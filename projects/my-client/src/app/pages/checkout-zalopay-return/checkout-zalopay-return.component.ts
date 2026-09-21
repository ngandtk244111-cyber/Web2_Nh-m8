import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppIconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-checkout-zalopay-return',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './checkout-zalopay-return.component.html',
  styleUrl: './checkout-zalopay-return.component.css'
})
export class CheckoutZalopayReturnComponent implements OnInit {
  isSuccess = false;
  orderNumber = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // ZaloPay không trả thẳng orderNumber của shop qua redirect URL, nên đọc lại từ embed_data
      // đã gửi kèm lúc tạo đơn (orderId), còn "status=1" là giao dịch thành công.
      this.isSuccess = params['status'] === '1';
      try {
        const embed = params['embed_data'] ? JSON.parse(params['embed_data']) : null;
        this.orderNumber = embed?.orderId || '';
      } catch {
        this.orderNumber = '';
      }
    });
  }
}
