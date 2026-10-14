import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomRequestService } from '../../../core/services/custom-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { DesignBrief } from '../../../core/models/custom-request.model';
import { AppIconComponent } from '../../../components/icon/icon.component';
import {
  PRINT_BUDGET_OPTIONS,
  PRINT_LIMITS,
  PRINT_MATERIALS,
  PRINT_PROCESS,
  PRINT_PRODUCT_TYPES,
  PRINT_PROHIBITED,
  PrintMaterialKey,
  PrintRequestErrors,
  PrintRequestInput,
  materialsFor,
  parseSizeText,
  validatePrintRequest,
} from '../../../core/data/print-request-rules';

@Component({
  selector: 'app-custom-request-new',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent],
  templateUrl: './custom-request-new.component.html',
  styleUrl: './custom-request-new.component.css'
})
export class CustomRequestNewComponent implements OnInit {
  customerName = '';
  customerEmail = '';
  customerPhone = '';
  title = '';
  referenceImageUrl = '';
  aiConceptImage: string | undefined;
  fromAi = false;

  // Quy cách in 3D
  material: PrintMaterialKey | '' = '';
  lengthCm: number | null = null;
  widthCm: number | null = null;
  heightCm: number | null = null;
  agreeRules = false;

  /** Chỉ hiện lỗi sau lần bấm gửi đầu tiên để không "mắng" người dùng khi vừa mở form. */
  submitted = false;
  errors: PrintRequestErrors = {};
  /** Lỗi server trả về (server kiểm tra lại quy tắc in 3D). */
  serverError = '';
  sending = false;

  readonly limits = PRINT_LIMITS;
  readonly productTypes = PRINT_PRODUCT_TYPES;
  readonly budgetOptions = PRINT_BUDGET_OPTIONS;
  readonly prohibited = PRINT_PROHIBITED;
  readonly process = PRINT_PROCESS;
  readonly allMaterials = PRINT_MATERIALS;

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
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.customerName = user.fullName || '';
      this.customerEmail = user.email || '';
      this.customerPhone = user.phoneNumber || '';
    }

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
      // Brief từ AI là chữ tự do — chỉ giữ loại sản phẩm/ngân sách nếu khớp lựa chọn có sẵn, tách số đo từ "size".
      if (!this.productTypes.some(t => t.label === this.brief.productType)) this.brief.productType = '';
      if (!this.budgetOptions.includes(this.brief.estimatedBudget || '')) this.brief.estimatedBudget = '';
      [this.lengthCm, this.widthCm, this.heightCm] = parseSizeText(this.brief.size || '');
    }
  }

  /** Chất liệu được phép theo loại sản phẩm đang chọn. */
  get materialOptions() {
    return this.brief.productType ? materialsFor(this.brief.productType) : this.allMaterials;
  }

  get maxCm(): number {
    return this.allMaterials.find(m => m.key === this.material)?.maxCm ?? this.limits.maxCm;
  }

  onProductTypeChange(): void {
    // Đổi sang loại không hỗ trợ chất liệu đang chọn (vd. đèn + resin) → bỏ chọn chất liệu.
    if (this.material && !this.materialOptions.some(m => m.key === this.material)) this.material = '';
    this.revalidate();
  }

  revalidate(): void {
    if (this.submitted) this.errors = validatePrintRequest(this.formInput());
  }

  get errorCount(): number {
    return Object.keys(this.errors).length;
  }

  private formInput(): PrintRequestInput {
    return {
      title: this.title,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      productType: this.brief.productType,
      material: this.material,
      lengthCm: this.lengthCm,
      widthCm: this.widthCm,
      heightCm: this.heightCm,
      theme: this.brief.theme,
      notes: this.brief.notes || '',
      customText: this.brief.customText || '',
      estimatedBudget: this.brief.estimatedBudget || '',
      referenceImageUrl: this.referenceImageUrl,
      agreeRules: this.agreeRules,
    };
  }

  submitRequest(): void {
    this.submitted = true;
    this.errors = validatePrintRequest(this.formInput());
    if (this.errorCount > 0) {
      document.querySelector('.crn-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.serverError = '';
    this.sending = true;
    const customerImages = this.referenceImageUrl.trim() ? [this.referenceImageUrl.trim()] : [];

    this.customRequestService.createRequest({
      title: this.title.trim(),
      customerName: this.customerName.trim(),
      customerEmail: this.customerEmail.trim(),
      customerPhone: this.customerPhone.replace(/[\s.]/g, ''),
      brief: {
        ...this.brief,
        size: `${this.lengthCm} x ${this.widthCm} x ${this.heightCm} cm`,
        customText: (this.brief.customText || '').trim(),
        printMaterial: this.material,
        dimensionsCm: { length: this.lengthCm, width: this.widthCm, height: this.heightCm },
        agreedPrintRules: true,
      },
      customerImages,
      aiConceptImage: this.aiConceptImage,
    }).subscribe({
      next: newReq => this.router.navigate(['/custom-request', newReq.id]),
      error: err => {
        this.sending = false;
        this.serverError = err?.error?.error || 'Không gửi được yêu cầu, vui lòng thử lại.';
      },
    });
  }
}
