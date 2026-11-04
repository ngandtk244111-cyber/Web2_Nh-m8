import * as XLSX from 'xlsx';

export type ExportRow = (string | number | null | undefined)[];

const stamp = () => new Date().toISOString().slice(0, 10);

/** Ô bắt đầu bằng = + - @ được chèn dấu ' để Excel không chạy như công thức. */
function safeCell(value: string | number | null | undefined): string | number {
  if (typeof value === 'number') return value;
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

/** Xuất Excel (.xlsx) — như dashboard-export.service của Vita. */
export function exportXlsx(name: string, headers: string[], rows: ExportRow[], sheetName = 'Dữ liệu'): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => r.map(safeCell))]);
  sheet['!cols'] = headers.map((h, i) => ({
    wch: Math.min(48, Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)) + 2),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, `${name}_${stamp()}.xlsx`);
}

/** CSV kèm BOM để Excel đọc đúng tiếng Việt. */
export function exportCsv(name: string, headers: string[], rows: ExportRow[]): void {
  const cell = (value: string | number | null | undefined) => {
    const v = safeCell(value);
    return typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`;
  };
  const csv = [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}_${stamp()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** In một khối HTML trong cửa sổ riêng (phiếu giao hàng, hoá đơn). */
export function printHtml(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=820,height=960');
  if (!win) return;
  win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:'Inter',system-ui,sans-serif;color:#1F1712;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px;color:#A3152D;text-transform:uppercase}
  h2{font-size:14px;margin:18px 0 6px;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #E3D9C8;padding:6px 8px;text-align:left}
  th{background:#F7F2E9}
  .right{text-align:right}.muted{color:#7A6F67}.total{font-size:15px;font-weight:700}
  .row{display:flex;justify-content:space-between;gap:24px}
</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
