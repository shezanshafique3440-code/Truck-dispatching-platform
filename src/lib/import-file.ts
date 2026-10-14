import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import { unzipSync, zipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { posix } from "node:path";
import { importLimits, type RawImportRow, type ImportIssue } from "@/lib/import-contract";
export class ImportFileError extends Error {}
type Xml = Record<string, unknown>;
const object = (v: unknown): Xml => v && typeof v === "object" ? v as Xml : {};
const array = (v: unknown): unknown[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
function parseXml(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new ImportFileError("The workbook contains invalid or unsupported XML.");
  return object(new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, removeNSPrefix: true }).parse(text));
}
function columnNumber(reference: string) { return [...reference].reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0); }
function finish(data: string[][], errors: Map<number, ImportIssue[]>) {
  if (!data.length || !data[0].length || data[0].length > importLimits.columns) throw new ImportFileError("Use a header row and at most 32 columns.");
  const headers = data[0].map(v => v.trim());
  if (headers.some(v => !v || v.length > 120) || new Set(headers.map(v => v.toLowerCase())).size !== headers.length) throw new ImportFileError("Headers must be nonempty, unique and at most 120 characters.");
  const rows: RawImportRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const cells = data[i]; if (cells.every(v => !v.trim()) && !errors.has(i + 1)) continue;
    const parseErrors = [...(errors.get(i + 1) ?? [])];
    if (cells.length > headers.length || cells.some(v => v.length > 10000)) parseErrors.push({ field: "row", message: "Row has extra columns or a cell over 10,000 characters." });
    rows.push({ rowNumber: i + 1, cells: cells.slice(0, importLimits.columns), parseErrors });
  }
  if (data.length > importLimits.rows + 1 || rows.length > importLimits.rows) throw new ImportFileError("Use at most 1,000 data rows per file.");
  if (!rows.length) throw new ImportFileError("Add at least one data row below the template headers.");
  return { headers, rows };
}
export async function parseImportFile(bytes: Uint8Array, filename: string) {
  if (!bytes.byteLength || bytes.byteLength > importLimits.bytes) throw new ImportFileError("Choose a nonempty CSV or XLSX file up to 2 MiB.");
  if (/\.csv$/i.test(filename)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new ImportFileError("CSV must be UTF-8 text without binary control characters.");
    let count = 0;
    const data = parse(text, { bom: true, cast: false, relax_column_count: true, skip_empty_lines: false, max_record_size: 64000, on_record: (row: string[]) => { if (++count > 1001) throw new ImportFileError("Use at most 1,000 data rows per file."); return row; } }) as string[][];
    // A conventional final newline produces no extra data row in csv-parse.
    return { ...finish(data, new Map()), fileType: "CSV" as const };
  }
  if (!/\.xlsx$/i.test(filename) || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ImportFileError("Only UTF-8 .csv and unencrypted .xlsx files are supported; .xls/.xlsm are not accepted.");
  let expanded = 0; let entries = 0; const names = new Set<string>();
  const files = unzipSync(bytes, { filter: file => {
    if (++entries > importLimits.archiveEntries || file.name.includes("..") || file.name.startsWith("/") || names.has(file.name)) throw new ImportFileError("The workbook archive has unsupported entries.");
    names.add(file.name); expanded += file.originalSize;
    if (expanded > importLimits.expandedBytes || !Number.isSafeInteger(file.originalSize)) throw new ImportFileError("The workbook expands beyond the 8 MiB limit.");
    if (/vbaProject|externalLinks|embeddings|connections/i.test(file.name)) throw new ImportFileError("Macros, external links and embedded objects are unsupported.");
    return !file.name.endsWith("/");
  } });
  const xml = new Map<string, Xml>();
  for (const [name, data] of Object.entries(files)) if (/\.(xml|rels)$/i.test(name)) xml.set(name, parseXml(data));
  const content = new TextDecoder().decode(files["[Content_Types].xml"] ?? new Uint8Array());
  if (/macroEnabled/i.test(content)) throw new ImportFileError("Macro-enabled workbooks are not accepted.");
  const workbook = object(xml.get("xl/workbook.xml")?.workbook);
  const sheets = array(object(workbook.sheets).sheet).map(object);
  const chosen = sheets.find(s => s["@_name"] === "Performance") ?? (sheets.length === 1 ? sheets[0] : undefined);
  if (!chosen) throw new ImportFileError("Use one worksheet, or name the intended data worksheet Performance.");
  const relationships = array(object(xml.get("xl/_rels/workbook.xml.rels")?.Relationships).Relationship).map(object);
  if (relationships.some(r => r["@_TargetMode"] === "External")) throw new ImportFileError("External workbook relationships are unsupported.");
  const relation = relationships.find(r => r["@_Id"] === chosen["@_id"]);
  const relationshipTarget = String(relation?.["@_Target"] ?? "");
  const target = relationshipTarget.startsWith("/") ? posix.normalize(relationshipTarget).slice(1) : posix.normalize(posix.join("xl", relationshipTarget));
  if (!target.startsWith("xl/worksheets/")) throw new ImportFileError("The data worksheet could not be resolved.");
  const worksheet = object(xml.get(target)?.worksheet);
  const errors = new Map<number, ImportIssue[]>();
  const worksheetRows = array(object(worksheet.sheetData).row);
  const seenRows = new Set<number>(); const seenCells = new Set<string>();
  for (const value of worksheetRows) {
    const row = object(value); const rowNumber = Number(row["@_r"]);
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 1001 || seenRows.has(rowNumber)) throw new ImportFileError("Worksheet row addresses must be unique and within rows 1–1,001.");
    seenRows.add(rowNumber);
    for (const cellValue of array(row.c)) {
      const cell = object(cellValue); const ref = String(cell["@_r"] ?? ""); const match = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!match || Number(match[2]) !== rowNumber || columnNumber(match[1]) > 32 || seenCells.has(ref)) throw new ImportFileError("Worksheet cell addresses must be unique and within the 32-column limit.");
      seenCells.add(ref);
      if ("f" in cell || cell["@_t"] === "e") {
        const issues = errors.get(rowNumber) ?? [];
        issues.push({ field: ref, message: "Formula and spreadsheet-error cells are unsupported. Replace them with verified literal values." }); errors.set(rowNumber, issues);
      }
    }
  }
  if (!seenCells.has("A1") || errors.has(1)) throw new ImportFileError("Start literal column headers in cell A1.");
  // Ignore a malicious/stale dimension hint; the reader computes actual cell bounds.
  // The maintained reader never evaluates formulas; formula rows are invalid even with cached results.
  const safeZip = zipSync(files, { level: 0 });
  const data = await readSheet(Buffer.from(safeZip), String(chosen["@_name"]), { trim: false, parseNumber: value => value });
  const strings = data.map(row => row.map(value => {
    if (value === null) return "";
    if (value instanceof Date) return value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds() || value.getUTCMilliseconds() ? "INVALID_DATE_TIME" : value.toISOString().slice(0, 10);
    return String(value);
  }));
  while (strings.length < Math.max(...seenRows)) strings.push([]);
  return { ...finish(strings, errors), fileType: "XLSX" as const };
}
