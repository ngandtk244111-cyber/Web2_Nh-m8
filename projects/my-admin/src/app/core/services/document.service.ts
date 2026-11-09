import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Chứng từ đính kèm (hoá đơn, phiếu giao nhận, hợp đồng...) — lưu ở server, chỉ nhân viên xem được. */
export interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  /** Đường dẫn tương đối kiểu /api/admin-documents/:id */
  url: string;
}

const BASE = `${environment.apiUrl}/admin-documents`;
/** apiUrl bỏ phần /api — ghép với attachment.url (đã có /api). */
const API_ORIGIN = environment.apiUrl.replace(/\/api\/?$/, '');

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);

  upload(files: File[]): Observable<Attachment[]> {
    const form = new FormData();
    files.forEach(f => form.append('files', f, f.name));
    return this.http.post<{ success: boolean; attachments: Attachment[] }>(BASE, form).pipe(map(res => res.attachments || []));
  }

  /**
   * Mở chứng từ ở tab mới. Route tải cần token nhân viên nên không mở link trực tiếp được — tải bằng
   * HttpClient (interceptor gắn token) rồi mở bản blob.
   */
  open(attachment: Attachment): void {
    // Mở tab trước (trong cùng cú click) để trình duyệt không chặn popup, đổ nội dung khi tải xong.
    const tab = window.open('', '_blank');
    this.http.get(API_ORIGIN + attachment.url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => tab?.close(),
    });
  }
}
