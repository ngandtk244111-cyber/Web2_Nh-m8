import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  readonly generalToasts = computed(() => this.toastService.toasts().filter(t => t.type !== 'cart'));
  readonly cartToasts = computed(() => this.toastService.toasts().filter(t => t.type === 'cart'));

  constructor(public toastService: ToastService) {}
}
