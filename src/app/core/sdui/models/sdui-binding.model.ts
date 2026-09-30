/**
 * Bindings: como o JSON referencia dados em vez de repetir valores.
 *
 * O BFF manda os dados UMA vez (em `data`/`state`) e o layout apenas aponta
 * para eles. Isso mantém o layout cacheável por produto e os dados por proposta.
 *
 *   { "$bind": "data.proposta.valorSolicitado" }         -> valor do caminho
 *   { "$tpl": "Proposta nº {data.proposta.numero}" }      -> interpolação de texto
 */
import type { SduiCondition } from './sdui-condition.model';

export type SduiPrimitive = string | number | boolean | null;

/**
 * Raízes de caminho:
 *  - `data`    somente leitura (vem do BFF junto com o layout)
 *  - `state`   estado editável da tela (filtros, parecer...)
 *  - `sources` resultado de data sources remotos: `{ value, loading, error }`
 *  - `item`    linha atual — só existe em ações disparadas de uma linha de tabela
 */
export type SduiRoot = 'data' | 'state' | 'sources' | 'item';
export type SduiPath = `${SduiRoot}.${string}`;
export type SduiStatePath = `state.${string}`;

export interface SduiBinding {
  readonly $bind: SduiPath;
  /** Valor usado quando o caminho não existe ou é `null`. */
  readonly default?: SduiPrimitive;
}

export interface SduiTemplate {
  readonly $tpl: string;
}

/** Booleano derivado de uma condição: `{ "$when": { "op": "eq", ... } }`. */
export interface SduiWhen {
  readonly $when: SduiCondition;
}

/**
 * Uma prop pode ser literal ou apontar para os dados da tela. `$tpl` só é
 * aceito onde o tipo admite qualquer string (não em enums como `variant`) e
 * `$when` onde admite boolean.
 */
export type Bindable<T> =
  | T
  | SduiBinding
  | (string extends T ? SduiTemplate : never)
  | (boolean extends T ? SduiWhen : never);

/**
 * Tipo da prop depois de resolvida pelo motor — é o que o wrapper do Design
 * System recebe. Remove recursivamente `$bind`/`$tpl`/`$when` do tipo.
 */
export type Resolved<T> = T extends SduiBinding | SduiTemplate | SduiWhen
  ? never
  : T extends readonly (infer U)[]
    ? readonly Resolved<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Resolved<T[K]> }
      : T;

export function isSduiBinding(value: unknown): value is SduiBinding {
  return typeof value === 'object' && value !== null && typeof (value as SduiBinding).$bind === 'string';
}

export function isSduiTemplate(value: unknown): value is SduiTemplate {
  return typeof value === 'object' && value !== null && typeof (value as SduiTemplate).$tpl === 'string';
}

export function isSduiWhen(value: unknown): value is SduiWhen {
  return typeof value === 'object' && value !== null && typeof (value as SduiWhen).$when === 'object';
}
