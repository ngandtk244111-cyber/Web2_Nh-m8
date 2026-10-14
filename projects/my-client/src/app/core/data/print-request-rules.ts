/**
 * QUY TẮC NHẬN YÊU CẦU IN 3D THEO THIẾT KẾ RIÊNG.
 *
 * Nguồn duy nhất cho: khung "Quy tắc in 3D" trên form /custom-request/new, kiểm tra dữ liệu ở client.
 * Server kiểm tra lại các giới hạn số (kích thước, chất liệu, khắc chữ...) ở
 * server/utils/print-request-rules.js — sửa ở đây thì sửa cả bên đó cho khớp.
 */

export type PrintMaterialKey = 'PLA' | 'PETG' | 'RESIN';

export interface PrintMaterialOption {
  key: PrintMaterialKey;
  label: string;
  description: string;
  /** Cạnh dài nhất tối đa (cm) với chất liệu này. */
  maxCm: number;
}

export const PRINT_MATERIALS: PrintMaterialOption[] = [
  { key: 'PLA', label: 'PLA (nhựa sinh học)', description: 'Đồ decor trong nhà, bề mặt mịn, nhiều màu. Không để nơi nóng trên 50°C.', maxCm: 30 },
  { key: 'PETG', label: 'PETG (bền, chịu nước)', description: 'Đồ dùng hằng ngày, chậu cây, đồ để ban công. Chịu va đập và ẩm tốt.', maxCm: 30 },
  { key: 'RESIN', label: 'Resin (chi tiết cao)', description: 'Tượng, figure, chi tiết nhỏ sắc nét. Kích thước tối đa 20cm.', maxCm: 20 },
];

/** Loại sản phẩm nhận in — loại "đèn" chỉ in PLA/PETG (resin giòn, dễ ố vàng khi gần nguồn sáng). */
export const PRINT_PRODUCT_TYPES: { label: string; materials: PrintMaterialKey[] }[] = [
  { label: 'Đèn ngủ / đèn bàn', materials: ['PLA', 'PETG'] },
  { label: 'Bình hoa / chậu cây', materials: ['PLA', 'PETG'] },
  { label: 'Khay / hộp đựng', materials: ['PLA', 'PETG'] },
  { label: 'Tượng / figure', materials: ['PLA', 'PETG', 'RESIN'] },
  { label: 'Giá đỡ / bookend', materials: ['PLA', 'PETG'] },
  { label: 'Decor treo tường', materials: ['PLA', 'PETG', 'RESIN'] },
  { label: 'Khác', materials: ['PLA', 'PETG', 'RESIN'] },
];

export const PRINT_BUDGET_OPTIONS = ['150.000đ - 300.000đ', '300.000đ - 500.000đ', '500.000đ - 1.000.000đ', 'Trên 1.000.000đ'];

export const PRINT_LIMITS = {
  /** Mỗi chiều (dài/rộng/cao) tính bằng cm. */
  minCm: 3,
  maxCm: 30,
  titleMinChars: 10,
  /** Mô tả ý tưởng (chủ đề + ghi chú) tối thiểu bao nhiêu ký tự để kỹ thuật viên dựng được mẫu. */
  ideaMinChars: 30,
  engraveMaxChars: 20,
} as const;

