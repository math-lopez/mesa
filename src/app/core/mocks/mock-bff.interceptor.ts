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
import { MockTokenClaims, verifyMockToken } from './mock-identity';
import { Mesa, mesasDoUsuario, telaDaFila } from './mock-mesas';
import { EXTRA_FILTERS, MockProposal, MockViewer, assign, queryQueue, queueSummary } from './mock-queue';

const LATENCY_MS = 450;

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

/** Contexto que o BFF monta a partir do token em TODA requisição. */
interface RequestUser {
  readonly claims: MockTokenClaims;
  readonly mesas: readonly Mesa[];
  readonly viewer: MockViewer;
}

/**
 * Simula o BFF enquanto ele não existe. Só é registrado quando
 * `environment.useMockBff` é true (ver app.config) — o código de produção não muda.
 *
 * Todo endpoint: valida o token (401) → resolve mesas pelos grupos (403 se nenhuma)
 * → aplica o escopo da mesa. O front nunca informa a mesa.
 *
 *   GET  /v1/me                              → usuário + mesas
 *   GET  /v1/telas/fila                      → layout da fila DA MESA do usuário
 *   GET  /v1/propostas?filtros&page&sort     → página filtrada, restrita às mesas
 *   GET  /v1/propostas/resumo                → contadores da mesa
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

  // ---- autenticação e autorização (o que o BFF faria num filtro/middleware) ----
  const claims = verifyMockToken(req.headers.get('Authorization'));
  if (!claims) return fail(req, 401, 'Sessão expirada ou inválida. Entre novamente.');

  const mesas = mesasDoUsuario(claims.groups);
  const user: RequestUser = {
    claims,
    mesas,
    viewer: { nome: claims.name, produtos: mesas.flatMap((mesa) => mesa.produtos) },
  };

  if (req.method === 'GET' && path === '/v1/me') {
    return respond(
      of({
        nome: claims.name,
        perfil: claims.title,
        mesas: mesas.map(({ codigo, nome }) => ({ codigo, nome })),
      }),
      150,
    );
  }

  if (mesas.length === 0) {
    return fail(req, 403, 'Seu usuário não está vinculado a nenhuma mesa de análise. Procure o gestor da área.');
  }

  // ---- fila ----
  if (req.method === 'GET' && path === '/v1/telas/fila') {
    return respond(asset<Record<string, unknown>>(telaDaFila(mesas)).pipe(map((tela) => scopeQueueScreen(tela, user))));
  }

  if (req.method === 'GET' && path === '/v1/propostas/resumo') {
    return respond(loadQueue().pipe(map((items) => queueSummary(items, user.viewer))), 200);
  }

  if (req.method === 'GET' && path === '/v1/propostas') {
    const p = req.params;
    return respond(
      loadQueue().pipe(
        map((items) =>
          queryQueue(items, user.viewer, {
            busca: p.get('busca'),
            situacao: p.get('situacao'),
            produto: p.get('produto'),
            dataCriacao: p.get('dataCriacao'),
            extras: Object.fromEntries(EXTRA_FILTERS.map((key) => [key, p.get(key)])),
            page: Number(p.get('page') ?? 0),
            size: Number(p.get('size') ?? 10),
            sortBy: p.get('sortBy'),
            sortDir: p.get('sortDir'),
          }),
        ),
      ),
    );
  }

  // ---- proposta (sempre verificando se pertence à mesa do usuário) ----
  const withProposal = <T>(id: string, handler: (proposal: MockProposal) => Observable<T>) =>
    loadQueue().pipe(
      switchMap((items) => {
        const proposal = items.find((item) => item.id === id);
        if (!proposal) return fail(req, 404, `Proposta ${id} não encontrada.`);
        if (!user.viewer.produtos.includes(proposal.produto)) {
          return fail(req, 403, `A proposta #${id} não pertence à sua mesa.`);
        }
        return handler(proposal);
      }),
    );

  const assignMatch = /^\/v1\/propostas\/([^/]+)\/atribuicao$/.exec(path);
  if (req.method === 'POST' && assignMatch) {
    const id = assignMatch[1]!;
    return withProposal(id, (proposal) => {
      if (proposal.situacao === 'EM_ATUACAO' && proposal.responsavel !== claims.name) {
        return fail(req, 409, `Proposta #${id} já está com ${proposal.responsavel}.`);
      }
      assigned.set(id, assign(proposal, claims.name));
      const effects: SduiAction[] = [
        { kind: 'notify', tone: 'success', message: `Proposta #${id} atribuída a você.` },
        { kind: 'navigate', route: `/propostas/${id}/analise` },
      ];
      return respond(of<SduiActionResult>({ effects }));
    });
  }

  const screen = /^\/v1\/propostas\/([^/]+)\/telas\/analise$/.exec(path);
  if (req.method === 'GET' && screen) {
    const id = screen[1]!;
    const templateId = Object.entries(ANALYSIS_TEMPLATE).find(([, template]) => template === id);
    if (templateId) {
      // Propostas-exemplo fixas: também respeitam a mesa.
      return user.viewer.produtos.includes(templateId[0])
        ? respond(asset(`telas/analise/${id}.json`))
        : fail(req, 403, `A proposta ${id} não pertence à sua mesa.`);
    }
    return withProposal(id, (proposal) =>
      respond(
        asset<Record<string, unknown>>(`telas/analise/${ANALYSIS_TEMPLATE[proposal.produto]}.json`).pipe(
          map((tela) => fillAnalysis(tela, proposal)),
        ),
      ),
    );
  }

  const action = /^\/v1\/propostas\/([^/]+)\/acoes\/([\w-]+)$/.exec(path);
  if (req.method === 'POST' && action) {
    const [, id = '', name = ''] = action;
    console.info('[mock-bff]', claims.name, name, id, req.body);
    return respond(of(actionResult(id, name)), LATENCY_MS * 2);
  }

  return next(req);
};

/**
 * Ajustes por usuário sobre o layout parametrizado da mesa. Na visão
 * consolidada (supervisor), o filtro de produto só oferece as mesas dele.
 */
