import { uploadFile } from "@/lib/storage";

export const MAX_PLOT_COVER_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PLOT_COVER_MIME = /^image\/(png|jpeg|jpg|gif|webp)$/;

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "cover";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  return cleaned || "cover";
}

export async function uploadPlotCoverFile(f: File): Promise<string> {
  const fileMime = f.type || "application/octet-stream";
  if (f.size > MAX_PLOT_COVER_BYTES) {
    throw new Error(`File exceeds ${MAX_PLOT_COVER_BYTES} bytes limit`);
  }
  if (!ALLOWED_PLOT_COVER_MIME.test(fileMime)) {
    throw new Error(`Unsupported file type: ${fileMime}`);
  }
  const result = await uploadFile(
    f,
    `plot-cover-${sanitizeFilename(f.name)}`,
    fileMime,
  );
  return result.url;
}
