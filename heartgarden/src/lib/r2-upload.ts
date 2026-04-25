import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2Env {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  /** Public origin for GET (no trailing slash), e.g. https://pub-xxxx.r2.dev */
  publicBaseUrl: string;
  secretAccessKey: string;
}

export function readR2Env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_BUCKET_NAME?.trim() ?? "";
  const publicBaseUrl =
    process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "").trim() ?? "";
  if (
    !(accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl)
  ) {
    return null;
  }
  return {
    accessKeyId,
    accountId,
    bucket,
    publicBaseUrl,
    secretAccessKey,
  };
}

function safeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return base || "image";
}

/** Presigned PUT for direct browser upload. */
export async function presignImagePut(
  env: R2Env,
  opts: {
    contentType: string;
    filename?: string;
    spaceId?: string;
    expiresSec?: number;
  }
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const id = crypto.randomUUID();
  const seg = opts.spaceId ?? "uploads";
  const name = safeFilename(opts.filename ?? "image");
  const key = `heartgarden/${seg}/${id}-${name}`;

  const client = new S3Client({
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });

  const command = new PutObjectCommand({
    Bucket: env.bucket,
    ContentType: opts.contentType,
    Key: key,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: opts.expiresSec ?? 900,
  });

  const publicUrl = `${env.publicBaseUrl}/${key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;

  return { key, publicUrl, uploadUrl };
}
