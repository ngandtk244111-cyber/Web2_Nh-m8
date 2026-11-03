import * as XLSX from 'xlsx';
import { Product } from '../../core/models/product.model';
import { slugify } from '../../shared/utils/order-labels';
import { PRODUCT_BADGE_OPTIONS, PRODUCT_CATEGORY_OPTIONS } from './product-options';

export type ImportColumn = 'name' | 'slug' | 'category' | 'productionType' | 'customizable' | 'basePrice' | 'originalPrice'
  | 'inStock' | 'badge' | 'dimensions' | 'materialInfo' | 'description' | 'story' | 'image1' | 'image2';

/** Giá trị thô của 1 dòng (giữ dạng chữ như trong Excel để sửa lại được), kèm kết quả kiểm tra. */
export type ImportValues = Record<ImportColumn, string>;

export interface ImportRow {
  line: number;
  values: ImportValues;
  payload: Omit<Product, 'id'>;
  errors: string[];
}

/** Cột của file mẫu — tiêu đề có * là bắt buộc. Khi đọc, so tiêu đề không phân biệt hoa thường và bỏ dấu *. */
const COLUMNS: { key: ImportColumn; header: string; example: string | number }[] = [
  { key: 'name', header: 'Tên sản phẩm *', example: 'Bình Hoa Gốm Men Rạn' },
  { key: 'slug', header: 'Slug', example: '' },
  { key: 'category', header: 'Danh mục *', example: 'Bình Hoa & Lọ Decor' },
  { key: 'productionType', header: 'Loại sản xuất', example: 'Hàng có sẵn' },
  { key: 'customizable', header: 'Cho tuỳ biến', example: 'Không' },
  { key: 'basePrice', header: 'Giá bán *', example: 450000 },
  { key: 'originalPrice', header: 'Giá gốc', example: 520000 },
  { key: 'inStock', header: 'Tồn kho', example: 30 },
  { key: 'badge', header: 'Nhãn', example: 'Mới' },
  { key: 'dimensions', header: 'Kích thước', example: '20 x 20 x 35 cm' },
  { key: 'materialInfo', header: 'Chất liệu', example: 'Gốm sứ Bát Tràng' },
  { key: 'description', header: 'Mô tả', example: 'Bình hoa men rạn thủ công.' },
  { key: 'story', header: 'Câu chuyện', example: '' },
  { key: 'image1', header: 'Ảnh chính (URL) *', example: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=800' },
  { key: 'image2', header: 'Ảnh phụ (URL)', example: '' },
];

export const PRODUCTION_TYPE_TEXT = { READY_STOCK: 'Hàng có sẵn', PRINT_ON_DEMAND: 'In 3D theo yêu cầu' } as const;

const normalize = (text: unknown) => String(text ?? '').replace(/\*/g, '').trim().toLowerCase();
const isUrl = (text: string) => /^(https?:\/\/|\/)/.test(text);

/** Nhận số dạng 450000, "450.000", "450,000 đ". Ô trống → null. */
function toNumber(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

export function downloadImportTemplate(): void {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([COLUMNS.map(c => c.header), COLUMNS.map(c => c.example)]);
  sheet['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.header.length, String(c.example).length, 12) + 2 }));
  XLSX.utils.book_append_sheet(book, sheet, 'Sản phẩm');

  // Sheet tra cứu giá trị hợp lệ cho các cột chọn
  const guide = XLSX.utils.aoa_to_sheet([
    ['Danh mục (ghi tên hoặc mã)', 'Mã', 'Loại sản xuất', 'Nhãn', 'Cho tuỳ biến'],
    ...PRODUCT_CATEGORY_OPTIONS.map((o, i) => [
      o.label, o.value,
      Object.values(PRODUCTION_TYPE_TEXT)[i] ?? '',
      PRODUCT_BADGE_OPTIONS[i] ?? '',
      ['Có', 'Không'][i] ?? '',
    ]),
  ]);
  guide['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(book, guide, 'Giá trị hợp lệ');
  XLSX.writeFile(book, 'lumea_mau_nhap_san_pham.xlsx');
}

/** Đọc sheet đầu tiên thành các dòng giá trị thô (bỏ dòng trống). */
export async function readProductFile(file: File): Promise<{ line: number; values: ImportValues }[]> {
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0]];
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false });
  if (!table.length) throw new Error('File không có dữ liệu');

  const headers = table[0].map(normalize);
  const colIndex = new Map(COLUMNS.map(c => [c.key, headers.indexOf(normalize(c.header))]));
  const missing = COLUMNS.filter(c => c.header.includes('*') && colIndex.get(c.key)! < 0).map(c => c.header.replace(' *', ''));
  if (missing.length) throw new Error(`File thiếu cột bắt buộc: ${missing.join(', ')}. Hãy dùng file mẫu.`);

  return table.slice(1)
    .map((cells, i) => ({
      line: i + 2, // dòng 1 là tiêu đề
      values: Object.fromEntries(COLUMNS.map(c => {
        const idx = colIndex.get(c.key)!;
        return [c.key, idx < 0 ? '' : String(cells[idx] ?? '').trim()];
      })) as ImportValues,
    }))
    .filter(r => Object.values(r.values).some(Boolean));
}

