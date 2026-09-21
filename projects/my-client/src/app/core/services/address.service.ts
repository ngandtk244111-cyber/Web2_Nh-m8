import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Address, VNLocation } from '../models/address.model';
import { AuthService } from './auth.service';

const BASE = `${environment.apiUrl}/auth/addresses`;

interface AddressResponse {
  success: boolean;
  addresses: Address[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly addresses = signal<Address[]>([]);
  readonly provinces = signal<VNLocation[]>([]);

  private get userId(): string | null {
    return this.authService.currentUser()?._id || null;
  }

  /** Danh mục Tỉnh/Thành — tham khảo AuraPC-main: dùng API hành chính VN công khai,
   *  không cần tự duy trì bộ dữ liệu tỉnh/huyện/xã. */
  loadProvinces(): void {
    if (this.provinces().length > 0) return;
    this.http.get<VNLocation[]>('https://provinces.open-api.vn/api/p/').subscribe({
      next: (res) => this.provinces.set(res),
      error: (err) => console.warn('Load provinces error', err),
    });
  }

  getDistricts(provinceCode: number) {
    return this.http.get<VNLocation>(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
  }

  getWards(districtCode: number) {
    return this.http.get<VNLocation>(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
  }

  load(): void {
    const userId = this.userId;
    if (!userId) { this.addresses.set([]); return; }

    this.http.get<AddressResponse>(BASE, { params: { userId } }).subscribe({
      next: (res) => {
        if (res.success) this.addresses.set(res.addresses || []);
      },
      error: (err) => console.warn('Load addresses error', err),
    });
  }

  add(data: Omit<Address, '_id'>): void {
    const userId = this.userId;
    if (!userId) return;

    this.http.post<AddressResponse>(BASE, { userId, ...data }).subscribe({
      next: (res) => {
        if (res.success) this.addresses.set(res.addresses || []);
      },
    });
  }

  update(addressId: string, data: Partial<Address>): void {
    const userId = this.userId;
    if (!userId) return;

    this.http.put<AddressResponse>(`${BASE}/${addressId}`, { userId, ...data }).subscribe({
      next: (res) => {
        if (res.success) this.addresses.set(res.addresses || []);
      },
    });
  }

  remove(addressId: string): void {
    const userId = this.userId;
    if (!userId) return;

    this.http.delete<AddressResponse>(`${BASE}/${addressId}`, { params: { userId } }).subscribe({
      next: (res) => {
        if (res.success) this.addresses.set(res.addresses || []);
      },
    });
  }

  setDefault(addressId: string): void {
    const userId = this.userId;
    if (!userId) return;

    this.http.put<AddressResponse>(`${BASE}/${addressId}/default`, { userId }).subscribe({
      next: (res) => {
        if (res.success) this.addresses.set(res.addresses || []);
      },
    });
  }

  getDefault(): Address | null {
    return this.addresses().find(a => a.isDefault) || null;
  }
}
