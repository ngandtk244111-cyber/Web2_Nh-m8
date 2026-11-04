import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { Order } from '../../core/models/order.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import {
  normalizePhone, orderDateLabel, orderItemName, orderStatusClass, orderStatusLabel, paymentMethodLabel,
  paymentStatusClass, paymentStatusLabel,
} from '../../shared/utils/order-labels';
import { buildCustomers, customerSuccessRate, successRateClass } from './customer-summary';

/** Chi tiết khách hàng — theo customerdetail của Vita: thông tin liên hệ + chỉ số mua hàng, bên dưới là lịch sử đơn. */
@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, VndPipe, MascotLoadingComponent],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.css',
})
export class CustomerDetailComponent implements OnInit {
  private orderService = inject(OrderService);
  private adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statusLabel = orderStatusLabel;
  readonly statusClass = orderStatusClass;
  readonly payLabel = paymentStatusLabel;
  readonly payClass = paymentStatusClass;
  readonly methodLabel = paymentMethodLabel;
  readonly dateLabel = orderDateLabel;
  readonly itemName = orderItemName;
  readonly successRate = customerSuccessRate;
  readonly rateClass = successRateClass;

  private phone = '';
  loading = signal(true);

  readonly customer = computed(() => {
    const own = this.orderService.orders().filter(o => normalizePhone(o.shippingAddress?.phone) === this.phone);
    return buildCustomers(own)[0] || null;
  });

  /** Tên khác nhau từng dùng với SĐT này (khách đặt hộ người thân...). */
  readonly otherNames = computed(() => {
    const c = this.customer();
    if (!c) return [];
    return [...new Set(c.orders.map(o => o.shippingAddress.fullName))].filter(n => n !== c.name);
  });

  ngOnInit(): void {
    this.phone = normalizePhone(this.route.snapshot.paramMap.get('phone'));
    if (this.customer()) this.loading.set(false);
    this.orderService.fetchAll().subscribe(() => this.loading.set(false));
  }

  get canViewOrders(): boolean {
    return this.adminAuth.can('orders.view');
  }

  openOrder(o: Order): void {
    if (this.canViewOrders) this.router.navigate(['/orders', o.orderNumber]);
  }

  goBack(): void {
    this.router.navigate(['/customers']);
  }
}