/** Kiểm tra lại toàn bộ danh sách — gọi sau khi đọc file và sau mỗi lần sửa/xoá dòng (slug trùng phụ thuộc các dòng khác). */
export function validateRows(rows: { line: number; values: ImportValues }[], existingSlugs: Set<string>): ImportRow[] {
  const seenSlugs = new Set<string>();
  return rows.map(({ line, values: v }) => {
    const errors: string[] = [];
    const name = v.name.trim();
    if (!name) errors.push('Thiếu tên sản phẩm');

    const categoryText = normalize(v.category);
    const category = PRODUCT_CATEGORY_OPTIONS.find(o => o.value === categoryText || normalize(o.label) === categoryText);
    if (!category) errors.push(categoryText ? `Danh mục "${v.category}" không có` : 'Thiếu danh mục');

    const typeText = normalize(v.productionType);
    const isPod = typeText.includes('in 3d') || typeText === 'print_on_demand';
    if (typeText && !isPod && !['hàng có sẵn', 'có sẵn', 'ready_stock'].includes(typeText)) {
      errors.push(`Loại sản xuất "${v.productionType}" không hợp lệ`);
    }

    const basePrice = toNumber(v.basePrice);
    if (!basePrice || basePrice <= 0) errors.push('Giá bán phải lớn hơn 0');
    const originalPrice = toNumber(v.originalPrice);
    const inStock = toNumber(v.inStock) ?? 0;

    const badge = PRODUCT_BADGE_OPTIONS.find(b => normalize(b) === normalize(v.badge)) ?? '';
    if (v.badge.trim() && !badge) errors.push(`Nhãn "${v.badge}" không có trong danh sách`);

    const image1 = v.image1.trim();
    const image2 = v.image2.trim();
    if (!image1) errors.push('Thiếu ảnh chính');
    else if (!isUrl(image1)) errors.push('Ảnh chính phải là URL http(s)://');
    if (image2 && !isUrl(image2)) errors.push('Ảnh phụ phải là URL http(s)://');

    const slug = slugify(v.slug.trim() || name);
    if (slug && existingSlugs.has(slug)) errors.push(`Slug "${slug}" đã có sản phẩm khác dùng`);
    else if (slug && seenSlugs.has(slug)) errors.push(`Slug "${slug}" bị trùng với dòng khác trong file`);
    seenSlugs.add(slug);

    return {
      line,
      values: v,
      errors,
      payload: {
        name,
        slug,
        category: category?.value ?? 'lamp',
        categoryName: category?.label ?? '',
        categoryGroup: category?.group ?? 'FURNITURE',
        productionType: isPod ? 'PRINT_ON_DEMAND' : 'READY_STOCK',
        customizable: ['có', 'co', 'x', '1', 'true', 'yes'].includes(normalize(v.customizable)),
        basePrice: basePrice ?? 0,
        originalPrice: originalPrice || basePrice || 0,
        inStock,
        dimensions: v.dimensions.trim(),
        materialInfo: v.materialInfo.trim(),
        description: v.description.trim(),
        story: v.story.trim(),
        badge,
        images: [image1, image2].filter(Boolean),
      } as Omit<Product, 'id'>,
    };
  });
}
