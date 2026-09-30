import { Bindable, SduiStatePath } from './sdui-binding.model';
import { SduiCondition } from './sdui-condition.model';
import type { SduiTone } from './sdui-node.model';

export type SduiActionId = string;

export interface SduiConfirm {
  readonly title: Bindable<string>;
  readonly message: Bindable<string>;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: SduiTone;
}

interface SduiActionBase<TKind extends string> {
  readonly kind: TKind;
  /** Permissão calculada no BFF (perfil, alçada, status). `false` bloqueia a ação. */
  readonly enabled?: boolean;
  /** Regra reativa no cliente (ex.: só devolve com motivo preenchido). */
  readonly enabledWhen?: SduiCondition;
  /** Explicação exibida quando a ação está bloqueada (tooltip / leitor de tela). */
  readonly disabledReason?: string;
  /** Campos de `state` que precisam estar válidos antes de executar. */
  readonly validate?: readonly SduiStatePath[];
  readonly confirm?: SduiConfirm;
  /** Ações do catálogo executadas em sequência após sucesso (encadeáveis). */
  readonly onSuccess?: readonly SduiActionId[];
}

/** Chamada ao BFF. `endpoint` aceita interpolação: `/v1/propostas/{data.proposta.id}/acoes/aprovar`. */
export interface SduiHttpAction extends SduiActionBase<'http'> {
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly endpoint: string;
  readonly payload?: Readonly<Record<string, Bindable<unknown>>>;
}

export interface SduiNavigateAction extends SduiActionBase<'navigate'> {
  readonly route: string;
}

export interface SduiNotifyAction extends SduiActionBase<'notify'> {
  readonly message: string;
  readonly tone?: SduiTone;
}

/** Grava em `state`. `value` aceita bindings (ex.: copiar o rascunho de filtros para a consulta). */
export interface SduiSetStateAction extends SduiActionBase<'setState'> {
  readonly path: SduiStatePath;
  readonly value: Bindable<unknown>;
}

export type SduiAction = SduiHttpAction | SduiNavigateAction | SduiNotifyAction | SduiSetStateAction;
export type SduiActionKind = SduiAction['kind'];

/**
 * Resposta padrão do BFF a uma ação. `effects` permite ao servidor decidir o
 * que acontece depois (notificar, navegar, atualizar estado) sem deploy do front.
 */
export interface SduiActionResult {
  readonly effects?: readonly SduiAction[];
}
