import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { SduiComponent, SduiSlotDirective, SduiViewOf } from '../../core/sdui';

let nextId = 0;

@Component({
  selector: 'ds-section',
  imports: [MatCardModule, MatIconModule, MatButtonModule, SduiSlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" class="section">
      <div class="section__header">
        @if (props().icon; as icon) {
          <mat-icon class="section__icon" aria-hidden="true">{{ icon }}</mat-icon>
        }
        <div class="section__titles">
          <h2 class="section__title" [id]="titleId">{{ props().title }}</h2>
          @if (props().description) {
            <p class="section__description">{{ props().description }}</p>
          }
        </div>
        @if (props().collapsible) {
          <button
            matIconButton
            type="button"
            [attr.aria-expanded]="expanded()"
            [attr.aria-controls]="bodyId"
            [attr.aria-label]="(expanded() ? 'Recolher ' : 'Expandir ') + props().title"
            (click)="expanded.set(!expanded())"
          >
            <mat-icon>{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
        }
      </div>
      <div class="section__body" role="region" [id]="bodyId" [attr.aria-labelledby]="titleId" [hidden]="!expanded()">
        <ng-container sduiSlot />
      </div>
    </mat-card>
  `,
  styles: `
    .section {
      padding: 18px 20px 20px;
      --mat-card-outlined-container-color: var(--ds-surface);
      --mat-card-outlined-outline-color: var(--ds-border);
      --mat-card-outlined-container-shape: 10px;
      box-shadow: var(--ds-shadow-sm);
    }
    .section__header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .section__icon {
      color: var(--mat-sys-primary);
      margin-top: 2px;
    }
    .section__titles {
      flex: 1;
    }
    .section__title {
      margin: 0;
      font: var(--mat-sys-title-medium);
      font-weight: 600;
      color: var(--ds-text);
    }
    .section__description {
      margin: 2px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .section__body {
      display: grid;
      gap: 16px;
      margin-top: 16px;
    }
  `,
})
export class DsSectionComponent implements SduiComponent<SduiViewOf<'layout.section'>> {
  readonly props = input.required<SduiViewOf<'layout.section'>>();

  protected readonly expanded = linkedSignal(() => this.props().expanded ?? true);
  protected readonly titleId = `ds-section-title-${nextId}`;
  protected readonly bodyId = `ds-section-body-${nextId++}`;
}
