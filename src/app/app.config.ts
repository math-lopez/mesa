import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { debugHttpInterceptor } from './core/debug/debug-http.interceptor';
import { provideDebugLogging } from './core/debug/debug-logger';
import { mockBffInterceptor } from './core/mocks/mock-bff.interceptor';
import { provideSdui } from './core/sdui';
import { DESIGN_SYSTEM } from './design-system/design-system';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Ordem importa: token → log do que vai para a rede → BFF (mock ou real).
    provideHttpClient(
      withFetch(),
      withInterceptors([
        authInterceptor,
        debugHttpInterceptor,
        ...(environment.useMockBff ? [mockBffInterceptor] : []),
      ]),
    ),
    provideDebugLogging(environment.debug),
    provideSdui(DESIGN_SYSTEM),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
