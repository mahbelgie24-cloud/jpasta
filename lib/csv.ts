/**
 * CSV serialization with two non-negotiables:
 *  1. Every cell is quoted and internal quotes are doubled (RFC 4180).
 *  2. Cells that begin with a formula character are prefixed with an
 *     apostrophe — Excel/Sheets otherwise execute `=HYPERLINK(...)` from a
 *     customer-provided name. This is CSV injection defence, not cosmetics.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Excel on Windows needs a UTF-8 BOM to render Arabic correctly. */
export function toCsvWithBom(rows: unknown[][]): string {
  return `\uFEFF${toCsv(rows)}`;
}
