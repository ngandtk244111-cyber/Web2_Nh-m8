import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WarrantyService, Warranty } from '../../core/services/warranty.service';
import { AppIconComponent } from '../../components/icon/icon.component';
import { environment } from '../../../environments/environment';

const DAY_MS = 86400000;
const MAX_CLAIM_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RESULT_LABELS: Record<string, string> = { REPAIR: 'Sửa chữa', REPRINT: 'In lại', REPLACE: 'Đổi mới', REJECTED: 'Không bảo hành' };

@Component({
  selector: 'app-warranty-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent],
  templateUrl: './warranty-lookup.component.html',
  styleUrl: './warranty-lookup.component.css'
})
export class WarrantyLookupComponent implements OnInit {
  warrantyCode = '';
  phone = '';
  isSearching = false;
  errorMessage = '';
  warranty: Warranty | null = null;
  /** SĐT đã dùng để tra ra phiếu đang hiển thị — gửi kèm khi yêu cầu bảo hành. */
  private verifiedPhone = '';

  claimNote = '';
  /** Ảnh tình trạng sản phẩm (bắt buộc ít nhất 1) để shop phân biệt lỗi sản xuất với hư hỏng khi dùng. */
  claimImages: { file: File; preview: string }[] = [];
  readonly maxClaimImages = MAX_CLAIM_IMAGES;
  readonly apiOrigin = environment.apiUrl.replace(/\/api$/, '');
  isSubmittingClaim = false;
  claimSubmitted = false;
  claimError = '';

  constructor(private warrantyService: WarrantyService, private route: ActivatedRoute) {}

  /** Mở từ trang chi tiết đơn: mã nằm trên URL, SĐT truyền qua router state (không lộ trên URL)
   *  -> điền sẵn và tra luôn. */
  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const phone = history.state?.phone;
    if (code) this.warrantyCode = code;
    if (typeof phone === 'string') this.phone = phone;
    if (this.warrantyCode && this.phone) this.search();
  }

  search(): void {
    if (!this.warrantyCode.trim() || !this.phone.trim()) {
      this.errorMessage = 'Vui lòng nhập mã bảo hành và số điện thoại đặt hàng';
      return;
    }

    this.isSearching = true;
    this.errorMessage = '';
    this.warranty = null;
    this.resetClaim();

    const phone = this.phone.trim();
    this.warrantyService.lookup(this.warrantyCode.trim().toUpperCase(), phone).subscribe(res => {
      this.isSearching = false;
      this.warranty = res.warranty;
      this.verifiedPhone = res.warranty ? phone : '';
      this.errorMessage = res.error || '';
    });
  }

  /** Quay lại form để tra phiếu khác. */
  reset(): void {
    this.warranty = null;
    this.warrantyCode = '';
    this.errorMessage = '';
    this.resetClaim();
  }

  submitClaim(): void {
    if (!this.warranty || this.isSubmittingClaim || !this.claimNote.trim()) return;
    if (!this.claimImages.length) {
      this.claimError = 'Vui lòng chụp ít nhất 1 ảnh tình trạng sản phẩm';
      return;
    }

    this.isSubmittingClaim = true;
    this.claimError = '';
    this.warrantyService.submitClaim(this.warranty.warrantyCode, this.verifiedPhone, this.claimNote.trim(), this.claimImages.map(i => i.file)).subscribe({
      next: (res) => {
        this.isSubmittingClaim = false;
        if (res.success && res.warranty) {
          this.warranty = res.warranty;
          this.claimSubmitted = true;
          this.claimNote = '';
          this.clearImages();
        }
      },
      error: (err) => {
        this.isSubmittingClaim = false;
        this.claimError = err?.error?.error || 'Không gửi được yêu cầu, vui lòng thử lại';
      },
    });
  }

  addImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    for (const file of Array.from(input.files || [])) {
      if (this.claimImages.length >= MAX_CLAIM_IMAGES) break;
      if (!file.type.startsWith('image/')) { this.claimError = 'Chỉ nhận file ảnh'; continue; }
      if (file.size > MAX_IMAGE_BYTES) { this.claimError = 'Mỗi ảnh tối đa 5MB'; continue; }
      this.claimImages.push({ file, preview: URL.createObjectURL(file) });
    }
    input.value = '';
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.claimImages[index].preview);
    this.claimImages.splice(index, 1);
  }

  private clearImages(): void {
    this.claimImages.forEach(i => URL.revokeObjectURL(i.preview));
    this.claimImages = [];
  }

  resultLabel(result?: string | null): string {
    return result ? RESULT_LABELS[result] || '' : '';
  }

  private resetClaim(): void {
    this.clearImages();
    this.claimNote = '';
    this.claimSubmitted = false;
    this.claimError = '';
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Còn hiệu lực';
      case 'CLAIMED': return 'Đã gửi yêu cầu — chờ tiếp nhận';
      case 'PROCESSING': return 'Đang xử lý yêu cầu bảo hành';
      case 'EXPIRED': return 'Đã hết hạn';
      default: return status;
    }
  }

  /** Số ngày bảo hành còn lại (0 nếu đã hết hạn). */
  get daysLeft(): number {
    if (!this.warranty) return 0;
    return Math.max(0, Math.ceil((new Date(this.warranty.expiresAt).getTime() - Date.now()) / DAY_MS));
  }

  /** Phần trăm thời hạn bảo hành còn lại, cho thanh tiến trình. */
  get remainingPercent(): number {
    if (!this.warranty) return 0;
    const start = new Date(this.warranty.purchasedAt).getTime();
    const end = new Date(this.warranty.expiresAt).getTime();
    if (end <= start) return 0;
    return Math.min(100, Math.max(0, ((end - Date.now()) / (end - start)) * 100));
  }
}
