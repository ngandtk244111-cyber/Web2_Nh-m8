import { Injectable, computed, signal } from '@angular/core';

export type MascotExpression = 'idle' | 'thinking' | 'happy' | 'surprised' | 'confident' | 'sad' | 'angry';

const DEFAULT_HOLD_MS = 2600;
/** Loading ngắn hơn ngưỡng này thì mascot không đổi biểu cảm (tránh nhấp nháy). */
const LOADING_SHOW_DELAY_MS = 300;
/** Loading lâu hơn ngưỡng này coi như bị bỏ quên -> tự quay về idle. */
const LOADING_MAX_MS = 20000;
/** 'thinking' luôn hiện ít nhất chừng này trước khi đổi sang biểu cảm kết quả — đủ để thấy, không nháy. */
const MIN_THINKING_MS = 700;

/**
 * Điều phối biểu cảm mascot Goh theo trạng thái tương tác thực của site (AI chat, tìm kiếm,
 * giỏ hàng, đăng nhập, flash sale, tùy biến 3D...). Biểu cảm phản ứng (react) tự quay về 'idle'
 * sau một khoảng ngắn; 'thinking' là trạng thái liên tục, chỉ đổi khi gọi stopThinking().
 */
@Injectable({ providedIn: 'root' })
export class MascotService {
  private readonly expressionSignal = signal<MascotExpression>('idle');
  readonly expression = this.expressionSignal.asReadonly();
  /** Ảnh tương ứng biểu cảm hiện tại — cho các nơi hiển thị mascot ngoài floating-mascot (vd: modal chat AI,
   *  vốn phủ lên và che mất mascot nổi). */
  readonly image = computed(() => {
    const e = this.expressionSignal();
    return e === 'idle' ? 'assets/mascot/goh-mascot.png' : `assets/mascot/goh-${e}.png`;
  });

  private revertTimer: ReturnType<typeof setTimeout> | null = null;
  /** Thời điểm bắt đầu hiện 'thinking' — để giữ đủ MIN_THINKING_MS trước khi đổi sang kết quả. */
  private thinkingSince: number | null = null;
  /** Biểu cảm kết quả đang chờ vì 'thinking' chưa hiện đủ lâu. */
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  /** Biểu cảm phản ứng nhất thời (happy/sad/surprised/confident/angry) — tự quay về idle sau holdMs.
   *  Nếu 'thinking' vừa mới hiện thì đợi đủ MIN_THINKING_MS rồi mới đổi, tránh nháy. */
  react(expression: MascotExpression, holdMs = DEFAULT_HOLD_MS): void {
    this.afterMinThinking(() => {
      this.expressionSignal.set(expression);
      if (expression !== 'thinking') {
        this.revertTimer = setTimeout(() => {
          this.expressionSignal.set('idle');
          this.revertTimer = null;
        }, holdMs);
      }
    });
  }

  /** AI/chatbot đang xử lý — giữ nguyên biểu cảm cho tới khi stopThinking(). */
  startThinking(): void {
    this.clearRevertTimer();
    this.clearPendingTimer();
    if (this.expressionSignal() !== 'thinking' || this.thinkingSince === null) {
      this.thinkingSince = Date.now();
    }
    this.expressionSignal.set('thinking');
  }

  /** Kết thúc thinking, chuyển sang biểu cảm kết quả (mặc định idle). Không làm gì nếu không đang thinking. */
  stopThinking(nextExpression: MascotExpression = 'idle', holdMs = DEFAULT_HOLD_MS): void {
    if (this.expressionSignal() !== 'thinking') return;
    if (nextExpression === 'idle') {
      this.afterMinThinking(() => this.expressionSignal.set('idle'));
      return;
    }
    this.react(nextExpression, holdMs);
  }

  /** Chạy apply ngay, hoặc hoãn tới khi 'thinking' đã hiện đủ MIN_THINKING_MS. Lần gọi sau thay thế lần trước. */
  private afterMinThinking(apply: () => void): void {
    this.clearPendingTimer();
    const run = () => {
      this.pendingTimer = null;
      this.clearRevertTimer();
      this.thinkingSince = null;
      apply();
    };
    const elapsed = this.thinkingSince === null ? Infinity : Date.now() - this.thinkingSince;
    const remaining = this.expressionSignal() === 'thinking' ? MIN_THINKING_MS - elapsed : 0;
    if (remaining > 0) this.pendingTimer = setTimeout(run, remaining);
    else run();
  }

  // ---------- Loading (tải dữ liệu, gửi form, dựng model 3D...) ----------

  /** Số tác vụ loading đang chạy — nhiều nơi có thể loading cùng lúc. */
  private loadingCount = 0;
  private loadingShowTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Bắt đầu 1 tác vụ loading; phải gọi endLoading() tương ứng.
   * - immediate: thao tác do người dùng bấm (gửi form, đặt hàng...) -> hiện 'thinking' ngay, giữ tối thiểu
   *   MIN_THINKING_MS để người dùng thấy được phản hồi.
   * - mặc định: tải nền (dữ liệu, dựng lại model 3D) -> chỉ hiện nếu kéo dài quá LOADING_SHOW_DELAY_MS,
   *   tránh đổi biểu cảm liên tục cho các lần tải rất nhanh.
   */
  beginLoading(options: { immediate?: boolean } = {}): void {
    this.loadingCount++;
    if (this.loadingCount === 1) {
      // Chốt an toàn: nơi gọi quên endLoading (component bị huỷ giữa chừng...) thì không kẹt 'thinking' mãi.
      this.loadingSafetyTimer = setTimeout(() => this.resetLoading(), LOADING_MAX_MS);
    }
    if (options.immediate) {
      if (this.loadingShowTimer) clearTimeout(this.loadingShowTimer);
      this.loadingShowTimer = null;
      this.startThinking();
      return;
    }
    if (this.loadingCount === 1 && this.expressionSignal() !== 'thinking') {
      this.loadingShowTimer = setTimeout(() => {
        this.loadingShowTimer = null;
        if (this.loadingCount > 0) this.startThinking();
      }, LOADING_SHOW_DELAY_MS);
    }
  }

  /** Kết thúc 1 tác vụ loading; khi không còn tác vụ nào thì chuyển sang biểu cảm kết quả (mặc định idle). */
  endLoading(nextExpression: MascotExpression = 'idle'): void {
    if (this.loadingCount === 0) return;
    this.loadingCount--;
    if (this.loadingCount > 0) return;
    this.clearLoadingTimers();
    if (nextExpression === 'idle') this.stopThinking('idle');
    else this.react(nextExpression);
  }

  private resetLoading(): void {
    this.loadingCount = 0;
    this.clearLoadingTimers();
    this.stopThinking('idle');
  }

  private clearLoadingTimers(): void {
    if (this.loadingShowTimer) clearTimeout(this.loadingShowTimer);
    if (this.loadingSafetyTimer) clearTimeout(this.loadingSafetyTimer);
    this.loadingShowTimer = null;
    this.loadingSafetyTimer = null;
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private clearRevertTimer(): void {
    if (this.revertTimer) {
      clearTimeout(this.revertTimer);
      this.revertTimer = null;
    }
  }
}
