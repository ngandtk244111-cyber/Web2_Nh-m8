import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { QuizService } from '../../core/services/quiz.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AuditService } from '../../core/services/audit.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { QuizQuestion, QuizResult, StyleTag } from '../../core/models/quiz.model';

export const STYLE_TAGS: { tag: StyleTag; label: string }[] = [
  { tag: 'minimalist', label: 'Tối giản' },
  { tag: 'scandinavian', label: 'Bắc Âu' },
  { tag: 'industrial', label: 'Công nghiệp' },
  { tag: 'bohemian', label: 'Bohemian' },
];

/** Loại sản phẩm (Product.category) có thể gợi ý ở trang kết quả. */
export const PRODUCT_CATEGORIES: { key: string; label: string }[] = [
  { key: 'sofa', label: 'Sofa' }, { key: 'bed', label: 'Giường' }, { key: 'table', label: 'Bàn' },
  { key: 'side_table', label: 'Bàn phụ' }, { key: 'chair', label: 'Ghế' }, { key: 'stool', label: 'Ghế đôn' },
  { key: 'cabinet', label: 'Tủ' }, { key: 'bookshelf', label: 'Kệ sách' }, { key: 'lamp', label: 'Đèn' },
  { key: 'desk_lamp', label: 'Đèn bàn' }, { key: 'night_lamp', label: 'Đèn ngủ' }, { key: 'pendant_lamp', label: 'Đèn thả' },
  { key: 'organizer', label: 'Khay & hộp đựng' }, { key: 'plant_pot', label: 'Chậu cây' }, { key: 'vase', label: 'Bình hoa' },
  { key: 'sculpture', label: 'Tượng trang trí' }, { key: 'clock', label: 'Đồng hồ' }, { key: 'frame', label: 'Khung ảnh' },
  { key: 'candle_holder', label: 'Đế nến' }, { key: 'tray', label: 'Khay decor' }, { key: 'bookend', label: 'Giá đỡ sách' },
];

/** Giá trị Product.style trong cửa hàng. */
export const PRODUCT_STYLES = ['Minimalist', 'Scandinavian', 'Modern', 'Japanese', 'Vintage', 'Retro', 'Cute/Kawaii'];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const emptyQuestion = () => ({
  text: '',
  active: true,
  options: STYLE_TAGS.map(s => ({ label: '', tag: s.tag as StyleTag })),
});

/** Trắc nghiệm phong cách của cửa hàng — nhân viên sửa câu hỏi, thứ tự và nội dung 4 kết quả. */
@Component({
  selector: 'app-style-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './style-quiz.component.html',
  styleUrl: './style-quiz.component.css',
})
export class StyleQuizComponent implements OnInit {
  private quizService = inject(QuizService);
  readonly adminAuth = inject(AdminAuthService);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly styleTags = STYLE_TAGS;
  readonly categories = PRODUCT_CATEGORIES;
  readonly maxOptions = MAX_OPTIONS;
  readonly productStyles = PRODUCT_STYLES;

  tab: 'questions' | 'results' = 'questions';

  readonly sorted = computed(() => [...this.quizService.questions()].sort((a, b) => a.order - b.order || a.id - b.id));
  readonly activeCount = computed(() => this.quizService.questions().filter(q => q.active).length);
  readonly results = computed(() =>
    STYLE_TAGS.map(s => this.quizService.results().find(r => r.tag === s.tag)).filter((r): r is QuizResult => !!r)
  );

  /** Số lựa chọn dẫn tới mỗi phong cách trong các câu đang bật — lệch nhiều thì kết quả cũng lệch. */
  readonly tagBalance = computed(() => {
    const active = this.quizService.questions().filter(q => q.active);
    return STYLE_TAGS.map(s => ({
      ...s,
      count: active.reduce((n, q) => n + q.options.filter(o => o.tag === s.tag).length, 0),
    }));
  });

  showModal = false;
  editing: QuizQuestion | null = null;
  form = emptyQuestion();
  saving = false;
  moving = false;

  resultEditing: QuizResult | null = null;
  resultForm = {
    title: '', description: '', image: '', suggestedCategories: [] as string[], paletteHex: '',
    traits: '', tips: '', avoid: '', productStyles: [] as string[], comboCategories: [] as string[],
  };

  ngOnInit(): void {
    this.quizService.refresh();
  }

  tagLabel(tag: string): string {
    return STYLE_TAGS.find(s => s.tag === tag)?.label || tag;
  }

  categoryLabel(key: string): string {
    return PRODUCT_CATEGORIES.find(c => c.key === key)?.label || key;
  }

  /* ---------- Câu hỏi ---------- */

  openCreate(): void {
    this.editing = null;
    this.form = emptyQuestion();
    this.showModal = true;
  }

  openEdit(question: QuizQuestion): void {
    this.editing = question;
    this.form = {
      text: question.text,
      active: question.active,
      options: question.options.map(o => ({ label: o.label, tag: o.tag })),
    };
    this.showModal = true;
  }

  addOption(): void {
    if (this.form.options.length < MAX_OPTIONS) this.form.options.push({ label: '', tag: 'minimalist' });
  }

  removeOption(index: number): void {
    if (this.form.options.length > MIN_OPTIONS) this.form.options.splice(index, 1);
  }

  optionLetter(index: number): string {
    return 'ABCDEF'[index];
  }

