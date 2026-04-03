import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public origin for GET (no trailing slash), e.g. https://pub-xxxx.r2.dev */
  publicBaseUrl: string;
};

export function readR2Env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_BUCKET_NAME?.trim() ?? "";
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "").trim() ?? "";
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
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
  },
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const id = crypto.randomUUID();
  const seg = opts.spaceId ?? "uploads";
  const name = safeFilename(opts.filename ?? "image");
  const key = `vigil/${seg}/${id}-${name}`;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.bucket,
    Key: key,
    ContentType: opts.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: opts.expiresSec ?? 900,
  });

  const publicUrl = `${env.publicBaseUrl}/${key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;

  return { uploadUrl, publicUrl, key };
}
