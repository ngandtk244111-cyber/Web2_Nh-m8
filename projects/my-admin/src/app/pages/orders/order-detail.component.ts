import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { OrderService } from '../../core/services/order.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { Order, ProductionStep, ShippingOptions } from '../../core/models/order.model';
import { CartItem } from '../../core/models/cart.model';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';
import { escapeHtml, printHtml } from '../../shared/utils/export';
import {
  canShip, isOrderFinal, isProductionStepDone, needsPhoneConfirm, normalizePhone, nowLabel, orderDateLabel,
  orderStatusClass, orderStatusLabel, paymentMethodLabel, paymentStatusClass, paymentStatusLabel,
} from '../../shared/utils/order-labels';

interface ProductionStepOption { step: ProductionStep; label: string; title: string; percent: number; notes: string; }

/** 4 bước sản xuất cho đơn có sản phẩm in 3D theo yêu cầu. */
const PRODUCTION_STEPS: ProductionStepOption[] = [
  { step: 'FILE_PREPARATION', label: 'Chuẩn bị file', title: 'Đã tiếp nhận file mô hình 3D', percent: 20, notes: 'File STL/3MF đã sẵn sàng' },
  { step: '3D_PRINTING', label: 'Đang in 3D', title: 'Đang in 3D với độ nét cao', percent: 55, notes: 'Máy in Bambu Lab đang in' },
  { step: 'POST_PROCESSING', label: 'Xử lý bề mặt', title: 'Đang xử lý bề mặt & hoàn thiện', percent: 80, notes: 'Chà nhám và phủ satin' },
  { step: 'PACKAGING', label: 'Đóng gói', title: 'Đã đóng gói, chờ bàn giao vận chuyển', percent: 95, notes: 'Đã dán tem bảo hành Luméa' },
];

