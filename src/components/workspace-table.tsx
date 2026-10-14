import { EmptyState } from "@/components/ui";
export type Row = Record<string, unknown>;
export function readable(value: unknown): string { if (value === null || value === undefined) return "—"; if (typeof value === "boolean") return value ? "Active" : "Inactive"; if (Array.isArray(value)) return value.map(readable).join(", "); if (typeof value === "object") { const object = value as Row; if ("name" in object) return String(object.name); return JSON.stringify(object); } const text = String(value); return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text; }
export function WorkspaceTable({ rows, columns, emptyTitle, emptyText, caption = "Latest 50 records within your access scope" }: { rows: Row[]; columns: { key: string; label: string }[]; emptyTitle: string; emptyText: string; caption?: string }) {
  if (!rows.length) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return <div className="workspace-table-wrap" tabIndex={0} role="region" aria-label="Scrollable records table"><table><caption>{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? `${row.userId}-${row.teamId}-${row.campaignId}-${index}`)}>{columns.map(column => <td key={column.key}>{readable(row[column.key])}</td>)}</tr>)}</tbody></table></div>;
}
