import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../icon/icon.component';

/** Khoảng xem doanh số: số ngày gần nhất hoặc tự chọn trên lịch. */
export type SalesRange = 7 | 15 | 30 | 'custom';

export interface SalesRangeSelection {
  range: SalesRange;
  /** yyyy-mm-dd, chỉ có giá trị khi range là 'custom'. */
  from: string;
  to: string;
}

interface CalendarDay {
  iso: string;
  day: number;
  disabled: boolean;
  isEdge: boolean;
  inRange: boolean;
  isToday: boolean;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Chuỗi yyyy-mm-dd theo giờ máy, so sánh được trực tiếp như chuỗi (toISOString sẽ lệch ngày vì dùng UTC). */
function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Nút thu gọn: bấm mới hiện các khoảng có sẵn, chọn "Tùy chọn" thì hiện lịch để chọn ngày đầu và ngày cuối. */
@Component({
  selector: 'app-sales-range-picker',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './sales-range-picker.component.html',
})
export class SalesRangePickerComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true }) range!: SalesRange;
  @Input() from = '';
  @Input() to = '';
  /** Nhãn khoảng đang chọn, hiện trên nút. */
  @Input() label = '';
  @Output() selected = new EventEmitter<SalesRangeSelection>();

  readonly presets: Exclude<SalesRange, 'custom'>[] = [7, 15, 30];
  readonly weekdays = WEEKDAYS;

  open = false;
  view: 'menu' | 'calendar' = 'menu';
  draftFrom = '';
  draftTo = '';
  viewYear = 0;
  viewMonth = 0;

  private readonly now = new Date();
  private readonly todayIso = toIso(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());

  toggle(): void {
    this.open = !this.open;
    this.view = 'menu';
  }

  choosePreset(range: Exclude<SalesRange, 'custom'>): void {
    this.selected.emit({ range, from: '', to: '' });
    this.open = false;
  }

  openCalendar(): void {
    this.draftFrom = this.range === 'custom' ? this.from : '';
    this.draftTo = this.range === 'custom' ? this.to : '';
    const [year, month] = (this.draftTo || this.todayIso).split('-').map(Number);
    this.viewYear = year;
    this.viewMonth = month - 1;
    this.view = 'calendar';
  }

  /** Lần bấm đầu chọn ngày bắt đầu, lần sau chọn ngày kết thúc; bấm ngày sớm hơn thì tự đảo lại. */
  pickDay(iso: string): void {
    if (!this.draftFrom || this.draftTo) {
      this.draftFrom = iso;
      this.draftTo = '';
    } else if (iso < this.draftFrom) {
      this.draftTo = this.draftFrom;
      this.draftFrom = iso;
    } else {
      this.draftTo = iso;
    }
  }

  apply(): void {
    if (!this.draftFrom || !this.draftTo) return;
    this.selected.emit({ range: 'custom', from: this.draftFrom, to: this.draftTo });
    this.open = false;
  }

  shiftMonth(delta: number): void {
    const next = new Date(this.viewYear, this.viewMonth + delta, 1);
    this.viewYear = next.getFullYear();
    this.viewMonth = next.getMonth();
  }

  get canGoNext(): boolean {
    return toIso(this.viewYear, this.viewMonth, 1) < toIso(this.now.getFullYear(), this.now.getMonth(), 1);
  }

  get monthLabel(): string {
    return `Tháng ${this.viewMonth + 1}, ${this.viewYear}`;
  }

  /** Ô trống đầu tháng để ngày 1 nằm đúng cột thứ (tuần bắt đầu từ thứ Hai). */
  get leadingBlanks(): number[] {
    const offset = (new Date(this.viewYear, this.viewMonth, 1).getDay() + 6) % 7;
    return Array.from({ length: offset }, (_, i) => i);
  }

  get days(): CalendarDay[] {
    const count = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => {
      const iso = toIso(this.viewYear, this.viewMonth, i + 1);
      return {
        iso,
        day: i + 1,
        disabled: iso > this.todayIso,
        isEdge: iso === this.draftFrom || iso === this.draftTo,
        inRange: !!this.draftFrom && !!this.draftTo && iso > this.draftFrom && iso < this.draftTo,
        isToday: iso === this.todayIso,
      };
    });
  }

  trackDay(_: number, day: CalendarDay): string {
    return day.iso;
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
