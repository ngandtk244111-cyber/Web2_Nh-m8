import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarrantyService, Warranty } from '../../core/services/warranty.service';
import { AppIconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-warranty-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './warranty-lookup.component.html',
  styleUrl: './warranty-lookup.component.css'
})
export class WarrantyLookupComponent {
  warrantyCode = '';
  phone = '';
  isSearching = false;
  errorMessage = '';
  warranty: Warranty | null = null;

  claimNote = '';
  isSubmittingClaim = false;
  claimSubmitted = false;

  constructor(private warrantyService: WarrantyService) {}

  search(): void {
    if (!this.warrantyCode.trim() || !this.phone.trim()) return;

    this.isSearching = true;
    this.errorMessage = '';
    this.warranty = null;
    this.claimSubmitted = false;

    this.warrantyService.lookup(this.warrantyCode.trim(), this.phone.trim()).subscribe(res => {
      this.isSearching = false;
      this.warranty = res.warranty;
      this.errorMessage = res.error || '';
    });
  }

  submitClaim(): void {
    if (!this.warranty || this.isSubmittingClaim) return;

    this.isSubmittingClaim = true;
    this.warrantyService.submitClaim(this.warranty.warrantyCode, this.claimNote).subscribe({
      next: (res) => {
        this.isSubmittingClaim = false;
        if (res.success && res.warranty) {
          this.warranty = res.warranty;
          this.claimSubmitted = true;
        }
      },
      error: () => { this.isSubmittingClaim = false; },
    });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Còn hiệu lực';
      case 'CLAIMED': return 'Đang xử lý yêu cầu bảo hành';
      case 'EXPIRED': return 'Đã hết hạn';
      default: return status;
    }
  }
}
