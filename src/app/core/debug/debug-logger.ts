import {
  EnvironmentProviders,
  Injectable,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Modo debug: registra no console a sequência completa do que acontece
 * (rotas, chamadas ao BFF, decisões do BFF simulado, montagem dos templates,
 * consultas, ações e mudanças de estado). Só para desenvolvimento.
 *
 * Ligado por `environment.debug`. Para desligar/ligar sem recompilar:
 *   localStorage.setItem('mesa.debug', 'off')   // ou 'on'  → recarregue a página
 */

export type DebugCategory = 'rota' | 'auth' | 'http' | 'bff' | 'template' | 'source' | 'acao' | 'estado';

const LABEL: Readonly<Record<DebugCategory, string>> = {
  rota: 'ROTA',
  auth: 'AUTH',
  http: 'HTTP',
  bff: 'BFF (mock)',
  template: 'TEMPLATE',
  source: 'SOURCE',
  acao: 'AÇÃO',
  estado: 'ESTADO',
};

const COLOR: Readonly<Record<DebugCategory, string>> = {
  rota: '#475569',
  auth: '#b91c1c',
  http: '#1d4ed8',
  bff: '#7c3aed',
  template: '#c2410c',
  source: '#0f766e',
  acao: '#15803d',
  estado: '#6b7280',
};

const STORAGE_KEY = 'mesa.debug';

export const DEBUG_ENABLED = new InjectionToken<boolean>('DEBUG_ENABLED', {
  providedIn: 'root',
  factory: () => false,
});

@Injectable({ providedIn: 'root' })
export class DebugLogger {
  readonly enabled = inject(DEBUG_ENABLED);

  /**
   * Uma linha por evento. Com `details`, vira um grupo recolhido no console:
   * a sequência fica legível e o conteúdo (corpo, árvore, estado) fica a um clique.
   */
  log(category: DebugCategory, message: string, details?: Readonly<Record<string, unknown>>): void {
    if (!this.enabled) return;
    const args = [
      `%c ${LABEL[category]} %c ${message}`,
      `background:${COLOR[category]};color:#fff;border-radius:3px;padding:1px 4px;font-weight:600`,
      'color:inherit',
    ];
    if (!details) {
      console.log(...args);
      return;
    }
    console.groupCollapsed(...args);
    for (const [key, value] of Object.entries(details)) console.log(`${key}:`, value);
    console.groupEnd();
  }
}

/** Liga o modo debug (respeitando o override do localStorage) e registra as navegações. */
export function provideDebugLogging(enabledByEnvironment: boolean): EnvironmentProviders {
  const enabled = readOverride() ?? enabledByEnvironment;
  return makeEnvironmentProviders([
    { provide: DEBUG_ENABLED, useValue: enabled },
    provideAppInitializer(() => {
      if (!enabled) return;
      const debug = inject(DebugLogger);
      console.info(
        '%cModo debug ativo%c — a sequência de chamadas e eventos aparece abaixo. ' +
          `Para desligar: localStorage.setItem('${STORAGE_KEY}', 'off') e recarregue.`,
        'font-weight:700',
        '',
      );
      inject(Router)
        .events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => debug.log('rota', event.urlAfterRedirects));
    }),
  ]);
}

function readOverride(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'on' ? true : value === 'off' ? false : null;
  } catch {
    return null;
  }
}