/** Chi tiết đơn hàng — theo orderdetail của Vita: bước trạng thái, danh sách sản phẩm, cột phải là khách + thanh toán + thao tác. */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VndPipe, MascotLoadingComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent implements OnInit {
  private orderService = inject(OrderService);
  readonly adminAuth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly productionSteps = PRODUCTION_STEPS;
  readonly cancelReasons = ['Khách yêu cầu huỷ', 'Không liên lạc được khách', 'Hết hàng / hết vật liệu in', 'Đơn trùng hoặc đặt nhầm', 'Nghi ngờ đơn ảo'];
  readonly returnReasons = ['Khách không nghe máy khi giao', 'Khách từ chối nhận hàng', 'Sai địa chỉ / không tìm được nhà', 'Hàng hư hỏng khi vận chuyển'];

  readonly statusLabel = orderStatusLabel;
  readonly statusClass = orderStatusClass;
  readonly payLabel = paymentStatusLabel;
  readonly payClass = paymentStatusClass;
  readonly methodLabel = paymentMethodLabel;
  readonly dateLabel = orderDateLabel;
  readonly isFinal = isOrderFinal;
  readonly canShip = canShip;
  readonly needsPhoneConfirm = needsPhoneConfirm;
  readonly stepDone = isProductionStepDone;

  private orderNumber = '';
  loading = signal(true);
  busy = signal(false);

  readonly order = computed(() => this.orderService.orders().find(o => o.orderNumber === this.orderNumber) || null);

  /** Số đơn trước đây của cùng SĐT bị giao thất bại — cảnh báo khi gọi xác nhận đơn COD. */
  readonly previousReturns = computed(() => {
    const o = this.order();
    const phone = normalizePhone(o?.shippingAddress?.phone);
    if (!o || !phone) return 0;
    return this.orderService.orders().filter(x => x.orderNumber !== o.orderNumber && x.status === 'RETURNED' && normalizePhone(x.shippingAddress?.phone) === phone).length;
  });

  cancelling = false;
  cancelReason = '';
  returning = false;
  returnReason = '';
  refundRef = '';
  refundNote = '';

  shippingOptions: ShippingOptions | null = null;
  shipForm = { carrier: '', trackingCode: '', fee: 0, note: '' };

  ngOnInit(): void {
    this.orderNumber = this.route.snapshot.paramMap.get('orderNumber') || '';
    if (this.order()) {
      this.loading.set(false);
      this.loadShippingOptions();
    }
    // Luôn tải lại để thấy trạng thái mới nhất (đơn có thể vừa được nhân viên khác cập nhật).
    this.orderService.fetchAll().subscribe(() => {
      this.loading.set(false);
      this.loadShippingOptions();
    });
  }

  get canEdit(): boolean {
    return this.adminAuth.can('orders.edit');
  }

  /** Hoàn tiền cần quyền duyệt thanh toán (khớp server: PATCH /refund yêu cầu orders.approve). */
  get canApprove(): boolean {
    return this.adminAuth.can('orders.approve');
  }

  get customerLink(): string[] | null {
    const phone = normalizePhone(this.order()?.shippingAddress?.phone);
    return phone && this.adminAuth.can('customers.view') ? ['/customers', phone] : null;
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }

  // ---- Hiển thị ----
  customizationText(item: CartItem): string {
    const c = item.selectedCustomization;
    if (!c) return '';
    return [c.color?.name, c.material?.name, c.size?.label, c.finish?.label, ...(c.accessories || []).map(a => a.name)]
      .filter(Boolean).join(' · ');
  }

  /** done = xong, current = đang chờ nhân viên xử lý, failed = huỷ/thất bại, '' = chưa tới. */
  stepState(step: 'confirm' | 'ship' | 'pay'): 'done' | 'current' | 'failed' | '' {
    const o = this.order();
    if (!o) return '';
    if (step === 'confirm') {
      if (o.status === 'CANCELLED' && needsPhoneConfirm(o)) return 'failed'; // huỷ trước khi gọi được khách
      return o.status !== 'PENDING' || o.phoneConfirmedAt ? 'done' : 'current';
    }
    if (step === 'ship') {
      if (o.status === 'DELIVERED') return 'done';
      if (o.status === 'RETURNED' || o.status === 'CANCELLED') return 'failed';
      return ['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED'].includes(o.status) ? 'current' : '';
    }
    if (o.paymentStatus === 'PAID') return 'done';
    if (o.paymentStatus === 'FAILED' || o.status === 'CANCELLED' || o.status === 'RETURNED') return 'failed';
    return o.transferReportedAt || (o.paymentMethod === 'COD' && o.status === 'DELIVERED') ? 'current' : '';
  }

  readonly stepChip: Record<string, string> = { done: 'Hoàn tất', current: 'Đang xử lý', failed: 'Dừng', '': 'Chưa tới' };

  stepIcon(state: string, icon: string): string {
    return state === 'done' ? 'bi-check-lg' : state === 'failed' ? 'bi-x-lg' : icon;
  }

  // ---- Thao tác ----
  private loadShippingOptions(): void {
    const o = this.order();
    if (!o || this.shippingOptions || !this.canShip(o)) return;
    this.orderService.getShippingOptions(o.orderNumber).subscribe({
      next: opts => {
        this.shippingOptions = opts;
        this.shipForm.carrier = opts.carriers.find(c => c.suitable)?.id || '';
      },
      error: err => this.toast.apiError(err, 'Không tải được danh sách hãng vận chuyển'),
    });
  }

  /** Gửi cập nhật lên server; trang tự hiện dữ liệu mới vì đọc thẳng từ OrderService. */
  private apply(request: Observable<Order>, message: string, auditAction: string, level: 'SUCCESS' | 'WARNING' | 'INFO' = 'SUCCESS'): void {
    if (this.busy()) return;
    this.busy.set(true);
    request.subscribe({
      next: updated => {
        this.busy.set(false);
        this.toast.success(message);
        this.audit.record('Đơn Hàng', auditAction, `Đơn ${updated.orderNumber}`, level);
        this.loadShippingOptions();
      },
      error: err => {
        this.busy.set(false);
        this.toast.apiError(err, 'Không cập nhật được đơn hàng');
      },
    });
  }

  confirmOrder(o: Order): void {
    this.apply(this.orderService.confirmOrder(o.orderNumber), `Đã xác nhận đơn ${o.orderNumber}`, 'Xác nhận đơn');
  }

  resolveRefund(o: Order, action: 'complete' | 'void'): void {
    const ref = this.refundRef.trim();
    const note = this.refundNote.trim();
    if (action === 'complete' ? !ref : !note) return;
    this.apply(
      this.orderService.resolveRefund(o.orderNumber, action, ref, note),
      action === 'complete' ? `Đã hoàn tiền đơn ${o.orderNumber}` : `Đơn ${o.orderNumber}: không hoàn tiền`,
      action === 'complete' ? `Hoàn tiền (mã GD ${ref})` : `Không hoàn tiền: ${note}`,
      action === 'complete' ? 'SUCCESS' : 'WARNING'
    );
    this.refundRef = '';
    this.refundNote = '';
  }

  confirmPhone(o: Order): void {
    this.apply(this.orderService.confirmPhone(o.orderNumber), `Đã xác nhận đơn ${o.orderNumber} với khách`, 'Gọi xác nhận đơn COD');
  }

  /** Không gọi được khách: mở sẵn ô huỷ với lý do tương ứng. */
  cannotReach(): void {
    this.cancelling = true;
    this.cancelReason = 'Không liên lạc được khách';
  }

  setProductionStep(o: Order, step: ProductionStepOption): void {
    this.apply(
      this.orderService.updateOrderStatus(o.orderNumber, 'IN_PRODUCTION', {
        currentStep: step.step, percentage: step.percent, stepTitle: step.title, notes: step.notes, updatedAt: nowLabel(),
      }),
      `Đơn ${o.orderNumber}: ${step.title} (${step.percent}%)`,
      `Cập nhật tiến độ in 3D: ${step.label}`,
      'INFO'
    );
  }

  submitShipment(o: Order): void {
    if (!this.shipForm.carrier) {
      this.toast.warning('Chọn hãng vận chuyển trước');
      return;
    }
    this.apply(
      this.orderService.ship(o.orderNumber, { ...this.shipForm, fee: Number(this.shipForm.fee) || 0 }),
      `Đã tạo vận đơn cho đơn ${o.orderNumber}`,
      'Tạo vận đơn'
    );
  }

  async markDelivered(o: Order): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: `Đơn ${o.orderNumber} đã giao thành công?`,
      message: (o.paymentMethod === 'COD' ? 'Shipper đã thu tiền COD (còn chờ đối soát với hãng). ' : '') + 'Khách sẽ được tặng voucher cho lần mua sau và đơn không sửa được nữa.',
      confirmLabel: 'Xác nhận đã giao',
      icon: 'bi-truck',
    });
    if (ok) this.apply(this.orderService.updateOrderStatus(o.orderNumber, 'DELIVERED'), `Đơn ${o.orderNumber} đã hoàn thành`, 'Giao thành công');
  }

  confirmReturn(o: Order): void {
    const reason = this.returnReason.trim();
    if (!reason) return;
    this.returning = false;
    this.apply(this.orderService.updateOrderStatus(o.orderNumber, 'RETURNED', undefined, reason), `Đơn ${o.orderNumber} giao thất bại — hàng hoàn về kho`, `Giao thất bại: ${reason}`, 'WARNING');
  }

  confirmCancel(o: Order): void {
    const reason = this.cancelReason.trim();
    if (!reason) return;
    this.cancelling = false;
    this.apply(this.orderService.updateOrderStatus(o.orderNumber, 'CANCELLED', undefined, reason), `Đã huỷ đơn ${o.orderNumber}`, `Huỷ đơn: ${reason}`, 'WARNING');
  }

  async setPaid(o: Order, paid: boolean): Promise<void> {
    if (!paid) {
      const ok = await this.confirmDialog.confirm({
        title: 'Chuyển về chưa thanh toán?',
        message: `Đơn ${o.orderNumber} sẽ được đánh dấu là chưa nhận tiền.`,
        confirmLabel: 'Chuyển về chưa thanh toán',
        danger: true,
      });
      if (!ok) return;
    }
    this.apply(
      this.orderService.setPaymentStatus(o.orderNumber, paid ? 'PAID' : 'UNPAID'),
      paid ? `Đã xác nhận nhận tiền đơn ${o.orderNumber}` : 'Đã chuyển về chưa thanh toán',
      paid ? 'Xác nhận đã thanh toán' : 'Huỷ xác nhận thanh toán',
      paid ? 'SUCCESS' : 'WARNING'
    );
  }

  /** Phiếu giao hàng in trong cửa sổ riêng. */
  printSlip(o: Order): void {
    const a = o.shippingAddress;
    const rows = (o.items || []).map(i => `<tr><td>${escapeHtml(i.product?.name)}${this.customizationText(i) ? `<div class="muted">${escapeHtml(this.customizationText(i))}</div>` : ''}${i.selectedCustomization?.customText ? `<div class="muted">Khắc: ${escapeHtml(i.selectedCustomization.customText)}</div>` : ''}</td><td class="right">${i.quantity}</td><td class="right">${(i.unitPrice || 0).toLocaleString('vi-VN')}đ</td><td class="right">${(i.totalPrice || 0).toLocaleString('vi-VN')}đ</td></tr>`).join('');
    const cod = o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' ? o.total : 0;
    printHtml(`Phiếu giao hàng ${o.orderNumber}`, `
      <div class="row"><div><h1>Luméa — Phiếu giao hàng</h1><div class="muted">Mã đơn: <b>${escapeHtml(o.orderNumber)}</b> · Ngày đặt: ${escapeHtml(this.dateLabel(o))}</div></div>
      <div class="right"><div class="muted">Thanh toán</div><b>${escapeHtml(this.methodLabel(o.paymentMethod))}</b></div></div>
      <h2>Người nhận</h2>
      <div><b>${escapeHtml(a?.fullName)}</b> · ${escapeHtml(a?.phone)}</div>
      <div>${escapeHtml([a?.street, a?.district, a?.city].filter(Boolean).join(', '))}</div>
      ${a?.notes || o.notes ? `<div class="muted">Ghi chú: ${escapeHtml(a?.notes || o.notes)}</div>` : ''}
      ${o.shipment ? `<div class="muted">Vận đơn: ${escapeHtml(o.shipment.carrierName)} ${escapeHtml(o.shipment.trackingCode)}</div>` : ''}
      <h2>Sản phẩm</h2>
      <table><thead><tr><th>Sản phẩm</th><th class="right">SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead><tbody>${rows}</tbody></table>
      <table style="margin-top:12px;width:50%;margin-left:auto">
        <tr><td>Tạm tính</td><td class="right">${(o.subtotal || 0).toLocaleString('vi-VN')}đ</td></tr>
        <tr><td>Giảm giá</td><td class="right">-${(o.discount || 0).toLocaleString('vi-VN')}đ</td></tr>
        <tr><td>Phí vận chuyển</td><td class="right">${(o.shippingFee || 0).toLocaleString('vi-VN')}đ</td></tr>
        <tr><td class="total">Tổng cộng</td><td class="right total">${o.total.toLocaleString('vi-VN')}đ</td></tr>
        <tr><td class="total">Thu hộ (COD)</td><td class="right total">${cod.toLocaleString('vi-VN')}đ</td></tr>
      </table>`);
  }
}
