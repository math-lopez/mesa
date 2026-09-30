import { Injectable, Signal, computed, inject } from '@angular/core';

import { DebugLogger } from '../../debug/debug-logger';
import { SduiActionDispatcher } from '../actions/sdui-action-dispatcher';
import { SduiNode, SduiUiEvent, isFieldNode, isInteractiveNode, submitActionOf } from '../models';
import { SduiFormState } from './sdui-form-state';
import { SduiResolver } from './sdui-resolver';
import { SduiStore } from './sdui-store';

export interface SduiNodeBinding {
  /** Props resolvidas + estado de runtime (valor/erro, loading/disabled). */
  readonly props: Signal<Readonly<Record<string, unknown>>>;
  readonly handle: (event: SduiUiEvent) => void;
  readonly dispose: () => void;
}

/**
 * Liga um nó JSON ao runtime da tela. É aqui — e não nos wrappers — que mora
 * toda a lógica SDUI: bindings, validação, estado de ações e tratamento de eventos.
 */
@Injectable()
export class SduiNodeBinder {
  readonly #store = inject(SduiStore);
  readonly #resolver = inject(SduiResolver);
  readonly #form = inject(SduiFormState);
  readonly #dispatcher = inject(SduiActionDispatcher);
  readonly #debug = inject(DebugLogger);

  bind(node: SduiNode): SduiNodeBinding {
    const field = isFieldNode(node) ? node : null;
    const interactive = isInteractiveNode(node) ? node : null;
    const submitAction = submitActionOf(node);
    const unregister = field ? this.#form.register(field.bind, field.validators ?? {}) : () => {};

    const props = computed(
      () => ({
        ...(this.#resolver.resolve(node.props) as Record<string, unknown>),
        ...(field && {
          value: this.#store.read(field.bind) ?? null,
          error: this.#form.visibleError(field.bind),
          required: field.validators?.required ?? false,
          maxLength: field.validators?.maxLength ?? null,
        }),
        ...(interactive && {
          disabled: this.#dispatcher.pending() !== null || !this.#dispatcher.isEnabled(interactive.on.click),
          loading: this.#dispatcher.pending() === interactive.on.click,
          disabledReason: this.#dispatcher.disabledReason(interactive.on.click),
        }),
      }),
      { equal: shallowEqual },
    );

    const handle = (event: SduiUiEvent): void => {
      switch (event.type) {
        case 'click':
          if (interactive) void this.#dispatcher.dispatch(interactive.on.click);
          break;
        case 'change':
          if (!field) break;
          this.#store.write(field.bind, event.value);
          // Campos de digitação logam no blur (um evento por campo, não por tecla).
          if (!TYPING.has(node.type)) {
            this.#debug.log('estado', `${field.bind} ← ${preview(event.value)}`, { nó: node.id, valor: event.value });
          }
          break;
        case 'blur':
          if (!field) break;
          this.#form.touch(field.bind);
          if (TYPING.has(node.type)) {
            const value = this.#store.read(field.bind);
            this.#debug.log('estado', `${field.bind} ← ${preview(value)}`, { nó: node.id, valor: value });
          }
          break;
        case 'submit':
          if (submitAction) void this.#dispatcher.dispatch(submitAction);
          break;
        case 'rowAction':
          void this.#dispatcher.dispatch(event.action, { item: event.item });
          break;
      }
    };

    return { props, handle, dispose: unregister };
  }
}

const TYPING = new Set<string>(['input.text', 'input.textarea']);

function preview(value: unknown): string {
  const text = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Evita re-render do wrapper quando nenhuma prop mudou de fato. */
function shallowEqual(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}
