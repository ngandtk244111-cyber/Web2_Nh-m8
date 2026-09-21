import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppIconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-checkout-momo-return',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './checkout-momo-return.component.html',
  styleUrl: './checkout-momo-return.component.css'
})
export class CheckoutMomoReturnComponent implements OnInit {
  isSuccess = false;
  orderNumber = '';
  message = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.orderNumber = params['orderId'] || '';
      this.message = params['message'] || '';
      // MoMo: resultCode = 0 nghĩa là giao dịch thành công.
      this.isSuccess = params['resultCode'] === '0';
    });
  }
}
