# Mesa de Crédito — Front-end SDUI

Aplicação Angular (standalone, zoneless, signals) para a mesa de análise julgamental de
crédito. As telas são montadas por **Server-Driven UI**: o BFF envia um JSON com dados,
layout e ações, e o front o renderiza com o Design System.

> 📘 Documentação completa (arquitetura, contrato SDUI, API do BFF, migração para o Design System
> da empresa): **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**

```bash
npm start        # http://localhost:4200 — usa os mocks de public/mocks (environment.development)
npm test         # Vitest: motor SDUI + teste de contrato dos mocks
npm run build    # build de produção (sem mocks)
```

A tela inicial é a **Fila** (`/fila`), com 120 propostas mockadas (`public/mocks/fila/propostas.json`)
filtradas, ordenadas e paginadas pelo interceptor como o BFF faria. Telas de análise diretas:
`PRP-2026-000123` (Varejo, excede alçada), `PRP-2026-000456` (Veículos), `PRP-2026-000789`
(Consórcio), `PRP-2026-000999` (contrato v2 — testa o guard de versão). Propostas da fila abrem a
análise usando o template do seu produto.

## Estrutura

```
src/app/
├── core/
│   ├── api/bff-api.config.ts            BFF_BASE_URL
│   ├── auth/                            AuthService (token opaco), interceptor Bearer, guard
│   ├── session/current-user.ts          usuário e mesas vindos do BFF (GET /v1/me)
│   ├── mocks/mock-bff.interceptor.ts    simula o BFF (só em dev)
│   └── sdui/                            MOTOR — não conhece Material nem produto
│       ├── models/                      contrato JSON tipado (catálogo de nós, ações, bindings)
│       ├── engine/                      store, resolver, validação, renderer (createComponent)
│       ├── actions/                     dispatcher + handlers plugáveis (http, navigate, notify, setState)
│       ├── registry/                    Component Registry (type → wrapper, lazy) + fallback
│       ├── ports/                       SduiDialogPort / SduiNotifierPort
│       ├── format/                      formatação pt-BR independente do DS
│       └── provide-sdui.ts              composição
├── design-system/                       ADAPTER — único lugar que conhece Angular Material
│   ├── components/ds-*.ts               wrappers: input `props` + output `sduiEvent`
│   ├── adapters/                        dialog/snackbar implementando as portas
│   ├── shell/                           marca (logo, textos) usada pelo shell do app
│   ├── ds-component-map.ts              o "De-Para"
│   └── design-system.ts                 DESIGN_SYSTEM (ponto único de troca)
├── shared/sdui-remote-screen.component  busca a tela no BFF + loading/erro
└── features/
    ├── work-queue/                      Tela 1 — Fila (GET /v1/telas/fila)
    └── proposal-analysis/               Tela 2 — Análise (GET /v1/propostas/:id/telas/analise)
```

## Visão por mesa (grupo do token)

O front trata o token como **opaco**: o `authInterceptor` só o anexa (`Authorization: Bearer`)
nas chamadas ao BFF. Quem decide a visão é o BFF, a cada requisição:

1. valida o token (assinatura/JWKS, `exp`, `aud`, `iss`) → 401 se inválido;
2. lê o claim `groups` e resolve a(s) mesa(s) pelo Parametrizador
   (`GRP_MESA_VEICULOS` → Mesa Veículos...) → 403 se nenhuma;
3. `GET /v1/telas/fila` devolve o layout da mesa (filtros, colunas, listas); com várias mesas
   (supervisor), a visão consolidada com o filtro de produto restrito às mesas dele;
4. listagem, contadores, "Pegar e Atuar" e tela de análise aplicam o escopo da mesa **no
   servidor** — alterar parâmetros no front não expõe propostas de outra mesa (403).

O endpoint é o mesmo para todos (`/v1/telas/fila`), sem parâmetro de mesa. Como a resposta varia
por usuário, o BFF real deve responder com `Cache-Control: private` / `Vary: Authorization`.

Simulação: `/entrar` é o "SSO fake" (só com `useMockBff`) e emite um JWT sem assinatura com os
grupos do perfil escolhido (`core/mocks/mock-identity.ts`). O mapa grupo → mesa → layout fica em
`core/mocks/mock-mesas.ts` e os layouts em `public/mocks/telas/fila/{MESA}.json`. Atalho de QA:
`/entrar?perfil=u-carlos` (perfis: `u-maria`, `u-carlos`, `u-fernanda`, `u-ricardo`, `u-joao`).
Em produção a rota `/entrar` não existe e o `AuthService` embrulha a lib OIDC corporativa.

## Como estender

- **Novo tipo de componente:** adicione a entrada em `SduiPropsCatalog`
  (`core/sdui/models/sdui-node.model.ts`). O compilador passa a exigir o wrapper em
  `ds-component-map.ts`. Crie o wrapper implementando `SduiComponent<SduiViewOf<'seu.tipo'>>`.
- **Novo tipo de ação:** adicione ao union `SduiAction` e registre um `SduiActionHandler`
  no multi-provider `SDUI_ACTION_HANDLERS`.
- **Trocar para o Design System da empresa:** reescreva template/SCSS dos wrappers em
  `design-system/components` (a API `props`/`sduiEvent` não muda), ou crie outro
  `SduiDesignSystem` e passe-o para `provideSdui()` em `app.config.ts`. Motor, JSON e
  telas não mudam.

## Regras do contrato

- Raízes de caminho: `data` (leitura), `state` (editável), `sources.<nome>` (dados remotos:
  `{ value, loading, error }`) e `item` (a linha, só em ações disparadas de uma tabela).
- Bindings: `{"$bind": "state.x"}`, `{"$tpl": "Proposta {data.proposta.numero}"}` e
  `{"$when": <condição>}` (booleano derivado, ex.: contador ativo).
- `sources` declara consultas reativas: quando um `$bind` dos `params` muda, o motor refaz a
  requisição (e cancela a anterior). A `data.table` só grava página/ordenação em `state`.
- Filtros usam rascunho + consulta: os campos editam `state.filtros`; a ação `FILTRAR` copia
  para `state.consulta.filtros` (que alimenta o source) e volta para a página 1 via `onSuccess`.

- `data` é somente leitura; `state` é o que o analista edita e o que as ações enviam.
- Regras de negócio (alçada, permissão) são calculadas no BFF e chegam como flags/`enabled`.
  O front só avalia condições simples e reativas (`visibleWhen`, `enabledWhen`).
- `meta.schemaVersion` com major diferente de `SDUI_SUPPORTED_MAJOR` é rejeitado.
- Tipos desconhecidos não quebram a tela: caem no `SduiFallbackComponent`.
