import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

import {
  SduiComponent,
  SduiDataColumn,
  SduiEventEmitter,
  SduiFormatPipe,
  SduiRow,
  SduiRowAction,
  SduiTableState,
  SduiTone,
  SduiUiEvent,
  SduiViewOf,
  resolveTone,
} from '../../core/sdui';

const DEFAULT_STATE: SduiTableState = { pageIndex: 0, pageSize: 10, sort: null };
const MAX_PAGE_BUTTONS = 5;

/**
 * Tabela com paginação e ordenação server-side. Não busca dados: recebe a
 * página atual em `props.rows` e emite o novo estado (página/ordenação) como
 * `change` — o motor grava em `state` e o data source refaz a consulta.
 */
@Component({
  selector: 'ds-data-table',
  imports: [MatTableModule, MatSortModule, MatButtonModule, MatProgressBarModule, SduiFormatPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="progress">
        @if (props().loading) {
          <mat-progress-bar mode="indeterminate" aria-label="Carregando dados" />
        }
      </div>

      <div class="scroll" [attr.aria-busy]="props().loading ?? false">
        <table
          mat-table
          [dataSource]="rows()"
          [trackBy]="trackBy"
          matSort
          [matSortActive]="state().sort?.active ?? ''"
          [matSortDirection]="state().sort?.direction ?? ''"
          (matSortChange)="onSort($event)"
        >
          @for (column of props().columns; track column.key) {
            <ng-container [matColumnDef]="column.key">
              <th
                mat-header-cell
                *matHeaderCellDef
                mat-sort-header
                [disabled]="!column.sortable"
                [class.end]="column.align === 'end'"
              >
                {{ column.header }}
              </th>
              <td
                mat-cell
                *matCellDef="let row"
                [class.end]="column.align === 'end'"
                [class.nowrap]="!!column.format || !!column.kind || !!column.prefix"
              >
                @switch (column.kind) {
                  @case ('badge') {
                    <span class="pill" [attr.data-tone]="toneOf(column, row)">{{ row[column.key] }}</span>
                  }
                  @case ('actions') {
                    <div class="row-actions">
                      @for (action of column.actions ?? []; track action.action) {
                        <button
                          type="button"
                          class="row-button"
                          [matButton]="action.variant === 'primary' ? 'filled' : 'outlined'"
                          [attr.aria-label]="action.label + ' ' + rowLabel(row)"
                          (click)="onRowAction(action, row)"
                        >
                          {{ action.label }}
                        </button>
                      }
                    </div>
                  }
                  @default {
                    {{ column.prefix }}{{ row[column.key] | sduiFormat: column.format }}
                  }
                }
              </td>
            </ng-container>
          }

          <tr mat-header-row *matHeaderRowDef="columnKeys()"></tr>
          <tr mat-row *matRowDef="let row; columns: columnKeys()"></tr>
          <tr class="mat-mdc-row" *matNoDataRow>
            <td class="empty" [attr.colspan]="columnKeys().length">
              {{ props().error ?? (props().loading ? 'Carregando…' : (props().emptyMessage ?? 'Nenhum registro encontrado.')) }}
            </td>
          </tr>
        </table>
      </div>

      <div class="footer">
        <span class="summary" aria-live="polite">{{ summary() }}</span>
        @if (pageCount() > 1) {
          <nav class="pager" aria-label="Paginação">
            <button type="button" class="page-btn" [disabled]="state().pageIndex === 0" (click)="goTo(state().pageIndex - 1)">
              Anterior
            </button>
            @for (page of pages(); track page) {
              <button
                type="button"
                class="page-btn number"
                [class.current]="page === state().pageIndex"
                [attr.aria-current]="page === state().pageIndex ? 'page' : null"
                [attr.aria-label]="'Página ' + (page + 1)"
                (click)="goTo(page)"
              >
                {{ page + 1 }}
              </button>
            }
            <button
              type="button"
              class="page-btn"
              [disabled]="state().pageIndex >= pageCount() - 1"
              (click)="goTo(state().pageIndex + 1)"
            >
              Próxima
            </button>
          </nav>
        }
      </div>
    </div>
  `,
  styles: `
    .card {
      background: var(--ds-surface);
      border: 1px solid var(--ds-border);
      border-radius: 10px;
      box-shadow: var(--ds-shadow-sm);
      overflow: hidden;
    }
    .progress {
      height: 4px;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      background: transparent;
      --mat-table-header-headline-color: var(--ds-text);
      --mat-table-header-headline-weight: 600;
      --mat-table-row-item-container-height: 44px;
      --mat-table-header-container-height: 44px;
    }
    th.mat-mdc-header-cell {
      background: var(--ds-surface-muted);
    }
    .end {
      text-align: end;
    }
    .nowrap {
      white-space: nowrap;
    }
    .pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      background: var(--ds-tone-bg);
      color: var(--ds-tone-fg);
      white-space: nowrap;
    }
    .row-actions {
      display: flex;
      gap: 8px;
    }
    .row-button {
      --mat-button-filled-container-height: 30px;
      --mat-button-outlined-container-height: 30px;
      --mat-button-filled-horizontal-padding: 12px;
      --mat-button-outlined-horizontal-padding: 12px;
      --mat-button-outlined-label-text-color: var(--ds-text);
      font-size: 13px;
      white-space: nowrap;
    }
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-top: 1px solid var(--ds-border);
    }
    .summary {
      color: var(--ds-text);
      font: var(--mat-sys-body-medium);
    }
    .pager {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .page-btn {
      min-width: 32px;
      height: 32px;
      padding: 0 12px;
      border: 1px solid var(--ds-border);
      border-radius: 6px;
      background: var(--ds-surface);
      color: var(--ds-text);
      font: var(--mat-sys-body-medium);
      cursor: pointer;
    }
    .page-btn.number {
      padding: 0;
      border-color: transparent;
    }
    .page-btn.current {
      background: var(--ds-surface-muted);
      border-color: var(--ds-border);
      font-weight: 600;
    }
    .page-btn:disabled {
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.6;
      cursor: default;
    }
    .page-btn:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 1px;
    }
  `,
})
export class DsDataTableComponent implements SduiComponent<SduiViewOf<'data.table'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'data.table'>>();
  readonly sduiEvent = output<SduiUiEvent>();

  protected readonly rows = computed(() => (this.props().rows ?? []) as SduiRow[]);
  protected readonly state = computed(() => this.props().value ?? DEFAULT_STATE);
  protected readonly columnKeys = computed(() => this.props().columns.map((column) => column.key));
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil((this.props().total ?? 0) / this.state().pageSize)),
  );

  /** Janela de até 5 páginas centrada na atual. */
  protected readonly pages = computed(() => {
    const count = this.pageCount();
    const size = Math.min(MAX_PAGE_BUTTONS, count);
    const start = Math.min(Math.max(0, this.state().pageIndex - Math.floor(size / 2)), count - size);
    return Array.from({ length: size }, (_, i) => start + i);
  });

  protected readonly summary = computed(() => {
    const total = this.props().total ?? 0;
    const label = this.props().itemLabel ?? 'registros';
    if (total === 0) return 'Nenhum resultado';
    const { pageIndex, pageSize } = this.state();
    const first = pageIndex * pageSize + 1;
    const last = Math.min(total, first + this.rows().length - 1);
    return `Exibindo ${first}-${last} de ${total} ${label}`;
  });

  protected readonly trackBy = (_: number, row: SduiRow) => row[this.props().rowKey];

  protected toneOf(column: SduiDataColumn, row: SduiRow): SduiTone {
    const value = row[column.toneKey ?? column.key];
    return resolveTone(value == null ? null : String(value), column.toneMap);
  }

  protected rowLabel(row: SduiRow): string {
    return String(row[this.props().rowKey] ?? '');
  }

  protected onRowAction(action: SduiRowAction, row: SduiRow): void {
    this.sduiEvent.emit({ type: 'rowAction', action: action.action, item: row });
  }

  protected goTo(pageIndex: number): void {
    if (pageIndex === this.state().pageIndex) return;
    this.#emit({ ...this.state(), pageIndex });
  }

  protected onSort(sort: Sort): void {
    const next = sort.direction ? { active: sort.active, direction: sort.direction } : null;
    this.#emit({ ...this.state(), pageIndex: 0, sort: next });
  }

  #emit(state: SduiTableState): void {
    this.sduiEvent.emit({ type: 'change', value: state });
  }
}
