import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";
import { zipSync, strToU8, unzipSync } from "fflate";
import { parseImportFile } from "./import-file";
import { importColumns, inferMapping, mappingIssues, stableStringify } from "./import-contract";
import { parseImportMetrics } from "./import-validation";
import { csvDocument, spreadsheetResponse } from "./spreadsheet-export";
const columns = importColumns.map(c => c.key);
const row = { work_date: "2026-10-13", campaign_id: "campaign", dispatcher_id: "dispatcher", dispatcher_email: "", calls_made: "30", follow_ups_completed: "8", qualified_leads: "5", carriers_signed: "2", loads_booked: "1", dispatch_fees: "999999999999.99", refunds: "0.01", adjustments: "-0.01", currency: "USD", gross_freight_revenue: "5000.00", notes: "Two lines\nwith a comma, and a \"quote\"." };
const file = (values = row) => new TextEncoder().encode(csvDocument(columns, [values]));
describe("bounded spreadsheet parsing and mapping", () => {
  it("keeps exact decimal strings and CSV quoted multiline cells", async () => {
    const parsed = await parseImportFile(file(), "daily.csv");
    expect(parsed.rows).toHaveLength(1); expect(parsed.rows[0].cells[9]).toBe(row.dispatch_fees); expect(parsed.rows[0].cells[14]).toBe(row.notes);
    // Exports neutralize negative text values; raw imports use plain signed amounts.
    parsed.rows[0].cells[11] = "-0.01";
    const checked = parseImportMetrics(parsed.rows[0], inferMapping(parsed.headers), { id: "campaign", tracksLoads: true }, "dispatcher");
    expect(checked.errors).toEqual([]); expect(checked.normalized?.dispatchFees).toBe("999999999999.99");
  });
  it("uses documented XLSX numeric parsing without floating-point conversion", async () => {
    const data = [columns.map(value => ({ value, type: String })), columns.map(key => ({ value: row[key], type: String }))];
    const buffer = await writeExcelFile(data, { sheet: "Performance" }).toBuffer();
    const files = unzipSync(buffer); const key = "xl/worksheets/sheet1.xml";
    const xml = new TextDecoder().decode(files[key]);
    files[key] = strToU8(xml.replace(/<c r="J2"[^>]*>.*?<\/c>/, '<c r="J2"><v>999999999999.99</v></c>'));
    const parsed = await parseImportFile(zipSync(files), "daily.xlsx");
    expect(parsed.rows[0].cells[9]).toBe("999999999999.99"); expect(parsed.rows[0].cells[14]).toBe(row.notes);
  });
  it("reports formula rows, including a trailing cell with no cached value", async () => {
    const bytes = await writeExcelFile([columns.map(value => ({ value })), [{ value: "1+1", type: "Formula" }]], { sheet: "Performance" }).toBuffer();
    const result = await parseImportFile(bytes, "formula.xlsx");
    expect(result.rows[0].rowNumber).toBe(2); expect(result.rows[0].parseErrors[0].message).toContain("Formula");
  });
  it("accepts a header-only template workbook after literal data is added", async () => {
    const response = await spreadsheetResponse(columns, [], "xlsx", "performance-template", ["Instructions"]);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files)).toContain("xl/worksheets/sheet2.xml");
    const original = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
    files["xl/worksheets/sheet1.xml"] = strToU8(original.replace("</sheetData>", '<row r="2"><c r="A2" t="inlineStr"><is><t>2026-10-13</t></is></c></row></sheetData>'));
    const result = await parseImportFile(zipSync(files), "template.xlsx"); expect(result.rows[0].cells[0]).toBe("2026-10-13");
  });
  it("rejects malformed quoting, binary CSV, unsupported extensions and oversize uploads", async () => {
    for (const [bytes, name] of [[new TextEncoder().encode('a,b\n"unterminated'), "a.csv"], [new Uint8Array([0, 1, 2]), "a.csv"], [file(), "a.xls"], [new Uint8Array(2 * 1024 * 1024 + 1), "a.csv"]] as const) await expect(parseImportFile(bytes, name)).rejects.toThrow();
  });
  it("rejects too many rows, ambiguous headers and extra source columns", async () => {
    await expect(parseImportFile(new TextEncoder().encode("a\n" + "1\n".repeat(1001)), "many.csv")).rejects.toThrow("1,000");
    await expect(parseImportFile(new TextEncoder().encode("a,A\n1,2"), "duplicates.csv")).rejects.toThrow("unique");
    const parsed = await parseImportFile(new TextEncoder().encode("a\n1,2"), "extra.csv"); expect(parsed.rows[0].parseErrors[0].field).toBe("row");
  });
  it("rejects decompression bombs, external links, DTD entities and distant cell addresses", async () => {
    await expect(parseImportFile(zipSync({ "big.xml": new Uint8Array(8 * 1024 * 1024 + 1) }), "bomb.xlsx")).rejects.toThrow("8 MiB");
    await expect(parseImportFile(zipSync({ "xl/externalLinks/link.xml": strToU8("<root/>") }), "link.xlsx")).rejects.toThrow("external links");
    await expect(parseImportFile(zipSync({ "a.xml": strToU8('<!DOCTYPE root [<!ENTITY a "value">]><root>&a;</root>') }), "entity.xlsx")).rejects.toThrow("XML");
    const bytes = await writeExcelFile([[{ value: "work_date" }], [{ value: "2026-10-13" }]]).toBuffer(); const files = unzipSync(bytes);
    files["xl/worksheets/sheet1.xml"] = strToU8(new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]).replace('r="A2"', 'r="ZZ2"'));
    await expect(parseImportFile(zipSync(files), "distant.xlsx")).rejects.toThrow("32-column");
  });
  it("checks mapping uniqueness and missing identity without name matching", () => {
    const inferred = inferMapping(["Work Date", "Dispatcher Name", "callsMade"]); expect(inferred).toEqual({ work_date: 0, calls_made: 2 });
    expect(mappingIssues({ ...inferred, currency: 2 }, 3).some(e => e.message.includes("only one"))).toBe(true);
    expect(mappingIssues(inferred, 3).some(e => e.field === "dispatcher_id")).toBe(true);
  });
  it("canonicalizes JSON comparisons independently of PostgreSQL object-key order", () => { expect(stableStringify({ b: { d: 1, c: 2 }, a: [3] })).toBe(stableStringify({ a: [3], b: { c: 2, d: 1 } })); });
});
describe("strict imported daily values", () => {
  it("rejects malformed dates, missing counts, currency, ranges and money precision", () => {
    for (const [field, value] of [["work_date", "2026-02-30"], ["work_date", "0000-01-01"], ["currency", "XYZ"], ["calls_made", ""], ["calls_made", "-1"], ["qualified_leads", "1000001"], ["dispatch_fees", "1.005"], ["dispatch_fees", "1e2"], ["refunds", "-1"], ["gross_freight_revenue", "1,200"], ["campaign_id", "outside"]] as const) {
      const cells = columns.map(key => key === field ? value : row[key]);
      const result = parseImportMetrics({ rowNumber: 2, cells, parseErrors: [] }, inferMapping(columns), { id: "campaign", tracksLoads: true }, "dispatcher"); expect(result.errors.length).toBeGreaterThan(0); expect(result.normalized).toBeNull();
    }
  });
  it("requires explicit loads relevance and preserves blank optional freight revenue", () => {
    const cells = columns.map(key => ({ ...row, loads_booked: "", gross_freight_revenue: "" })[key]);
    const result = parseImportMetrics({ rowNumber: 2, cells, parseErrors: [] }, inferMapping(columns), { id: "campaign", tracksLoads: false }, "dispatcher");
    expect(result.errors).toEqual([]); expect(result.normalized?.loads).toBeNull(); expect(result.normalized?.grossRevenue).toBeNull();
  });
  it("gives human-readable errors tied to import fields", () => {
    const cells = columns.map(key => key === "calls_made" ? "bad" : row[key]);
    const result = parseImportMetrics({ rowNumber: 2, cells, parseErrors: [] }, inferMapping(columns), { id: "campaign", tracksLoads: true }, "dispatcher");
    expect(result.errors).toContainEqual({ field: "calls_made", message: "Enter a whole number from 0 to 1,000,000." });
  });
  it("neutralizes formula injection in CSV and writes literal XLSX string cells", async () => {
    const rows = ["=HYPERLINK(\"bad\")", "  +SUM(1,2)", "\t@cmd", "-1+2"].map(value => ({ notes: value }));
    const csv = csvDocument(["notes"], rows); expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain("'  +SUM");
    const r = await spreadsheetResponse(["notes"], rows, "xlsx", "safe"); const files = unzipSync(new Uint8Array(await r.arrayBuffer()));
    expect(new TextDecoder().decode(files["xl/worksheets/sheet1.xml"])).not.toMatch(/<f[\s>]/); const parsed = await readSheetForTest(files); expect(parsed).toContain("'=HYPERLINK");
  });
});
async function readSheetForTest(files: Record<string, Uint8Array>) { return Object.values(files).map(v => new TextDecoder().decode(v)).join("\n"); }
