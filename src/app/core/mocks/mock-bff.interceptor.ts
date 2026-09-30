import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { BFF_BASE_URL } from '../api/bff-api.config';
import { SduiAction, SduiActionResult } from '../sdui';
import { MockProposal, assign, queryQueue, queueSummary } from './mock-queue';

const LATENCY_MS = 450;
const ANALYST = 'Maria Silva';

/** Marca requisições internas do mock (leitura dos JSONs) para não serem reinterceptadas. */
const MOCK_ASSET = new HttpContextToken(() => false);

/** Telas de análise por produto — propostas da fila usam o template do seu produto. */
const ANALYSIS_TEMPLATE: Readonly<Record<string, string>> = {
  CREDITO_VAREJO: 'PRP-2026-000123',
  VEICULOS: 'PRP-2026-000456',
  CONSORCIO: 'PRP-2026-000789',
};

const ACTION_LABEL: Readonly<Record<string, string>> = {
  aprovar: 'aprovada',
  recusar: 'recusada',
  devolver: 'devolvida',
  finalizar: 'finalizada',
  'solicitar-vistoria': 'enviada para vistoria',
  'encaminhar-alcada': 'encaminhada para alçada',
};

// Estado em memória do "BFF fake" (dura enquanto a aba estiver aberta).
let queue$: Observable<MockProposal[]> | null = null;
const assigned = new Map<string, MockProposal>();

/**
 * Simula o BFF enquanto ele não existe. Só é registrado quando
 * `environment.useMockBff` é true (ver app.config) — o código de produção não muda.
 *
 *   GET  /v1/telas/fila                     → public/mocks/telas/fila.json
 *   GET  /v1/propostas?filtros&page&sort     → página filtrada/ordenada da base mock
 *   GET  /v1/propostas/resumo                → contadores
 *   POST /v1/propostas/:id/atribuicao        → "Pegar e Atuar"
 *   GET  /v1/propostas/:id/telas/analise     → tela de análise (por produto)
 *   POST /v1/propostas/:id/acoes/:acao       → decisão com efeitos
 */
export const mockBffInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(BFF_BASE_URL);
  if (req.context.get(MOCK_ASSET) || !req.url.startsWith(baseUrl)) {
    return next(req);
  }
  const http = inject(HttpClient);
  const path = req.url.slice(baseUrl.length);
  const asset = <T>(file: string) =>
    http.get<T>(`/mocks/${file}`, { context: new HttpContext().set(MOCK_ASSET, true) });
  const loadQueue = () =>
    (queue$ ??= asset<MockProposal[]>('fila/propostas.json').pipe(shareReplay(1))).pipe(
      map((items) => items.map((item) => assigned.get(item.id) ?? item)),
    );
  const respond = <T>(body$: Observable<T>, latency = LATENCY_MS) =>
    body$.pipe(
      map((body) => new HttpResponse<T>({ status: 200, body, url: req.url })),
      delay(latency),
    );

  if (req.method === 'GET' && path === '/v1/telas/fila') {
    return respond(asset('telas/fila.json'));
  }

  if (req.method === 'GET' && path === '/v1/propostas/resumo') {
    return respond(loadQueue().pipe(map(queueSummary)), 200);
  }

  if (req.method === 'GET' && path === '/v1/propostas') {
    const p = req.params;
    return respond(
      loadQueue().pipe(
        map((items) =>
          queryQueue(items, {
            busca: p.get('busca'),
            situacao: p.get('situacao'),
            produto: p.get('produto'),
            dataCriacao: p.get('dataCriacao'),
            page: Number(p.get('page') ?? 0),
            size: Number(p.get('size') ?? 10),
            sortBy: p.get('sortBy'),
            sortDir: p.get('sortDir'),
          }),
        ),
      ),
    );
  }

  const assignMatch = /^\/v1\/propostas\/([^/]+)\/atribuicao$/.exec(path);
  if (req.method === 'POST' && assignMatch) {
    const id = assignMatch[1]!;
    return loadQueue().pipe(
      switchMap((items) => {
        const proposal = items.find((item) => item.id === id);
        if (!proposal) return notFound(req, `Proposta ${id} não encontrada.`);
        if (proposal.situacao === 'EM_ATUACAO' && proposal.responsavel !== ANALYST) {
          return conflict(req, `Proposta ${id} já está com ${proposal.responsavel}.`);
        }
        assigned.set(id, assign(proposal, ANALYST));
        const effects: SduiAction[] = [
          { kind: 'notify', tone: 'success', message: `Proposta #${id} atribuída a você.` },
          { kind: 'navigate', route: `/propostas/${id}/analise` },
        ];
        return respond(of<SduiActionResult>({ effects }), LATENCY_MS);
      }),
    );
  }

  const screen = /^\/v1\/propostas\/([^/]+)\/telas\/analise$/.exec(path);
  if (req.method === 'GET' && screen) {
    const id = screen[1]!;
    if (Object.values(ANALYSIS_TEMPLATE).includes(id)) {
      return respond(asset(`telas/analise/${id}.json`));
    }
    return loadQueue().pipe(
      switchMap((items) => {
        const proposal = items.find((item) => item.id === id);
        const template = proposal && ANALYSIS_TEMPLATE[proposal.produto];
        if (!proposal || !template) return notFound(req, `Proposta ${id} não encontrada.`);
        return respond(
          asset<Record<string, unknown>>(`telas/analise/${template}.json`).pipe(
            map((tela) => withProposal(tela, proposal)),
          ),
        );
      }),
    );
  }

  const action = /^\/v1\/propostas\/([^/]+)\/acoes\/([\w-]+)$/.exec(path);
  if (req.method === 'POST' && action) {
    const [, id = '', name = ''] = action;
    console.info('[mock-bff]', name, id, req.body);
    return respond(of(actionResult(id, name)), LATENCY_MS * 2);
  }

  return next(req);
};

/** Injeta os dados da proposta da fila no template de análise do produto. */
function withProposal(tela: Record<string, unknown>, p: MockProposal): Record<string, unknown> {
  const data = tela['data'] as Record<string, Record<string, unknown>>;
  return {
    ...tela,
    data: {
      ...data,
      proposta: { ...data['proposta'], id: p.id, numero: p.id, produtoDescricao: p.produtoDescricao, valorSolicitado: p.valor, dataEntrada: p.dataEnvio },
      cliente: { ...data['cliente'], nome: p.cliente, cpf: p.documento },
    },
  };
}

function actionResult(id: string, name: string): SduiActionResult {
  const protocolo = `${Date.now()}`.slice(-8);
  return {
    effects: [
      {
        kind: 'notify',
        tone: 'success',
        message: `Proposta ${id} ${ACTION_LABEL[name] ?? 'atualizada'}. Protocolo ${protocolo}.`,
      },
      { kind: 'navigate', route: name === 'encaminhar-alcada' ? `/propostas/${id}/alcadas` : '/fila' },
    ],
  };
}

function notFound(req: HttpRequest<unknown>, message: string) {
  return throwError(() => new HttpErrorResponse({ status: 404, error: { message }, url: req.url }));
}

function conflict(req: HttpRequest<unknown>, message: string) {
  return throwError(() => new HttpErrorResponse({ status: 409, error: { message }, url: req.url }));
}
