import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SduiRemoteScreenComponent } from '../../shared/sdui-remote-screen.component';

/**
 * Tela 2 — Análise e detalhamento da proposta.
 * Não conhece produto nem campos: o BFF decide a jornada pelo produto da proposta.
 */
@Component({
  selector: 'app-proposal-analysis-page',
  imports: [SduiRemoteScreenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sdui-remote-screen
      [endpoint]="endpoint()"
      loadingMessage="Carregando proposta…"
      errorFallback="Não foi possível carregar a proposta."
    />
  `,
})
export class ProposalAnalysisPage {
  /** Vem do parâmetro de rota `:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly endpoint = computed(
    () => `/v1/propostas/${encodeURIComponent(this.id())}/telas/analise`,
  );
}
