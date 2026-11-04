import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { MascotLoadingComponent } from '../../components/mascot-loading/mascot-loading.component';

type SettingsTab = 'general' | 'print3d' | 'loyalty' | 'payment';

/** Mặc định khi chưa lưu lần nào trên server. */
const DEFAULT_SETTINGS = {
  storeName: 'Luméa Modern Home & 3D Décor',
  slogan: 'Nội thất tối giản & Decor in 3D cá nhân hóa',
  hotline: '1900 888 333',
  supportEmail: 'contact@lumea.vn',
  showroomAddress: 'Tầng 2, Tháp Design, 128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Quận 3, TP.HCM',
  businessHours: '08:30 - 21:00 (Thứ 2 - Chủ Nhật)',
  plaPerGram: 1800,
  resinPerGram: 3200,
  woodPerGram: 2400,
  finishLaborFee: 45000,
  defaultLeadDays: 4,
  earnCoinRate: 100000,
  coinRedeemValue: 1000,
  maxCoinPerOrder: 30,
  enableCod: true,
  /** Đơn COD dưới mức này (và không có hàng in 3D) giao luôn, không cần gọi xác nhận — server/utils/cod-policy.js. */
  codConfirmThreshold: 500000,
  enableBankQr: true,
  enableMomo: true,
  enableZaloPay: true,
};

export type StoreSettings = typeof DEFAULT_SETTINGS;

const NUMBER_FIELDS: (keyof StoreSettings)[] = [
  'plaPerGram', 'resinPerGram', 'woodPerGram', 'finishLaborFee', 'defaultLeadDays', 'earnCoinRate', 'coinRedeemValue', 'maxCoinPerOrder', 'codConfirmThreshold',
];

/** Cài đặt hệ thống — thông tin cửa hàng, đơn giá in 3D, Xu thưởng, cổng thanh toán (config 'settings'). */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MascotLoadingComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  private configService = inject(AdminConfigService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'general', label: 'Cửa hàng & showroom', icon: 'bi-shop' },
    { key: 'print3d', label: 'Đơn giá in 3D', icon: 'bi-printer' },
    { key: 'loyalty', label: 'Xu thưởng', icon: 'bi-coin' },
    { key: 'payment', label: 'Thanh toán', icon: 'bi-credit-card' },
  ];

  tab = signal<SettingsTab>('general');
  form: StoreSettings = { ...DEFAULT_SETTINGS };
  saving = false;
  dirty = false;

  readonly loading = computed(() => !this.configService.config());

  constructor() {
    // Có cấu hình từ server thì nạp vào form (chỉ khi người dùng chưa sửa dở).
    effect(() => {
      const saved = this.configService.config()?.settings;
      untracked(() => {
        if (!this.dirty) this.form = { ...DEFAULT_SETTINGS, ...(saved || {}) };
      });
    });
  }

  ngOnInit(): void {
    this.configService.load(true);
  }

  get canEdit(): boolean {
    return this.adminAuth.can('settings.edit');
  }

  markDirty(): void {
    this.dirty = true;
  }

  reset(): void {
    this.dirty = false;
    this.form = { ...DEFAULT_SETTINGS, ...(this.configService.get<Partial<StoreSettings>>('settings') || {}) };
  }

  save(): void {
    if (!this.canEdit || this.saving) return;
    const f = this.form;
    if (!f.storeName.trim()) {
      this.tab.set('general');
      this.toast.warning('Vui lòng nhập tên cửa hàng');
      return;
    }
    if (f.supportEmail.trim() && !/^\S+@\S+\.\S+$/.test(f.supportEmail.trim())) {
      this.tab.set('general');
      this.toast.warning('Email hỗ trợ không hợp lệ');
      return;
    }
    const bad = NUMBER_FIELDS.find(k => !(Number(f[k]) >= 0));
    if (bad) {
      this.toast.warning('Các ô số phải là số không âm');
      return;
    }
    if (Number(f.maxCoinPerOrder) > 100) {
      this.tab.set('loyalty');
      this.toast.warning('Tỉ lệ dùng Xu tối đa không được quá 100%');
      return;
    }
    if (!f.enableCod && !f.enableBankQr && !f.enableMomo && !f.enableZaloPay) {
      this.tab.set('payment');
      this.toast.warning('Cần bật ít nhất 1 hình thức thanh toán');
      return;
    }
    const value: StoreSettings = { ...f };
    for (const k of NUMBER_FIELDS) (value as any)[k] = Number(f[k]);
    for (const k of ['storeName', 'slogan', 'hotline', 'supportEmail', 'showroomAddress', 'businessHours'] as const) value[k] = f[k].trim();

    this.saving = true;
    this.configService.save('settings', value).subscribe({
      next: () => {
        this.saving = false;
        this.dirty = false;
        this.form = { ...value };
        this.toast.success('Đã lưu cài đặt hệ thống');
        this.audit.record('Cài Đặt', 'Cập nhật cài đặt hệ thống', 'Thông tin cửa hàng, bảng giá in 3D, Xu thưởng & thanh toán', 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được cài đặt lên server');
      },
    });
  }
}
