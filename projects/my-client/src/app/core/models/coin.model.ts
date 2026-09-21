export type CoinRewardReason =
  | 'STYLE_QUIZ'
  | 'ORDER_DELIVERED'
  | 'PROFILE_COMPLETE'
  | 'COMMUNITY_POST'
  | 'NEWSLETTER_SUBSCRIBE'
  | 'PRODUCT_REVIEW'
  | 'BIRTHDAY';

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
