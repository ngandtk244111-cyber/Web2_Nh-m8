import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { CustomRequestService } from '../../core/services/custom-request.service';
import { RoomService } from '../../core/services/room.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { Product, ProductionType, ProductCategory } from '../../core/models/product.model';
import { Order, ProductionStep } from '../../core/models/order.model';
import { CustomRequest, CustomRequestStatus } from '../../core/models/custom-request.model';
import { Room } from '../../core/models/room.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  // my-client (app khách hàng) giờ là 1 project Angular riêng biệt — mọi link "sang trang khách
  // hàng" phải là link ngoài (href tuyệt đối), không còn dùng routerLink nội bộ được nữa.
  readonly clientAppUrl = environment.clientAppUrl;

  activeTab: 'orders' | 'custom-requests' | 'products' | 'rooms' = 'orders';

  // Sản phẩm có sẵn (READY_STOCK) và sản phẩm tùy biến in 3D (PRINT_ON_DEMAND) là hai danh mục
  // quản lý riêng biệt — khớp với cách my-client đã tách /catalog và /customizer-3d.
  productSubTab: 'ready' | 'customizable' = 'ready';

  products: Product[] = [];
  orders: Order[] = [];
  customRequests: CustomRequest[] = [];
  rooms: Room[] = [];

  totalRevenue = 0;
  podOrdersCount = 0;
  pendingRequestsCount = 0;
  customizableProductsCount = 0;

  quotationInputs: { [key: string]: number } = {};
  showAddProductModal = false;

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private customRequestService: CustomRequestService,
    private roomService: RoomService,
    public adminAuth: AdminAuthService,
    private router: Router
  ) {
    // Product/CustomRequest/Room giờ nạp & tự cập nhật bất đồng bộ từ backend (mỗi service tự
    // refresh signal của nó sau khi ghi) — effect() giữ các field cục bộ của dashboard đồng bộ
    // theo, thay vì đọc snapshot 1 lần trong refreshData().
    effect(() => {
      this.products = this.productService.products();
      this.customizableProductsCount = this.products.filter(p => p.customizable).length;
    });
    effect(() => {
      this.customRequests = this.customRequestService.requests();
      this.pendingRequestsCount = this.customRequests.filter(r => r.status === 'PENDING_REVIEW').length;
    });
    effect(() => {
      this.rooms = this.roomService.rooms();
    });
  }

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.orderService.fetchAll().subscribe(orders => {
      this.orders = orders;
      this.totalRevenue = this.orders.reduce((sum, o) => sum + o.total, 0);
      this.podOrdersCount = this.orders.filter(o => o.hasPrintOnDemandItems).length;
    });
  }

  setProductionStep(orderNumber: string, step: ProductionStep, title: string, percent: number, notes: string): void {
    const status = step === 'DISPATCHED' ? 'SHIPPED' : 'IN_PRODUCTION';
    this.orderService.updateOrderStatus(orderNumber, status, {
      currentStep: step,
      percentage: percent,
      stepTitle: title,
      notes,
      updatedAt: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }).subscribe(() => this.refreshData());
  }

  submitQuotation(requestId: string): void {
    const price = this.quotationInputs[requestId];
    if (!price || price <= 0) return;
    this.customRequestService.updateStatus(requestId, 'QUOTED', price, 4);
    this.customRequestService.sendMessage(
      requestId,
      `Shop Luméa đã kiểm tra yêu cầu và gửi báo giá chính thức: ${price.toLocaleString('vi-VN')}đ. Thời gian in và xử lý hoàn thiện khoảng 4 ngày.`,
      'SHOP_SPECIALIST'
    );
  }

  setPreviewReady(requestId: string): void {
    this.customRequestService.updateStatus(requestId, 'PREVIEW_READY', undefined, undefined, 'moon_lamp');
    this.customRequestService.sendMessage(
      requestId,
      'Bản vẽ mô phỏng 3D Preview đã được tải lên! Bạn hãy xem và bấm duyệt thiết kế nhé.',
      'SHOP_SPECIALIST'
    );
  }

  deleteProduct(id: string): void {
    this.productService.deleteProduct(id).subscribe();
  }

  logout(): void {
    this.adminAuth.logout();
    this.router.navigate(['/login']);
  }

  get readyStockProducts(): Product[] {
    return this.products.filter(p => p.productionType === 'READY_STOCK');
  }

  get customizableAdminProducts(): Product[] {
    return this.products.filter(p => p.productionType === 'PRINT_ON_DEMAND');
  }
}
