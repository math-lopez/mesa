import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Placeholder temporário da Tela 3 (Alçadas), que entra na próxima iteração.
 */
@Component({
  selector: 'app-upcoming-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="upcoming">
      <h1>{{ title() }}</h1>
      <p>Esta tela será construída na próxima iteração.</p>
      <a routerLink="/fila">Voltar para a fila</a>
    </section>
  `,
  styles: `
    .upcoming {
      padding: 32px;
      max-width: 720px;
    }
  `,
})
export class UpcomingPage {
  readonly title = input('Em construção');

}
