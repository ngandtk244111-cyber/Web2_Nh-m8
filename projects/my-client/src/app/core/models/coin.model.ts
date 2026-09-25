export type CoinRewardReason =
  | 'STYLE_QUIZ'
  | 'ORDER_DELIVERED'
  | 'PROFILE_COMPLETE'
  | 'COMMUNITY_POST'
  | 'NEWSLETTER_SUBSCRIBE'
  | 'PRODUCT_REVIEW'
  | 'BIRTHDAY'
  | 'DAILY_CHECKIN'
  | 'BROWSE_FEED'
  | 'GAME_WHEEL'
  | 'GAME_GIFT_BOX'
  | 'GAME_MEMORY';

export interface CoinTransaction {
  _id: string;
  amount: number;
  reason: CoinRewardReason;
  refId: string | null;
  note: string;
  createdAt: string;
}

export interface CoinClaimResult {
  success: boolean;
  alreadyApplied: boolean;
  coins: number;
  amount: number;
}

/** Trò chơi nhận xu trên trang /xu — key khớp với GAMES ở server/routes/coinRoutes.js. */
export type CoinGameKey = 'WHEEL' | 'GIFT_BOX' | 'MEMORY';

export interface CoinRewardsState {
  checkin: {
    today: string;
    claimedToday: boolean;
    /** Ngày (1..7) trong chuỗi: ngày sẽ nhận nếu chưa điểm danh, hoặc ngày vừa nhận nếu đã điểm danh. */
    streakDay: number;
    schedule: number[];
  };
  games: Record<CoinGameKey, { dailyLimit: number; playsLeft: number }>;
  browse: { amount: number; claimedToday: boolean };
  prizes: { WHEEL: number[]; GIFT_BOX: number[] };
}

export interface CoinGamePlayResult {
  success: boolean;
  amount: number;
  coins: number;
  playsLeft: number;
  /** Vòng quay: ô trúng thưởng do server bốc. */
  prizeIndex?: number;
  /** Hộp quà: phần thưởng của 2 hộp không chọn (chỉ để hiển thị). */
  otherBoxes?: number[];
}
