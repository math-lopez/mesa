import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SduiRemoteScreenComponent } from '../../shared/sdui-remote-screen.component';

/**
 * Tela 1 — Fila de propostas para atuação.
 * Filtros, contadores, colunas e ações por linha vêm do BFF (`/v1/telas/fila`);
 * os dados da tabela vêm paginados/ordenados do servidor via data source.
 */
@Component({
  selector: 'app-work-queue-page',
  imports: [SduiRemoteScreenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-sdui-remote-screen endpoint="/v1/telas/fila" loadingMessage="Carregando fila…" />`,
})
export class WorkQueuePage {}
