import { Injectable, Signal, signal } from '@angular/core';

import { SduiPath, SduiScreen, SduiStatePath } from '../models';
import { readPath, splitPath, writePath } from './sdui-path';

/** O que a tela enxerga de um data source em `sources.<nome>`. */
export interface SduiSourceSnapshot {
  readonly value: unknown;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Estado reativo de UMA tela SDUI (escopo do `<sdui-screen>`, não root).
 * `data` é imutável para a UI; `state` é o que o analista edita e o que
 * as ações enviam de volta ao BFF; `sources` espelha os data sources remotos.
 */
@Injectable()
export class SduiStore {
  readonly #data = signal<Readonly<Record<string, unknown>>>({});
  readonly #state = signal<Readonly<Record<string, unknown>>>({});
  readonly #sources = signal<Readonly<Record<string, Signal<SduiSourceSnapshot>>>>({});

  readonly state = this.#state.asReadonly();

  init(screen: Pick<SduiScreen, 'data' | 'state'>): void {
    this.#data.set(screen.data);
    this.#state.set(screen.state);
  }

  attachSources(sources: Readonly<Record<string, Signal<SduiSourceSnapshot>>>): void {
    this.#sources.set(sources);
  }

  /** Leitura reativa quando chamada dentro de `computed`/`effect`. Só assina a raiz lida. */
  read(path: SduiPath): unknown {
    const [root, ...rest] = splitPath(path);
    switch (root) {
      case 'data':
        return readPath(this.#data(), rest);
      case 'state':
        return readPath(this.#state(), rest);
      case 'sources': {
        const [name, ...inner] = rest;
        const source = name === undefined ? undefined : this.#sources()[name];
        return source ? readPath(source(), inner) : undefined;
      }
      default:
        return undefined; // `item` só existe no escopo de uma ação (ver SduiResolver)
    }
  }

  write(path: SduiStatePath, value: unknown): void {
    const [, ...rest] = splitPath(path);
    this.#state.update((current) => writePath(current, rest, value));
  }
}
