import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024; // 80 MB
const MAX_EXTRACTED_CHARS = 2_000_000;
const MAX_PDF_PAGE_FAILURES = 20;

type PdfRuntimeGlobals = typeof globalThis & {
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
  pdfjsWorker?: {
    WorkerMessageHandler?: unknown;
  };
};

class FallbackDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;
  isIdentity = true;

  constructor(init?: number[] | ArrayLike<number>) {
    const values = Array.from(init ?? []);
    if (values.length >= 6) {
      this.a = values[0] ?? this.a;
      this.b = values[1] ?? this.b;
      this.c = values[2] ?? this.c;
      this.d = values[3] ?? this.d;
      this.e = values[4] ?? this.e;
      this.f = values[5] ?? this.f;
      this.m11 = this.a;
      this.m12 = this.b;
      this.m21 = this.c;
      this.m22 = this.d;
      this.m41 = this.e;
      this.m42 = this.f;
      this.isIdentity = false;
    }
  }

  preMultiplySelf() {
    return this;
  }

  multiplySelf() {
    return this;
  }

  translate(tx = 0, ty = 0) {
    this.e += tx;
    this.f += ty;
    this.m41 = this.e;
    this.m42 = this.f;
    this.isIdentity = false;
    return this;
  }

  scale(scaleX = 1, scaleY = scaleX) {
    this.a *= scaleX;
    this.d *= scaleY;
    this.m11 = this.a;
    this.m22 = this.d;
    this.isIdentity = false;
    return this;
  }

  invertSelf() {
    return this;
  }
}

class FallbackImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width = 1, height = 1) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

class FallbackPath2D {
  addPath() {}
}

async function ensurePdfRuntimeGlobals(attemptId: string) {
  const globals = globalThis as PdfRuntimeGlobals;
  if (globals.DOMMatrix && globals.ImageData && globals.Path2D) return;

  try {
    const canvas = await import("@napi-rs/canvas");
    // `@napi-rs/canvas`’s DOMMatrix is structurally enough for `pdfjs-dist` but not identical to
    // the lib.dom global type in TS (e.g. prototype method differences). Cast at the boundary.
    globals.DOMMatrix ??= canvas.DOMMatrix as unknown as NonNullable<typeof globalThis.DOMMatrix>;
    globals.ImageData ??= canvas.ImageData as unknown as NonNullable<typeof globalThis.ImageData>;
    globals.Path2D ??= canvas.Path2D as unknown as NonNullable<typeof globalThis.Path2D>;
  } catch (error) {
    console.warn("[lore-import] @napi-rs/canvas unavailable; using PDF fallbacks", {
      attemptId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  globals.DOMMatrix ??= FallbackDOMMatrix as unknown as NonNullable<typeof globalThis.DOMMatrix>;
  globals.ImageData ??= FallbackImageData as unknown as NonNullable<typeof globalThis.ImageData>;
  globals.Path2D ??= FallbackPath2D as unknown as NonNullable<typeof globalThis.Path2D>;
}

function stripBom(text: string) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function importAttemptId(req: Request): string {
  return req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
}

function appendCappedText(
  chunks: string[],
  chunk: string,
  charCount: number,
): { charCount: number; truncated: boolean } {
  if (!chunk) return { charCount, truncated: false };
  if (charCount >= MAX_EXTRACTED_CHARS) return { charCount, truncated: true };
  const remaining = MAX_EXTRACTED_CHARS - charCount;
  const next = chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
  chunks.push(next);
  return { charCount: charCount + next.length, truncated: next.length < chunk.length };
}

function parseTextLikeFile(buf: Buffer) {
  const decoded = stripBom(buf.toString("utf8"));
  // U+FFFD indicates byte sequences that are not valid UTF-8.
  const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
  if (replacementCount > 0 && replacementCount / Math.max(decoded.length, 1) > 0.02) {
    throw new Error("Text file is not valid UTF-8");
  }
  const chunks: string[] = [];
  const { charCount, truncated } = appendCappedText(chunks, decoded, 0);
  return {
    text: chunks.join(""),
    charCount,
    truncated,
  };
}

async function parsePdfText(
  buf: Buffer,
  attemptId: string,
): Promise<{ text: string; pageCount: number; parsedPages: number; failedPages: number; truncated: boolean }> {
  await ensurePdfRuntimeGlobals(attemptId);
  // @ts-expect-error pdfjs-dist does not publish worker-module typings.
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  // In Node, pdfjs always uses the fake worker path; pre-seed the worker handler to avoid
  // dynamic workerSrc resolution against server chunk paths in Vercel bundles.
  (globalThis as PdfRuntimeGlobals).pdfjsWorker = workerModule as PdfRuntimeGlobals["pdfjsWorker"];
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buf),
  });

  const doc = await loadingTask.promise;
  try {
    const chunks: string[] = [];
    let charCount = 0;
    let failedPages = 0;
    let parsedPages = 0;
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        try {
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
            .filter(Boolean)
            .join(" ")
            .trim();
          if (pageText) {
            if (chunks.length > 0) {
              const spacing = appendCappedText(chunks, "\n\n", charCount);
              charCount = spacing.charCount;
              if (spacing.truncated) break;
            }
            const next = appendCappedText(chunks, pageText, charCount);
            charCount = next.charCount;
            if (next.truncated) break;
          }
          parsedPages += 1;
        } finally {
          page.cleanup();
        }
      } catch (error) {
        failedPages += 1;
        console.warn("[lore-import] parse pdf page failed", {
          attemptId,
          pageNum,
          detail: error instanceof Error ? error.message : String(error),
        });
        if (failedPages >= MAX_PDF_PAGE_FAILURES && parsedPages === 0) {
          throw new Error("PDF pages could not be parsed");
        }
      }
    }
    if (parsedPages === 0) throw new Error("PDF did not contain readable text");
    return {
      text: chunks.join(""),
      pageCount: doc.numPages,
      parsedPages,
      failedPages,
      truncated: charCount >= MAX_EXTRACTED_CHARS,
    };
  } finally {
    await doc.destroy();
  }
}