function scopeQueueScreen(tela: Record<string, unknown>, user: RequestUser): Record<string, unknown> {
  const data = tela['data'] as { listas: Record<string, { value: string; label: string }[]> } & Record<string, unknown>;
  const produtos = data.listas['produtos'];
  return {
    ...tela,
    data: {
      ...data,
      escopo: { descricao: user.mesas.map((mesa) => mesa.nome).join(', ') },
      listas: {
        ...data.listas,
        ...(produtos && {
          produtos: produtos.filter((option) => !option.value || user.viewer.produtos.includes(option.value)),
        }),
      },
    },
  };
}

/** Injeta os dados da proposta da fila no template de análise do produto. */
function fillAnalysis(tela: Record<string, unknown>, p: MockProposal): Record<string, unknown> {
  const data = tela['data'] as Record<string, Record<string, unknown>>;
  return {
    ...tela,
    data: {
      ...data,
      proposta: {
        ...data['proposta'],
        id: p.id,
        numero: p.id,
        produtoDescricao: p.produtoDescricao,
        valorSolicitado: p.valor,
        dataEntrada: p.dataEnvio,
      },
      cliente: { ...data['cliente'], nome: p.cliente, cpf: p.documento },
      ...(p.placa !== undefined && { veiculo: { ...data['veiculo'], marcaModelo: p.veiculo, placa: p.placa ?? '0 km' } }),
      ...(p.grupoCota && {
        consorcio: { ...data['consorcio'], grupo: p.grupoCota.split('/')[0], cota: p.grupoCota.split('/')[1] },
      }),
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

function fail(req: HttpRequest<unknown>, status: number, message: string) {
  return throwError(() => new HttpErrorResponse({ status, error: { message }, url: req.url }));
}
