import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddressService } from '../../../core/services/address.service';
import { ToastService } from '../../../core/services/toast.service';
import { Address, VNLocation } from '../../../core/models/address.model';
import { AppIconComponent } from '../../../components/icon/icon.component';

@Component({
  selector: 'app-account-addresses-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './addresses-tab.component.html',
  styleUrl: './addresses-tab.component.css'
})
export class AddressesTabComponent implements OnInit {
  showModal = false;
  modalMode: 'add' | 'edit' = 'add';
  editingId = '';

  label = 'Nhà riêng';
  fullName = '';
  phone = '';
  city = '';
  district = '';
  ward = '';
  address = '';
  isDefault = false;

  districts = signal<VNLocation[]>([]);
  wards = signal<VNLocation[]>([]);
  errors: Record<string, string> = {};

  showDeleteConfirm = false;
  deletingId = '';

  constructor(
    public addressService: AddressService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.addressService.loadProvinces();
    this.addressService.load();
  }

  openAdd(): void {
    this.modalMode = 'add';
    this.editingId = '';
    this.label = 'Nhà riêng';
    this.fullName = '';
    this.phone = '';
    this.city = '';
    this.district = '';
    this.ward = '';
    this.address = '';
    this.isDefault = false;
    this.errors = {};
    this.districts.set([]);
    this.wards.set([]);
    this.showModal = true;
  }

  openEdit(addr: Address): void {
    this.modalMode = 'edit';
    this.editingId = addr._id;
    this.label = addr.label;
    this.fullName = addr.fullName;
    this.phone = addr.phone;
    this.city = addr.city;
    this.district = addr.district;
    this.ward = addr.ward;
    this.address = addr.address;
    this.isDefault = addr.isDefault;
    this.errors = {};
    this.districts.set([]);
    this.wards.set([]);
    this.showModal = true;

    if (addr.city) this.loadDependentLocations(addr.city, addr.district);
  }

  closeModal(): void {
    this.showModal = false;
  }

  onProvinceChange(): void {
    const p = this.addressService.provinces().find(x => x.name === this.city);
    this.districts.set([]);
    this.wards.set([]);
    this.district = '';
    this.ward = '';
    if (p) {
      this.addressService.getDistricts(p.code).subscribe(res => this.districts.set(res.districts || []));
    }
  }

  onDistrictChange(): void {
    const d = this.districts().find(x => x.name === this.district);
    this.wards.set([]);
    this.ward = '';
    if (d) {
      this.addressService.getWards(d.code).subscribe(res => this.wards.set(res.wards || []));
    }
  }

  private loadDependentLocations(city: string, district?: string): void {
    const check = setInterval(() => {
      const provinces = this.addressService.provinces();
      if (provinces.length === 0) return;
      clearInterval(check);
      const p = provinces.find(x => x.name === city);
      if (!p) return;
      this.addressService.getDistricts(p.code).subscribe(res => {
        this.districts.set(res.districts || []);
        if (district) {
          const d = (res.districts || []).find(x => x.name === district);
          if (d) this.addressService.getWards(d.code).subscribe(wRes => this.wards.set(wRes.wards || []));
        }
      });
    }, 100);
  }

  private validate(): boolean {
    const errors: Record<string, string> = {};
    if (!this.fullName.trim()) errors['fullName'] = 'Vui lòng nhập họ tên.';
    const phone = this.phone.replace(/\s+/g, '');
    if (!phone) errors['phone'] = 'Vui lòng nhập số điện thoại.';
    else if (!/^0\d{9}$/.test(phone)) errors['phone'] = 'Số điện thoại không hợp lệ (VD: 0912345678).';
    if (!this.city) errors['city'] = 'Vui lòng chọn Tỉnh/Thành phố.';
    if (!this.district) errors['district'] = 'Vui lòng chọn Quận/Huyện.';
    if (!this.ward) errors['ward'] = 'Vui lòng chọn Phường/Xã.';
    if (!this.address.trim()) errors['address'] = 'Vui lòng nhập địa chỉ cụ thể.';
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  save(): void {
    if (!this.validate()) return;

    const data = {
      label: this.label,
      fullName: this.fullName,
      phone: this.phone,
      city: this.city,
      district: this.district,
      ward: this.ward,
      address: this.address,
      isDefault: this.isDefault,
    };

    if (this.modalMode === 'add') {
      this.addressService.add(data);
      this.toastService.success('Đã thêm địa chỉ mới');
    } else {
      this.addressService.update(this.editingId, data);
      this.toastService.success('Đã cập nhật địa chỉ');
    }
    this.showModal = false;
  }

  confirmDelete(id: string): void {
    this.deletingId = id;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  deleteConfirmed(): void {
    this.addressService.remove(this.deletingId);
    this.toastService.success('Đã xoá địa chỉ');
    this.showDeleteConfirm = false;
  }

  setDefault(id: string): void {
    this.addressService.setDefault(id);
    this.toastService.success('Đã đặt làm địa chỉ mặc định');
  }
}
