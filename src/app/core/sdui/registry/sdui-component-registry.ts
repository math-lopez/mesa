import { Injectable, InjectionToken, Provider, Type, inject, isDevMode } from '@angular/core';

import { SduiComponent, SduiNode, SduiNodeType, SduiViewOf } from '../models';
import { SduiFallbackComponent } from './sdui-fallback.component';

export type SduiComponentType<T extends SduiNodeType> = Type<SduiComponent<SduiViewOf<T>>>;

/** Loader lazy: cada wrapper vira um chunk separado e só é baixado se a tela usar. */
export type SduiComponentLoader<T extends SduiNodeType> = () => Promise<SduiComponentType<T>>;

/**
 * O "De-Para" type do JSON → wrapper do Design System.
 * É um mapped type sobre TODO o catálogo: esquecer um tipo, ou ligar um tipo
 * a um wrapper cujo `props` não bate com o contrato, é erro de compilação.
 */
export type SduiComponentMap = { readonly [T in SduiNodeType]: SduiComponentLoader<T> };

export const SDUI_COMPONENT_MAP = new InjectionToken<SduiComponentMap>('SDUI_COMPONENT_MAP');

export function provideSduiComponents(map: SduiComponentMap): Provider {
  return { provide: SDUI_COMPONENT_MAP, useValue: map };
}

@Injectable({ providedIn: 'root' })
export class SduiComponentRegistry {
  readonly #map = inject(SDUI_COMPONENT_MAP);
  readonly #loaded = new Map<string, Type<unknown>>();
  readonly #inflight = new Map<string, Promise<void>>();

  /**
   * Baixa, em paralelo, todos os wrappers usados na árvore. Depois disso a
   * renderização é 100% síncrona — sem "pipocar" de blocos fora de ordem.
   */
  async preload(root: SduiNode): Promise<void> {
    await Promise.all([...collectTypes(root)].map((type) => this.#load(type)));
  }

  /** Síncrono. Tipos desconhecidos (ex.: BFF mais novo que o front) caem no fallback. */
  get(type: string): Type<unknown> {
    return this.#loaded.get(type) ?? SduiFallbackComponent;
  }

  #load(type: string): Promise<void> {
    if (this.#loaded.has(type)) return Promise.resolve();

    const loader = isKnownType(this.#map, type) ? this.#map[type] : undefined;
    if (!loader) {
      if (isDevMode()) console.warn(`[SDUI] Tipo "${type}" não registrado — usando fallback.`);
      return Promise.resolve();
    }

    let pending = this.#inflight.get(type);
    if (!pending) {
      pending = loader()
        .then((component) => void this.#loaded.set(type, component))
        .finally(() => this.#inflight.delete(type));
      this.#inflight.set(type, pending);
    }
    return pending;
  }
}

function isKnownType(map: SduiComponentMap, type: string): type is SduiNodeType {
  return Object.hasOwn(map, type);
}

function collectTypes(node: SduiNode, into = new Set<string>()): Set<string> {
  into.add(node.type);
  node.children?.forEach((child) => collectTypes(child, into));
  Object.values(node.slots ?? {}).forEach((slot) => slot.forEach((child) => collectTypes(child, into)));
  return into;
}
