import { ChangeDetectionStrategy, Component, inject, input, isDevMode } from '@angular/core';

import { SduiComponent } from '../models';
import { SDUI_NODE } from '../engine/sdui-node.token';

/**
 * Renderizado quando o BFF envia um `type` que este build não conhece.
 * Em dev mostra um aviso visível; em produção não renderiza nada (degrada sem quebrar a tela).
 */
@Component({
  selector: 'sdui-fallback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (devMode) {
      <div class="fallback" role="note">
        Componente SDUI não suportado: <code>{{ node.type }}</code> (id: {{ node.id }})
      </div>
    }
  `,
  styles: `
    .fallback {
      padding: 8px 12px;
      border: 1px dashed #b3261e;
      border-radius: 8px;
      color: #b3261e;
      font-size: 13px;
    }
  `,
})
export class SduiFallbackComponent implements SduiComponent<unknown> {
  readonly props = input<unknown>();
  protected readonly node = inject(SDUI_NODE);
  protected readonly devMode = isDevMode();
}
