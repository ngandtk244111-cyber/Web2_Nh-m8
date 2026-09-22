export interface Admin {
  _id: string;
  username: string;
  fullName: string;
  active: boolean;
  lastLogin: string | null;
}
