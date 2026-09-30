import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { BFF_BASE_URL } from '../../api/bff-api.config';
import { DebugLogger } from '../../debug/debug-logger';
import {
  SduiActionResult,
  SduiHttpAction,
  SduiNavigateAction,
  SduiNotifyAction,
  SduiSetStateAction,
} from '../models';
import { SduiNotifierPort } from '../ports/sdui-ui.ports';
import { SduiActionContext, SduiActionHandler } from './sdui-action-handler';

@Injectable({ providedIn: 'root' })
export class SduiHttpActionHandler implements SduiActionHandler<'http'> {
  readonly kind = 'http';
  readonly #http = inject(HttpClient);
  readonly #baseUrl = inject(BFF_BASE_URL);

  execute(action: SduiHttpAction, { resolver, scope }: SduiActionContext): Promise<SduiActionResult> {
    const url = `${this.#baseUrl}${resolver.interpolate(action.endpoint, scope)}`;
    const body = action.payload ? resolver.resolve(action.payload, scope) : undefined;
    return firstValueFrom(this.#http.request<SduiActionResult>(action.method, url, { body }));
  }
}

@Injectable({ providedIn: 'root' })
export class SduiNavigateActionHandler implements SduiActionHandler<'navigate'> {
  readonly kind = 'navigate';
  readonly #router = inject(Router);

  async execute(action: SduiNavigateAction, { resolver, scope }: SduiActionContext): Promise<void> {
    await this.#router.navigateByUrl(resolver.interpolate(action.route, scope));
  }
}

@Injectable({ providedIn: 'root' })
export class SduiNotifyActionHandler implements SduiActionHandler<'notify'> {
  readonly kind = 'notify';
  readonly #notifier = inject(SduiNotifierPort);

  async execute(action: SduiNotifyAction, { resolver, scope }: SduiActionContext): Promise<void> {
    this.#notifier.notify(resolver.interpolate(action.message, scope), action.tone);
  }
}

@Injectable({ providedIn: 'root' })
export class SduiSetStateActionHandler implements SduiActionHandler<'setState'> {
  readonly kind = 'setState';
  readonly #debug = inject(DebugLogger);

  async execute(action: SduiSetStateAction, { store, resolver, scope }: SduiActionContext): Promise<void> {
    const value = resolver.resolve(action.value, scope);
    store.write(action.path, value);
    this.#debug.log('estado', `${action.path} ← ${JSON.stringify(value)}`, { valor: value });
  }
}
