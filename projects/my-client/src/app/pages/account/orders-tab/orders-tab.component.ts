import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';
import { AppIconComponent } from '../../../components/icon/icon.component';

type StatusTab = 'ALL' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-account-orders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, AppIconComponent],
  templateUrl: './orders-tab.component.html',
  styleUrl: './orders-tab.component.css'
})
export class OrdersTabComponent implements OnInit {
  orders: Order[] = [];
  loading = false;
  searchQuery = '';
  statusTab: StatusTab = 'ALL';

  readonly statusTabs: { id: StatusTab; label: string }[] = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'PROCESSING', label: 'Đang xử lý' },
    { id: 'SHIPPED', label: 'Đang giao' },
    { id: 'DELIVERED', label: 'Đã giao' },
    { id: 'CANCELLED', label: 'Đã hủy' },
  ];

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.orderService.fetchMine().subscribe(orders => {
      this.orders = orders;
      this.loading = false;
    });
  }

  setStatusTab(tab: StatusTab): void {
    this.statusTab = tab;
  }

  private matchesStatusTab(status: OrderStatus): boolean {
    if (this.statusTab === 'ALL') return true;
    if (this.statusTab === 'PROCESSING') return ['PENDING', 'CONFIRMED', 'IN_PRODUCTION'].includes(status);
    return this.statusTab === status;
  }

  get filteredOrders(): Order[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.orders.filter(o => {
      if (!this.matchesStatusTab(o.status)) return false;
      if (!q) return true;
      return o.orderNumber.toLowerCase().includes(q) ||
        o.items.some(i => i.product.name.toLowerCase().includes(q));
    });
  }

  statusLabel(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      IN_PRODUCTION: 'Đang sản xuất',
      SHIPPED: 'Đang giao',
      DELIVERED: 'Đã giao',
      CANCELLED: 'Đã hủy',
    };
    return map[status] || status;
  }

  statusClass(status: OrderStatus): string {
    if (status === 'DELIVERED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (status === 'SHIPPED') return 'bg-[#5b9bf0]/15 text-[#5b9bf0] border-[#5b9bf0]/30';
    if (status === 'CANCELLED') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  }
}
