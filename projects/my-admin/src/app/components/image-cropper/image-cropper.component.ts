import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

const MAX_FRAME_WIDTH = 520;
const MAX_FRAME_HEIGHT = 420;
const FRAME_GUTTER = 64;
const MAX_ZOOM = 4;
const MAX_OUTPUT_SIDE = 1600;
const JPEG_QUALITY = 0.92;

/** Cắt ảnh theo đúng tỉ lệ khung ở my-client: kéo để chọn vùng, thanh trượt để phóng to. */
@Component({
  selector: 'app-image-cropper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-cropper.component.html',
})
export class ImageCropperComponent implements OnInit, OnDestroy {
  @Input({ required: true }) file!: File;
  /** Rộng / cao của khung cắt. */
  @Input({ required: true }) ratio!: number;
  @Input() hint = '';
  @Output() cropped = new EventEmitter<File>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() failed = new EventEmitter<void>();

  objectUrl = '';
  frameWidth = 0;
  frameHeight = 0;
  zoom = 1;
  x = 0;
  y = 0;
  scale = 1;
  naturalWidth = 0;
  naturalHeight = 0;

  private image: HTMLImageElement | null = null;
  private minScale = 1;
  private dragStart: { pointerX: number; pointerY: number; x: number; y: number } | null = null;

  readonly maxZoom = MAX_ZOOM;

  ngOnInit(): void {
    this.objectUrl = URL.createObjectURL(this.file);
    let width = Math.min(MAX_FRAME_WIDTH, window.innerWidth - FRAME_GUTTER);
    let height = width / this.ratio;
    if (height > MAX_FRAME_HEIGHT) {
      height = MAX_FRAME_HEIGHT;
      width = height * this.ratio;
    }
    this.frameWidth = width;
    this.frameHeight = height;
  }

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.objectUrl);
  }

  onImageLoad(image: HTMLImageElement): void {
    this.image = image;
    this.naturalWidth = image.naturalWidth;
    this.naturalHeight = image.naturalHeight;
    this.minScale = Math.max(this.frameWidth / this.naturalWidth, this.frameHeight / this.naturalHeight);
    this.scale = this.minScale;
    this.x = (this.frameWidth - this.naturalWidth * this.scale) / 2;
    this.y = (this.frameHeight - this.naturalHeight * this.scale) / 2;
  }

  /** Phóng to quanh tâm khung để vùng đang chọn không bị trôi. */
  onZoomChange(value: string): void {
    this.zoom = Number(value);
    const centerX = (this.frameWidth / 2 - this.x) / this.scale;
    const centerY = (this.frameHeight / 2 - this.y) / this.scale;
    this.scale = this.minScale * this.zoom;
    this.moveTo(this.frameWidth / 2 - centerX * this.scale, this.frameHeight / 2 - centerY * this.scale);
  }

  onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragStart = { pointerX: event.clientX, pointerY: event.clientY, x: this.x, y: this.y };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragStart) return;
    this.moveTo(
      this.dragStart.x + event.clientX - this.dragStart.pointerX,
      this.dragStart.y + event.clientY - this.dragStart.pointerY
    );
  }

  onPointerUp(): void {
    this.dragStart = null;
  }

  confirm(): void {
    if (!this.image) return;
    const sourceWidth = this.frameWidth / this.scale;
    const sourceHeight = this.frameHeight / this.scale;
    const shrink = Math.min(1, MAX_OUTPUT_SIDE / Math.max(sourceWidth, sourceHeight));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * shrink);
    canvas.height = Math.round(sourceHeight * shrink);
    const context = canvas.getContext('2d');
    if (!context) {
      this.failed.emit();
      return;
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(this.image, -this.x / this.scale, -this.y / this.scale, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    // JPG không có nền trong suốt; PNG/WEBP giữ nền trong suốt cho ảnh như mascot.
    const type = this.file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    canvas.toBlob(blob => {
      if (!blob) {
        this.failed.emit();
        return;
      }
      this.cropped.emit(new File([blob], this.file.name, { type: blob.type }));
    }, type, JPEG_QUALITY);
  }

  /** Giữ ảnh luôn phủ kín khung, không để lộ khoảng trống. */
  private moveTo(x: number, y: number): void {
    this.x = Math.min(0, Math.max(this.frameWidth - this.naturalWidth * this.scale, x));
    this.y = Math.min(0, Math.max(this.frameHeight - this.naturalHeight * this.scale, y));
  }
}
