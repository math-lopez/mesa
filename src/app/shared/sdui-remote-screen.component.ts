import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { BFF_BASE_URL } from '../core/api/bff-api.config';
import { DebugLogger } from '../core/debug/debug-logger';
import { SduiNode, SduiSchemaError, SduiScreen, SduiScreenComponent } from '../core/sdui';
import { DsFeedbackComponent } from '../design-system/components/ds-feedback.component';
import { compileTemplateScreen } from '../templates/compile-template';

/**
 * Busca uma tela no BFF (contrato por template), monta o layout base e
 * entrega ao motor SDUI, com estados de carga/erro.
 * As páginas (features) só informam o endpoint — não conhecem layout nem produto.
 */
@Component({
  selector: 'app-sdui-remote-screen',
  imports: [SduiScreenComponent, DsFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (screen.hasValue()) {
      <sdui-screen [screen]="screen.value()" />
    } @else if (screen.error()) {
      <ds-feedback state="error" [message]="errorMessage()" (retry)="screen.reload()" />
    } @else {
      <ds-feedback state="loading" [message]="loadingMessage()" />
    }
  `,
})
export class SduiRemoteScreenComponent {
  /** Endpoint relativo ao BFF, ex.: `/v1/telas/fila`. */
  readonly endpoint = input.required<string>();
  readonly loadingMessage = input('Carregando…');
  readonly errorFallback = input('Não foi possível carregar a tela.');

  readonly #baseUrl = inject(BFF_BASE_URL);
  readonly #debug = inject(DebugLogger);

  protected readonly screen = httpResource(() => `${this.#baseUrl}${this.endpoint()}`, {
    parse: (raw) => this.#compile(raw),
  });

  #compile(raw: unknown): SduiScreen {
    try {
      const tree = compileTemplateScreen(raw);
      const received = raw as { template?: string; meta?: { schemaVersion?: string; product?: string } };
      this.#debug.log(
        'template',
        `"${received.template}" v${received.meta?.schemaVersion} (${received.meta?.product}) → ${countNodes(tree.layout)} nós na árvore interna`,
        {
          'contrato recebido do BFF': raw,
          'árvore montada pelo template': tree.layout,
          'estado inicial': tree.state,
          ações: tree.actions,
          sources: tree.sources ?? {},
        },
      );
      return tree;
    } catch (error) {
      this.#debug.log('template', `✕ contrato recusado: ${(error as Error).message}`, { 'contrato recebido': raw });
      throw error;
    }
  }

  protected readonly errorMessage = computed(() => {
    const error = this.screen.error();
    if (error instanceof SduiSchemaError) return error.message;
    // 403 = usuário sem acesso (ex.: proposta de outra mesa): mostra o motivo dado pelo BFF.
    const serverMessage = error instanceof HttpErrorResponse ? (error.error as { message?: unknown } | null)?.message : null;
    return typeof serverMessage === 'string' ? serverMessage : this.errorFallback();
  });
}

function countNodes(node: SduiNode): number {
  const children = [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()];
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}
