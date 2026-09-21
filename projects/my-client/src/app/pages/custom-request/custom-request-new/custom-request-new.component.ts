import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomRequestService } from '../../../core/services/custom-request.service';
import { DesignBrief } from '../../../core/models/custom-request.model';
import { AppIconComponent } from '../../../components/icon/icon.component';

@Component({
  selector: 'app-custom-request-new',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent],
  templateUrl: './custom-request-new.component.html',
  styleUrl: './custom-request-new.component.css'
})
export class CustomRequestNewComponent implements OnInit {
  customerName = 'Nguyễn Thảo My';
  customerEmail = 'thaomy.nguyen@gmail.com';
  customerPhone = '0912 345 678';
  title = '';
  referenceImageUrl = '';
  aiConceptImage: string | undefined;
  fromAi = false;

  brief: DesignBrief = {
    productType: '',
    theme: '',
    style: '',
    color: '',
    size: '',
    usage: '',
    customText: '',
    estimatedBudget: '',
    notes: '',
  };

  constructor(
    private customRequestService: CustomRequestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check navigation state if transferred from AI Assistant
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras.state || history.state;

    if (state && state.brief) {
      this.brief = { ...this.brief, ...state.brief };
      this.title = `${this.brief.productType} - ${this.brief.theme}`;
      this.fromAi = true;
      if (state.aiConceptImage) {
        this.aiConceptImage = state.aiConceptImage;
      }
    }
  }

  submitRequest(): void {
    if (!this.title || !this.customerName || !this.customerEmail) return;

    const customerImages = this.referenceImageUrl ? [this.referenceImageUrl] : [];

    this.customRequestService.createRequest({
      title: this.title,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      brief: this.brief,
      customerImages,
      aiConceptImage: this.aiConceptImage,
    }).subscribe(newReq => {
      this.router.navigate(['/custom-request', newReq.id]);
    });
  }
}
