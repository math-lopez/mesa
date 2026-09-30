import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, PendingTasks, inject, isDevMode, signal } from '@angular/core';

import { SduiResolver, SduiScope } from '../engine/sdui-resolver';
import { SduiFormState } from '../engine/sdui-form-state';
import { SduiStore } from '../engine/sdui-store';
import { SduiAction, SduiActionId, SduiScreen } from '../models';
import { SduiDialogPort, SduiNotifierPort } from '../ports/sdui-ui.ports';
import { AnySduiActionHandler, SDUI_ACTION_HANDLERS } from './sdui-action-handler';

/** Protege contra `onSuccess` circular vindo do JSON. */
const MAX_CHAIN_DEPTH = 10;

/**
 * Executa as ações declaradas no catálogo `actions` da tela:
 * permissão → validação → confirmação → handler → efeitos do servidor → `onSuccess`.
 * Garante uma ação por vez (evita duplo clique em "Aprovar").
 */
@Injectable()
export class SduiActionDispatcher {
  readonly #store = inject(SduiStore);
  readonly #resolver = inject(SduiResolver);
  readonly #form = inject(SduiFormState);
  readonly #dialog = inject(SduiDialogPort);
  readonly #notifier = inject(SduiNotifierPort);
  readonly #pendingTasks = inject(PendingTasks);
  readonly #handlers = new Map(
    inject(SDUI_ACTION_HANDLERS).map((handler) => [handler.kind, handler] as const),
  );

  #catalog: SduiScreen['actions'] = {};

  /** Id da ação em execução — usado para loading/disable dos botões. */
  readonly pending = signal<SduiActionId | null>(null);

  init(screen: Pick<SduiScreen, 'actions'>): void {
    this.#catalog = screen.actions;
  }

  /** Reativo: reavalia quando o `state` referenciado em `enabledWhen` muda. */
  isEnabled(id: SduiActionId, scope?: SduiScope): boolean {
    const action = this.#catalog[id];
    return (
      action !== undefined &&
      action.enabled !== false &&
      this.#resolver.evaluate(action.enabledWhen, scope)
    );
  }

  disabledReason(id: SduiActionId, scope?: SduiScope): string | null {
    return this.isEnabled(id, scope) ? null : (this.#catalog[id]?.disabledReason ?? null);
  }

  /** `scope` carrega o contexto do disparo — ex.: `{ item: linha }` numa ação de tabela. */
  async dispatch(id: SduiActionId, scope?: SduiScope): Promise<void> {
    const action = this.#catalog[id];
    if (!action) {
      this.#warn(`Ação "${id}" não existe no catálogo da tela.`);
      return;
    }
    if (this.pending() !== null) return;
    if (!this.isEnabled(id, scope)) {
      const reason = this.disabledReason(id, scope);
      if (reason) this.#notifier.notify(reason, 'warning');
      return;
    }

    if (action.validate?.length && !this.#form.validate(action.validate)) {
      this.#notifier.notify('Revise os campos destacados antes de continuar.', 'warning');
      return;
    }
    if (
      action.confirm &&
      !(await this.#dialog.confirm(this.#resolver.resolve(action.confirm, scope)))
    ) {
      return;
    }

    this.pending.set(id);
    // Mantém a aplicação "instável" enquanto a ação roda (whenStable, SSR, e2e).
    const done = this.#pendingTasks.add();
    try {
      await this.#run(action, scope, 0);
    } catch (error) {
      this.#notifier.notify(this.#errorMessage(error), 'danger');
    } finally {
      this.pending.set(null);
      done();
    }
  }

  async #run(action: SduiAction, scope: SduiScope | undefined, depth: number): Promise<void> {
    if (depth > MAX_CHAIN_DEPTH) {
      throw new Error('Cadeia de ações SDUI excedeu o limite (possível ciclo em onSuccess).');
    }
    const handler = this.#handlers.get(action.kind) as AnySduiActionHandler | undefined;
    if (!handler) {
      throw new Error(`Nenhum handler registrado para ações do tipo "${action.kind}".`);
    }
    // O Map é indexado por `kind`, então handler e action são do mesmo tipo.
    const result = await handler.execute(action as never, {
      store: this.#store,
      resolver: this.#resolver,
      scope,
    });
    for (const effect of result?.effects ?? []) {
      await this.#run(effect, scope, depth + 1);
    }
    for (const nextId of action.onSuccess ?? []) {
      const next = this.#catalog[nextId];
      if (next) await this.#run(next, scope, depth + 1);
      else this.#warn(`onSuccess referencia ação inexistente "${nextId}".`);
    }
  }

  #errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = (error.error as { message?: unknown } | null)?.message;
      if (typeof serverMessage === 'string') return serverMessage;
      return error.status === 0
        ? 'Não foi possível comunicar com o servidor. Tente novamente.'
        : `Falha ao executar a ação (HTTP ${error.status}).`;
    }
    return 'Não foi possível concluir a ação. Tente novamente.';
  }

  #warn(message: string): void {
    if (isDevMode()) console.warn(`[SDUI] ${message}`);
  }
}
