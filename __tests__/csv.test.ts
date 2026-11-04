import { describe, expect, it } from "vitest";
import { csvCell, toCsv, toCsvWithBom } from "@/lib/csv";

describe("CSV serialization", () => {
  it("quotes cells and escapes embedded quotes", () => {
    expect(csvCell('زبون "خاص"')).toBe('"زبون ""خاص"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(20)).toBe('"20"');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      '"\'=HYPERLINK(""http://evil"")"',
    );
    expect(csvCell("+970599000000")).toBe('"\'+970599000000"');
    expect(csvCell("-1")).toBe('"\'-1"');
    expect(csvCell("@cmd")).toBe('"\'@cmd"');
    expect(csvCell(" =1+1")).toBe('"\' =1+1"');
    expect(csvCell("\t=1+1")).toBe('"\'\t=1+1"');
    expect(csvCell("\r=1+1")).toBe('"\'\r=1+1"');
    expect(csvCell("\n=1+1")).toBe('"\'\n=1+1"');
  });

  it("joins rows with CRLF", () => {
    expect(
      toCsv([
        ["a", 1],
        ["b", 2],
      ]),
    ).toBe('"a","1"\r\n"b","2"');
  });

  it("prefixes a UTF-8 BOM for Excel Arabic", () => {
    expect(toCsvWithBom([["طلب"]])).toBe('\uFEFF"طلب"');
  });
});
