import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  constructor(public dialog: ConfirmDialogService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.state()) this.dialog.close(false);
  }
}
