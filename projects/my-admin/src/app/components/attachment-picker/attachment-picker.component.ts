import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Attachment, DocumentService } from '../../core/services/document.service';
import { ToastService } from '../../core/services/toast.service';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Chọn & tải chứng từ (PDF / ảnh) — dùng ở phiếu nhập/xuất kho, hồ sơ xưởng. Tải lên ngay khi chọn,
 * trả danh sách attachment qua (attachmentsChange); bấm tên file để xem.
 */
@Component({
  selector: 'app-attachment-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ap">
      <div class="ap-list" *ngIf="attachments.length">
        <div class="ap-file" *ngFor="let a of attachments; let i = index">
          <i class="bi" [ngClass]="a.contentType === 'application/pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image'"></i>
          <button type="button" class="ap-name" (click)="docs.open(a)" [title]="'Xem ' + a.name">{{ a.name }}</button>
          <span class="ap-size">{{ sizeLabel(a.size) }}</span>
          <button type="button" class="ap-remove" *ngIf="!disabled" (click)="remove(i)" aria-label="Bỏ file">&times;</button>
        </div>
      </div>
      <label class="ap-drop" *ngIf="!disabled && attachments.length < max" [class.ap-drop--busy]="uploading()">
        <input type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp" (change)="onPick($event)" [disabled]="uploading()" hidden>
        <i class="bi" [ngClass]="uploading() ? 'bi-hourglass-split' : 'bi-paperclip'"></i>
        {{ uploading() ? 'Đang tải lên...' : label }}
      </label>
      <div class="form-hint mb-0">PDF hoặc ảnh JPG/PNG/WEBP, tối đa 10MB mỗi file, {{ max }} file.</div>
    </div>
  `,
  styles: [`
    .ap { display: flex; flex-direction: column; gap: 6px; }
    .ap-list { display: flex; flex-direction: column; gap: 4px; }
    .ap-file { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--color-neutral-30); border-radius: var(--radius-md); font-size: 13px; }
    .ap-file .bi { color: var(--color-primary); }
    .ap-name { flex: 1; min-width: 0; padding: 0; border: 0; background: none; text-align: left; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    .ap-name:hover { text-decoration: underline; }
    .ap-size { color: var(--color-text-tertiary); font-size: 12px; }
    .ap-remove { border: 0; background: none; font-size: 18px; line-height: 1; color: var(--color-text-secondary); cursor: pointer; }
    .ap-drop { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 12px; border: 1px dashed var(--color-neutral-50); border-radius: var(--radius-md); font-size: 13px; color: var(--color-text-secondary); cursor: pointer; }
    .ap-drop:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .ap-drop--busy { cursor: progress; opacity: 0.7; }
  `],
})
export class AttachmentPickerComponent {
  readonly docs = inject(DocumentService);
  private toast = inject(ToastService);

  @Input() attachments: Attachment[] = [];
  @Output() attachmentsChange = new EventEmitter<Attachment[]>();
  @Input() label = 'Đính kèm chứng từ (hoá đơn, phiếu giao nhận, ảnh...)';
  @Input() max = 5;
  @Input() disabled = false;

  uploading = signal(false);

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []).slice(0, this.max - this.attachments.length);
    input.value = '';
    if (!files.length) return;
    if (files.some(f => !ACCEPT.includes(f.type))) {
      this.toast.warning('Chỉ nhận file PDF hoặc ảnh JPG, PNG, WEBP');
      return;
    }
    if (files.some(f => f.size > MAX_SIZE)) {
      this.toast.warning('Mỗi file không được vượt quá 10MB');
      return;
    }
    this.uploading.set(true);
    this.docs.upload(files).subscribe({
      next: added => {
        this.uploading.set(false);
        this.attachments = [...this.attachments, ...added];
        this.attachmentsChange.emit(this.attachments);
      },
      error: err => {
        this.uploading.set(false);
        this.toast.apiError(err, 'Không tải được file lên');
      },
    });
  }

  remove(index: number): void {
    this.attachments = this.attachments.filter((_, i) => i !== index);
    this.attachmentsChange.emit(this.attachments);
  }

  sizeLabel(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
