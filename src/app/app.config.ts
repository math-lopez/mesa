import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { mockBffInterceptor } from './core/mocks/mock-bff.interceptor';
import { provideSdui } from './core/sdui';
import { DESIGN_SYSTEM } from './design-system/design-system';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Ordem importa: o token é anexado antes de o BFF (mock ou real) receber a chamada.
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, ...(environment.useMockBff ? [mockBffInterceptor] : [])]),
    ),
    provideSdui(DESIGN_SYSTEM),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