  saveQuestion(): void {
    if (this.saving) return;
    const f = this.form;
    const options = f.options.map(o => ({ label: o.label.trim(), tag: o.tag })).filter(o => o.label);
    if (!f.text.trim()) {
      this.toast.warning('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    if (options.length < MIN_OPTIONS) {
      this.toast.warning(`Cần ít nhất ${MIN_OPTIONS} lựa chọn có nội dung`);
      return;
    }
    const editing = this.editing;
    const payload = { text: f.text.trim(), active: f.active, options: options.map((o, i) => ({ id: 'abcdef'[i], ...o })) };
    this.saving = true;
    const request = editing ? this.quizService.updateQuestion(editing.id, payload) : this.quizService.createQuestion(payload);
    request.subscribe({
      next: question => {
        this.saving = false;
        this.showModal = false;
        this.toast.success(editing ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi vào trắc nghiệm');
        this.audit.record('Trắc nghiệm', editing ? 'Sửa câu hỏi' : 'Thêm câu hỏi', question.text, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được câu hỏi');
      },
    });
  }

  toggleActive(question: QuizQuestion): void {
    this.quizService.updateQuestion(question.id, { active: !question.active }).subscribe({
      next: updated => {
        this.toast.info(updated.active ? 'Câu hỏi đã hiện trong trắc nghiệm' : 'Đã ẩn câu hỏi khỏi trắc nghiệm');
        this.audit.record('Trắc nghiệm', updated.active ? 'Hiện câu hỏi' : 'Ẩn câu hỏi', question.text, 'INFO');
      },
      error: err => this.toast.apiError(err, 'Không cập nhật được câu hỏi'),
    });
  }

  /** Đổi chỗ với câu liền trước/sau — như trang Video. */
  move(question: QuizQuestion, direction: -1 | 1): void {
    const list = this.sorted();
    const index = list.findIndex(q => q.id === question.id);
    const other = list[index + direction];
    if (!other || this.moving) return;
    this.moving = true;
    forkJoin([
      this.quizService.updateQuestion(question.id, { order: index + direction + 1 }),
      this.quizService.updateQuestion(other.id, { order: index + 1 }),
    ]).subscribe({
      next: () => this.moving = false,
      error: err => {
        this.moving = false;
        this.toast.apiError(err, 'Không đổi được thứ tự câu hỏi');
        this.quizService.refresh();
      },
    });
  }

  async remove(question: QuizQuestion): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xoá câu hỏi?',
      message: `"${question.text}" sẽ bị gỡ khỏi trắc nghiệm. Muốn tạm bỏ thì nên dùng nút Ẩn.`,
      confirmLabel: 'Xoá',
      danger: true,
      icon: 'bi-trash',
    });
    if (!ok) return;
    this.quizService.deleteQuestion(question.id).subscribe({
      next: () => {
        this.toast.info('Đã xoá câu hỏi');
        this.audit.record('Trắc nghiệm', 'Xoá câu hỏi', question.text, 'WARNING');
      },
      error: err => this.toast.apiError(err, 'Không xoá được câu hỏi'),
    });
  }

  /* ---------- Kết quả ---------- */

  openResult(result: QuizResult): void {
    this.resultEditing = result;
    this.resultForm = {
      title: result.title,
      description: result.description,
      image: result.image,
      suggestedCategories: [...result.suggestedCategories],
      paletteHex: result.paletteHex.join(', '),
      traits: (result.traits || []).join('\n'),
      tips: (result.tips || []).join('\n'),
      avoid: (result.avoid || []).join('\n'),
      productStyles: [...(result.productStyles || [])],
      comboCategories: [...(result.comboCategories || [])],
    };
  }

  /** Bật/tắt 1 giá trị trong danh sách chọn nhiều của form kết quả. */
  toggleIn(field: 'suggestedCategories' | 'productStyles' | 'comboCategories', key: string): void {
    const list = this.resultForm[field];
    this.resultForm[field] = list.includes(key) ? list.filter(k => k !== key) : [...list, key];
  }

  private lines(text: string): string[] {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  }

  get paletteList(): string[] {
    return this.resultForm.paletteHex.split(',').map(h => h.trim()).filter(Boolean);
  }

  saveResult(): void {
    const result = this.resultEditing;
    if (!result || this.saving) return;
    const f = this.resultForm;
    if (!f.title.trim()) {
      this.toast.warning('Vui lòng nhập tên phong cách');
      return;
    }
    if (this.paletteList.some(h => !/^#[0-9a-f]{6}$/i.test(h))) {
      this.toast.warning('Mã màu phải có dạng #RRGGBB, cách nhau bằng dấu phẩy');
      return;
    }
    this.saving = true;
    this.quizService.updateResult(result.tag, {
      title: f.title.trim(),
      description: f.description.trim(),
      image: f.image.trim(),
      suggestedCategories: f.suggestedCategories,
      paletteHex: this.paletteList,
      traits: this.lines(f.traits),
      tips: this.lines(f.tips),
      avoid: this.lines(f.avoid),
      productStyles: f.productStyles,
      comboCategories: f.comboCategories,
    }).subscribe({
      next: updated => {
        this.saving = false;
        this.resultEditing = null;
        this.toast.success(`Đã cập nhật kết quả "${updated.title}"`);
        this.audit.record('Trắc nghiệm', 'Sửa kết quả', updated.title, 'SUCCESS');
      },
      error: err => {
        this.saving = false;
        this.toast.apiError(err, 'Không lưu được kết quả');
      },
    });
  }
}
