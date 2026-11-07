import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WarrantyService, Warranty } from '../../core/services/warranty.service';
import { AppIconComponent } from '../../components/icon/icon.component';

const DAY_MS = 86400000;

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

    this.isSubmittingClaim = true;
    this.claimError = '';
    this.warrantyService.submitClaim(this.warranty.warrantyCode, this.verifiedPhone, this.claimNote.trim()).subscribe({
      next: (res) => {
        this.isSubmittingClaim = false;
        if (res.success && res.warranty) {
          this.warranty = res.warranty;
          this.claimSubmitted = true;
          this.claimNote = '';
        }
      },
      error: (err) => {
        this.isSubmittingClaim = false;
        this.claimError = err?.error?.error || 'Không gửi được yêu cầu, vui lòng thử lại';
      },
    });
  }

  private resetClaim(): void {
    this.claimNote = '';
    this.claimSubmitted = false;
    this.claimError = '';
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Còn hiệu lực';
      case 'CLAIMED': return 'Đang xử lý yêu cầu bảo hành';
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
