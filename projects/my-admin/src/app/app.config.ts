import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideQuillConfig } from 'ngx-quill/config';

import { routes } from './app.routes';
import { adminAuthInterceptor } from './core/interceptors/admin-auth.interceptor';

/** Toolbar soạn bài (Quill) — giống app.config của Vita. */
const quillToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ header: [2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  [{ color: [] }, { background: [] }],
  ['blockquote', 'link', 'image'],
  ['clean'],
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([adminAuthInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    provideQuillConfig({ modules: { toolbar: quillToolbar } }),
  ]
};
