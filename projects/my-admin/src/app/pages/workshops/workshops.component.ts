import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminConfigService } from '../../core/services/admin-config.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { WorkshopReceipt, WorkshopReceiptService } from '../../core/services/workshop-receipt.service';
import { SPECIALTY_KEYS, WORKSHOP_SPECIALTIES, Workshop, WorkshopSpecialty, specialtyLabels, workshopFor } from '../../core/data/workshops';
import { Product } from '../../core/models/product.model';
import { PagerComponent, pageSlice } from '../../components/pager/pager.component';
import { exportXlsx } from '../../shared/utils/export';
import { Attachment } from '../../core/services/document.service';
import { CONTACT_CHANNELS, ContactChannel, WorkshopContactService } from '../../core/services/workshop-contact.service';
import { AttachmentPickerComponent } from '../../components/attachment-picker/attachment-picker.component';
import { DocumentService } from '../../core/services/document.service';

type WorkshopFilter = 'ALL' | 'ACTIVE' | 'PAUSED';
type DetailTab = 'products' | 'receipts' | 'contracts' | 'contacts';

/** Xưởng sản xuất đối tác — lưu ở cấu hình 'workshops'. Sản phẩm tự gắn xưởng theo nhóm hàng. */
@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PagerComponent, AttachmentPickerComponent],
  templateUrl: './workshops.component.html',
  styleUrl: './workshops.component.css',
})
export class WorkshopsComponent implements OnInit {
  private config = inject(AdminConfigService);
  readonly adminAuth = inject(AdminAuthService);
  private productService = inject(ProductService);
  private receiptService = inject(WorkshopReceiptService);
  private contactService = inject(WorkshopContactService);
  readonly docs = inject(DocumentService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);

  readonly specialtyKeys = SPECIALTY_KEYS;
  readonly specialtyNames = WORKSHOP_SPECIALTIES;
  readonly specialtyLabels = specialtyLabels;

  readonly workshops = computed<Workshop[]>(() => this.config.get<Workshop[]>('workshops') || []);
  readonly loading = computed(() => this.config.config() === null);

  /** Sản phẩm phụ trách của từng xưởng (tự gán + chọn riêng). */
  readonly productsByWorkshop = computed(() => {
    const map = new Map<string, Product[]>();
    const list = this.workshops();
    for (const p of this.productService.products()) {
      const w = workshopFor(p, list);
      if (w) map.set(w.id, [...(map.get(w.id) || []), p]);
    }
    return map;
  });

  readonly unassignedCount = computed(() => {
    const list = this.workshops();
    return this.productService.products().filter(p => !workshopFor(p, list)).length;
  });

