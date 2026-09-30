import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Placeholder temporário da Tela 3 (Alçadas), que entra na próxima iteração.
 * Lista as propostas mockadas para navegar até a Tela 2.
 */
@Component({
  selector: 'app-upcoming-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="upcoming">
      <h1>{{ title() }}</h1>
      <p>Esta tela será construída na próxima iteração. Propostas de exemplo (mock do BFF):</p>
      <ul>
        @for (mock of mocks; track mock.id) {
          <li>
            <a [routerLink]="['/propostas', mock.id, 'analise']">{{ mock.id }}</a> — {{ mock.produto }}
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .upcoming {
      padding: 32px;
      max-width: 720px;
    }
    li {
      margin-block: 8px;
    }
  `,
})
export class UpcomingPage {
  readonly title = input('Em construção');

  protected readonly mocks = [
    { id: 'PRP-2026-000123', produto: 'Crédito Varejo (excede alçada)' },
    { id: 'PRP-2026-000456', produto: 'Veículos' },
    { id: 'PRP-2026-000789', produto: 'Consórcio' },
    { id: 'PRP-2026-000999', produto: 'Contrato v2 (incompatível — testa o guard de versão)' },
  ];
}
