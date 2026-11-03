import { AfterViewInit, DestroyRef, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Vietnamese } from 'flatpickr/dist/l10n/vn';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';

/**
 * Ô chọn ngày Flatpickr thay cho `<input type="date">` (theo vc-flatpickr của Vita).
 * Dùng với `[(ngModel)]` chuỗi `yyyy-MM-dd`.
 */
@Directive({
  selector: '[appDatePicker]',
  standalone: true,
  host: { autocomplete: 'off' },
})
export class DatePickerDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private fp: FlatpickrInstance | null = null;

  ngAfterViewInit(): void {
    const input = this.el.nativeElement;
    const ctrl = this.ngControl?.control;
    const initial = String(ctrl?.value ?? input.value ?? '').trim();

    this.fp = flatpickr(input, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      locale: Vietnamese,
      allowInput: true,
      disableMobile: true,
      defaultDate: initial || undefined,
      onChange: (_dates: Date[], dateStr: string) => {
        if (ctrl) {
          ctrl.setValue(dateStr);
          ctrl.markAsDirty();
        } else {
          input.value = dateStr;
        }
      },
    });

    // Giá trị đổi từ code (vd nút "Xoá lọc") thì lịch cập nhật theo.
    ctrl?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v => {
      if (!this.fp) return;
      const str = v == null ? '' : String(v).trim();
      const sel = this.fp.selectedDates[0];
      if (str === (sel ? this.fp.formatDate(sel, 'Y-m-d') : '')) return;
      if (str) this.fp.setDate(str, false);
      else this.fp.clear(false);
    });
  }

  ngOnDestroy(): void {
    this.fp?.destroy();
    this.fp = null;
  }
}
