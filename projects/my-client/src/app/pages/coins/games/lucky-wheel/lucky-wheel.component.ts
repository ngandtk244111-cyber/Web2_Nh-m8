import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoucherService } from '../../../../core/services/voucher.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AppIconComponent } from '../../../../components/icon/icon.component';

const SPIN_MS = 4800;

/**
 * Vòng Quay May Mắn: server bốc ô trúng thưởng (prizeIndex) TRƯỚC, client chỉ quay tới đúng ô đó —
 * không thể can thiệp kết quả từ trình duyệt.
 */
@Component({
  selector: 'app-lucky-wheel',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './lucky-wheel.component.html',
  styleUrl: './lucky-wheel.component.css'
})
export class LuckyWheelComponent {
  @Input({ required: true }) prizes: string[] = [];
  @Input() playsLeft = 0;
  @Output() rewarded = new EventEmitter<string>();

  readonly spinMs = SPIN_MS;
  readonly rotation = signal(0);
  readonly spinning = signal(false);
  readonly result = signal<string | null>(null);

  constructor(private voucherService: VoucherService, private toastService: ToastService) {}

  get segmentAngle(): number {
    return 360 / this.prizes.length;
  }

  /** Ô "độc đắc" (giảm 15% / 100K) tô vàng. */
  private isJackpot(i: number): boolean {
    return this.prizes[i] === '15%' || this.prizes[i] === '100K';
  }

  /** Nền bánh xe: các lát xen kẽ kem / đỏ đô, lát độc đắc màu vàng. */
  get wheelBackground(): string {
    const a = this.segmentAngle;
    const stops = this.prizes.map((_, i) => {
      const color = this.isJackpot(i) ? '#F6C244' : i % 2 === 0 ? '#FBF3E4' : '#A80D27';
      return `${color} ${i * a}deg ${(i + 1) * a}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  labelColor(i: number): string {
    return this.isJackpot(i) ? '#6B3E07' : i % 2 === 0 ? '#840B1E' : '#FFFFFF';
  }

  async spin(): Promise<void> {
    if (this.spinning() || this.playsLeft <= 0) return;
    this.spinning.set(true);
    this.result.set(null);

    try {
      const res = await this.voucherService.playGame('WHEEL');
      const index = res.prizeIndex ?? 0;
      // Lát i nằm trong [i·a, (i+1)·a] tính từ đỉnh theo chiều kim đồng hồ; quay bánh xe R độ thì
      // kim (ở đỉnh) chỉ vào góc -R — nên để kim chỉ giữa lát i cần R ≡ -(i·a + a/2) (mod 360).
      const a = this.segmentAngle;
      const jitter = (Math.random() - 0.5) * a * 0.6;
      const current = this.rotation();
      const target = current - (current % 360) + 360 * 6 + (360 - (index * a + a / 2)) + jitter;
      this.rotation.set(target);

      setTimeout(() => {
        this.spinning.set(false);
        this.result.set(res.voucher.title);
        this.playsLeft = res.playsLeft;
        this.rewarded.emit(res.voucher.title);
      }, SPIN_MS + 150);
    } catch (err: any) {
      this.spinning.set(false);
      this.toastService.error(err.message);
    }
  }
}
