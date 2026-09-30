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
import { Observable, delay, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { BFF_BASE_URL } from '../api/bff-api.config';
import { DebugLogger } from '../debug/debug-logger';
import { SduiAction, SduiActionResult } from '../sdui';
import { FilaScreen } from '../../templates/template-contract.model';
import { buildAnaliseMock } from './mock-analysis';
import { MockTokenClaims, verifyMockToken } from './mock-identity';
import { Mesa, mesasDoUsuario, telaDaFila } from './mock-mesas';
import { EXTRA_FILTERS, MockPage, MockProposal, MockViewer, assign, queryQueue, queueSummary } from './mock-queue';

const LATENCY_MS = 450;

/** Marca requisições internas do mock (leitura dos JSONs) para não serem reinterceptadas. */
const MOCK_ASSET = new HttpContextToken(() => false);

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
 *   GET  /v1/propostas/:id/telas/analise     → tela de análise composta a partir da proposta
 *   POST /v1/propostas/:id/acoes/:acao       → decisão com efeitos
 */
export const mockBffInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(BFF_BASE_URL);
  if (req.context.get(MOCK_ASSET) || !req.url.startsWith(baseUrl)) {
    return next(req);
  }
  const http = inject(HttpClient);
  const debug = inject(DebugLogger);
  /** O que o BFF "pensou" nesta requisição — só aparece no modo debug. */
  const bff = (message: string, details?: Record<string, unknown>) => debug.log('bff', message, details);
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
  if (!claims) {
    bff(`${req.method} ${path}: token ausente, inválido ou expirado → 401`);
    return fail(req, 401, 'Sessão expirada ou inválida. Entre novamente.');
  }

  const mesas = mesasDoUsuario(claims.groups);
  bff(
    `${req.method} ${path}: token de ${claims.name} (${claims.title}) → ${mesas.map((m) => m.nome).join(', ') || 'nenhuma mesa'}`,
    { 'claims do token': claims, 'mesas resolvidas pelos grupos': mesas },
  );
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
    bff('usuário sem mesa vinculada → 403');
    return fail(req, 403, 'Seu usuário não está vinculado a nenhuma mesa de análise. Procure o gestor da área.');
  }

  // ---- fila ----
  if (req.method === 'GET' && path === '/v1/telas/fila') {
    const layout = telaDaFila(mesas);
    bff(`fila: ${mesas.length === 1 ? 'uma mesa' : `${mesas.length} mesas (visão consolidada)`} → parametrização ${layout}`);
    return respond(asset<FilaScreen>(layout).pipe(map((tela) => scopeQueueScreen(tela, user))));
  }

  if (req.method === 'GET' && path === '/v1/propostas/resumo') {
    return respond(
      loadQueue().pipe(
        map((items) => queueSummary(items, user.viewer)),
        tap((resumo) => bff(`resumo no escopo [${user.viewer.produtos.join(', ')}]`, { resumo })),
      ),
      200,
    );
  }

  if (req.method === 'GET' && path === '/v1/propostas') {
    const p = req.params;
    return respond(
      loadQueue().pipe(
        map((items) =>
          withRowPermissions(queryQueue(items, user.viewer, {
            busca: p.get('busca'),
            situacao: p.get('situacao'),
            produto: p.get('produto'),
            dataCriacao: p.get('dataCriacao'),
            extras: Object.fromEntries(EXTRA_FILTERS.map((key) => [key, p.get(key)])),
            page: Number(p.get('page') ?? 0),
            size: Number(p.get('size') ?? 10),
            sortBy: p.get('sortBy'),
            sortDir: p.get('sortDir'),
          })),
        ),
        tap((page) =>
          bff(
            `listagem no escopo [${user.viewer.produtos.join(', ')}]: ${page.total} proposta(s) após filtros → página ${page.page + 1} com ${page.items.length}`,
            { 'parâmetros recebidos': Object.fromEntries(p.keys().map((key) => [key, p.get(key)])), 'podePegar calculado por linha': page.items.map((i) => `${i.id}: ${i.podePegar}`) },
          ),
        ),
      ),
    );
  }

  // ---- proposta (sempre verificando se pertence à mesa do usuário) ----
  const withProposal = <T>(id: string, handler: (proposal: MockProposal) => Observable<T>) =>
    loadQueue().pipe(
      switchMap((items) => {
        const proposal = items.find((item) => item.id === id);
        if (!proposal) {
          bff(`proposta ${id} não existe → 404`);
          return fail(req, 404, `Proposta ${id} não encontrada.`);
        }
        if (!user.viewer.produtos.includes(proposal.produto)) {
          bff(`proposta ${id} é de ${proposal.produto}, fora das mesas do usuário → 403`);
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
        bff(`proposta ${id} já está com ${proposal.responsavel} → 409`);
        return fail(req, 409, `Proposta #${id} já está com ${proposal.responsavel}.`);
      }
      assigned.set(id, assign(proposal, claims.name));
      bff(`proposta ${id} atribuída a ${claims.name}; devolvendo efeitos: notificar → navegar para a análise`);
      const effects: SduiAction[] = [
        { kind: 'notify', tone: 'success', message: `Proposta #${id} atribuída a você.` },
        { kind: 'navigate', route: `/propostas/${id}/analise` },
      ];
      return respond(of<SduiActionResult>({ effects }));
    });
  }

  const screen = /^\/v1\/propostas\/([^/]+)\/telas\/analise$/.exec(path);
  if (req.method === 'GET' && screen) {
    return withProposal(screen[1]!, (proposal) => {
      const tela = buildAnaliseMock(proposal);
      bff(`compondo análise de ${proposal.id} (${proposal.produto}): ${tela.blocos.length} blocos, ações ${tela.acoes.map((a) => `${a.id}${a.habilitada === false ? '(bloqueada)' : ''}`).join(', ')}`, {
        proposta: proposal,
      });
      return respond(of(tela));
    });
  }

  const action = /^\/v1\/propostas\/([^/]+)\/acoes\/([\w-]+)$/.exec(path);
  if (req.method === 'POST' && action) {
    const [, id = '', name = ''] = action;
    bff(`decisão "${name}" na proposta ${id} por ${claims.name} (aqui o BFF real enviaria o TaskToken ao Step Functions)`, { corpo: req.body });
    return respond(of(actionResult(id, name)), LATENCY_MS * 2);
  }

  return next(req);
};

/**
 * Ajustes por usuário sobre a fila parametrizada da mesa. Na visão
 * consolidada (supervisor), o subtítulo lista as mesas e o filtro de
 * produto só oferece as mesas dele.
 */
function scopeQueueScreen(tela: FilaScreen, user: RequestUser): FilaScreen {
  if (user.mesas.length === 1) return tela;
  return {
    ...tela,
    subtitulo: `Visão consolidada · ${user.mesas.map((mesa) => mesa.nome).join(', ')}`,
    filtros: tela.filtros.map((filtro) =>
      filtro.tipo === 'select' && filtro.campo === 'produto'
        ? { ...filtro, opcoes: filtro.opcoes.filter((opcao) => user.viewer.produtos.includes(opcao.value)) }
        : filtro,
    ),
  };
}

/** Permissão por linha calculada no servidor — o front só a respeita (`campoHabilitado`). */
function withRowPermissions(page: MockPage<MockProposal>): MockPage<MockProposal & { podePegar: boolean }> {
  return { ...page, items: page.items.map((item) => ({ ...item, podePegar: item.situacao !== 'EM_ATUACAO' })) };
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
