import { Injectable, signal } from '@angular/core';

export type CheckoutStep = 1 | 2 | 3 | 4;
export type CheckoutStepStatus = 'completed' | 'active' | 'disabled';

/**
 * Nguồn sự thật DUY NHẤT cho bước hiện tại của luồng Giỏ hàng → Thanh toán.
 * Là service (singleton) chứ không phải field trong component vì /cart và /checkout
 * là 2 route riêng — Angular huỷ/khởi tạo lại component mỗi lần điều hướng, nên state
 * bước phải sống ở tầng service mới không bị "nhảy loạn" khi chuyển trang.
 *
 * - currentStep: bước đang hiển thị trên màn hình.
 * - maxReachedStep: bước xa nhất đã được validate hợp lệ — quyết định bước nào là
 *   "completed" (được phép bấm quay lại) so với "disabled" (chưa đủ điều kiện, khoá).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutFlowService {
  private readonly currentStepSignal = signal<CheckoutStep>(1);
  private readonly maxReachedStepSignal = signal<CheckoutStep>(1);

  readonly currentStep = this.currentStepSignal.asReadonly();
  readonly maxReachedStep = this.maxReachedStepSignal.asReadonly();

  statusOf(step: CheckoutStep): CheckoutStepStatus {
    if (step === this.currentStepSignal()) return 'active';
    // Bước 4 (Hoàn tất) khoá cứng toàn bộ thanh Stepper cho tới khi reset().
    if (this.currentStepSignal() === 4) return 'disabled';
    return step <= this.maxReachedStepSignal() ? 'completed' : 'disabled';
  }

  /**
   * Hàm điều hướng bước DUY NHẤT của toàn bộ luồng — mọi nút bấm (Tiến hành thanh toán,
   * Quay lại, click thẳng vào Stepper) đều phải gọi qua đây, không tự set currentStep ở nơi khác.
   *
   * - Lùi về một bước đã hoàn thành (`target <= maxReachedStep`): luôn cho phép, không cần validate lại.
   * - Tiến lên bước kế tiếp (`target === maxReachedStep + 1`): bắt buộc `validate()` trả về true.
   * - Nhảy cóc qua bước chưa hoàn thành: luôn bị chặn, trả về false.
   */
  goToStep(target: CheckoutStep, opts?: { validate?: () => boolean }): boolean {
    if (this.currentStepSignal() === 4 && target !== 4) return false;

    const maxReached = this.maxReachedStepSignal();

    if (target <= maxReached) {
      this.currentStepSignal.set(target);
      return true;
    }

    if (target === maxReached + 1) {
      if (opts?.validate && !opts.validate()) return false;
      this.currentStepSignal.set(target);
      this.maxReachedStepSignal.set(target);
      return true;
    }

    return false;
  }

  /** Gọi khi vào trang /cart: luôn phản ánh đúng thực tế là đang ở Bước 1. */
  enterCartPage(): void {
    this.currentStepSignal.set(1);
  }

  /** Gọi khi vào trang /checkout lần đầu (từ Bước 1 hợp lệ) — không ghi đè nếu đã đang ở giữa luồng. */
  enterCheckoutPageFromCart(): void {
    if (this.currentStepSignal() === 1) {
      this.goToStep(2);
    }
  }

  /** Dùng khi "Tiếp tục mua sắm" sau khi đặt hàng xong — trả luồng về trạng thái sạch cho lần mua kế tiếp. */
  reset(): void {
    this.currentStepSignal.set(1);
    this.maxReachedStepSignal.set(1);
  }
}
