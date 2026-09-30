import { Injectable, inject } from '@angular/core';

import {
  Resolved,
  SduiCondition,
  SduiPath,
  isSduiBinding,
  isSduiTemplate,
  isSduiWhen,
} from '../models';
import { evaluateCondition } from './sdui-conditions';
import { readPath, splitPath } from './sdui-path';
import { SduiStore } from './sdui-store';

const TEMPLATE_TOKEN = /\{((?:data|state|sources|item)(?:\.[\w-]+)+)\}/g;

/**
 * Valores extras visíveis durante uma resolução — hoje, `item` (a linha
 * que disparou uma ação de tabela). Sobrepõe as raízes do store.
 */
export type SduiScope = Readonly<Record<string, unknown>>;

/** Converte props declarativas (`$bind`, `$tpl`, `$when`) em valores concretos. */
@Injectable()
export class SduiResolver {
  readonly #store = inject(SduiStore);

  resolve<T>(value: T, scope?: SduiScope): Resolved<T> {
    return this.#resolveDeep(value, scope) as Resolved<T>;
  }

  interpolate(template: string, scope?: SduiScope): string {
    return template.replace(TEMPLATE_TOKEN, (_, path: SduiPath) => {
      const value = this.read(path, scope);
      return value === null || value === undefined ? '' : String(value);
    });
  }

  evaluate(condition: SduiCondition | undefined, scope?: SduiScope): boolean {
    return condition === undefined || evaluateCondition(condition, (path) => this.read(path, scope));
  }

  read(path: SduiPath, scope?: SduiScope): unknown {
    if (scope) {
      const [root, ...rest] = splitPath(path);
      if (root !== undefined && Object.hasOwn(scope, root)) return readPath(scope[root], rest);
    }
    return this.#store.read(path);
  }

  #resolveDeep(value: unknown, scope: SduiScope | undefined): unknown {
    if (isSduiBinding(value)) {
      return this.read(value.$bind, scope) ?? value.default ?? null;
    }
    if (isSduiTemplate(value)) {
      return this.interpolate(value.$tpl, scope);
    }
    if (isSduiWhen(value)) {
      return this.evaluate(value.$when, scope);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.#resolveDeep(item, scope));
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.#resolveDeep(item, scope)]),
      );
    }
    return value;
  }
}
