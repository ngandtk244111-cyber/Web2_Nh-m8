import { Product } from '../models/product.model';

/** Xưởng sản xuất đối tác — lưu ở cấu hình 'workshops' (server trả danh sách mặc định khi chưa lưu). */
import { Attachment } from '../services/document.service';

export interface Workshop {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  /** Nhóm hàng xưởng nhận làm (khóa của WORKSHOP_SPECIALTIES). */
  specialties: WorkshopSpecialty[];
  /** Số ngày xưởng thường cần để giao — dùng điền sẵn ngày dự kiến khi tạo phiếu. */
  leadDays: number;
  note: string;
  active: boolean;
  /** Hợp đồng / phụ lục ký với xưởng (PDF, ảnh scan) — lưu ở kho chứng từ nội bộ. */
  contracts?: Attachment[];
}

// Bảng này khớp với server/utils/workshops.js — sửa ở đây thì sửa cả bên đó.
export const WORKSHOP_SPECIALTIES = {
  upholstery: 'Sofa, giường & ghế bọc nệm',
  wood: 'Đồ gỗ (bàn, tủ, kệ)',
  ceramic: 'Gốm sứ',
  lighting: 'Đèn & thiết bị điện',
  metal_glass: 'Gương, kim loại & kính',
  textile: 'Dệt may & đồ gia dụng',
  decor: 'Decor thủ công (tượng, khung, đồng hồ)',
  print3d: 'In 3D & làm theo yêu cầu',
} as const;

export type WorkshopSpecialty = keyof typeof WORKSHOP_SPECIALTIES;
export const SPECIALTY_KEYS = Object.keys(WORKSHOP_SPECIALTIES) as WorkshopSpecialty[];

const CATEGORY_SPECIALTY: Record<string, WorkshopSpecialty> = {
  sofa: 'upholstery', bed: 'upholstery', chair: 'upholstery', stool: 'upholstery',
  table: 'wood', side_table: 'wood', cabinet: 'wood', bookshelf: 'wood', organizer: 'wood', bookend: 'wood',
  vase: 'ceramic', plant_pot: 'ceramic', candle_holder: 'ceramic', tray: 'ceramic',
  lamp: 'lighting', desk_lamp: 'lighting', night_lamp: 'lighting', pendant_lamp: 'lighting',
  mirror: 'metal_glass',
  household: 'textile',
  sculpture: 'decor', frame: 'decor', clock: 'decor',
};

export function specialtyOf(product: Pick<Product, 'id' | 'category' | 'productionType'>): WorkshopSpecialty | null {
  if (product.productionType === 'PRINT_ON_DEMAND' || String(product.id || '').startsWith('custom-')) return 'print3d';
  return CATEGORY_SPECIALTY[product.category] || null;
}

/** Xưởng phụ trách: xưởng admin chọn riêng (nếu còn hợp tác), không thì xưởng đầu tiên nhận nhóm hàng đó. */
export function workshopFor(product: Pick<Product, 'id' | 'category' | 'productionType' | 'workshopId'>, workshops: Workshop[]): Workshop | null {
  const active = workshops.filter(w => w.active !== false);
  if (product.workshopId) {
    const chosen = active.find(w => w.id === product.workshopId);
    if (chosen) return chosen;
  }
  const s = specialtyOf(product);
  return s ? active.find(w => (w.specialties || []).includes(s)) || null : null;
}

export function specialtyLabels(w: Pick<Workshop, 'specialties'>): string {
  return (w.specialties || []).map(s => WORKSHOP_SPECIALTIES[s] || s).join(' · ');
}

export const DEFAULT_SHOWROOM_ADDRESS = 'Tầng 2, Tháp Design, 128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Quận 3, TP.HCM';
