import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomRequestService } from '../../../core/services/custom-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { CustomRequest, RequestChatMessage } from '../../../core/models/custom-request.model';
import { ThreeViewerComponent } from '../../../components/three-viewer/three-viewer.component';
import { QuotePanelComponent } from '../../../components/quote-panel/quote-panel.component';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-custom-request-detail',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterLink, 
    ThreeViewerComponent, 
    AppIconComponent,
    VndPipe,
    QuotePanelComponent
  ],
  templateUrl: './custom-request-detail.component.html',
  styleUrl: './custom-request-detail.component.css'
})
export class CustomRequestDetailComponent implements OnInit, OnDestroy {
  request: CustomRequest | undefined;
  chatInput = '';
  sending = false;
  /** Link ảnh tham khảo không tải được (link hỏng / link trang web). */
  readonly brokenImages = new Set<string>();
  private stopWatching?: () => void;
  get fromAccount(): boolean { return this.route.snapshot.queryParamMap.get('from') === 'account'; }
  private currentId: string | null = null;

  constructor(
    public auth: AuthService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private customRequestService: CustomRequestService,
    private router: Router
  ) {
    // requests giờ nạp/cập nhật bất đồng bộ từ backend — effect() tự đồng bộ this.request
    // lại mỗi khi signal đổi (kể cả sau khi gửi tin nhắn/duyệt giá qua API).
    effect(() => {
      this.customRequestService.requests();
      if (this.currentId) {
        this.request = this.customRequestService.getRequestById(this.currentId);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.stopWatching?.();
      this.currentId = params.get('id');
      if (this.currentId) this.stopWatching = this.customRequestService.watch(this.currentId);
      this.customRequestService.refresh();
      if (this.currentId) {
        this.request = this.customRequestService.getRequestById(this.currentId);
      }
    });
  }

  ngOnDestroy(): void { this.stopWatching?.(); }

  messageAvatar(message: RequestChatMessage): string | null {
    if (message.sender === 'AI_ASSISTANT') return 'assets/mascot/goh-mascot.png';
    if (message.sender !== 'CUSTOMER') return 'assets/logo/lumea-mark.png';
    return this.auth.getAvatarUrl(this.auth.currentUser()?.avatar || this.request?.customerAvatar);
  }

  sendChatMessage(): void {
    if (!this.request || !this.chatInput.trim() || this.sending) return;
    const text = this.chatInput.trim();
    this.sending = true;
    this.customRequestService.sendMessage(this.request.id, text).subscribe({
      next: () => { this.chatInput = ''; this.sending = false; },
      error: () => { this.sending = false; this.toast.error('Chưa gửi được tin nhắn. Vui lòng thử lại.'); },
    });
    // Kỹ thuật viên trả lời từ trang admin; server tự xác định người gửi theo token nên FE không giả lập trả lời.
  }

}
