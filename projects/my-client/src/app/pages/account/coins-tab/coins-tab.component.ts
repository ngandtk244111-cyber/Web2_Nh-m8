import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CoinService } from '../../../core/services/coin.service';
import { AppIconComponent } from '../../../components/icon/icon.component';

@Component({
  selector: 'app-account-coins-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './coins-tab.component.html',
  styleUrl: './coins-tab.component.css'
})
export class CoinsTabComponent {
  constructor(public coinService: CoinService) {}
}
