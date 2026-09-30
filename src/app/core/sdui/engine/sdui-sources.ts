import { HttpParams, httpResource } from '@angular/common/http';
import {
  Injectable,
  Injector,
  ResourceRef,
  Signal,
  computed,
  inject,
  runInInjectionContext,
} from '@angular/core';

import { BFF_BASE_URL } from '../../api/bff-api.config';
import { DebugLogger } from '../../debug/debug-logger';
import { SduiDataSource, SduiScreen } from '../models';
import { SduiResolver } from './sdui-resolver';
import { SduiSourceSnapshot, SduiStore } from './sdui-store';

/**
 * Transforma os `sources` declarados no JSON em `httpResource`s reativos.
 * Quando um `$bind` dos params muda (filtro aplicado, página, ordenação), a
 * requisição é refeita e a anterior é cancelada automaticamente.
 */
@Injectable()
export class SduiSources {
  readonly #injector = inject(Injector);
  readonly #resolver = inject(SduiResolver);
  readonly #store = inject(SduiStore);
  readonly #baseUrl = inject(BFF_BASE_URL);
  readonly #debug = inject(DebugLogger);
  #resources: ResourceRef<unknown>[] = [];

  init(screen: Pick<SduiScreen, 'sources'>): void {
    this.#resources.forEach((resource) => resource.destroy());
    this.#resources = [];

    const snapshots = Object.fromEntries(
      Object.entries(screen.sources ?? {}).map(([name, source]) => [name, this.#create(name, source)]),
    );
    this.#store.attachSources(snapshots);
  }

  #create(name: string, source: SduiDataSource): Signal<SduiSourceSnapshot> {
    const resource = runInInjectionContext(this.#injector, () =>
      httpResource<unknown>(() => {
        const endpoint = this.#resolver.interpolate(source.endpoint);
        const params = this.#resolver.resolve(source.params ?? {});
        // Roda de novo sempre que um parâmetro ligado ao `state` muda.
        this.#debug.log('source', `"${name}" consultando ${endpoint}`, { parâmetros: params });
        return { url: `${this.#baseUrl}${endpoint}`, params: toHttpParams(params) };
      }),
    );
    this.#resources.push(resource);

    // Mantém o último valor durante recargas: a tabela não "pisca" vazia ao paginar.
    let last: unknown = null;
    return computed(() => {
      if (resource.hasValue()) last = resource.value();
      return {
        value: last,
        loading: resource.isLoading(),
        error: resource.error() ? 'Não foi possível carregar os dados.' : null,
      };
    });
  }
}

function toHttpParams(params: Readonly<Record<string, unknown>>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    result = result.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return result;
}
