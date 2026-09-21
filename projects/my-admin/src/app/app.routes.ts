import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/admin.component').then(m => m.AdminComponent),
  },
  { path: '**', redirectTo: '' },
];
