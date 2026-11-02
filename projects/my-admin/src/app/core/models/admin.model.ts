export interface Admin {
  _id: string;
  username: string;
  fullName: string;
  code?: string;
  email?: string;
  phone?: string;
  department?: string;
  role?: string;
  createdAt?: string;
  active: boolean;
  lastLogin: string | null;
}
