export interface AppNotification {
  _id: string;
  userId: string | null;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}
