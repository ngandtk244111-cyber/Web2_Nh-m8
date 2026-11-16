export interface Address {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  ward: string;
  address: string;
  isDefault: boolean;
}


export interface VNLocation {
  name: string;
  code: number;
  division_type: string;
  codename: string;
  districts?: VNLocation[];
  wards?: VNLocation[];
}
