/**
 * Universal RFC-4180 compliant CSV export utility
 * Supports quote escaping, multiline strings, commas, UTF-8 BOM, and browser download triggers.
 */

export function formatCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }
  const str = String(val);
  // If string contains quotes, commas, or linebreaks, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsvContent(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const headerLine = headers.map(formatCsvValue).join(",");
  const dataLines = rows.map((row) => row.map(formatCsvValue).join(","));
  // Prepend UTF-8 BOM (\uFEFF) so Excel and spreadsheet applications correctly recognize UTF-8 characters
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): void {
  const content = generateCsvContent(headers, rows);
  downloadCsv(filename, content);
}
