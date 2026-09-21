import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomRequestService } from '../../../core/services/custom-request.service';
import { AiAssistantService } from '../../../core/services/ai-assistant.service';
import { CustomRequest } from '../../../core/models/custom-request.model';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-custom-request-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './custom-request-list.component.html',
  styleUrl: './custom-request-list.component.css'
})
export class CustomRequestListComponent implements OnInit {
  requests: CustomRequest[] = [];

  constructor(
    private customRequestService: CustomRequestService,
    private aiService: AiAssistantService
  ) {
    effect(() => {
      this.requests = this.customRequestService.requests();
    });
  }

  ngOnInit(): void {}

  openAiAssistant(): void {
    this.aiService.openModal();
  }
}