  filter = signal<WorkshopFilter>('ALL');
  search = signal('');

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.workshops().filter(w =>
      (this.filter() === 'ALL' || (this.filter() === 'ACTIVE') === (w.active !== false)) &&
      (!q || [w.code, w.name, w.contact, w.phone, w.address, specialtyLabels(w)].some(v => (v || '').toLowerCase().includes(q))));
  });

  // ---------- Modal thêm / sửa ----------
  showModal = false;
  editing: Workshop | null = null;
  form: Omit<Workshop, 'id'> = this.emptyForm();
  saving = signal(false);

  // ---------- Modal chi tiết ----------
  detail = signal<Workshop | null>(null);
  detailTab = signal<DetailTab>('products');
  detailSearch = signal('');
  detailPage = signal(1);
  readonly detailPageSize = 15;

  /** Bản mới nhất của xưởng đang xem — sau khi sửa / tạm ngưng thì cửa sổ chi tiết cập nhật theo. */
  readonly current = computed(() => {
    const d = this.detail();
    return d ? this.workshops().find(w => w.id === d.id) || d : null;
  });

  readonly detailProducts = computed(() => {
    const w = this.detail();
    if (!w) return [];
    const q = this.detailSearch().toLowerCase().trim();
    return (this.productsByWorkshop().get(w.id) || []).filter(p => !q || p.name.toLowerCase().includes(q));
  });
  readonly detailProductsPage = computed(() => pageSlice(this.detailProducts(), this.detailPage(), this.detailPageSize));

  /** Lịch sử giao nhận của xưởng đang xem (đã sắp mới nhất trước từ server). */
  readonly detailReceipts = computed(() => {
    const w = this.detail();
    return w ? this.receiptService.receipts().filter(r => r.workshopId === w.id) : [];
  });

  ngOnInit(): void {
    this.config.load();
    if (!this.productService.products().length) this.productService.refresh();
    this.receiptService.refresh();
  }

  get canCreate(): boolean { return this.adminAuth.can('inventory.create'); }
  get canEdit(): boolean { return this.adminAuth.can('inventory.edit'); }

  count(f: WorkshopFilter): number {
    return this.workshops().filter(w => f === 'ALL' || (f === 'ACTIVE') === (w.active !== false)).length;
  }

  productCount(w: Workshop): number {
    return this.productsByWorkshop().get(w.id)?.length || 0;
  }

  /** Lần xưởng giao hàng gần nhất (danh sách từ server đã sắp mới nhất trước). */
  lastReceipt(w: Workshop): WorkshopReceipt | undefined {
    return this.receiptService.receipts().find(r => r.workshopId === w.id);
  }

  isPinned(p: Product, w: Workshop): boolean {
    return p.workshopId === w.id;
  }

  private emptyForm(): Omit<Workshop, 'id'> {
    return { code: '', name: '', contact: '', phone: '', email: '', address: '', specialties: [], leadDays: 14, note: '', active: true };
  }

  openAdd(): void {
    this.editing = null;
    this.form = { ...this.emptyForm(), code: 'XSX-' + (this.workshops().length + 1) };
    this.showModal = true;
  }

  openEdit(w: Workshop): void {
    this.editing = w;
    const { id, ...rest } = w;
    this.form = { ...this.emptyForm(), ...rest, specialties: [...(w.specialties || [])] };
    this.showModal = true;
  }

  /** Đóng cửa sổ chi tiết rồi mở form sửa. */
  editFromDetail(w: Workshop): void {
    this.detail.set(null);
    this.openEdit(w);
  }

  toggleSpecialty(s: WorkshopSpecialty): void {
    const set = new Set(this.form.specialties);
    set.has(s) ? set.delete(s) : set.add(s);
    this.form.specialties = SPECIALTY_KEYS.filter(k => set.has(k));
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) {
      this.toast.warning('Vui lòng nhập tên xưởng');
      return;
    }
    if (!this.form.address.trim()) {
      this.toast.warning('Vui lòng nhập địa chỉ xưởng (dùng để hiện trên bản đồ)');
      return;
    }
    if (!this.form.specialties.length) {
      this.toast.warning('Chọn ít nhất 1 nhóm hàng xưởng nhận làm');
      return;
    }
    const leadDays = Math.max(0, Math.round(Number(this.form.leadDays) || 0));
    const entry = { ...this.form, name, leadDays, note: this.form.note.trim() };
    const isEdit = !!this.editing;
    const next = isEdit
      ? this.workshops().map(w => w.id === this.editing!.id ? { ...w, ...entry } : w)
      : [...this.workshops(), { id: 'ws-' + Date.now(), ...entry }];
    this.persist(next, () => {
      this.showModal = false;
      this.toast.success(isEdit ? `Đã cập nhật xưởng "${name}"` : `Đã thêm xưởng "${name}"`);
      this.audit.record('Xưởng Sản Xuất', isEdit ? 'Cập nhật xưởng' : 'Thêm xưởng', name, isEdit ? 'INFO' : 'SUCCESS');
    });
  }

  toggleActive(w: Workshop): void {
    const active = w.active === false;
    this.persist(this.workshops().map(x => x.id === w.id ? { ...x, active } : x), () => {
      this.toast.info(`${w.name}: ${active ? 'đang hợp tác' : 'tạm ngưng'}`);
      this.audit.record('Xưởng Sản Xuất', 'Đổi trạng thái xưởng', `${w.name} -> ${active ? 'ACTIVE' : 'PAUSED'}`, 'INFO');
    });
  }

  /** Chỉ báo thành công khi server đã lưu; lỗi thì tải lại bản đang lưu trên server. */
  private persist(list: Workshop[], onSaved: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.config.save('workshops', list).subscribe({
      next: () => {
        this.saving.set(false);
        onSaved();
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Không lưu được xưởng lên server');
        this.config.load(true);
      },
    });
  }

  openDetail(w: Workshop, tab: DetailTab = 'products'): void {
    this.detail.set(w);
    this.detailTab.set(tab);
    this.detailSearch.set('');
    this.detailPage.set(1);
    this.contactNote = '';
    this.contactAttachments = [];
    this.contactService.load(w.id);
  }

  // ---- Liên hệ nhanh ----
  /** Chỉ giữ chữ số; số bắt đầu bằng 84 thì đổi về 0 cho link Zalo. */
  private digits(phone: string): string {
    const d = (phone || '').replace(/\D/g, '');
    return d.startsWith('84') ? '0' + d.slice(2) : d;
  }

  telLink(w: Workshop): string {
    return 'tel:' + this.digits(w.phone);
  }

  zaloLink(w: Workshop): string {
    return 'https://zalo.me/' + this.digits(w.phone);
  }

  // ---- Hợp đồng ----
  /** Thêm / bỏ file hợp đồng: lưu ngay vào hồ sơ xưởng. */
  saveContracts(w: Workshop, contracts: Attachment[]): void {
    const next = this.workshops().map(x => x.id === w.id ? { ...x, contracts } : x);
    this.persist(next, () => {
      this.detail.set({ ...w, contracts });
      this.toast.success('Đã cập nhật hợp đồng của xưởng');
      this.audit.record('Xưởng Sản Xuất', 'Cập nhật hợp đồng', `${w.name}: ${contracts.length} file`, 'INFO');
    });
  }

  // ---- Nhật ký trao đổi ----
  readonly contactChannels = CONTACT_CHANNELS;
  readonly contacts = this.contactService.contacts;
  contactChannel: ContactChannel = 'PHONE';
  contactNote = '';
  contactAttachments: Attachment[] = [];
  savingContact = signal(false);

  channelLabel(key: ContactChannel): string {
    return CONTACT_CHANNELS.find(c => c.key === key)?.label || 'Khác';
  }

  channelIcon(key: ContactChannel): string {
    return CONTACT_CHANNELS.find(c => c.key === key)?.icon || 'bi-three-dots';
  }

  addContact(w: Workshop): void {
    const note = this.contactNote.trim();
    if (!note) {
      this.toast.warning('Ghi nội dung đã trao đổi với xưởng');
      return;
    }
    this.savingContact.set(true);
    this.contactService.add({ workshopId: w.id, channel: this.contactChannel, note, attachments: this.contactAttachments }).subscribe({
      next: () => {
        this.savingContact.set(false);
        this.contactNote = '';
        this.contactAttachments = [];
        this.toast.success('Đã lưu nội dung trao đổi');
      },
      error: err => {
        this.savingContact.set(false);
        this.toast.apiError(err, 'Không lưu được nội dung trao đổi');
      },
    });
  }

  exportExcel(): void {
    exportXlsx('lumea_xuong_san_xuat',
      ['Mã', 'Tên xưởng', 'Người liên hệ', 'SĐT', 'Email', 'Địa chỉ', 'Nhóm hàng', 'Số ngày giao', 'SP phụ trách', 'Trạng thái'],
      this.filtered().map(w => [w.code, w.name, w.contact, w.phone, w.email, w.address, specialtyLabels(w), w.leadDays, this.productCount(w), w.active !== false ? 'Đang hợp tác' : 'Tạm ngưng']),
      'Xưởng sản xuất');
    this.toast.success(`Đã xuất ${this.filtered().length} xưởng ra file Excel`);
  }
}
