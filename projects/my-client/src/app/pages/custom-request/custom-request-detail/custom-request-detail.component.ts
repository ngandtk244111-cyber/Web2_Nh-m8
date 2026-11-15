import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomRequestService } from '../../../core/services/custom-request.service';
import { CustomRequest } from '../../../core/models/custom-request.model';
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
export class CustomRequestDetailComponent implements OnInit {
  request: CustomRequest | undefined;
  chatInput = '';
  private currentId: string | null = null;

  constructor(
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
      this.currentId = params.get('id');
      if (this.currentId) {
        this.request = this.customRequestService.getRequestById(this.currentId);
      }
    });
  }

  sendChatMessage(): void {
    if (!this.request || !this.chatInput.trim()) return;
    const text = this.chatInput.trim();
    this.customRequestService.sendMessage(this.request.id, text);
    this.chatInput = '';
    // Kỹ thuật viên trả lời từ trang admin; server tự xác định người gửi theo token nên FE không giả lập trả lời.
  }

}
