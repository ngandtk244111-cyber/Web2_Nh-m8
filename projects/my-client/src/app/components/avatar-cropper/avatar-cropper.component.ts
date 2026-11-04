import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../icon/icon.component';

type Step = 'choose' | 'camera' | 'crop';

/** Cạnh khung cắt trên màn hình (px) — khớp .ac_stage trong CSS. */
const STAGE = 280;
/** Cạnh ảnh xuất ra (px). */
const OUTPUT = 512;
const MAX_ZOOM = 3;

/**
 * Hộp đổi ảnh đại diện: chụp bằng camera hoặc tải ảnh lên -> kéo/phóng to trong khung tròn -> xuất JPEG vuông.
 * Cha tự quyết định upload: nghe (cropped) để nhận File đã cắt, (closed) khi người dùng đóng hộp.
 */
@Component({
  selector: 'app-avatar-cropper',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './avatar-cropper.component.html',
  styleUrl: './avatar-cropper.component.css'
})
export class AvatarCropperComponent implements OnDestroy {
  @Output() cropped = new EventEmitter<File>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  step: Step = 'choose';
  error = '';
  cameraStarting = false;
  saving = false;

  /** Ảnh đang cắt (object URL / data URL) và kích thước gốc. */
  imageSrc = '';
  private naturalW = 0;
  private naturalH = 0;
  private imageEl: HTMLImageElement | null = null;

  zoom = 1;
  readonly maxZoom = MAX_ZOOM;
  /** Độ lệch tâm ảnh so với tâm khung (px màn hình). */
  offsetX = 0;
  offsetY = 0;

  private stream: MediaStream | null = null;
  private objectUrl: string | null = null;
  private drag: { pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null = null;

  /** Kích thước ảnh hiển thị: phủ kín khung ở zoom 1. */
  get displayW(): number { return this.naturalW * this.scale; }
  get displayH(): number { return this.naturalH * this.scale; }
  private get scale(): number {
    if (!this.naturalW || !this.naturalH) return 1;
    return Math.max(STAGE / this.naturalW, STAGE / this.naturalH) * this.zoom;
  }

  // ---------- Chọn nguồn ----------

  pickFile(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      this.error = 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'Ảnh quá lớn, vui lòng chọn ảnh dưới 10MB';
      return;
    }
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.loadForCrop(this.objectUrl);
  }

  async openCamera(): Promise<void> {
    this.error = '';
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = 'Trình duyệt không hỗ trợ camera, bạn hãy tải ảnh lên nhé';
      return;
    }
    this.cameraStarting = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      this.step = 'camera';
      // Đợi *ngIf vẽ thẻ <video> rồi mới gắn stream.
      setTimeout(() => {
        const v = this.video?.nativeElement;
        if (v && this.stream) {
          v.srcObject = this.stream;
          v.play().catch(() => {});
        }
      });
    } catch {
      this.error = 'Không mở được camera — hãy cho phép quyền camera hoặc tải ảnh lên';
    } finally {
      this.cameraStarting = false;
    }
  }

  /** Chụp khung hình hiện tại (lật ngang cho giống gương như lúc xem trước). */
  capture(): void {
    const v = this.video?.nativeElement;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    this.stopCamera();
    this.loadForCrop(canvas.toDataURL('image/jpeg', 0.92));
  }

  private loadForCrop(src: string): void {
    const img = new Image();
    img.onload = () => {
      this.imageEl = img;
      this.naturalW = img.naturalWidth;
      this.naturalH = img.naturalHeight;
      this.imageSrc = src;
      this.zoom = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.error = '';
      this.step = 'crop';
    };
    img.onerror = () => { this.error = 'Không đọc được ảnh này, bạn thử ảnh khác nhé'; };
    img.src = src;
  }

  back(): void {
    this.stopCamera();
    this.step = 'choose';
    this.error = '';
  }

  // ---------- Kéo & phóng to ----------

  onPointerDown(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: this.offsetX, baseY: this.offsetY };
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== e.pointerId) return;
    this.offsetX = this.drag.baseX + (e.clientX - this.drag.startX);
    this.offsetY = this.drag.baseY + (e.clientY - this.drag.startY);
    this.clampOffset();
  }

  onPointerUp(e: PointerEvent): void {
    if (this.drag?.pointerId === e.pointerId) this.drag = null;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  onZoomInput(e: Event): void {
    this.setZoom(Number((e.target as HTMLInputElement).value));
  }

  stepZoom(delta: number): void {
    this.setZoom(this.zoom + delta);
  }

  /** Phóng to quanh tâm khung: giữ nguyên điểm đang nằm giữa. */
  private setZoom(next: number): void {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const ratio = z / this.zoom;
    this.zoom = z;
    this.offsetX *= ratio;
    this.offsetY *= ratio;
    this.clampOffset();
  }

  /** Không cho kéo hở mép: ảnh luôn phủ kín khung. */
  private clampOffset(): void {
    const maxX = Math.max(0, (this.displayW - STAGE) / 2);
    const maxY = Math.max(0, (this.displayH - STAGE) / 2);
    this.offsetX = Math.min(maxX, Math.max(-maxX, this.offsetX));
    this.offsetY = Math.min(maxY, Math.max(-maxY, this.offsetY));
  }

  // ---------- Xuất ảnh ----------

  save(): void {
    if (!this.imageEl || this.saving) return;
    this.saving = true;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d')!;
    const k = OUTPUT / STAGE;
    const left = STAGE / 2 - this.displayW / 2 + this.offsetX;
    const top = STAGE / 2 - this.displayH / 2 + this.offsetY;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(this.imageEl, left * k, top * k, this.displayW * k, this.displayH * k);
    canvas.toBlob((blob) => {
      this.saving = false;
      if (!blob) {
        this.error = 'Không lưu được ảnh, bạn thử lại nhé';
        return;
      }
      this.cropped.emit(new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.stopCamera();
    this.closed.emit();
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokeObjectUrl();
  }
}
