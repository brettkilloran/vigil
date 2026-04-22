import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";

export const runtime = "nodejs";

type PdfRuntimeGlobals = typeof globalThis & {
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
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
    globals.DOMMatrix ??= canvas.DOMMatrix;
    globals.ImageData ??= canvas.ImageData;
    globals.Path2D ??= canvas.Path2D;
  } catch (error) {
    console.warn("[lore-import] @napi-rs/canvas unavailable; using PDF fallbacks", {
      attemptId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  globals.DOMMatrix ??= FallbackDOMMatrix;
  globals.ImageData ??= FallbackImageData;
  globals.Path2D ??= FallbackPath2D;
}

function stripBom(text: string) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function importAttemptId(req: Request): string {
  return req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
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
  console.info("[lore-import] parse request", {
    attemptId,
    fileName: name,
    contentType: file.type || null,
    fileBytes: buf.length,
  });

  let text = "";
  if (lower.endsWith(".pdf")) {
    try {
      await ensurePdfRuntimeGlobals(attemptId);
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const parsed = await parser.getText();
        text = typeof parsed.text === "string" ? parsed.text : "";
      } finally {
        await parser.destroy();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[lore-import] parse pdf failed", { attemptId, fileName: name, detail });
      return Response.json(
        { ok: false, error: "Could not parse PDF", detail },
        { status: 400 },
      );
    }
  } else if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".markdown")) {
    text = stripBom(buf.toString("utf8"));
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
  });
}
