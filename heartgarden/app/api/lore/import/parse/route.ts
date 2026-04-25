import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  type LoreImportUserContext,
  loreImportUserContextSchema,
} from "@/src/lib/lore-import-plan-types";

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
  if (globals.DOMMatrix && globals.ImageData && globals.Path2D) {
    return;
  }

  try {
    const canvas = await import("@napi-rs/canvas");
    // `@napi-rs/canvas`’s DOMMatrix is structurally enough for `pdfjs-dist` but not identical to
    // the lib.dom global type in TS (e.g. prototype method differences). Cast at the boundary.
    globals.DOMMatrix ??= canvas.DOMMatrix as unknown as NonNullable<
      typeof globalThis.DOMMatrix
    >;
    globals.ImageData ??= canvas.ImageData as unknown as NonNullable<
      typeof globalThis.ImageData
    >;
    globals.Path2D ??= canvas.Path2D as unknown as NonNullable<
      typeof globalThis.Path2D
    >;
  } catch (error) {
    console.warn(
      "[lore-import] @napi-rs/canvas unavailable; using PDF fallbacks",
      {
        attemptId,
        detail: error instanceof Error ? error.message : String(error),
      }
    );
  }

  globals.DOMMatrix ??= FallbackDOMMatrix as unknown as NonNullable<
    typeof globalThis.DOMMatrix
  >;
  globals.ImageData ??= FallbackImageData as unknown as NonNullable<
    typeof globalThis.ImageData
  >;
  globals.Path2D ??= FallbackPath2D as unknown as NonNullable<
    typeof globalThis.Path2D
  >;
}

function stripBom(text: string) {
  if (text.charCodeAt(0) === 0xfe_ff) {
    return text.slice(1);
  }
  return text;
}

function importAttemptId(req: Request): string {
  return req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
}

function appendCappedText(
  chunks: string[],
  chunk: string,
  charCount: number
): { charCount: number; truncated: boolean } {
  if (!chunk) {
    return { charCount, truncated: false };
  }
  if (charCount >= MAX_EXTRACTED_CHARS) {
    return { charCount, truncated: true };
  }
  const remaining = MAX_EXTRACTED_CHARS - charCount;
  const next = chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
  chunks.push(next);
  return {
    charCount: charCount + next.length,
    truncated: next.length < chunk.length,
  };
}

function parseTextLikeFile(buf: Buffer) {
  const decoded = stripBom(buf.toString("utf8"));
  // U+FFFD indicates byte sequences that are not valid UTF-8.
  const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
  if (
    replacementCount > 0 &&
    replacementCount / Math.max(decoded.length, 1) > 0.02
  ) {
    throw new Error("Text file is not valid UTF-8");
  }
  const chunks: string[] = [];
  const { charCount, truncated } = appendCappedText(chunks, decoded, 0);
  return {
    charCount,
    text: chunks.join(""),
    truncated,
  };
}

async function parseDocxText(buf: Buffer) {
  const mammoth = await import("mammoth");
  const parsed = await mammoth.extractRawText({ buffer: buf });
  const chunks: string[] = [];
  const { charCount, truncated } = appendCappedText(
    chunks,
    parsed.value ?? "",
    0
  );
  return {
    charCount,
    text: chunks.join(""),
    truncated,
  };
}

