import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withNavigationErrorHandler, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      // Cuộn khi chuyển trang do AppComponent tự xử lý (lên đầu trang khi vào trang mới, về đúng vị trí cũ khi Back).
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled', anchorScrolling: 'enabled' }),
      // Tab đang mở từ bản build cũ (vừa deploy / ng serve build lại) -> file JS của trang mới không còn,
      // bấm link sẽ "đứng im". Khi đó tải hẳn trang đích để lấy bản mới.
      withNavigationErrorHandler(e => {
        const msg = String((e.error as Error)?.message ?? e.error);
        if (/dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(msg)) {
          location.assign(e.url);
        }
      })
    )
  ]
};
