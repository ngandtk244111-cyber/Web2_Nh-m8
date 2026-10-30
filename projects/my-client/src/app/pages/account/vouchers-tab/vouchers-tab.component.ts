import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VoucherService } from '../../../core/services/voucher.service';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VoucherCardComponent } from '../../../components/voucher-card/voucher-card.component';

/** Tab "Voucher" ở trang tài khoản: voucher đang có + lịch sử voucher đã dùng/hết hạn. */
@Component({
  selector: 'app-account-vouchers-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VoucherCardComponent],
  templateUrl: './vouchers-tab.component.html',
})
export class VouchersTabComponent {
  readonly view = signal<'usable' | 'history'>('usable');

  constructor(public voucherService: VoucherService) {
    this.voucherService.refresh();
  }
}
