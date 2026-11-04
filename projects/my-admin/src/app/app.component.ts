import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ToastHostComponent } from './components/toast-host/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogComponent, ToastHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Tiêu đề tab trình duyệt theo route (data.title) — như titleByRoute của Vita. */
  ngOnInit(): void {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      let r = this.route.snapshot;
      let title = '';
      while (r) {
        title = r.data['title'] || title;
        r = r.firstChild!;
      }
      document.title = title ? `Luméa Admin - ${title}` : 'Luméa Admin';
    });
  }
}
