/** Voucher cá nhân của khách — khớp publicVoucher() ở server/routes/voucherRoutes.js. */
export interface UserVoucher {
  _id: string;
  code: string;
  title: string;
  description: string;
  /** Giảm theo % (kèm maxDiscount) hoặc giảm thẳng số tiền — chỉ 1 trong 2 khác 0. */
  discountPercent: number;
  discountAmount: number;
  maxDiscount: number;
  minSpend: number;
  source: string;
  expiresAt: string;
  usedAt: string | null;
  usedOrderNumber: string | null;
  createdAt: string;
}

/** Trò chơi nhận voucher — key khớp GAMES ở server/routes/voucherRoutes.js. */
export type VoucherGameKey = 'WHEEL' | 'GIFT_BOX' | 'MEMORY';

export interface VoucherRewardsState {
  games: Record<VoucherGameKey, { dailyLimit: number; playsLeft: number }>;
  /** Nhãn ngắn của từng ô vòng quay, vd "10K", "5%". */
  prizes: { WHEEL: string[] };
}

export interface VoucherGamePlayResult {
  success: boolean;
  voucher: UserVoucher;
  /** Nhãn ngắn của voucher trúng, vd "20K". */
  label: string;
  playsLeft: number;
  /** Vòng quay: ô trúng thưởng do server bốc. */
  prizeIndex?: number;
  /** Hộp quà: nhãn phần thưởng của 2 hộp không chọn (chỉ để hiển thị). */
  otherBoxes?: string[];
}
