import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/** URL base do BFF. Todas as chamadas do front passam por aqui (nunca direto nos serviços de domínio). */
export const BFF_BASE_URL = new InjectionToken<string>('BFF_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.bffBaseUrl,
});
