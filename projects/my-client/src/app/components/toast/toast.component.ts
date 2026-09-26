import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  readonly generalToasts = computed(() => this.toastService.toasts().filter(t => t.type !== 'cart'));
  readonly cartToasts = computed(() => this.toastService.toasts().filter(t => t.type === 'cart'));

  constructor(public toastService: ToastService) {}
}