async function parsePdfText(
  buf: Buffer,
  attemptId: string
): Promise<{
  text: string;
  pageCount: number;
  parsedPages: number;
  failedPages: number;
  truncated: boolean;
}> {
  await ensurePdfRuntimeGlobals(attemptId);
  // @ts-expect-error pdfjs-dist does not publish worker-module typings.
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  // In Node, pdfjs always uses the fake worker path; pre-seed the worker handler to avoid
  // dynamic workerSrc resolution against server chunk paths in Vercel bundles.
  (globalThis as PdfRuntimeGlobals).pdfjsWorker =
    workerModule as PdfRuntimeGlobals["pdfjsWorker"];
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
            .map((item) =>
              "str" in item && typeof item.str === "string" ? item.str : ""
            )
            .filter(Boolean)
            .join(" ")
            .trim();
          if (pageText) {
            if (chunks.length > 0) {
              const spacing = appendCappedText(chunks, "\n\n", charCount);
              charCount = spacing.charCount;
              if (spacing.truncated) {
                break;
              }
            }
            const next = appendCappedText(chunks, pageText, charCount);
            charCount = next.charCount;
            if (next.truncated) {
              break;
            }
          }
          parsedPages += 1;
        } finally {
          page.cleanup();
        }
      } catch (error) {
        failedPages += 1;
        console.warn("[lore-import] parse pdf page failed", {
          attemptId,
          detail: error instanceof Error ? error.message : String(error),
          pageNum,
        });
        if (failedPages >= MAX_PDF_PAGE_FAILURES && parsedPages === 0) {
          throw new Error("PDF pages could not be parsed");
        }
      }
    }
    if (parsedPages === 0) {
      throw new Error("PDF did not contain readable text");
    }
    return {
      failedPages,
      pageCount: doc.numPages,
      parsedPages,
      text: chunks.join(""),
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
  if (denied) {
    return denied;
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return Response.json(
      { error: 'Expected multipart/form-data with field "file"', ok: false },
      { status: 400 }
    );
  }

  // Reject obviously-too-large uploads before buffering them. The body still includes
  // multipart framing so the actual file may be a touch smaller than `Content-Length`,
  // but rejecting at the cap removes the worst case where we allocate hundreds of MB
  // before the post-decode size check fires. (`REVIEW_2026-04-25_1835` L1.)
  const contentLengthRaw = req.headers.get("content-length");
  if (contentLengthRaw) {
    const declaredBytes = Number(contentLengthRaw);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          detail: `Max upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
          error: "File too large",
          ok: false,
        },
        { status: 413 }
      );
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (error) {
    console.error("[lore-import] parse formData failed", {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Invalid form data", ok: false },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file && file instanceof File)) {
    return Response.json({ error: "Missing file", ok: false }, { status: 400 });
  }
  let parsedContext: LoreImportUserContext | undefined;
  let contextWarning: { code: string; message: string } | undefined;
  const contextRaw = form.get("context");
  if (typeof contextRaw === "string" && contextRaw.trim().length > 0) {
    try {
      const contextJson = JSON.parse(contextRaw);
      const contextParsed = loreImportUserContextSchema.safeParse(contextJson);
      if (contextParsed.success) {
        parsedContext = contextParsed.data;
      } else {
        contextWarning = {
          code: "user_context_invalid",
          message:
            "Multipart `context` was present but did not match the lore import user-context schema; default import settings apply.",
        };
      }
    } catch {
      contextWarning = {
        code: "user_context_not_json",
        message:
          "Multipart `context` was present but was not valid JSON; default import settings apply.",
      };
    }
  }

  const name = file.name || "upload";
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) {
    return Response.json(
      {
        detail: `Max upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
        error: "File too large",
        ok: false,
      },
      { status: 413 }
    );
  }
  console.info("[lore-import] parse request", {
    attemptId,
    contentType: file.type || null,
    fileBytes: buf.length,
    fileName: name,
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
        failedPages: parsed.failedPages,
        pageCount: parsed.pageCount,
        parsedPages: parsed.parsedPages,
      };
      console.info("[lore-import] parse pdf success", {
        attemptId,
        failedPages: parsed.failedPages,
        fileName: name,
        pageCount: parsed.pageCount,
        parsedPages: parsed.parsedPages,
        truncated: parsed.truncated,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[lore-import] parse pdf failed", {
        attemptId,
        detail,
        fileName: name,
      });
      return Response.json(
        { detail, error: "Could not parse PDF", ok: false },
        { status: 400 }
      );
    }
  } else if (lower.endsWith(".docx")) {
    try {
      const parsed = await parseDocxText(buf);
      text = parsed.text;
      truncated = parsed.truncated;
      console.info("[lore-import] parse docx success", {
        attemptId,
        fileName: name,
        truncated: parsed.truncated,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return Response.json(
        { detail, error: "Could not parse DOCX file", ok: false },
        { status: 400 }
      );
    }
  } else if (
    lower.endsWith(".md") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".markdown")
  ) {
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
        { detail, error: "Could not parse text file", ok: false },
        { status: 400 }
      );
    }
  } else {
    return Response.json(
      {
        error: "Unsupported type. Use .pdf, .docx, .md, or .txt",
        ok: false,
      },
      { status: 400 }
    );
  }

  const trimmed = text.replace(/\0/g, "").trim();
  const baseTitle = name.replace(/\.[^.]+$/, "").trim() || "Import";

  return Response.json({
    attemptId,
    charCount: trimmed.length,
    fileName: name,
    ok: true,
    suggestedTitle: baseTitle,
    text: trimmed,
    truncated,
    ...(parsedContext ? { context: parsedContext } : {}),
    ...(contextWarning ? { contextWarning } : {}),
    ...(meta ? { meta } : {}),
  });
}
