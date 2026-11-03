import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AdminAuthService } from '../core/services/admin-auth.service';
import { NoticeService } from '../core/services/notice.service';
import { ChatService } from '../core/services/chat.service';
import { ToastService } from '../core/services/toast.service';
import { AuditService } from '../core/services/audit.service';
import { ConfirmDialogService } from '../core/services/confirm-dialog.service';
import { ADMIN_NAV_GROUPS, AdminNavGroup, AdminNavItem, DASHBOARD_NAV } from './admin-nav';
import { environment } from '../../environments/environment';

const COLLAPSED_KEY = 'lumea_admin_sidebar_collapsed';

/** Khung trang quản trị: sidebar nhóm menu + topbar (thông báo, tài khoản) — theo layout/ của Vita. */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  readonly adminAuth = inject(AdminAuthService);
  readonly notice = inject(NoticeService);
  private chat = inject(ChatService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private audit = inject(AuditService);
  private confirmDialog = inject(ConfirmDialogService);

  readonly clientAppUrl = environment.clientAppUrl;
  readonly dashboardNav = DASHBOARD_NAV;

  isSidebarCollapsed = false;
  /** Nhóm đang mở trên sidebar; mặc định mở nhóm chứa trang đang xem. */
  private openGroups = new Set<string>();
  /** Sidebar thu gọn: nhóm đang rê chuột + vị trí menu bay. */
  flyoutGroup: string | null = null;
  flyoutTop = 0;

  isNoticeOpen = false;
  isProfileOpen = false;

  showPasswordModal = false;
  passwordForm = { old: '', next: '', confirm: '' };
  showPasswords = false;
  savingPassword = false;

  private navSub?: Subscription;

  ngOnInit(): void {
    try {
      this.isSidebarCollapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch { /* bộ nhớ trình duyệt bị chặn — dùng mặc định */ }
    this.openGroupOf(this.router.url);
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.openGroupOf(e.urlAfterRedirects);
        this.flyoutGroup = null;
      });
    this.notice.loadSources();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.chat.disconnect();
  }

  get adminName(): string {
    const a = this.adminAuth.currentAdmin();
    return a?.fullName || a?.username || 'Quản trị viên';
  }

  get adminRole(): string {
    return this.adminAuth.currentAdmin()?.role || '';
  }

  get adminInitials(): string {
    return this.adminName.split(/\s+/).filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase() || 'AD';
  }

  canSee(item: AdminNavItem): boolean {
    return !item.perm || this.adminAuth.can(item.perm);
  }

  visibleItems(group: AdminNavGroup): AdminNavItem[] {
    return group.items.filter(i => this.canSee(i));
  }

  get groups(): AdminNavGroup[] {
    return ADMIN_NAV_GROUPS.filter(g => this.visibleItems(g).length > 0);
  }

  isGroupOpen(group: AdminNavGroup): boolean {
    return this.openGroups.has(group.key);
  }

  isGroupActive(group: AdminNavGroup): boolean {
    const path = this.router.url.split(/[?#]/)[0].split('/')[1];
    return group.items.some(i => i.path === path);
  }

  toggleGroup(group: AdminNavGroup): void {
    if (this.isSidebarCollapsed) {
      this.router.navigate(['/', this.visibleItems(group)[0].path]);
      return;
    }
    if (this.openGroups.has(group.key)) this.openGroups.delete(group.key);
    else this.openGroups.add(group.key);
  }

  private openGroupOf(url: string): void {
    const path = url.split(/[?#]/)[0].split('/')[1];
    const group = ADMIN_NAV_GROUPS.find(g => g.items.some(i => i.path === path));
    if (group) this.openGroups.add(group.key);
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.flyoutGroup = null;
    try {
      localStorage.setItem(COLLAPSED_KEY, this.isSidebarCollapsed ? '1' : '0');
    } catch { /* không lưu được thì thôi */ }
  }

  onGroupEnter(group: AdminNavGroup, event: MouseEvent): void {
    if (!this.isSidebarCollapsed) return;
    this.flyoutGroup = group.key;
    this.flyoutTop = (event.currentTarget as HTMLElement).getBoundingClientRect().top;
  }

  onGroupLeave(): void {
    this.flyoutGroup = null;
  }

  toggleNotice(event: Event): void {
    event.stopPropagation();
    this.isNoticeOpen = !this.isNoticeOpen;
    this.isProfileOpen = false;
  }

  toggleProfile(event: Event): void {
    event.stopPropagation();
    this.isProfileOpen = !this.isProfileOpen;
    this.isNoticeOpen = false;
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.isNoticeOpen = false;
    this.isProfileOpen = false;
  }

  openNotice(link: string, query?: Record<string, string>): void {
    this.isNoticeOpen = false;
    this.router.navigate([link], { queryParams: query });
  }

  openPasswordModal(): void {
    this.isProfileOpen = false;
    this.passwordForm = { old: '', next: '', confirm: '' };
    this.showPasswords = false;
    this.showPasswordModal = true;
  }

  changePassword(): void {
    const { old, next, confirm } = this.passwordForm;
    if (!old || !next) {
      this.toast.warning('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');
      return;
    }
    if (next !== confirm) {
      this.toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    this.savingPassword = true;
    this.adminAuth.changePassword(old, next).subscribe({
      next: () => {
        this.savingPassword = false;
        this.showPasswordModal = false;
        this.toast.success('Đổi mật khẩu thành công');
      },
      error: err => {
        this.savingPassword = false;
        this.toast.apiError(err, 'Không đổi được mật khẩu');
      },
    });
  }

  async logout(): Promise<void> {
    this.isProfileOpen = false;
    const ok = await this.confirmDialog.confirm({
      title: 'Đăng xuất?',
      message: 'Bạn sẽ cần đăng nhập lại để tiếp tục quản trị.',
      confirmLabel: 'Đăng xuất',
      icon: 'bi-box-arrow-right',
    });
    if (!ok) return;
    this.audit.record('Hệ Thống', 'Đăng xuất', 'Đăng xuất khỏi hệ thống', 'INFO');
    this.adminAuth.logout();
    this.router.navigate(['/login']);
  }
}
