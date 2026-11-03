import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Chân bảng: "Hiển thị x–y / tổng" + nút trang. Danh sách dài (~700 sản phẩm) chỉ vẽ 1 trang
 * để trang không bị đơ khi gõ tìm kiếm.
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-footer" *ngIf="total > 0">
      <span>Hiển thị {{ from }}–{{ to }} / {{ total }}</span>
      <div class="pager" *ngIf="pageCount > 1">
        <button type="button" class="icon-btn" [disabled]="page <= 1" (click)="go(page - 1)" title="Trang trước">
          <i class="bi bi-chevron-left"></i>
        </button>
        <ng-container *ngFor="let p of pages">
          <span *ngIf="p === 0" class="dots">…</span>
          <button *ngIf="p > 0" type="button" class="page-btn" [class.active]="p === page" (click)="go(p)">{{ p }}</button>
        </ng-container>
        <button type="button" class="icon-btn" [disabled]="page >= pageCount" (click)="go(page + 1)" title="Trang sau">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pager { display: flex; align-items: center; gap: 4px; }
    .page-btn {
      min-width: 32px; height: 32px; padding: 0 8px;
      border: 1px solid var(--color-neutral-40); border-radius: var(--radius-md);
      background: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .page-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .page-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
    .dots { padding: 0 4px; color: var(--color-text-tertiary); }
  `],
})
export class PagerComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 20;
  @Output() pageChange = new EventEmitter<number>();

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get from(): number {
    return this.total ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get to(): number {
    return Math.min(this.total, this.page * this.pageSize);
  }

  /** Trang đầu, cuối và 2 trang quanh trang hiện tại; 0 = dấu "…". */
  get pages(): number[] {
    const last = this.pageCount;
    const set = [...new Set([1, last, this.page - 1, this.page, this.page + 1])].filter(p => p >= 1 && p <= last).sort((a, b) => a - b);
    const out: number[] = [];
    set.forEach((p, i) => {
      if (i > 0 && p - set[i - 1] > 1) out.push(0);
      out.push(p);
    });
    return out;
  }

  go(p: number): void {
    if (p < 1 || p > this.pageCount || p === this.page) return;
    this.pageChange.emit(p);
  }
}

/** Cắt 1 trang từ danh sách đã lọc. */
export function pageSlice<T>(rows: T[], page: number, pageSize = 20): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}
