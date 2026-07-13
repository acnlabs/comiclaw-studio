// 存储驱动统一抽象
// 切换方式: 设置环境变量 STORAGE_PROVIDER=blob|oss|cos
// 默认 blob (Vercel Blob)
//
// OSS (阿里云):
//   STORAGE_PROVIDER=oss
//   OSS_REGION=oss-cn-hangzhou
//   OSS_BUCKET=your-bucket
//   OSS_ACCESS_KEY_ID=xxx
//   OSS_ACCESS_KEY_SECRET=xxx
//   OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com  (可选,自定义域名)
//
// COS (腾讯云):
//   STORAGE_PROVIDER=cos
//   COS_REGION=ap-guangzhou
//   COS_BUCKET=your-bucket-1234567890
//   COS_SECRET_ID=xxx
//   COS_SECRET_KEY=xxx
//   COS_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com  (可选)

export interface UploadResult {
  url: string;
}

export async function uploadFile(
  body: Blob | Buffer | ArrayBuffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "blob";

  if (provider === "oss" || provider === "cos") {
    return uploadS3Compatible(body, filename, contentType, provider);
  }

  return uploadBlob(body, filename, contentType);
}

// ---------- Vercel Blob ----------

async function uploadBlob(
  body: Blob | Buffer | ArrayBuffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const { put } = await import("@vercel/blob");
  const blob = await put(`studio/${Date.now()}-${filename}`, body, {
    access: "public",
    contentType,
  });
  return { url: blob.url };
}

// ---------- S3 兼容(OSS / COS) ----------

async function uploadS3Compatible(
  body: Blob | Buffer | ArrayBuffer,
  filename: string,
  contentType: string,
  provider: string
): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  let endpoint: string;
  let bucket: string;
  let accessKeyId: string;
  let secretAccessKey: string;
  let region: string;
  let publicBase: string;

  if (provider === "oss") {
    region = process.env.OSS_REGION ?? "oss-cn-hangzhou";
    bucket = process.env.OSS_BUCKET ?? "";
    accessKeyId = process.env.OSS_ACCESS_KEY_ID ?? "";
    secretAccessKey = process.env.OSS_ACCESS_KEY_SECRET ?? "";
    endpoint = process.env.OSS_ENDPOINT ?? `https://${region}.aliyuncs.com`;
    publicBase = `https://${bucket}.${region}.aliyuncs.com`;
  } else {
    // COS
    region = process.env.COS_REGION ?? "ap-guangzhou";
    bucket = process.env.COS_BUCKET ?? "";
    accessKeyId = process.env.COS_SECRET_ID ?? "";
    secretAccessKey = process.env.COS_SECRET_KEY ?? "";
    endpoint = process.env.COS_ENDPOINT ?? `https://cos.${region}.myqcloud.com`;
    publicBase = `https://${bucket}.cos.${region}.myqcloud.com`;
  }

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(`${provider.toUpperCase()} credentials not configured`);
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const key = `studio/${Date.now()}-${filename}`;
  const arrayBuf = body instanceof Blob ? await body.arrayBuffer() : body;
  const buf = Buffer.from(new Uint8Array(arrayBuf instanceof ArrayBuffer ? arrayBuf : arrayBuf));

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    })
  );

  const customBase = process.env.OSS_ENDPOINT || process.env.COS_ENDPOINT;
  const url = customBase
    ? `${customBase.replace(/\/$/, "")}/${key}`
    : `${publicBase}/${key}`;

  return { url };
}
