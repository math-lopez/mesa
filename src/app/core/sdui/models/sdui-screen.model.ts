import { SduiAction, SduiActionId } from './sdui-action.model';
import { Bindable } from './sdui-binding.model';
import { SduiNode } from './sdui-node.model';

export interface SduiScreenMeta {
  /** Versão do contrato de origem (validada em `compileTemplateScreen`). */
  readonly schemaVersion: string;
  /** Identifica a tela (`proposal-analysis`, `work-queue`, `approval`...). */
  readonly screenId: string;
  /** Produto que determinou a jornada (`CREDITO_VAREJO`, `VEICULOS`, `CONSORCIO`...). */
  readonly product: string;
  /** Versão do layout parametrizado — útil para cache, A/B e auditoria. */
  readonly revision: string;
  readonly generatedAt: string;
  readonly traceId?: string;
}

/**
 * Dado remoto consumido pela tela (ex.: página da fila). Os `params` são
 * reativos: quando o `state` referenciado muda, o motor refaz a requisição.
 * O resultado fica em `sources.<nome>` = `{ value, loading, error }`.
 */
export interface SduiDataSource {
  /** Relativo ao BFF; aceita interpolação `{state...}`. */
  readonly endpoint: string;
  /** Viram query string. `null`/`''` são omitidos. */
  readonly params?: Readonly<Record<string, Bindable<unknown>>>;
}

/**
 * Envelope completo de uma tela SDUI.
 *
 *  - `meta`    → versionamento, rastreabilidade
 *  - `data`    → dados de negócio (somente leitura)
 *  - `state`   → estado inicial editável (parecer, motivo...)
 *  - `sources` → dados remotos reativos (paginação/ordenação server-side)
 *  - `actions` → catálogo de ações com permissões já calculadas pelo BFF
 *  - `layout`  → árvore de componentes que referencia `data`/`state`/`actions`
 */
export interface SduiScreen {
  readonly meta: SduiScreenMeta;
  readonly data: Readonly<Record<string, unknown>>;
  readonly state: Readonly<Record<string, unknown>>;
  readonly sources?: Readonly<Record<string, SduiDataSource>>;
  readonly actions: Readonly<Record<SduiActionId, SduiAction>>;
  readonly layout: SduiNode;
}
