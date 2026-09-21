import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { Order, ProductionStep } from '../../core/models/order.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './order-tracking.component.html',
  styleUrl: './order-tracking.component.css'
})
export class OrderTrackingComponent implements OnInit {
  searchCode = '';
  currentOrder: Order | undefined;
  isSearching = false;
  notFound = false;

  pipelineSteps: { key: ProductionStep; label: string }[] = [
    { key: 'FILE_PREPARATION', label: '1. Slicing file' },
    { key: '3D_PRINTING', label: '2. Đang in 3D' },
    { key: 'POST_PROCESSING', label: '3. Xử lý bề mặt' },
    { key: 'ASSEMBLY_TESTING', label: '4. Kiểm tra điện' },
    { key: 'PACKAGING', label: '5. Đóng hộp' },
    { key: 'DISPATCHED', label: '6. Đang giao' },
  ];

  constructor(
    private orderService: OrderService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['orderNumber'];
      if (code) {
        this.searchCode = code;
        this.searchOrder();
      }
    });
  }

  searchOrder(): void {
    const code = this.searchCode.trim();
    if (!code) return;

    this.isSearching = true;
    this.notFound = false;
    this.orderService.getOrderByNumber(code).subscribe(order => {
      this.isSearching = false;
      this.currentOrder = order || undefined;
      this.notFound = !order;
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'IN_PRODUCTION': return 'Đang in 3D & sản xuất';
      case 'CONFIRMED': return 'Đã xác nhận đơn';
      case 'SHIPPED': return 'Đang giao hàng';
      case 'DELIVERED': return 'Giao hàng thành công';
      default: return status;
    }
  }

  isStepReached(stepKey: ProductionStep): boolean {
    if (!this.currentOrder?.productionProgress) return false;
    const orderIndex = this.pipelineSteps.findIndex(s => s.key === this.currentOrder!.productionProgress!.currentStep);
    const stepIndex = this.pipelineSteps.findIndex(s => s.key === stepKey);
    return stepIndex <= orderIndex;
  }
}
