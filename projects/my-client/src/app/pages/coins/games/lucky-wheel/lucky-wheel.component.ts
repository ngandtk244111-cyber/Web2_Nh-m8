import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoinService } from '../../../../core/services/coin.service';
import { ToastService } from '../../../../core/services/toast.service';
import { XuCoinComponent } from '../../xu-coin/xu-coin.component';

const SPIN_MS = 4800;

/**
 * Vòng Quay May Mắn: server bốc ô trúng thưởng (prizeIndex) TRƯỚC, client chỉ quay tới đúng ô đó —
 * không thể can thiệp kết quả từ trình duyệt.
 */
@Component({
  selector: 'app-lucky-wheel',
  standalone: true,
  imports: [CommonModule, XuCoinComponent],
  templateUrl: './lucky-wheel.component.html',
  styleUrl: './lucky-wheel.component.css'
})
export class LuckyWheelComponent {
  @Input({ required: true }) prizes: number[] = [];
  @Input() playsLeft = 0;
  @Output() rewarded = new EventEmitter<number>();

  readonly spinMs = SPIN_MS;
  readonly rotation = signal(0);
  readonly spinning = signal(false);
  readonly result = signal<number | null>(null);

  constructor(private coinService: CoinService, private toastService: ToastService) {}

  get segmentAngle(): number {
    return 360 / this.prizes.length;
  }

  /** Nền bánh xe: các lát xen kẽ kem / đỏ đô, lát "độc đắc" (≥ 200 xu) màu vàng. */
  get wheelBackground(): string {
    const a = this.segmentAngle;
    const stops = this.prizes.map((amount, i) => {
      const color = amount >= 200 ? '#F6C244' : i % 2 === 0 ? '#FBF3E4' : '#A80D27';
      return `${color} ${i * a}deg ${(i + 1) * a}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  labelColor(i: number): string {
    return this.prizes[i] >= 200 ? '#6B3E07' : i % 2 === 0 ? '#840B1E' : '#FFFFFF';
  }

  async spin(): Promise<void> {
    if (this.spinning() || this.playsLeft <= 0) return;
    this.spinning.set(true);
    this.result.set(null);

    try {
      const res = await this.coinService.playGame('WHEEL');
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
        this.result.set(res.amount);
        this.playsLeft = res.playsLeft;
        this.rewarded.emit(res.amount);
      }, SPIN_MS + 150);
    } catch (err: any) {
      this.spinning.set(false);
      this.toastService.error(err.message);
    }
  }
}
