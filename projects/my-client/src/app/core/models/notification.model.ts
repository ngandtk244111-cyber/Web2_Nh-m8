export interface AppNotification {
  _id: string;
  userId: string | null;
  title: string;
  message: string;
  link?: string | null;
  /** Khóa tham chiếu của thông báo nhắc hẹn (vd "flash-sale:2026-09-25"). */
  refKey?: string | null;
  read: boolean;
  createdAt: string;
}
