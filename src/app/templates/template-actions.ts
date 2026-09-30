import { Bindable, SduiAction, SduiCondition, SduiConfirm, SduiStatePath } from '../core/sdui';
import { Confirmacao, Execucao } from './template-contract.model';

/** Campos de formulário/filtro vivem em `state.<prefixo><campo>`. */
export function statePath(campo: string, prefixo = ''): SduiStatePath {
  return `state.${prefixo}${campo}`;
}

export function toConfirm(confirmacao: Confirmacao | undefined): SduiConfirm | undefined {
  return (
    confirmacao && {
      title: confirmacao.titulo,
      message: confirmacao.mensagem,
      confirmLabel: confirmacao.botao,
      tone: confirmacao.tom,
    }
  );
}

interface ActionOptions {
  readonly enabled?: boolean;
  readonly enabledWhen?: SduiCondition;
  readonly disabledReason?: string;
  readonly validate?: readonly SduiStatePath[];
  readonly confirm?: SduiConfirm;
  /** Corpo das requisições (campos já como bindings). */
  readonly payload?: Readonly<Record<string, Bindable<unknown>>>;
  /** Reescreve `{campo}` em endpoint/rota (ex.: para `{item.campo}` em ações de linha). */
  readonly rewritePath?: (template: string) => string;
}

export function toSduiAction(execucao: Execucao, options: ActionOptions = {}): SduiAction {
  const rewrite = options.rewritePath ?? ((template: string) => template);
  const common = {
    enabled: options.enabled,
    enabledWhen: options.enabledWhen,
    disabledReason: options.disabledReason,
    validate: options.validate,
    confirm: options.confirm,
  };
  return execucao.tipo === 'requisicao'
    ? {
        ...common,
        kind: 'http',
        method: execucao.metodo,
        endpoint: rewrite(execucao.endpoint),
        payload: options.payload,
      }
    : { ...common, kind: 'navigate', route: rewrite(execucao.rota) };
}

/** `/v1/propostas/{id}/x` → `/v1/propostas/{item.id}/x` (valores da linha clicada). */
export function rowScoped(template: string): string {
  return template.replace(/\{(\w+)\}/g, '{item.$1}');
}

export function allFilled(paths: readonly SduiStatePath[]): SduiCondition | undefined {
  if (paths.length === 0) return undefined;
  const conditions = paths.map((path): SduiCondition => ({ op: 'exists', path }));
  return conditions.length === 1 ? conditions[0] : { op: 'and', conditions };
}