export async function POST(req: Request) {
  const attemptId = importAttemptId(req);
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return Response.json(
      { ok: false, error: "Expected multipart/form-data with field \"file\"" },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (error) {
    console.error("[lore-import] parse formData failed", {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const name = file.name || "upload";
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) {
    return Response.json(
      {
        ok: false,
        error: "File too large",
        detail: `Max upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      },
      { status: 413 },
    );
  }
  console.info("[lore-import] parse request", {
    attemptId,
    fileName: name,
    contentType: file.type || null,
    fileBytes: buf.length,
  });

  let text = "";
  let truncated = false;
  let meta: Record<string, unknown> | null = null;
  if (lower.endsWith(".pdf")) {
    try {
      const parsed = await parsePdfText(buf, attemptId);
      text = parsed.text;
      truncated = parsed.truncated;
      meta = {
        pageCount: parsed.pageCount,
        parsedPages: parsed.parsedPages,
        failedPages: parsed.failedPages,
      };
      console.info("[lore-import] parse pdf success", {
        attemptId,
        fileName: name,
        pageCount: parsed.pageCount,
        parsedPages: parsed.parsedPages,
        failedPages: parsed.failedPages,
        truncated: parsed.truncated,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[lore-import] parse pdf failed", { attemptId, fileName: name, detail });
      return Response.json(
        { ok: false, error: "Could not parse PDF", detail },
        { status: 400 },
      );
    }
  } else if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".markdown")) {
    try {
      const parsed = parseTextLikeFile(buf);
      text = parsed.text;
      truncated = parsed.truncated;
      console.info("[lore-import] parse text success", {
        attemptId,
        fileName: name,
        truncated: parsed.truncated,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return Response.json(
        { ok: false, error: "Could not parse text file", detail },
        { status: 400 },
      );
    }
  } else {
    return Response.json(
      {
        ok: false,
        error: "Unsupported type. Use .pdf, .md, or .txt",
      },
      { status: 400 },
    );
  }

  const trimmed = text.replace(/\0/g, "").trim();
  const baseTitle = name.replace(/\.[^.]+$/, "").trim() || "Import";

  return Response.json({
    ok: true,
    attemptId,
    fileName: name,
    suggestedTitle: baseTitle,
    text: trimmed,
    charCount: trimmed.length,
    truncated,
    ...(meta ? { meta } : {}),
  });
}
