import { Component, EventEmitter, Input, OnDestroy, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoinService } from '../../../../core/services/coin.service';
import { ToastService } from '../../../../core/services/toast.service';
import { XuCoinComponent } from '../../xu-coin/xu-coin.component';

interface MemoryCard {
  id: number;
  pairKey: string;
  image: string;
  flipped: boolean;
  matched: boolean;
}

/** 8 minh họa danh mục có sẵn (assets/categories) làm mặt thẻ — đúng chủ đề decor của Luméa. */
const CARD_FACES = ['decor-ban', 'tuong-mo-hinh', 'den-chieu-sang', 'chau-cay', 'phu-kien', 'phong-cach', 'khong-gian', '3d-custom'];
const MISMATCH_DELAY_MS = 750;

/**
 * Lật Thẻ Decor: ghép 8 cặp thẻ. Ghép xong mới gửi số lượt + thời gian lên server,
 * server tự quy ra số xu (càng ít lượt càng nhiều xu). Hết lượt nhận xu vẫn chơi thử được.
 */
@Component({
  selector: 'app-memory-game',
  standalone: true,
  imports: [CommonModule, XuCoinComponent],
  templateUrl: './memory-game.component.html',
  styleUrl: './memory-game.component.css'
})
export class MemoryGameComponent implements OnDestroy {
  @Input() playsLeft = 0;
  @Output() rewarded = new EventEmitter<number>();

  readonly cards = signal<MemoryCard[]>([]);
  readonly moves = signal(0);
  readonly seconds = signal(0);
  readonly started = signal(false);
  readonly finished = signal(false);
  readonly submitting = signal(false);
  readonly result = signal<number | null>(null);

  private firstPick: MemoryCard | null = null;
  private locked = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private coinService: CoinService, private toastService: ToastService) {
    this.reset();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  reset(): void {
    const deck = [...CARD_FACES, ...CARD_FACES].map((key, i) => ({
      id: i,
      pairKey: key,
      image: `assets/categories/${key}.png`,
      flipped: false,
      matched: false,
    }));
    // Fisher–Yates
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards.set(deck);
    this.moves.set(0);
    this.seconds.set(0);
    this.started.set(false);
    this.finished.set(false);
    this.result.set(null);
    this.firstPick = null;
    this.locked = false;
    this.stopTimer();
  }

  flip(card: MemoryCard): void {
    if (this.locked || card.flipped || card.matched || this.finished()) return;

    if (!this.started()) {
      this.started.set(true);
      this.timer = setInterval(() => this.seconds.update(s => s + 1), 1000);
    }

    card.flipped = true;
    this.cards.update(list => [...list]);

    if (!this.firstPick) {
      this.firstPick = card;
      return;
    }

    const first = this.firstPick;
    this.firstPick = null;
    this.moves.update(m => m + 1);

    if (first.pairKey === card.pairKey) {
      first.matched = card.matched = true;
      this.cards.update(list => [...list]);
      if (this.cards().every(c => c.matched)) this.complete();
      return;
    }

    this.locked = true;
    setTimeout(() => {
      first.flipped = card.flipped = false;
      this.cards.update(list => [...list]);
      this.locked = false;
    }, MISMATCH_DELAY_MS);
  }

  private async complete(): Promise<void> {
    this.stopTimer();
    this.finished.set(true);
    if (this.playsLeft <= 0) return;

    this.submitting.set(true);
    try {
      const res = await this.coinService.playGame('MEMORY', { moves: this.moves(), seconds: this.seconds() });
      this.result.set(res.amount);
      this.playsLeft = res.playsLeft;
      this.rewarded.emit(res.amount);
    } catch (err: any) {
      this.toastService.error(err.message);
    } finally {
      this.submitting.set(false);
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  formatTime(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
