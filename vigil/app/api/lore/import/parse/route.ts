import { PDFParse } from "pdf-parse";

import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";

export const runtime = "nodejs";

function stripBom(text: string) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

export async function POST(req: Request) {
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
  } catch {
    return Response.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const name = file.name || "upload";
  const lower = name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let text = "";
  if (lower.endsWith(".pdf")) {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const parsed = await parser.getText();
      await parser.destroy();
      text = typeof parsed.text === "string" ? parsed.text : "";
    } catch {
      return Response.json({ ok: false, error: "Could not parse PDF" }, { status: 400 });
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
    fileName: name,
    suggestedTitle: baseTitle,
    text: trimmed,
    charCount: trimmed.length,
  });
}
