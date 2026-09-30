import { Injectable, inject, signal } from '@angular/core';

import { SduiStatePath, SduiValidators } from '../models';
import { isEmpty } from './sdui-conditions';
import { SduiStore } from './sdui-store';

/**
 * Validação dos campos editáveis da tela. Os validadores vêm do JSON do nó;
 * as ações declaram quais caminhos precisam estar válidos (`validate`).
 */
@Injectable()
export class SduiFormState {
  readonly #store = inject(SduiStore);
  readonly #validators = new Map<SduiStatePath, SduiValidators>();
  readonly #touched = signal<ReadonlySet<SduiStatePath>>(new Set());

  /** Registra enquanto o campo estiver renderizado. Campo oculto não bloqueia ações. */
  register(path: SduiStatePath, validators: SduiValidators): () => void {
    this.#validators.set(path, validators);
    return () => this.#validators.delete(path);
  }

  /** Erro exibível: só aparece depois que o campo foi tocado ou uma ação tentou validar. */
  visibleError(path: SduiStatePath): string | null {
    return this.#touched().has(path) ? this.errorOf(path) : null;
  }

  errorOf(path: SduiStatePath): string | null {
    const rules = this.#validators.get(path);
    if (!rules) return null;

    const value = this.#store.read(path);
    const length = typeof value === 'string' ? value.trim().length : 0;

    if (rules.required && isEmpty(value)) {
      return rules.messages?.required ?? 'Campo obrigatório.';
    }
    if (rules.minLength !== undefined && length > 0 && length < rules.minLength) {
      return rules.messages?.minLength ?? `Informe ao menos ${rules.minLength} caracteres.`;
    }
    if (rules.maxLength !== undefined && length > rules.maxLength) {
      return rules.messages?.maxLength ?? `Máximo de ${rules.maxLength} caracteres.`;
    }
    return null;
  }

  touch(path: SduiStatePath): void {
    if (this.#touched().has(path)) return;
    this.#touched.update((current) => new Set(current).add(path));
  }

  /** Marca os caminhos como tocados (exibindo erros) e informa se todos são válidos. */
  validate(paths: readonly SduiStatePath[]): boolean {
    this.#touched.update((current) => new Set([...current, ...paths]));
    return paths.every((path) => this.errorOf(path) === null);
  }
}