/** Khắc chữ: chữ cái (có dấu), số, khoảng trắng và . , - & ' — không emoji/ký tự đặc biệt. */
export const ENGRAVE_PATTERN = /^[\p{L}\p{N} .,\-&']*$/u;

/** Những gì Luméa KHÔNG nhận in. */
export const PRINT_PROHIBITED: string[] = [
  'Vũ khí, bộ phận vũ khí hoặc vật có thể gây sát thương',
  'Nhân vật, logo, thương hiệu có bản quyền khi bạn không có quyền sử dụng',
  'Đồ đựng thực phẩm/đồ uống trực tiếp, đồ chơi cho trẻ dưới 3 tuổi',
  'Vật chịu lực (giá treo nặng trên 3kg) hoặc đặt gần nguồn nhiệt trên 50°C',
];

/** Quy trình & cam kết hiển thị cho khách trước khi gửi. */
export const PRINT_PROCESS: string[] = [
  'Shop phản hồi khả thi + báo giá trong 24h làm việc.',
  'Bạn duyệt mẫu 3D (ảnh/xoay 360°) trước khi in — được chỉnh sửa miễn phí 2 lần.',
  'Sau khi duyệt mẫu, thời gian in & hoàn thiện 3–7 ngày làm việc tuỳ kích thước.',
  'Sản phẩm in theo yêu cầu là độc bản nên không áp dụng đổi trả, trừ khi lỗi in hoặc hư hỏng khi giao.',
  'Đèn chỉ dùng bóng LED (không dùng bóng sợi đốt) để tránh biến dạng nhựa.',
];

export interface PrintRequestInput {
  title: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productType: string;
  material: PrintMaterialKey | '';
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  theme: string;
  notes: string;
  customText: string;
  estimatedBudget: string;
  referenceImageUrl: string;
  agreeRules: boolean;
}

export type PrintRequestErrors = Partial<Record<keyof PrintRequestInput, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Số di động VN: 10 số, bắt đầu bằng 0 (cho phép khoảng trắng/dấu chấm khi nhập). */
const PHONE_PATTERN = /^0\d{9}$/;

export function materialsFor(productType: string): PrintMaterialOption[] {
  const allowed = PRINT_PRODUCT_TYPES.find(t => t.label === productType)?.materials ?? PRINT_MATERIALS.map(m => m.key);
  return PRINT_MATERIALS.filter(m => allowed.includes(m.key));
}

/** Kiểm tra toàn bộ form — trả về lỗi theo từng trường (rỗng = hợp lệ). */
export function validatePrintRequest(f: PrintRequestInput): PrintRequestErrors {
  const e: PrintRequestErrors = {};
  const { minCm, titleMinChars, ideaMinChars, engraveMaxChars } = PRINT_LIMITS;

  if (!f.customerName.trim()) e.customerName = 'Vui lòng nhập họ tên.';
  if (!EMAIL_PATTERN.test(f.customerEmail.trim())) e.customerEmail = 'Email không hợp lệ.';
  if (!PHONE_PATTERN.test(f.customerPhone.replace(/[\s.]/g, ''))) e.customerPhone = 'Số điện thoại gồm 10 số, bắt đầu bằng 0 (để shop liên hệ qua Zalo).';

  if (f.title.trim().length < titleMinChars) e.title = `Tiêu đề cần ít nhất ${titleMinChars} ký tự.`;
  if (!f.productType) e.productType = 'Chọn loại sản phẩm.';

  const material = PRINT_MATERIALS.find(m => m.key === f.material);
  if (!material) {
    e.material = 'Chọn chất liệu in.';
  } else if (f.productType && !materialsFor(f.productType).some(m => m.key === material.key)) {
    e.material = `${material.label} không phù hợp với "${f.productType}".`;
  }

  const dims = [f.lengthCm, f.widthCm, f.heightCm];
  const maxCm = material?.maxCm ?? PRINT_LIMITS.maxCm;
  if (dims.some(d => d === null || Number.isNaN(d))) {
    e.lengthCm = 'Nhập đủ dài × rộng × cao (cm).';
  } else if (dims.some(d => d! < minCm || d! > maxCm)) {
    e.lengthCm = `Mỗi chiều từ ${minCm} đến ${maxCm} cm${material ? ` (giới hạn của ${material.key})` : ''}.`;
  }

  if ((f.theme.trim() + ' ' + f.notes.trim()).trim().length < ideaMinChars) {
    e.theme = `Mô tả ý tưởng (chủ đề + ghi chú) cần ít nhất ${ideaMinChars} ký tự để kỹ thuật viên dựng mẫu.`;
  }

  const text = f.customText.trim();
  if (text.length > engraveMaxChars) e.customText = `Khắc tối đa ${engraveMaxChars} ký tự.`;
  else if (!ENGRAVE_PATTERN.test(text)) e.customText = 'Chỉ khắc chữ, số và các dấu . , - & \' (không emoji).';

  if (!f.estimatedBudget) e.estimatedBudget = 'Chọn ngân sách dự kiến.';

  const url = f.referenceImageUrl.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) e.referenceImageUrl = 'Link ảnh phải bắt đầu bằng http:// hoặc https://';

  if (!f.agreeRules) e.agreeRules = 'Bạn cần đồng ý với quy tắc in 3D trước khi gửi.';
  return e;
}

/** Tách "18cm x 15cm x 10" (vd. từ AI Assistant) thành các chiều số. */
export function parseSizeText(size: string): (number | null)[] {
  const nums = (size.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => Number(n.replace(',', '.')));
  return [nums[0] ?? null, nums[1] ?? null, nums[2] ?? null];
}
