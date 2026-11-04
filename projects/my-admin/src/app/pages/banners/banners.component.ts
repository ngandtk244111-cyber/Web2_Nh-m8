import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { BANNER_GROUPS, BANNER_SLOTS, BannerSlot } from '../../core/data/banner-slots';
import { ImageCropperComponent } from '../../components/image-cropper/image-cropper.component';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { LinkPickerComponent } from '../../components/link-picker/link-picker.component';

/**
 * Banner trang chủ — vị trí cố định của my-client (core/data/banner-slots.ts). Chỉ lưu phần admin
 * đã sửa (khác nội dung gốc) vào cấu hình 'banners' trên server.
 */
@Component({
  selector: 'app-banners',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageCropperComponent, MascotLoadingComponent, LinkPickerComponent],
  templateUrl: './banners.component.html',
  styleUrl: './banners.component.css',
})
export class BannersComponent implements OnInit {
  private configService = inject(AdminConfigService);
  readonly adminAuth = inject(AdminAuthService);
  private productService = inject(ProductService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly groups = BANNER_GROUPS;
  readonly loading = computed(() => this.configService.config() === null);

  /** Bản đã sửa theo id vị trí. Popup lưu từ bản cũ mang id riêng nên nhận theo position. */
  readonly overrides = computed<Record<string, any>>(() => {
    const entries: any[] = this.configService.get<any[]>('banners') || [];
    const result: Record<string, any> = {};
    for (const entry of entries) {
      if (BANNER_SLOTS.some(s => s.id === entry.id)) result[entry.id] = entry;
    }
    const legacyPopup = entries.find(e => e.position === 'POPUP_HOME');
    if (!result['popup-home'] && legacyPopup) result['popup-home'] = { ...legacyPopup, id: 'popup-home' };
    return result;
  });

  editingSlot: BannerSlot | null = null;
  form: Record<string, string> = {};
  uploading = false;
  saving = false;
  cropFile: File | null = null;

  ngOnInit(): void {
    this.configService.load(true);
  }

  get canEdit(): boolean {
    return this.adminAuth.can('marketing.edit');
  }

  value(slot: BannerSlot, key: string): string {
    return this.overrides()[slot.id]?.[key] || (slot.defaults as Record<string, string>)[key] || '';
  }

  isActive(slot: BannerSlot): boolean {
    return this.overrides()[slot.id]?.active !== false;
  }

  isCustomized(slot: BannerSlot): boolean {
    const entry = this.overrides()[slot.id];
    return !!entry && Object.keys(entry).some(k => k !== 'id' && k !== 'active' && k !== 'position');
  }

  openEdit(slot: BannerSlot): void {
    this.editingSlot = slot;
    // Vị trí chỉ dùng video không có ảnh, không đưa vào form để khỏi bị bắt buộc nhập.
    this.form = slot.imageRatio ? { imageUrl: this.value(slot, 'imageUrl') } : {};
    for (const field of slot.fields) this.form[field.key] = this.value(slot, field.key);
  }

  closeEdit(): void {
    this.editingSlot = null;
    this.cropFile = null;
  }

  /** GIF không qua bước cắt để giữ chuyển động. */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Cho phép chọn lại đúng file đó sau khi tải lỗi.
    if (!file) return;
    if (file.type === 'image/gif') this.upload(file);
    else this.cropFile = file;
  }

  onCropped(file: File): void {
    this.cropFile = null;
    this.upload(file);
  }

  onCropFailed(): void {
    this.cropFile = null;
    this.toast.error('Không đọc được file ảnh này');
  }

  private upload(file: File): void {
    const form = this.form;
    this.uploading = true;
    this.productService.uploadImage(file).subscribe({
      next: url => {
        form['imageUrl'] = url;
        this.uploading = false;
      },
      error: err => {
        this.uploading = false;
        this.toast.apiError(err, 'Không tải được ảnh lên server');
      },
    });
  }

  resetToDefault(): void {
    const slot = this.editingSlot;
    if (!slot) return;
    for (const key of Object.keys(this.form)) this.form[key] = (slot.defaults as Record<string, string>)[key] || '';
  }

  save(): void {
    const slot = this.editingSlot;
    if (!slot || this.saving) return;
    const entry: any = { id: slot.id };
    if (this.overrides()[slot.id]?.active === false) entry.active = false;

    for (const key of Object.keys(this.form)) {
      const value = (this.form[key] || '').trim();
      const label = slot.fields.find(f => f.key === key)?.label || 'Ảnh';
      if (!value) {
        this.toast.warning(key === 'ctaLink' ? 'Vui lòng chọn trang mà nút trên banner dẫn tới' : `Vui lòng nhập: ${label}`);
        return;
      }
      if (key === 'ctaLink' && !/^\/(?!\/)/.test(value)) {
        this.toast.warning('Đường dẫn tự nhập phải là trang trong cửa hàng, bắt đầu bằng / (vd. /catalog)');
        return;
      }
      const isDefault = value === (slot.defaults as Record<string, string>)[key];
      if (key === 'videoUrl' && !isDefault && !/^https?:\/\//.test(value)) {
        this.toast.warning('URL video phải bắt đầu bằng http:// hoặc https://');
        return;
      }
      if (!isDefault) entry[key] = value;
    }

    this.saveOverrides({ ...this.overrides(), [slot.id]: entry }, () => {
      this.closeEdit();
      this.toast.success(`Đã cập nhật: ${slot.name}`);
      this.audit.record('Banner', 'Sửa banner', slot.name, 'SUCCESS');
    });
  }

  toggle(slot: BannerSlot): void {
    const active = !this.isActive(slot);
    const entry = { ...this.overrides()[slot.id], id: slot.id };
    if (active) delete entry.active;
    else entry.active = false;

    this.saveOverrides({ ...this.overrides(), [slot.id]: entry }, () => {
      this.toast.info(`${slot.name} hiện đã ${active ? 'hiển thị' : 'ẩn'}`);
      this.audit.record('Banner', 'Đổi trạng thái banner', `${slot.name} -> ${active ? 'ACTIVE' : 'HIDDEN'}`, 'INFO');
    });
  }

  /** Chỉ báo thành công khi server xác nhận; lỗi thì tải lại bản đang lưu. */
  private saveOverrides(overrides: Record<string, any>, onSaved: () => void): void {
    this.saving = true;
    this.configService.save('banners', Object.values(overrides)).subscribe({
      next: () => {
        this.saving = false;
        onSaved();
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được banner lên server');
        this.configService.load(true);
      },
    });
  }
}
