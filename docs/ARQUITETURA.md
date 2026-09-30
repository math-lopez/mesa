# Mesa de Crédito — Documentação do Front-end

> Front-end da mesa de análise julgamental de crédito, construído com **Server-Driven UI (SDUI)**.
> Este documento explica **o que existe**, **como funciona**, **onde mexer** para cada tipo de
> mudança e **como migrar para o Design System da empresa**.

**Sumário**

1. [Visão geral](#1-visão-geral)
2. [Como rodar](#2-como-rodar)
3. [Arquitetura em camadas](#3-arquitetura-em-camadas)
4. [O contrato SDUI (JSON do BFF)](#4-o-contrato-sdui-json-do-bff)
5. [Como o motor funciona](#5-como-o-motor-funciona)
6. [Component Registry (o "De-Para")](#6-component-registry-o-de-para)
7. [Migração para o Design System da empresa](#7-migração-para-o-design-system-da-empresa)
8. [Autenticação e visão por mesa](#8-autenticação-e-visão-por-mesa)
9. [Contrato de API do BFF](#9-contrato-de-api-do-bff)
10. [Mocks: como o BFF é simulado](#10-mocks-como-o-bff-é-simulado)
11. [Receitas: como estender](#11-receitas-como-estender)
12. [Testes](#12-testes)
13. [Decisões, limitações e próximos passos](#13-decisões-limitações-e-próximos-passos)
14. [Mapa de arquivos](#14-mapa-de-arquivos)

---

## 1. Visão geral

Propostas de crédito negadas nos motores automáticos caem na **mesa julgamental**, onde analistas
decidem manualmente. A aplicação atende três produtos — **Crédito Varejo, Veículos e Consórcio** —
e cada mesa tem analistas, filtros, colunas e blocos de informação diferentes.

Em vez de codificar uma tela por produto, o front é um **motor genérico**: o BFF envia um JSON
descrevendo a tela (dados + layout + ações) e o Angular apenas renderiza. Mudar a jornada de um
produto é mudar a parametrização no BFF, **sem deploy do front**.

| Tela | Rota | Estado |
|---|---|---|
| 1. Fila de propostas | `/fila` | ✅ Pronta — visão por mesa, filtros, contadores, paginação server-side |
| 2. Análise da proposta | `/propostas/:id/analise` | ✅ Pronta — blocos por produto, parecer, ações com permissão/validação |
| 3. Aprovação por alçada | `/propostas/:id/alcadas` | ⏳ Placeholder — próxima iteração |

**Stack:** Angular 22 (standalone, zoneless, signals), TypeScript estrito, Angular Material
(apenas como implementação provisória do Design System), Vitest.

---

## 2. Como rodar

```bash
npm install
npm start          # http://localhost:4200 (usa o BFF simulado)
npm test           # testes unitários + teste de contrato dos mocks
npm run build      # build de produção (sem mocks)
```

Ao abrir, você cai em `/entrar` (login simulado). Escolha um perfil — cada um tem grupos
diferentes no token e, portanto, uma fila diferente:

| Perfil | Link direto | O que vê |
|---|---|---|
| Maria Silva — Analista | `/entrar?perfil=u-maria` | Mesa Crédito Varejo |
| Carlos Souza — Analista | `/entrar?perfil=u-carlos` | Mesa Veículos |
| Fernanda Rocha — Analista | `/entrar?perfil=u-fernanda` | Mesa Consórcio |
| Ricardo Alves — Supervisor | `/entrar?perfil=u-ricardo` | Visão consolidada (Crédito + Veículos) |
| João Lima — sem mesa | `/entrar?perfil=u-joao` | Acesso negado pelo BFF |

O ícone de sair no topo troca de usuário.

**Ambientes** (`src/environments/`):

| Arquivo | `bffBaseUrl` | `useMockBff` | Uso |
|---|---|---|---|
| `environment.development.ts` | `/bff` | `true` | `npm start` — BFF simulado no navegador |
| `environment.ts` | `/bff` | `false` | build de produção — chama o BFF real |

---

## 3. Arquitetura em camadas

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FEATURES  (src/app/features)                                            │
│  Páginas finas: dizem QUAL endpoint de tela buscar. Não conhecem campos, │
│  produto nem Material.                                                   │
│  work-queue.page → GET /v1/telas/fila                                    │
│  proposal-analysis.page → GET /v1/propostas/:id/telas/analise            │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ <sdui-screen [screen]="json">
┌───────────────────────────────▼──────────────────────────────────────────┐
│  CORE SDUI  (src/app/core/sdui)          ← NÃO muda ao trocar o DS       │
│  models/    contrato tipado do JSON                                      │
│  engine/    store (signals), resolver de bindings, validação,            │
│             data sources, renderer (ViewContainerRef.createComponent)    │
│  actions/   dispatcher + handlers (http, navigate, notify, setState)     │
│  registry/  Component Registry (type → componente) + fallback            │
│  ports/     abstrações de dialog e toast                                 │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ props resolvidas ↓   ↑ eventos de UI
┌───────────────────────────────▼──────────────────────────────────────────┐
│  DESIGN SYSTEM  (src/app/design-system)  ← ÚNICO lugar que troca         │
│  components/ds-*   wrappers: input `props` + output `sduiEvent`          │
│  adapters/         dialog/toast implementando as portas                  │
│  ds-component-map  o De-Para type → wrapper                              │
│  shell/            marca (logo, textos)                                  │
│  Hoje: Angular Material por dentro.                                      │
└──────────────────────────────────────────────────────────────────────────┘

  Transversal: core/auth (token), core/session (usuário via BFF),
               core/mocks (BFF simulado), shared/sdui-remote-screen
```

**Regras de dependência** (o que garante a troca fácil de DS):

- `core/sdui` **não importa** nada de `design-system` nem de `@angular/material`.
- Os wrappers do `design-system` **não conhecem** JSON, store, ações nem BFF. Recebem `props`
  prontas e emitem eventos genéricos (`click`, `change`, `blur`, `submit`, `rowAction`).
- As `features` não conhecem produto nem campos — só o endpoint da tela.

---

## 4. O contrato SDUI (JSON do BFF)

Toda tela é um envelope com seis partes. Tipos em `src/app/core/sdui/models/`.

```jsonc
{
  "meta":    { "schemaVersion": "1.0", "screenId": "work-queue", "product": "VEICULOS",
               "revision": "fila-veiculos@2026.09.2", "generatedAt": "...", "traceId": "..." },
  "data":    { /* dados de negócio, somente leitura */ },
  "state":   { /* estado editável inicial: filtros, parecer, paginação */ },
  "sources": { /* consultas remotas reativas (opcional) */ },
  "actions": { /* catálogo de ações, com permissões já calculadas pelo BFF */ },
  "layout":  { /* árvore de componentes */ }
}
```

| Parte | Para quê |
|---|---|
| `meta` | Versionamento e rastreio. O motor **recusa** `schemaVersion` com major diferente de `SDUI_SUPPORTED_MAJOR` (hoje `1`). `revision` identifica a versão da parametrização. |
| `data` | Dados de negócio (proposta, cliente, listas de opções). Nunca é alterado pela UI. |
| `state` | O que o analista edita e o que as ações enviam de volta. |
| `sources` | Dados buscados à parte (ex.: a página da fila). Refeitos quando os parâmetros mudam. |
| `actions` | O que os botões fazem, com `enabled`, regras e confirmação. |
| `layout` | Árvore de nós `{ id, type, props, children?, slots? }` que referencia os itens acima. |

### 4.1 Caminhos e bindings

Props podem ser literais ou apontar para dados. Raízes de caminho:

| Raiz | Conteúdo | Exemplo |
|---|---|---|
| `data.*` | dados do BFF (leitura) | `data.proposta.valorSolicitado` |
| `state.*` | estado editável | `state.filtros.situacao` |
| `sources.<nome>.*` | resultado de um source: `{ value, loading, error }` | `sources.fila.value.items` |
| `item.*` | a linha da tabela — só em ações disparadas de uma linha | `item.id` |

| Binding | Resultado | Exemplo |
|---|---|---|
| `{ "$bind": "caminho", "default": x }` | valor do caminho | `{ "$bind": "data.cliente.nome" }` |
| `{ "$tpl": "texto {caminho}" }` | texto interpolado | `{ "$tpl": "Proposta nº {data.proposta.numero}" }` |
| `{ "$when": <condição> }` | booleano | contador ativo quando o filtro é "URGENTE" |

### 4.2 Condições

Usadas em `visibleWhen` (nó), `enabledWhen` (ação) e `$when`. É uma **AST fechada** — nunca
`eval` de string vinda do servidor.

```jsonc
{ "op": "eq",  "path": "data.alcada.excedeAlcada", "value": true }
{ "op": "gt",  "path": "data.veiculo.ltv", "value": 0.8 }          // gt | gte | lt | lte
{ "op": "in",  "path": "data.uf", "values": ["SP", "RJ"] }
{ "op": "exists", "path": "state.motivoDevolucao" }                 // exists | empty
{ "op": "and", "conditions": [ ... ] }                              // and | or
{ "op": "not", "condition": { ... } }
```

> **Regra de ouro:** regras de negócio pesadas (alçada, permissão, política) são calculadas no
> BFF e chegam prontas (`excedeAlcada: true`, `enabled: false`). O front só avalia condições
> simples e reativas ao que o analista preenche.

### 4.3 Catálogo de componentes (`type`)

Fonte da verdade: `SduiPropsCatalog` em `models/sdui-node.model.ts`.

| `type` | Para quê | Props principais | Interação |
|---|---|---|---|
| `layout.page` | Página | `title`, `subtitle`; slots `toolbar`, `header`, `main`, `footer` (fixo) | — |
| `layout.section` | Card com título | `title`, `icon`, `description`, `collapsible`, `expanded` | — |
| `layout.grid` | Grade responsiva | `columns` (1–4, 6, 12), `gap`, `align`; filhos usam `span` | — |
| `layout.actionBar` | Grupo de botões | `align` (`start`/`end`/`between`) | — |
| `display.field` | Rótulo + valor | `label`, `value`, `format`, `span`, `emphasis` | — |
| `display.badge` | Pílula | `label`, `value`, `tone`, `toneMap` | — |
| `display.alert` | Aviso | `tone`, `title`, `message` | — |
| `display.table` | Tabela estática | `columns`, `rows`, `emptyMessage` | — |
| `data.table` | Tabela paginada server-side | `columns` (text/badge/actions), `rows`, `total`, `loading`, `rowKey` | `bind` (página/ordenação) + ações por linha |
| `input.text` | Texto | `label`, `placeholder`, `icon` | `bind`, `validators`, `on.submit` |
| `input.date` | Data (ISO `aaaa-mm-dd`) | `label`, `placeholder` | `bind`, `validators` |
| `input.select` | Seleção | `label`, `options`, `hint` | `bind`, `validators` |
| `input.textarea` | Texto longo | `label`, `rows`, `placeholder`, `hint` | `bind`, `validators` |
| `action.button` | Botão | `label`, `icon`, `variant` (`primary`/`secondary`/`danger`/`ghost`) | `on.click` |
| `action.counter` | Contador clicável | `label`, `count`, `tone`, `active` | `on.click` |

Formatos (`format`): `text`, `number`, `currency`, `percent`, `date`, `datetime`, `cpf`, `cnpj`,
`document` (CPF ou CNPJ automático), `boolean`, `months`.
Tons (`tone`): `neutral`, `info`, `success`, `warning`, `danger`.

### 4.4 Ações

Declaradas uma vez em `actions` e referenciadas pelos nós (`"on": { "click": "APROVAR" }`).

| `kind` | Faz | Campos |
|---|---|---|
| `http` | Chama o BFF | `method`, `endpoint` (com `{...}`), `payload` (com bindings) |
| `navigate` | Navega | `route` (com `{...}`) |
| `notify` | Mostra toast | `message`, `tone` |
| `setState` | Grava em `state` | `path`, `value` (aceita bindings) |

Campos comuns a todas:

| Campo | Efeito |
|---|---|
| `enabled: false` | Bloqueio decidido pelo BFF (perfil, alçada, status) |
| `enabledWhen` | Bloqueio reativo no cliente (ex.: só devolve com motivo) |
| `disabledReason` | Texto do tooltip / leitor de tela quando bloqueada |
| `validate: ["state.parecer"]` | Campos que precisam estar válidos antes de executar |
| `confirm: { title, message, confirmLabel, tone }` | Diálogo de confirmação |
| `onSuccess: ["OUTRA_ACAO"]` | Encadeia ações após sucesso (máx. 10 níveis) |

**Resposta do BFF a uma ação `http`:** `{ "effects": [ ...ações ] }`. O servidor decide o que
acontece depois (ex.: notificar + navegar para a fila) sem deploy do front.

### 4.5 Data sources

```jsonc
"sources": {
  "fila": {
    "endpoint": "/v1/propostas",
    "params": {
      "situacao": { "$bind": "state.consulta.filtros.situacao" },
      "page":     { "$bind": "state.consulta.tabela.pageIndex" }
    }
  }
}
```

O motor transforma cada source num `httpResource`. Quando qualquer `$bind` dos `params` muda, a
requisição é refeita e a anterior cancelada. Parâmetros `null`/`''` são omitidos da query string.
O resultado fica em `sources.fila.value`, `sources.fila.loading` e `sources.fila.error`.

**Padrão de filtros usado na fila (rascunho × consulta):** os campos editam `state.filtros`; a
ação `FILTRAR` copia para `state.consulta.filtros` (que alimenta o source) e o `onSuccess` volta
para a página 1. Assim a busca só dispara ao clicar em Filtrar/Enter, não a cada tecla.

### 4.6 Exemplo mínimo completo

```json
{
  "meta": { "schemaVersion": "1.0", "screenId": "exemplo", "product": "VEICULOS", "revision": "x", "generatedAt": "" },
  "data": { "proposta": { "id": "123", "valor": 50000 } },
  "state": { "parecer": null },
  "actions": {
    "APROVAR": {
      "kind": "http", "method": "POST",
      "endpoint": "/v1/propostas/{data.proposta.id}/acoes/aprovar",
      "payload": { "parecer": { "$bind": "state.parecer" } },
      "validate": ["state.parecer"]
    }
  },
  "layout": {
    "id": "page", "type": "layout.page", "props": { "title": { "$tpl": "Proposta {data.proposta.id}" } },
    "slots": {
      "main": [
        { "id": "valor", "type": "display.field",
          "props": { "label": "Valor", "value": { "$bind": "data.proposta.valor" }, "format": "currency" } },
        { "id": "parecer", "type": "input.textarea", "bind": "state.parecer",
          "validators": { "required": true, "minLength": 30 }, "props": { "label": "Parecer" } }
      ],
      "footer": [
        { "id": "btn", "type": "action.button", "props": { "label": "Aprovar", "variant": "primary" },
          "on": { "click": "APROVAR" } }
      ]
    }
  }
}
```

---

## 5. Como o motor funciona

### 5.1 Renderização de uma tela

```
Página (feature)
  └─ SduiRemoteScreenComponent          httpResource GET {bff}{endpoint}
       │                                 parse: parseSduiScreen() → valida estrutura e versão
       └─ <sdui-screen [screen]>        cria o ESCOPO da tela (providers próprios):
            │                            SduiStore, SduiResolver, SduiFormState,
            │                            SduiSources, SduiActionDispatcher, SduiNodeBinder
            │
            ├─ 1. registry.preload(layout)   baixa em paralelo os wrappers usados (lazy)
            ├─ 2. store.init / dispatcher.init / sources.init
            └─ 3. [sduiOutlet]="[layout]"    renderiza a árvore
                    │
                    └─ para cada nó visível (visibleWhen):
                         binder.bind(node)       → props = computed(resolve(bindings) + runtime)
                         Injector com SDUI_NODE  → permite recursão
                         vcr.createComponent(wrapper, { bindings: [inputBinding('props', props)] })
                         assina `sduiEvent` do wrapper → binder.handle(evento)
                              │
                              └─ wrapper container usa <ng-container sduiSlot="main" />
                                 → mesmo processo para os filhos (recursivo)
```

Pontos importantes:

- **Reatividade por signals:** cada nó tem um `computed` de props. Digitar no parecer só
  recalcula os nós que leem `state`; nós que leem só `data` não re-renderizam.
- **Reconciliação:** quando um `visibleWhen` muda, só o nó afetado é criado/destruído, na
  posição correta. Os demais mantêm foco e estado.
- **Resiliência:** tipo desconhecido (BFF mais novo que o front) → `SduiFallbackComponent`
  (aviso em dev, nada em produção). Wrapper que lança erro na criação → também vira fallback,
  sem derrubar os irmãos.
- **Escopo isolado:** cada `<sdui-screen>` tem seu próprio store. Duas telas na mesma página
  não interferem.

### 5.2 Ciclo de uma ação

```
clique → wrapper emite { type: 'click' } → binder → dispatcher.dispatch('APROVAR', scope?)
  1. ação existe? já há outra em execução?         (uma por vez — evita duplo clique)
  2. enabled !== false  e  enabledWhen verdadeiro  (senão: toast com disabledReason)
  3. validate: marca campos como tocados; se inválido → erro no campo + toast
  4. confirm: abre diálogo (porta SduiDialogPort)
  5. pending = 'APROVAR'  → botões ficam disabled/loading
  6. handler do kind (http/navigate/notify/setState)
  7. executa `effects` devolvidos pelo BFF
  8. executa `onSuccess`
  9. erro HTTP → toast com a mensagem do BFF (`error.message`) ou mensagem padrão
```

`scope` carrega o contexto do disparo: numa ação de linha de tabela, `{ item: linha }` — por
isso o endpoint pode usar `{item.id}`.

### 5.3 Validação

Os validadores vêm do nó (`validators: { required, minLength, maxLength, messages }`). O erro só
aparece depois que o campo é tocado ou que uma ação o valida. Campos ocultos são desregistrados e
não bloqueiam ações.

---

## 6. Component Registry (o "De-Para")

Arquivo: `src/app/design-system/ds-component-map.ts`

```ts
export const DS_COMPONENT_MAP: SduiComponentMap = {
  'layout.page':   () => import('./components/ds-page.component').then((m) => m.DsPageComponent),
  'input.select':  () => import('./components/ds-inputs.components').then((m) => m.DsSelectComponent),
  'data.table':    () => import('./components/ds-data-table.component').then((m) => m.DsDataTableComponent),
  // ...
};
```

- **Lazy:** cada wrapper é um chunk separado, baixado só se a tela usar.
- **Tipado e exaustivo:** `SduiComponentMap` é um mapped type sobre todo o catálogo. Faltar um
  `type`, ou ligar um `type` a um wrapper cujo `props` não bate com o contrato, é **erro de
  compilação**.

O mapa entra na aplicação por um único objeto (`src/app/design-system/design-system.ts`):

```ts
export const DESIGN_SYSTEM: SduiDesignSystem = {
  components: DS_COMPONENT_MAP,   // o De-Para
  dialog: MaterialDialogAdapter,  // implementa SduiDialogPort
  notifier: MaterialNotifierAdapter, // implementa SduiNotifierPort
};
// app.config.ts
provideSdui(DESIGN_SYSTEM)
```

### O contrato de um wrapper

```ts
@Component({ selector: 'ds-button', template: `...HTML do DS...` })
export class DsButtonComponent
  implements SduiComponent<SduiViewOf<'action.button'>>, SduiEventEmitter {
  readonly props = input.required<SduiViewOf<'action.button'>>(); // entrada: tudo pronto
  readonly sduiEvent = output<SduiUiEvent>();                     // saída: eventos genéricos
}
```

`SduiViewOf<'tipo'>` = props do JSON **já resolvidas** + estado de runtime injetado pelo motor:

| Tipo de nó | Runtime adicional em `props` |
|---|---|
| Inputs (`bind`) e `data.table` | `value`, `error` (mensagem pronta), `required`, `maxLength` |
| Clicáveis (`on.click`) | `disabled`, `loading`, `disabledReason` |

Eventos que um wrapper pode emitir:

| Evento | Quando | Motor faz |
|---|---|---|
| `{ type: 'click' }` | botão/contador clicado | dispara `on.click` |
| `{ type: 'change', value }` | valor alterado | grava em `bind` |
| `{ type: 'blur' }` | campo perdeu foco | marca como tocado (mostra erro) |
| `{ type: 'submit' }` | Enter no campo | dispara `on.submit` |
| `{ type: 'rowAction', action, item }` | botão de linha | dispara `action` com `item` |

Containers renderizam filhos com a diretiva `sduiSlot` — é o **único** ponto de contato de um
wrapper com o motor:

```html
<ng-container sduiSlot />            <!-- children -->
<ng-container sduiSlot="footer" />   <!-- slots.footer -->
```

---

## 7. Migração para o Design System da empresa

### 7.1 O que muda e o que NÃO muda

| Muda | Não muda |
|---|---|
| `src/app/design-system/**` (wrappers, adapters, marca) | `src/app/core/**` (motor, contrato, auth) |
| `src/styles.scss` (tema e tokens) | JSONs do BFF / mocks |
| 4 pontos pontuais fora do DS (lista em 7.4) | `src/app/features/**` (exceto o login simulado) |
| `package.json` (troca de dependências) | Testes do motor e de contrato |

### 7.2 Duas estratégias

**A) Reescrever por dentro (recomendada para começar).** Para cada arquivo em
`design-system/components/`, troque o template e os estilos pelo componente do DS corporativo,
mantendo `selector`, `props` e `sduiEvent`. O De-Para não muda.

**B) Pacote paralelo.** Crie `src/app/design-system-corp/` com novos wrappers + adapters + um
`CORP_DESIGN_SYSTEM: SduiDesignSystem`, e troque uma linha em `app.config.ts`:

```ts
provideSdui(CORP_DESIGN_SYSTEM)   // antes: provideSdui(DESIGN_SYSTEM)
```

Permite migrar componente a componente (o mapa novo pode reaproveitar entradas do antigo) e
comparar lado a lado. O compilador garante que nenhum `type` ficou sem wrapper.

### 7.3 Checklist por arquivo

| Arquivo | Wrappers / papel | O que trocar | Cuidados |
|---|---|---|---|
| `components/ds-page.component.ts` | `layout.page` | Estrutura de página, header, footer fixo | Manter os 4 `sduiSlot` (`toolbar`, `header`, `main`, `footer`) |
| `components/ds-section.component.ts` | `layout.section` | Card do DS (hoje `mat-card`) | Manter `aria-expanded`/`aria-controls` do recolher |
| `components/ds-layout.components.ts` | `layout.grid`, `layout.actionBar` | Grid do DS, se houver | O grid usa `--ds-span` (definido pelo motor a partir de `node.span`) |
| `components/ds-display.components.ts` | `display.field`, `display.badge`, `display.alert` | Tag/badge/alert do DS | Usar `sduiFormat` e `resolveTone` (formatação e tom são do core) |
| `components/ds-table.component.ts` | `display.table` | Tabela do DS | — |
| `components/ds-data-table.component.ts` | `data.table` | Tabela + paginação + ordenação do DS | Emitir `change` com `{ pageIndex, pageSize, sort }` e `rowAction`; nunca buscar dados |
| `components/ds-inputs.components.ts` | `input.text`, `input.date`, `input.select`, `input.textarea` | Inputs do DS | Emitir `change`/`blur`/`submit`; exibir `props().error`; data trafega como ISO `aaaa-mm-dd` |
| `components/ds-button.component.ts` | `action.button` | Botão do DS | Respeitar `disabled`, `loading`, `disabledReason` (tooltip + `aria-describedby`) |
| `components/ds-counter.component.ts` | `action.counter` | Chip/contador do DS | `aria-pressed` = `props().active` |
| `components/ds-feedback.component.ts` | loading/erro de página (fora do SDUI) | Spinner/empty state do DS | — |
| `adapters/material-ui.adapters.ts` | `SduiDialogPort`, `SduiNotifierPort` | Modal e toast do DS | `confirm()` resolve `true`/`false`; `notify(msg, tone)` |
| `adapters/ds-confirm-dialog.component.ts` | conteúdo do modal | Modal do DS | — |
| `shell/brand.ts`, `shell/ds-logo.component.ts` | textos e logo | Logo oficial (asset) | — |

### 7.4 Pontos fora de `design-system/` que usam Material

| Arquivo | Uso atual | Ação na migração |
|---|---|---|
| `src/styles.scss` | `mat.theme`, `mat.button-overrides`, `mat.form-field-overrides`, `--mat-sys-*` | Trocar pelo CSS/tema do DS. **Manter os tokens `--ds-*`** (ver 7.5) apontando para os tokens oficiais |
| `src/app/app.config.ts` | `MAT_ICON_DEFAULT_OPTIONS` (fonte de ícones) | Remover ou trocar pelo provider de ícones do DS |
| `src/app/app.ts` (shell) | `MatIconModule` e `--mat-sys-*` no topo/menu | Trocar pelo header/menu do DS (ou mover o shell para `design-system/shell`) |
| `src/app/features/dev-login/dev-login.page.ts` | `--mat-sys-*` em estilos | Só existe com mock; ajuste cosmético |

Ícones: o JSON envia nomes de ícone (`"icon": "check_circle"`, hoje Material Symbols). Se o DS
usar outro conjunto, faça o **mapeamento no wrapper** (tabela nome → ícone do DS) — não mude o
contrato.

### 7.5 Tokens de design

Os wrappers consomem variáveis `--ds-*`, definidas em `src/styles.scss`. Na migração, aponte-as
para os tokens oficiais:

| Token | Uso |
|---|---|
| `--ds-brand-primary`, `--ds-brand-primary-hover` | Laranja da marca (botões primários, destaques) |
| `--ds-brand-navy`, `--ds-brand-navy-strong` | Azul-marinho (topo, menu, links) |
| `--ds-page-bg`, `--ds-surface`, `--ds-surface-muted` | Fundos |
| `--ds-border`, `--ds-text`, `--ds-shadow-sm` | Bordas, texto, sombra |
| `[data-tone=…]` → `--ds-tone-bg`, `--ds-tone-fg`, `--ds-tone-accent` | Tons semânticos (badges, alertas, contadores) |

### 7.6 Como validar a migração

1. `npm run build` — o compilador acusa wrapper faltando ou `props` incompatível.
2. `npm test` — o teste de contrato garante que todo `type` usado nos mocks tem wrapper.
3. Navegar pelos 5 perfis (seção 2) e pelas 3 telas de análise.
4. Remover `@angular/material` do `package.json` e buscar resíduos: `grep -r "@angular/material\|--mat-" src`.

---

## 8. Autenticação e visão por mesa

### 8.1 Princípio

O front trata o token como **opaco**: guarda e envia. **Quem decide a visão é o BFF.** O front
nunca lê grupos, nunca envia "qual mesa" e nunca filtra por segurança.

```
 SSO corporativo (OIDC)                    Front (Angular)                          BFF
 ──────────────────────                    ───────────────                          ───
 login → token com claim `groups`  ──►  AuthService guarda o token
                                          authInterceptor: Authorization: Bearer ──► valida assinatura/exp/aud/iss (401)
                                                                                     groups → mesa(s) via Parametrizador (403 se nenhuma)
                                          GET /v1/me                        ◄──────  { nome, perfil, mesas }
                                          GET /v1/telas/fila                ◄──────  layout DA MESA do usuário
                                          GET /v1/propostas?...             ◄──────  somente propostas das mesas dele
```

### 8.2 Peças no front

| Arquivo | Responsabilidade |
|---|---|
| `core/auth/auth.service.ts` | Guarda o token (hoje `sessionStorage`). Em produção, embrulha a biblioteca OIDC (login, refresh, logout). |
| `core/auth/auth.interceptor.ts` | Anexa `Bearer` **só** em chamadas ao BFF. 401 → encerra a sessão e vai para o login. 403 segue para a tela exibir. |
| `core/auth/auth.guard.ts` | Rotas protegidas exigem sessão. Sem sessão → `/entrar` (em produção, redirect ao SSO). |
| `core/session/current-user.ts` | Nome, perfil e mesas **vindos do BFF** (`GET /v1/me`), só para exibição. Recarrega a cada troca de token. |
| `shared/sdui-remote-screen.component.ts` | Mostra a mensagem do BFF em 403 (ex.: "proposta não pertence à sua mesa"). |

### 8.3 Regras que o BFF real deve implementar

1. Validar o token em **toda** requisição (assinatura via JWKS, `exp`, `aud`, `iss`).
2. Resolver `groups → mesas` pelo Parametrizador. Nenhuma mesa → **403** com `message`.
3. `GET /v1/telas/fila`: uma mesa → layout da mesa; várias (supervisor) → visão consolidada,
   com o filtro de produto restrito às mesas do usuário.
4. Aplicar o escopo da mesa em listagem, contadores, atribuição, tela de análise e ações —
   **ignorando** qualquer parâmetro do front que tente ampliar o escopo.
5. Filtros específicos de mesa são uma **whitelist** (hoje `modalidade`, `segmento`,
   `tipoVeiculo`, `loja`, `tipoBem`, `contemplacao`); parâmetros desconhecidos são ignorados.
6. "Em minha atuação" = responsável é o usuário do token.
7. Respostas variam por usuário: `Cache-Control: private` e `Vary: Authorization`.

### 8.4 Mapa grupo → mesa (hoje simulado)

| Grupo (claim `groups`) | Mesa | Produtos | Layout da fila |
|---|---|---|---|
| `GRP_MESA_CREDITO_VAREJO` | Mesa Crédito Varejo | `CREDITO_VAREJO` | `telas/fila/CREDITO_VAREJO.json` |
| `GRP_MESA_VEICULOS` | Mesa Veículos | `VEICULOS` | `telas/fila/VEICULOS.json` |
| `GRP_MESA_CONSORCIO` | Mesa Consórcio | `CONSORCIO` | `telas/fila/CONSORCIO.json` |
| 2+ grupos de mesa | Visão consolidada | união | `telas/fila/GERAL.json` |

Os nomes de grupo são exemplos — alinhar com o time de identidade.

### 8.5 Diferenças de visão por mesa (fila)

| Mesa | Filtros | Colunas específicas |
|---|---|---|
| Crédito Varejo | busca, status, modalidade, segmento PF/PJ | Segmento, Modalidade |
| Veículos | busca (ID/CPF/CNPJ/**placa**), status, tipo de veículo, loja parceira | Veículo, Placa, Loja, Valor financiado |
| Consórcio | busca (ID/CPF/CNPJ/**grupo/cota**), status, tipo de bem, contemplação | Grupo/Cota, Bem, Valor da carta, Contemplação |
| Consolidada | busca, status, produto (restrito), data de criação | Produto |

---

## 9. Contrato de API do BFF

Base: `environment.bffBaseUrl` (hoje `/bff`). Todas as rotas exigem `Authorization: Bearer`.
Erros seguem `{ "message": "texto para o usuário" }` — o front exibe esse texto.

| Método | Rota | Resposta | Erros |
|---|---|---|---|
| GET | `/v1/me` | `{ nome, perfil, mesas: [{ codigo, nome }] }` | 401 |
| GET | `/v1/telas/fila` | `SduiScreen` da mesa do usuário | 401, 403 |
| GET | `/v1/propostas` | `{ items, total, page, size }` | 401, 403 |
| GET | `/v1/propostas/resumo` | `{ disponiveis, emAtuacao, urgentes }` | 401, 403 |
| POST | `/v1/propostas/:id/atribuicao` | `{ effects }` (ex.: notificar + navegar para a análise) | 401, 403, 404, 409 (já com outro analista) |
| GET | `/v1/propostas/:id/telas/analise` | `SduiScreen` da análise (layout pelo produto da proposta) | 401, 403, 404 |
| POST | `/v1/propostas/:id/acoes/:acao` | `{ effects }` | 401, 403, 409, 422 |

**Query de `/v1/propostas`:** `busca`, `situacao` (`DISPONIVEL` \| `EM_ATUACAO` \| `URGENTE`),
`produto`, `dataCriacao` (`aaaa-mm-dd`), filtros da mesa (seção 8.3), `page` (base 0), `size`,
`sortBy` (`id`, `cliente`, `valor`, `dataEnvio`, `veiculo`, `grupoCota`), `sortDir` (`asc`\|`desc`).

**Ações da análise** (`:acao`): `aprovar`, `recusar`, `devolver`, `encaminhar-alcada`,
`solicitar-vistoria` (Veículos). O corpo é o `payload` declarado no JSON da tela.

> Integração com Step Functions: ao receber uma decisão, o BFF envia o `TaskToken` da proposta
> (`SendTaskSuccess`/`SendTaskFailure`). O front não participa disso.

---

## 10. Mocks: como o BFF é simulado

Com `useMockBff: true`, o interceptor `core/mocks/mock-bff.interceptor.ts` responde às rotas da
seção 9 **dentro do navegador**, com latência artificial. O código de produção não muda — em
produção o interceptor simplesmente não é registrado.

| Arquivo | Papel |
|---|---|
| `core/mocks/mock-bff.interceptor.ts` | Roteia as chamadas; valida token (401), resolve mesa (403), aplica escopo |
| `core/mocks/mock-identity.ts` | "SSO fake": perfis de teste, emissão/validação de JWT sem assinatura |
| `core/mocks/mock-mesas.ts` | Parametrização grupo → mesa → layout |
| `core/mocks/mock-queue.ts` | Filtro, busca, ordenação, paginação e contadores (funções puras) |
| `features/dev-login/dev-login.page.ts` | Tela `/entrar` (só existe com mock) |
| `public/mocks/telas/fila/*.json` | Layout da fila por mesa |
| `public/mocks/telas/analise/*.json` | Telas de análise por produto (+ contrato v2 para testar o guard) |
| `public/mocks/fila/propostas.json` | 120 propostas (40 por produto) |

Estado em memória: "Pegar e Atuar" atribui a proposta ao usuário até recarregar a aba.

**Ligar o BFF real em desenvolvimento:** em `environment.development.ts`, `useMockBff: false`, e
configure um proxy do `ng serve` de `/bff` para o BFF local (`proxy.conf.json` com
`"/bff": { "target": "http://localhost:8081", "pathRewrite": { "^/bff": "" } }` e
`"proxyConfig"` em `angular.json`). Sem mock, a rota `/entrar` deixa de existir: é preciso
integrar o `AuthService` com o SSO.

---

## 11. Receitas: como estender

### Novo tipo de componente (ex.: `display.timeline`)

1. `core/sdui/models/sdui-node.model.ts` → adicione a entrada em `SduiPropsCatalog` com as props.
   Se for interativo, adicione também em `SduiInteractionCatalog` e `SduiRuntimeCatalog`.
2. `npm run build` → o compilador aponta que `DS_COMPONENT_MAP` está incompleto.
3. Crie o wrapper em `design-system/components/` implementando
   `SduiComponent<SduiViewOf<'display.timeline'>>`.
4. Registre-o em `ds-component-map.ts`.
5. Use o novo `type` nos JSONs; o teste de contrato valida o registro.

### Novo tipo de ação (ex.: `download`)

1. Adicione a interface ao union `SduiAction` em `models/sdui-action.model.ts`.
2. Crie um `SduiActionHandler<'download'>` em `actions/sdui-action-handlers.ts`.
3. Registre-o no multi-provider `SDUI_ACTION_HANDLERS` em `provide-sdui.ts`.

### Nova mesa ou produto

**Front: nada a fazer.** No BFF: criar o grupo, mapear grupo → mesa → produtos no Parametrizador,
publicar o layout da fila e o da análise. No mock: `mock-mesas.ts` + um novo
`public/mocks/telas/fila/<MESA>.json` (os existentes são gerados de uma base comum — siga o
mesmo formato).

### Novo filtro ou coluna numa mesa

**Front: nada a fazer** se usar componentes existentes. No JSON da fila: adicione o campo em
`state.filtros` e `state.consulta.filtros`, o nó `input.*` no grid, o parâmetro em
`sources.fila.params` e o valor em `LIMPAR_FILTROS`. No BFF: aceite o novo parâmetro
(whitelist).

### Nova tela SDUI (ex.: Tela 3 — Alçadas)

1. Crie `features/<tela>/<tela>.page.ts` com `<app-sdui-remote-screen endpoint="/v1/...">`.
2. Adicione a rota em `app.routes.ts` (dentro do bloco protegido por `authGuard`).
3. Se precisar de componentes novos (ex.: visualização da matriz de alçada), siga a receita acima.

---

## 12. Testes

```bash
npm test
```

| Arquivo | Cobre |
|---|---|
| `core/sdui/engine/sdui-engine.spec.ts` | Caminhos, condições, renderização a partir do JSON, `$tpl`/`$bind`/`$when`, fallback, validação bloqueando ação, two-way, `visibleWhen` na posição certa, payload resolvido, data source reativo, ação por linha com `item`, cadeia `setState` → `onSuccess` |
| `core/mocks/mock-contract.spec.ts` | **Teste de contrato:** todo JSON de tela passa no guard, usa só tipos registrados, referencia ações existentes (inclusive por linha e `onSuccess`), faz bind só em caminhos existentes e sources declarados; contrato v2 é recusado |
| `core/mocks/mock-queue.spec.ts` | Escopo por mesa (inclusive tentativa de ampliar escopo), "em minha atuação", whitelist de filtros, busca (acento, CPF/CNPJ, placa, grupo/cota), fuso, ordenação, paginação, contadores |
| `core/mocks/mock-identity.spec.ts` | Token (acentos, expirado, malformado) e resolução grupo → mesa → layout |
| `app.spec.ts` | Shell renderiza |

> Quando o BFF real existir, grave respostas reais e rode o **teste de contrato** contra elas —
> ele é a especificação executável do acordo entre front e BFF.

---

## 13. Decisões, limitações e próximos passos

### Decisões de arquitetura

| Decisão | Por quê |
|---|---|
| Renderização com `ViewContainerRef.createComponent` + `inputBinding` (não `@switch` gigante nem Formly) | Extensível por registro, lazy por componente, props reativas via signals |
| Contrato tipado por um único catálogo | Um lugar para evoluir; o compilador força wrapper e props corretos |
| Wrappers sem lógica SDUI | Trocar o DS = trocar HTML/SCSS, sem tocar no motor |
| Condições como AST, sem `eval` | Segurança e previsibilidade |
| Regras de negócio no BFF | Front agnóstico a produto; uma fonte de verdade |
| Token opaco no front | Autorização é do servidor; o front não pode ser a barreira |
| Ações com `effects` do servidor | O BFF controla o pós-ação sem deploy do front |
| Versionamento por major (`schemaVersion`) | Evita que um front antigo renderize contrato incompatível |

### Limitações conhecidas

- **Tela 3 (alçadas)** ainda é placeholder.
- O guard de schema (`parseSduiScreen`) valida a estrutura mínima, não cada prop. Para
  endurecer, gerar um JSON Schema a partir dos tipos e validar no BFF (CI) e/ou no front (dev).
- `input.date` aceita digitação `dd/mm/aaaa` via um adapter próprio; se o DS tiver datepicker
  próprio, essa lógica sai junto com o Material.
- A atribuição "Pegar e Atuar" no mock vale só até recarregar a aba.
- A 1440px, textos longos em selects estreitos podem ser truncados (ex.: "Disponível para
  pegar"); ajustável pelos `span` no JSON.
- Não há cache de layout no front; se necessário, usar `meta.revision` como chave.

### Próximos passos sugeridos

1. Tela 3 — matriz de alçada (regras combinatórias tipo N2 = 1 Diretor Comercial **ou**
   1 Diretor ADM + 1 Superintendente **ou** 2 Gerentes), com a avaliação da regra no BFF e um
   componente visual de progresso por combinação.
2. Integração do `AuthService` com o SSO corporativo (OIDC).
3. BFF real + proxy de desenvolvimento + teste de contrato contra respostas gravadas.
4. Migração para o Design System da empresa (seção 7).
5. Telemetria: enviar `meta.traceId`/`revision` e erros de renderização (fallbacks) para
   observabilidade.

---

## 14. Mapa de arquivos

```
src/
├── environments/                         bffBaseUrl, useMockBff
├── styles.scss                           tema Material + tokens --ds-* (MIGRAÇÃO DS)
└── app/
    ├── app.config.ts                     providers: router, http + interceptors, provideSdui(DESIGN_SYSTEM)
    ├── app.routes.ts                     /entrar (mock), /fila, /propostas/:id/analise, /alcadas
    ├── app.ts                            shell: topo, menu lateral (MIGRAÇÃO DS)
    ├── core/
    │   ├── api/bff-api.config.ts         token BFF_BASE_URL
    │   ├── auth/                         AuthService, authInterceptor, authGuard
    │   ├── session/current-user.ts       GET /v1/me
    │   ├── mocks/                        BFF simulado (identidade, mesas, fila, interceptor)
    │   └── sdui/                         MOTOR SDUI
    │       ├── models/                   contrato (nós, bindings, condições, ações, tela)
    │       ├── engine/                   store, resolver, form-state, sources, binder,
    │       │                             renderer (sduiOutlet/sduiSlot), screen, schema
    │       ├── actions/                  dispatcher + handlers
    │       ├── registry/                 registry lazy + fallback
    │       ├── ports/                    SduiDialogPort, SduiNotifierPort
    │       ├── format/                   formatação pt-BR, resolveTone
    │       ├── provide-sdui.ts           composição
    │       └── index.ts                  API pública do core
    ├── design-system/                    ADAPTER DO DS (MIGRAÇÃO DS)
    │   ├── components/ds-*.ts            wrappers
    │   ├── adapters/                     dialog e toast
    │   ├── shell/                        marca e logo
    │   ├── ds-component-map.ts           De-Para
    │   └── design-system.ts              DESIGN_SYSTEM
    ├── shared/sdui-remote-screen.component.ts   busca tela no BFF + loading/erro/403
    └── features/
        ├── work-queue/                   Tela 1
        ├── proposal-analysis/            Tela 2
        ├── placeholders/                 Tela 3 (provisório)
        └── dev-login/                    login simulado (só com mock)
public/mocks/                             JSONs do BFF simulado
```
