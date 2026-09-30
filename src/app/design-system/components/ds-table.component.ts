import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

import { SduiComponent, SduiFormatPipe, SduiRow, SduiViewOf } from '../../core/sdui';

@Component({
  selector: 'ds-table',
  imports: [MatTableModule, SduiFormatPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (props().rows.length) {
      <div class="table__scroll">
        <table mat-table [dataSource]="rows()">
          @for (column of props().columns; track column.key) {
            <ng-container [matColumnDef]="column.key">
              <th mat-header-cell *matHeaderCellDef [class.end]="column.align === 'end'">
                {{ column.header }}
              </th>
              <td mat-cell *matCellDef="let row" [class.end]="column.align === 'end'">
                {{ row[column.key] | sduiFormat: column.format }}
              </td>
            </ng-container>
          }
          <tr mat-header-row *matHeaderRowDef="columnKeys()"></tr>
          <tr mat-row *matRowDef="let row; columns: columnKeys()"></tr>
        </table>
      </div>
    } @else {
      <p class="table__empty">{{ props().emptyMessage ?? 'Nenhum registro.' }}</p>
    }
  `,
  styles: `
    .table__scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      background: transparent;
    }
    .end {
      text-align: end;
    }
    .table__empty {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class DsTableComponent implements SduiComponent<SduiViewOf<'display.table'>> {
  readonly props = input.required<SduiViewOf<'display.table'>>();
  protected readonly rows = computed(() => this.props().rows as SduiRow[]);
  protected readonly columnKeys = computed(() => this.props().columns.map((column) => column.key));
}
