import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';

import { SduiActionDispatcher } from '../actions/sdui-action-dispatcher';
import { SduiNode, SduiScreen } from '../models';
import { SduiComponentRegistry } from '../registry/sdui-component-registry';
import { SduiFormState } from './sdui-form-state';
import { SduiNodeBinder } from './sdui-node-binder';
import { SduiOutletDirective } from './sdui-renderer';
import { SduiResolver } from './sdui-resolver';
import { SduiSources } from './sdui-sources';
import { SduiStore } from './sdui-store';

/**
 * Host de uma tela SDUI. Cria o escopo de DI da tela (store, validação,
 * ações), pré-carrega os wrappers necessários e renderiza a árvore.
 * Duas telas na mesma página = dois escopos isolados.
 */
@Component({
  selector: 'sdui-screen',
  imports: [SduiOutletDirective],
  providers: [SduiStore, SduiResolver, SduiFormState, SduiSources, SduiActionDispatcher, SduiNodeBinder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-sdui-screen]': 'screen().meta.screenId' },
  template: `
    @if (root(); as nodes) {
      <ng-container [sduiOutlet]="nodes" />
    } @else if (prepared.error()) {
      <p role="alert">Não foi possível montar a tela.</p>
    }
  `,
})
export class SduiScreenComponent {
  readonly screen = input.required<SduiScreen>();

  readonly #registry = inject(SduiComponentRegistry);
  readonly #store = inject(SduiStore);
  readonly #dispatcher = inject(SduiActionDispatcher);
  readonly #sources = inject(SduiSources);

  protected readonly prepared = resource({
    params: () => this.screen(),
    loader: async ({ params: screen }) => {
      await this.#registry.preload(screen.layout);
      this.#store.init(screen);
      this.#dispatcher.init(screen);
      this.#sources.init(screen);
      return screen;
    },
  });

  protected readonly root = computed<readonly SduiNode[] | null>(() =>
    this.prepared.hasValue() ? [this.prepared.value().layout] : null,
  );
}
