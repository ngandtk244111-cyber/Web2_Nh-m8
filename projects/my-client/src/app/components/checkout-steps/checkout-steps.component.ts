import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { CheckoutFlowService, CheckoutStep, CheckoutStepStatus } from '../../core/services/checkout-flow.service';

interface StepDef {
  step: CheckoutStep;
  label: string;
  icon: string;
  path: string;
}

const STEPS: StepDef[] = [
  { step: 1, label: 'Giỏ hàng', icon: 'cart', path: '/cart' },
  { step: 2, label: 'Thông tin đặt hàng', icon: 'calendar', path: '/checkout' },
  { step: 3, label: 'Thanh toán', icon: 'credit-card', path: '/checkout' },
  { step: 4, label: 'Hoàn tất', icon: 'shield', path: '/checkout' },
];

/**
 * Thanh Stepper Giỏ hàng → Thông tin đặt hàng → Thanh toán → Hoàn tất.
 * Chỉ ĐỌC trạng thái từ CheckoutFlowService (nguồn sự thật duy nhất) và gọi
 * flow.goToStep() khi bấm — không tự giữ state riêng để tránh lệch pha giữa 2 trang /cart, /checkout.
 */
@Component({
  selector: 'app-checkout-steps',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './checkout-steps.component.html',
  styleUrl: './checkout-steps.component.css'
})
export class CheckoutStepsComponent {
  readonly steps = STEPS;

  constructor(public flow: CheckoutFlowService, private router: Router) {}

  statusOf(step: CheckoutStep): CheckoutStepStatus {
    return this.flow.statusOf(step);
  }

  iconFor(def: StepDef): string {
    return this.statusOf(def.step) === 'completed' ? 'check' : def.icon;
  }

  onStepClick(def: StepDef): void {
    // Chỉ các bước ĐÃ HOÀN THÀNH mới cho phép click nhảy lùi lại; bước active bấm không làm gì,
    // bước disabled (chưa tới / chưa validate) không cho nhảy cóc sang.
    if (this.statusOf(def.step) !== 'completed') return;
    if (!this.flow.goToStep(def.step)) return;

    const currentPath = this.router.url.split('?')[0].split('#')[0];
    if (currentPath !== def.path) {
      this.router.navigate([def.path]);
    }
  }
}
