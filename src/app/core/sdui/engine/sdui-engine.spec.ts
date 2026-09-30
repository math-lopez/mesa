import { ChangeDetectionStrategy, Component, Type, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { BFF_BASE_URL } from '../../api/bff-api.config';
import { SduiComponentMap } from '../registry/sdui-component-registry';
import { SduiDialogPort, SduiNotifierPort } from '../ports/sdui-ui.ports';
import { provideSdui } from '../provide-sdui';
import { SduiRow, SduiScreen, SduiUiEvent } from '../models';
import { SduiSlotDirective } from './sdui-renderer';
import { SduiScreenComponent } from './sdui-screen.component';
import { evaluateCondition } from './sdui-conditions';
import { readPath, writePath } from './sdui-path';

// ------------------------------------------------------------------ utilitários puros

describe('sdui-path', () => {
  it('lê caminhos aninhados e índices de array', () => {
    expect(readPath({ a: { b: [{ c: 1 }] } }, ['a', 'b', '0', 'c'])).toBe(1);
    expect(readPath({ a: null }, ['a', 'b'])).toBeUndefined();
  });

  it('escreve de forma imutável clonando só o trecho alterado', () => {
    const source = { a: { b: 1 }, x: { y: 2 } };
    const next = writePath(source, ['a', 'b'], 9);
    expect(next).toEqual({ a: { b: 9 }, x: { y: 2 } });
    expect(next).not.toBe(source);
    expect(next.x).toBe(source.x);
  });
});

describe('evaluateCondition', () => {
  const data: Record<string, unknown> = { 'data.valor': 100, 'state.motivo': '  ', 'data.uf': 'SP' };
  const read = (path: string) => data[path];

  it('avalia comparações e composição', () => {
    expect(evaluateCondition({ op: 'gt', path: 'data.valor', value: 50 }, read)).toBe(true);
    expect(evaluateCondition({ op: 'in', path: 'data.uf', values: ['RJ', 'SP'] }, read)).toBe(true);
    expect(evaluateCondition({ op: 'exists', path: 'state.motivo' }, read)).toBe(false);
    expect(
      evaluateCondition(
        { op: 'and', conditions: [{ op: 'lte', path: 'data.valor', value: 100 }, { op: 'not', condition: { op: 'eq', path: 'data.uf', value: 'RJ' } }] },
        read,
      ),
    ).toBe(true);
  });
});

// ------------------------------------------------------------------ motor completo

@Component({
  selector: 'test-container',
  imports: [SduiSlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>{{ props().title }}</h1><ng-container sduiSlot="main" /><footer><ng-container sduiSlot="footer" /></footer>`,
})
class TestPage {
  readonly props = input.required<{ title: string }>();
}

@Component({
  selector: 'test-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="text">{{ props().label }}={{ props().value }}</span>`,
})
class TestText {
  readonly props = input.required<{ label: string; value: unknown }>();
}

@Component({
  selector: 'test-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input [value]="props().value ?? ''" (input)="change($event)" /><em>{{ props().error }}</em>`,
})
class TestInput {
  readonly props = input.required<{ value: string | null; error: string | null }>();
  readonly sduiEvent = output<SduiUiEvent>();
  change(event: Event): void {
    this.sduiEvent.emit({ type: 'change', value: (event.target as HTMLInputElement).value });
  }
}

@Component({
  selector: 'test-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button [disabled]="props().disabled" (click)="sduiEvent.emit({ type: 'click' })">{{ props().label }}</button>`,
})
class TestButton {
  readonly props = input.required<{ label: string; disabled: boolean }>();
  readonly sduiEvent = output<SduiUiEvent>();
}

@Component({
  selector: 'test-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (row of props().rows; track row['id']) {
      <button class="row" (click)="sduiEvent.emit({ type: 'rowAction', action: 'PEGAR', item: row })">{{ row['id'] }}</button>
    }
  `,
})
class TestTable {
  readonly props = input.required<{ rows: readonly SduiRow[] }>();
  readonly sduiEvent = output<SduiUiEvent>();
}

const load = <T>(type: Type<T>) => () => Promise.resolve(type as never);
const TEST_MAP = {
  'layout.page': load(TestPage),
  'display.field': load(TestText),
  'input.textarea': load(TestInput),
  'action.button': load(TestButton),
  'data.table': load(TestTable),
} as unknown as SduiComponentMap; // o mapa real é exaustivo; aqui só o necessário

/** Tela no formato da fila: data source reativo, ações por linha, $when e cadeia de setState. */
function queueScreen(): SduiScreen {
  return {
    meta: { schemaVersion: '1.0', screenId: 'fila', product: 'TESTE', revision: 't', generatedAt: '' },
    data: {},
    state: {
      filtros: { busca: 'silva' },
      consulta: { filtros: { busca: null }, tabela: { pageIndex: 3, pageSize: 10, sort: null } },
    },
    sources: {
      fila: {
        endpoint: '/v1/propostas',
        params: {
          busca: { $bind: 'state.consulta.filtros.busca' },
          page: { $bind: 'state.consulta.tabela.pageIndex' },
        },
      },
    },
    actions: {
      FILTRAR: { kind: 'setState', path: 'state.consulta.filtros', value: { $bind: 'state.filtros' }, onSuccess: ['PAGINA_0'] },
      PAGINA_0: { kind: 'setState', path: 'state.consulta.tabela.pageIndex', value: 0 },
      PEGAR: {
        kind: 'http',
        method: 'POST',
        endpoint: '/v1/propostas/{item.id}/atribuicao',
        enabledWhen: { op: 'neq', path: 'item.situacao', value: 'EM_ATUACAO' },
        disabledReason: 'Já está com você.',
      },
    },
    layout: {
      id: 'page',
      type: 'layout.page',
      props: { title: 'Fila' },
      slots: {
        main: [
          {
            id: 'filtrado',
            type: 'display.field',
            props: { label: 'Filtrado', value: { $when: { op: 'exists', path: 'state.consulta.filtros.busca' } } },
          },
          { id: 'tabela', type: 'data.table', bind: 'state.consulta.tabela', props: { rowKey: 'id', columns: [], rows: { $bind: 'sources.fila.value.items', default: null }, total: { $bind: 'sources.fila.value.total', default: 0 } } },
        ],
        footer: [{ id: 'filtrar', type: 'action.button', props: { label: 'Filtrar' }, on: { click: 'FILTRAR' } }],
      },
    },
  };
}

function screen(): SduiScreen {
  return {
    meta: { schemaVersion: '1.0', screenId: 'test', product: 'TESTE', revision: 't', generatedAt: '' },
    data: { proposta: { id: 'P1', valor: 10 } },
    state: { parecer: null },
    actions: {
      ENVIAR: {
        kind: 'http',
        method: 'POST',
        endpoint: '/v1/propostas/{data.proposta.id}/acoes/enviar',
        payload: { parecer: { $bind: 'state.parecer' } },
        validate: ['state.parecer'],
      },
    },
    layout: {
      id: 'page',
      type: 'layout.page',
      props: { title: { $tpl: 'Proposta {data.proposta.id}' } },
      slots: {
        main: [
          { id: 'valor', type: 'display.field', props: { label: 'Valor', value: { $bind: 'data.proposta.valor' } } },
          {
            id: 'eco',
            type: 'display.field',
            visibleWhen: { op: 'exists', path: 'state.parecer' },
            props: { label: 'Eco', value: { $bind: 'state.parecer' } },
          },
          { id: 'parecer', type: 'input.textarea', bind: 'state.parecer', validators: { required: true }, props: { label: 'Parecer' } },
          { id: 'desconhecido', type: 'display.chart' as 'display.field', props: { label: '', value: null } },
        ],
        footer: [{ id: 'enviar', type: 'action.button', props: { label: 'Enviar' }, on: { click: 'ENVIAR' } }],
      },
    },
  };
}

describe('SduiScreenComponent', () => {
  const notify = vi.fn();

  beforeEach(() => {
    notify.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BFF_BASE_URL, useValue: '/bff' },
        provideSdui({
          components: TEST_MAP,
          dialog: class extends SduiDialogPort {
            override confirm = () => Promise.resolve(true);
          },
          notifier: class extends SduiNotifierPort {
            override notify = notify;
          },
        }),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(SduiScreenComponent);
    fixture.componentRef.setInput('screen', screen());
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('renderiza a árvore resolvendo $tpl e $bind, com fallback para tipo desconhecido', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toBe('Proposta P1');
    expect(el.querySelector('.text')?.textContent).toBe('Valor=10');
    expect(el.querySelector('[data-sdui-id="desconhecido"]')?.tagName.toLowerCase()).toBe('sdui-fallback');
    expect(el.querySelector('footer button')?.textContent).toBe('Enviar');
  });

  it('bloqueia a ação quando a validação falha e exibe o erro no campo', async () => {
    const { fixture, el } = await render();
    el.querySelector<HTMLButtonElement>('footer button')!.click();
    await fixture.whenStable();

    TestBed.inject(HttpTestingController).expectNone('/bff/v1/propostas/P1/acoes/enviar');
    expect(el.querySelector('em')?.textContent).toBe('Campo obrigatório.');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Revise'), 'warning');
  });

  it('two-way no state, visibilidade reativa e envio do payload resolvido', async () => {
    const { fixture, el } = await render();
    const inputEl = el.querySelector('input')!;
    inputEl.value = 'Cliente com bom histórico';
    inputEl.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    // Nó com visibleWhen apareceu na posição correta (entre "valor" e "parecer").
    const ids = [...el.querySelectorAll('[data-sdui-id]')].map((n) => n.getAttribute('data-sdui-id'));
    expect(ids.slice(1, 4)).toEqual(['valor', 'eco', 'parecer']);

    el.querySelector<HTMLButtonElement>('footer button')!.click();
    // Sem whenStable aqui: a ação em curso é uma PendingTask até o flush da resposta.
    await Promise.resolve();
    fixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne('/bff/v1/propostas/P1/acoes/enviar');
    expect(req.request.body).toEqual({ parecer: 'Cliente com bom histórico' });
    expect(el.querySelector<HTMLButtonElement>('footer button')!.disabled).toBe(true); // pending

    req.flush({ effects: [{ kind: 'notify', message: 'ok', tone: 'success' }] });
    await fixture.whenStable();
    expect(notify).toHaveBeenCalledWith('ok', 'success');
    expect(el.querySelector<HTMLButtonElement>('footer button')!.disabled).toBe(false);
  });

  describe('fila: data source, ações por linha e cadeia de setState', () => {
    let http: HttpTestingController;
    beforeEach(() => (http = TestBed.inject(HttpTestingController)));

    /** Espera o motor (preload assíncrono + effects) disparar a requisição do data source. */
    async function nextListRequest(fixture: { detectChanges(): void }) {
      // Como o agendador zoneless real: CD só depois que a cadeia de microtasks da ação termina.
      await new Promise((resolve) => setTimeout(resolve));
      return vi.waitFor(() => {
        fixture.detectChanges();
        return http.expectOne((req) => req.url === '/bff/v1/propostas');
      });
    }

    it('consulta, dispara ação com o item da linha e reconsulta ao filtrar', async () => {
      const fixture = TestBed.createComponent(SduiScreenComponent);
      fixture.componentRef.setInput('screen', queueScreen());
      const el = fixture.nativeElement as HTMLElement;

      const first = await nextListRequest(fixture);
      expect(first.request.params.get('page')).toBe('3');
      expect(first.request.params.has('busca')).toBe(false); // null é omitido
      first.flush({ items: [{ id: 'A', situacao: 'DISPONIVEL' }, { id: 'B', situacao: 'EM_ATUACAO' }], total: 2 });
      await fixture.whenStable();

      const rows = () => [...el.querySelectorAll<HTMLButtonElement>('button.row')];
      expect(rows().map((b) => b.textContent)).toEqual(['A', 'B']);
      expect(el.querySelector('.text')?.textContent).toBe('Filtrado=false');

      // enabledWhen avaliado com `item` da linha: B já está em atuação.
      rows()[1]!.click();
      await fixture.whenStable();
      http.expectNone('/bff/v1/propostas/B/atribuicao');
      expect(notify).toHaveBeenCalledWith('Já está com você.', 'warning');

      rows()[0]!.click();
      await Promise.resolve();
      http.expectOne('/bff/v1/propostas/A/atribuicao').flush({});
      await fixture.whenStable();

      // FILTRAR copia o rascunho para a consulta e o onSuccess volta para a página 0.
      el.querySelector<HTMLButtonElement>('footer button')!.click();
      const second = await nextListRequest(fixture);
      expect(second.request.params.get('busca')).toBe('silva');
      expect(second.request.params.get('page')).toBe('0');
      second.flush({ items: [], total: 0 });
      await fixture.whenStable();
      expect(el.querySelector('.text')?.textContent).toBe('Filtrado=true');
    });
  });
});
