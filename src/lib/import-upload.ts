import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizedOperation } from "@/lib/authorized-operation";
import { HttpError } from "@/lib/http";
import { consumeLimit } from "@/lib/throttle";
import { importLimits } from "@/lib/import-contract";
import { parseImportFile, ImportFileError } from "@/lib/import-file";
import { stagePerformanceImport } from "@/lib/performance-import";
const formInput = z.object({ campaignId: z.string().trim().min(1).max(128), requestKey: z.uuid() }).strict();
export async function uploadPerformanceImport(request: Request) {
  const actorId = await authorizedOperation(request.headers, false, async (_tx, actor) => actor.id);
  const budget = await consumeLimit(`performance-import:${actorId}`, { max: 20, window: 600 });
  if (!budget.allowed) throw new HttpError(429, `Upload limit reached. Retry in ${budget.retryAfter} seconds.`);
  const type = request.headers.get("content-type");
  if (!type?.toLowerCase().startsWith("multipart/form-data")) throw new HttpError(415, "Upload the file using multipart/form-data.");
  const maxBody = importLimits.bytes + 16384;
  if (Number(request.headers.get("content-length")) > maxBody) throw new HttpError(413, "Upload exceeds the 2 MiB file limit.");
  if (!request.body) throw new HttpError(400, "A file is required.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBody) { await reader.cancel(); throw new HttpError(413, "Upload exceeds the 2 MiB file limit."); } chunks.push(value); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData(); } catch { throw new HttpError(400, "Invalid multipart upload."); }
  if ([...form.keys()].length !== 3 || ["file", "campaignId", "requestKey"].some(key => form.getAll(key).length !== 1)) throw new HttpError(400, "Supply exactly one file, campaign ID and upload request key.");
  const input = formInput.parse({ campaignId: form.get("campaignId"), requestKey: form.get("requestKey") });
  const file = form.get("file"); if (!(file instanceof File) || !file.size) throw new HttpError(400, "Choose a nonempty file.");
  if (file.size > importLimits.bytes) throw new HttpError(413, "Choose a file up to 2 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try { parsed = await parseImportFile(bytes, file.name); }
  catch (error) { throw new HttpError(400, error instanceof ImportFileError ? error.message : "This file could not be parsed safely. Check the CSV quoting or XLSX structure and use the supplied template."); }
  const filename = file.name.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001F]/g, "").slice(0, 160);
  return stagePerformanceImport(request.headers, { ...input, contentHash: createHash("sha256").update(bytes).digest("hex"), filename, ...parsed });
}
