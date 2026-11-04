import { Component, Input } from '@angular/core';

/** Mascot Luméa chạy trên thanh loading — theo admin-mascot-loading của my-admin-vita. */
@Component({
  selector: 'app-mascot-loading',
  standalone: true,
  templateUrl: './mascot-loading.component.html',
  styleUrl: './mascot-loading.component.css'
})
export class MascotLoadingComponent {
  @Input() message = 'Đang tải dữ liệu…';
  /** true: phủ kín khung cha (cha cần position: relative); false: khối nằm trong luồng trang. */
  @Input() overlay = true;
}
