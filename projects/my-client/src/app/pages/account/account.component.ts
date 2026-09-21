import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { AppIconComponent } from '../../components/icon/icon.component';
import { ProfileTabComponent } from './profile-tab/profile-tab.component';
import { OrdersTabComponent } from './orders-tab/orders-tab.component';
import { AddressesTabComponent } from './addresses-tab/addresses-tab.component';
import { CoinsTabComponent } from './coins-tab/coins-tab.component';

export type AccountTab = 'profile' | 'orders' | 'addresses' | 'coins';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, AppIconComponent, ProfileTabComponent, OrdersTabComponent, AddressesTabComponent, CoinsTabComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent {
  activeTab: AccountTab = 'profile';

  readonly tabs: { id: AccountTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Hồ Sơ Cá Nhân', icon: 'user' },
    { id: 'orders', label: 'Đơn Hàng Của Tôi', icon: 'truck' },
    { id: 'addresses', label: 'Sổ Địa Chỉ', icon: 'home' },
    { id: 'coins', label: 'Xu Thưởng', icon: 'coin' },
  ];

  constructor(
    public authService: AuthService,
    public loginModalService: LoginModalService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const tab = this.route.snapshot.queryParamMap.get('tab') as AccountTab | null;
    if (tab && this.tabs.some(t => t.id === tab)) this.activeTab = tab;
  }

  switchTab(tab: AccountTab): void {
    this.activeTab = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
