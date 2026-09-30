# Mesa de Crédito — Documentação do Front-end

> Front-end da mesa de análise julgamental de crédito, construído com **Server-Driven UI (SDUI)
> por templates**: o BFF diz **o que** aparece (filtros, colunas, blocos, campos, ações) e o front
> é dono de **como** aparece (layout base de cada tela).
> Este documento explica **o que existe**, **como funciona**, **onde mexer** para cada tipo de
> mudança e **como migrar para o Design System da empresa**.
>
> Histórico: a primeira versão (branch `main` até o commit `f82e973`) tinha o layout inteiro no
> JSON do BFF (grid, larguras, alinhamento). Esta versão (branch `feat/sdui-templates`) move o
> layout para templates no front, porque nas mesas o **conteúdo varia** mas a **disposição é
> sempre a mesma**.

**Sumário**

1. [Visão geral](#1-visão-geral)
2. [Como rodar](#2-como-rodar)
3. [Arquitetura em camadas](#3-arquitetura-em-camadas)
4. [O contrato do BFF (v2, por template)](#4-o-contrato-do-bff-v2-por-template)
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

Em vez de codificar uma tela por produto, o front tem **templates** (o layout base de cada tipo de
tela) e um **motor genérico** de renderização. O BFF envia um JSON enxuto dizendo o que entra em
cada template: quais filtros e colunas a fila da mesa tem, quais blocos e campos a análise do
produto mostra, quais ações o analista pode executar. Mais ou menos itens, outros campos, outros
blocos: **sem deploy do front**. Só uma **disposição nova** exige um template novo.

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

**Para acompanhar o que acontece por trás**, abra o DevTools (F12 → Console): em desenvolvimento o
modo debug registra cada chamada ao BFF, as decisões do BFF simulado e cada passo do motor
(seção [10.1](#101-modo-debug-acompanhando-a-sequência-no-console)).

**Ambientes** (`src/environments/`):

| Arquivo | `bffBaseUrl` | `useMockBff` | `debug` | Uso |
|---|---|---|---|---|
| `environment.development.ts` | `/bff` | `true` | `true` | `npm start` — BFF simulado no navegador, log no console |
| `environment.ts` | `/bff` | `false` | `false` | build de produção — chama o BFF real, sem log |

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
                                │ JSON enxuto do BFF  { "template": "fila", ... }
┌───────────────────────────────▼──────────────────────────────────────────┐
│  TEMPLATES  (src/app/templates)          ← LAYOUT BASE de cada tela      │
│  template-contract.model  contrato do BFF (v2)                           │
│  compile-template         valida versão/template e escolhe o montador    │
│  fila.template            título+contadores / filtros+botões / tabela    │
│  analise.template         etiquetas+alertas / blocos / formulário / ações│
│  Monta a árvore interna (grid, larguras, posição) que o motor renderiza. │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ árvore interna  <sdui-screen [screen]>
┌───────────────────────────────▼──────────────────────────────────────────┐
│  CORE SDUI  (src/app/core/sdui)          ← NÃO muda ao trocar o DS       │
│  models/    tipos da árvore interna (nós, bindings, ações)               │
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
- O **BFF não conhece layout**: nada de grid, largura ou alinhamento no contrato. Isso é dos
  `templates`.

---

## 4. O contrato do BFF (v2, por template)

Tipos em `src/app/templates/template-contract.model.ts`. Toda resposta de tela tem:

```jsonc
{
  "meta": { "schemaVersion": "2.0", "product": "CONSORCIO", "revision": "fila-consorcio@2026.09.3",
            "generatedAt": "...", "traceId": "..." },
  "template": "fila",          // ou "analise" — escolhe o layout base no front
  /* ...conteúdo do template... */
}
```

O front **recusa** `schemaVersion` com major diferente de `TEMPLATE_CONTRACT_MAJOR` (hoje `2`),
`template` desconhecido e listas obrigatórias ausentes — com mensagem clara na tela.

> **Regra de ouro:** o BFF envia **conteúdo e regras já decididas** (valores prontos, permissões,
> alçada, quais blocos existem). O front decide **disposição e comportamento de UI**.

### 4.1 Template `fila`

Layout base (fixo no front):

```
┌ título / subtítulo ─────────────────────────────── contadores ┐
├ card "Filtros de Busca": filtros (largura automática) + Filtrar | Limpar
└ tabela paginada: colunas do BFF + coluna Ações (fixa à direita)
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `titulo`, `subtitulo` | título | Cabeçalho da página |
| `fonte.listagem` | ✅ | Endpoint da listagem paginada (recebe filtros + `page`, `size`, `sortBy`, `sortDir`) |
| `fonte.resumo` | — | Endpoint dos contadores |
| `contadores[]` | — | `{ label, tom, chave, filtro }` — `chave` no resumo; `filtro` aplicado ao clicar (fica ativo quando aplicado) |
| `filtros[]` | ✅ | `{ campo, tipo: texto\|select\|data, label, placeholder?, valorInicial?, opcoes? }` — `campo` é o nome do parâmetro da listagem; selects ganham "Todos" automaticamente (`semOpcaoTodos: true` para desligar) |
| `colunas[]` | ✅ | `{ campo, label, tipo?: texto\|badge, formato?, prefixo?, ordenavel?, alinhamento?, campoTom?, tons? }` |
| `acoesLinha[]` | — | `{ label, variante, campoHabilitado?, motivoBloqueio?, confirmacao?, executa }` — `{campo}` em endpoint/rota vira o valor da linha |
| `chaveLinha` | — | Campo identificador da linha (padrão `id`) |
| `paginacao` | — | `{ tamanho, ordenacao: { campo, direcao } }` |
| `itens`, `mensagemVazia` | — | Textos do rodapé e da tabela vazia |

**Comportamento que é do template** (o BFF não precisa descrever):
filtros em rascunho × consulta (só busca ao clicar Filtrar/Enter); Filtrar volta para a página 1;
Limpar zera os filtros; contador aplica o filtro dele mantendo os demais; largura dos filtros
(busca 3/12, demais 2/12, botões no fim da última linha ou numa linha própria).

**Permissão por linha:** `campoHabilitado: "podePegar"` faz o botão respeitar o booleano que o BFF
calcula para cada linha da listagem. O front nunca decide se a proposta pode ser pega.

Exemplo real — `public/mocks/telas/fila/CONSORCIO.json` (76 linhas):

```json
{
  "meta": { "schemaVersion": "2.0", "product": "CONSORCIO", "revision": "fila-consorcio@2026.09.3", "generatedAt": "..." },
  "template": "fila",
  "titulo": "Fila de Propostas para Atuação",
  "subtitulo": "Mesa Consórcio",
  "fonte": { "listagem": "/v1/propostas", "resumo": "/v1/propostas/resumo" },
  "contadores": [
    { "label": "Disponíveis para pegar", "tom": "info", "chave": "disponiveis", "filtro": { "situacao": "DISPONIVEL" } },
    { "label": "Em minha atuação", "tom": "warning", "chave": "emAtuacao", "filtro": { "situacao": "EM_ATUACAO" } },
    { "label": "Urgentes", "tom": "danger", "chave": "urgentes", "filtro": { "situacao": "URGENTE" } }
  ],
  "filtros": [
    { "campo": "busca", "tipo": "texto", "label": "Buscar por ID, CPF/CNPJ ou Grupo/Cota" },
    { "campo": "situacao", "tipo": "select", "label": "Status", "valorInicial": "DISPONIVEL", "opcoes": [ ... ] },
    { "campo": "tipoBem", "tipo": "select", "label": "Tipo de bem", "opcoes": [ ... ] },
    { "campo": "contemplacao", "tipo": "select", "label": "Contemplação", "opcoes": [ ... ] }
  ],
  "colunas": [
    { "campo": "id", "label": "ID", "prefixo": "#", "ordenavel": true },
    { "campo": "grupoCota", "label": "Grupo/Cota", "ordenavel": true },
    { "campo": "valor", "label": "Valor da carta", "formato": "currency", "ordenavel": true },
    { "campo": "statusDescricao", "label": "Status", "tipo": "badge", "campoTom": "status",
      "tons": { "DISPONIVEL": "info", "PENDENTE": "warning", "URGENTE": "danger", "EM_ATUACAO": "neutral" } }
  ],
  "acoesLinha": [
    { "label": "Pegar e Atuar", "variante": "primary", "campoHabilitado": "podePegar",
      "motivoBloqueio": "Esta proposta já está em atuação.",
      "executa": { "tipo": "requisicao", "metodo": "POST", "endpoint": "/v1/propostas/{id}/atribuicao" } },
    { "label": "Visualizar", "variante": "secondary",
      "executa": { "tipo": "navegacao", "rota": "/propostas/{id}/analise" } }
  ],
  "paginacao": { "tamanho": 10, "ordenacao": { "campo": "dataEnvio", "direcao": "desc" } },
  "itens": "propostas"
}
```

### 4.2 Template `analise`

Layout base (fixo no front):

```
┌ título / subtítulo
├ etiquetas (status, classificação...) + alertas da proposta
├ blocos, na ordem recebida — "campos" (grade de 4) ou "tabela"
├ formulário do analista
└ rodapé fixo com as ações (na ordem recebida)
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `titulo`, `subtitulo` | título | Cabeçalho |
| `etiquetas[]` | — | `{ texto, tom? }` |
| `alertas[]` | — | `{ tom, titulo?, mensagem }` — o BFF só envia os que se aplicam (ex.: alçada) |
| `blocos[]` | ✅ | `{ id, titulo, icone?, descricao?, recolhivel?, alertas?, tipo }` + `campos[]` (`tipo: "campos"`) ou `colunas[]`/`linhas[]` (`tipo: "tabela"`) |
| `blocos[].campos[]` | — | `{ label, valor, formato?, largo?, destaque? }` — **valor pronto**, sem binding |
| `formulario` | — | `{ titulo, icone?, campos[] }` |
| `formulario.campos[]` | — | `{ campo, tipo: textarea\|select\|texto\|data, label, obrigatorio?, minimo?, maximo?, mensagemObrigatorio?, placeholder?, dica?, opcoes?, valorInicial? }` |
| `acoes[]` | ✅ | ver 4.3 |

Blocos por produto (hoje): todos têm **Dados da proposta**, **Cliente** e **Operações ativas**;
Crédito Varejo acrescenta **Capacidade de pagamento**; Veículos, **Veículo e garantia** (com
alerta de LTV); Consórcio, **Grupo e cota**. Adicionar/remover/reordenar blocos ou campos é só no BFF.

### 4.3 Ações (`acoes[]` da análise e `acoesLinha[]` da fila)

```jsonc
{
  "id": "DEVOLVER",                          // só na análise
  "label": "Devolver", "icone": "undo", "variante": "ghost",   // primary | secondary | danger | ghost
  "habilitada": true,                         // permissão decidida pelo BFF (perfil, alçada, status)
  "motivoBloqueio": "Selecione o motivo da devolução.",
  "validar": ["parecer", "motivoDevolucao"],  // campos do formulário que precisam estar válidos
  "exigePreenchidos": ["motivoDevolucao"],    // só habilita com estes campos preenchidos
  "confirmacao": { "titulo": "Devolver proposta?", "mensagem": "...", "botao": "Devolver", "tom": "danger" },
  "executa": { "tipo": "requisicao", "metodo": "POST", "endpoint": "/v1/propostas/948372/acoes/devolver",
               "enviar": ["parecer", "motivoDevolucao"] }   // padrão: todos os campos do formulário
  // ou: "executa": { "tipo": "navegacao", "rota": "/fila" }
}
```

Ordem de execução ao clicar: permissão → `exigePreenchidos` → `validar` → `confirmacao` →
requisição → `effects` devolvidos pelo BFF (ex.: notificar e navegar) — ver 5.2.

Formatos (`formato`): `text`, `number`, `currency`, `percent`, `date`, `datetime`, `cpf`, `cnpj`,
`document` (CPF ou CNPJ automático), `boolean`, `months`.
Tons (`tom`): `neutral`, `info`, `success`, `warning`, `danger`.

### 4.4 Árvore interna (detalhe do motor — não é contrato)

Os templates convertem o JSON enxuto numa árvore de nós que o motor renderiza. **O BFF não envia
nem conhece esta árvore**; ela só importa para quem mexe nos templates ou no motor. Tipos em
`src/app/core/sdui/models/`.

```jsonc
{
  "meta": { ... }, "data": { ... }, "state": { ... }, "sources": { ... },
  "actions": { ... },
  "layout": { "id": "page", "type": "layout.page", "props": { ... }, "slots": { "main": [ ... ] } }
}
```

#### Caminhos e bindings

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

#### Condições

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


#### Catálogo de nós (`type`) — cada um tem um wrapper no DS

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

#### Ações internas

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

#### Data sources

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


---

## 5. Como o motor funciona

### 5.1 Renderização de uma tela

```
Página (feature)
  └─ SduiRemoteScreenComponent          httpResource GET {bff}{endpoint}
       │                                 parse: compileTemplateScreen()
       │                                   → valida versão (v2), template e listas obrigatórias
       │                                   → fila.template / analise.template montam a árvore interna
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
| `src/app/design-system/**` (wrappers, adapters, marca) | `src/app/core/**` (motor, auth) |
| `src/app/templates/**` — **só se** o grid do DS for diferente (larguras em colunas de 12) | Contrato do BFF (`template-contract.model.ts`) |
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
| GET | `/v1/telas/fila` | Tela `template: "fila"` da mesa do usuário (seção 4.1) | 401, 403 |
| GET | `/v1/propostas` | `{ items, total, page, size }` — cada item com as colunas e `podePegar` | 401, 403 |
| GET | `/v1/propostas/resumo` | `{ disponiveis, emAtuacao, urgentes }` | 401, 403 |
| POST | `/v1/propostas/:id/atribuicao` | `{ effects }` (ex.: notificar + navegar para a análise) | 401, 403, 404, 409 (já com outro analista) |
| GET | `/v1/propostas/:id/telas/analise` | Tela `template: "analise"` com valores prontos (seção 4.2) | 401, 403, 404 |
| POST | `/v1/propostas/:id/acoes/:acao` | `{ effects }` | 401, 403, 409, 422 |

**Query de `/v1/propostas`:** `busca`, `situacao` (`DISPONIVEL` \| `EM_ATUACAO` \| `URGENTE`),
`produto`, `dataCriacao` (`aaaa-mm-dd`), filtros da mesa (seção 8.3), `page` (base 0), `size`,
`sortBy` (`id`, `cliente`, `valor`, `dataEnvio`, `veiculo`, `grupoCota`), `sortDir` (`asc`\|`desc`).

**Ações da análise** (`:acao`): `aprovar`, `recusar`, `devolver`, `encaminhar-alcada`,
`solicitar-vistoria` (Veículos). O corpo são os campos do formulário listados em
`executa.enviar` (padrão: todos).

> Integração com Step Functions: ao receber uma decisão, o BFF envia o `TaskToken` da proposta
> (`SendTaskSuccess`/`SendTaskFailure`). O front não participa disso.

---

## 10. Mocks: como o BFF é simulado

Com `useMockBff: true`, o interceptor `core/mocks/mock-bff.interceptor.ts` responde às rotas da
seção 9 **dentro do navegador**, com latência artificial. O código de produção não muda — em
produção o interceptor simplesmente não é registrado.

| Arquivo | Papel |
|---|---|
| `core/mocks/mock-bff.interceptor.ts` | Roteia as chamadas; valida token (401), resolve mesa (403), aplica escopo; registra as decisões no modo debug |
| `core/mocks/mock-identity.ts` | "SSO fake": perfis de teste, emissão/validação de JWT sem assinatura |
| `core/mocks/mock-mesas.ts` | Parametrização grupo → mesa → layout |
| `core/mocks/mock-queue.ts` | Filtro, busca, ordenação, paginação e contadores (funções puras) |
| `core/mocks/mock-analysis.ts` | Compõe a tela de análise a partir da proposta (blocos por produto, alçada, ações) — como o BFF real fará |
| `features/dev-login/dev-login.page.ts` | Tela `/entrar` (só existe com mock) |
| `public/mocks/telas/fila/*.json` | Fila de cada mesa no contrato enxuto (~75 linhas cada) |
| `public/mocks/fila/propostas.json` | 120 propostas (40 por produto) |

Estado em memória: "Pegar e Atuar" atribui a proposta ao usuário até recarregar a aba.

**Ligar o BFF real em desenvolvimento:** em `environment.development.ts`, `useMockBff: false`, e
configure um proxy do `ng serve` de `/bff` para o BFF local (`proxy.conf.json` com
`"/bff": { "target": "http://localhost:8081", "pathRewrite": { "^/bff": "" } }` e
`"proxyConfig"` em `angular.json`). Sem mock, a rota `/entrar` deixa de existir: é preciso
integrar o `AuthService` com o SSO.

---

### 10.1 Modo debug: acompanhando a sequência no console

Com `environment.debug: true` (padrão em `npm start`), abra o **DevTools → Console**. Cada evento
vira uma linha com um selo colorido, em ordem. Linhas com detalhes são **grupos recolhidos**:
clique para ver o corpo da resposta, o contrato recebido, a árvore montada, os parâmetros etc.

| Selo | O que registra | Onde nasce |
|---|---|---|
| `ROTA` | Cada navegação concluída | `core/debug/debug-logger.ts` |
| `AUTH` | Login, logout, 401 que derruba a sessão | `core/auth/*` |
| `HTTP` | `→ #n` ida (método, URL com query, corpo, token mascarado) · `← #n` volta (status, corpo, tempo) · `✕ #n` erro · `⊘ #n` cancelada | `core/debug/debug-http.interceptor.ts` |
| `BFF (mock)` | O que o "servidor" decidiu: usuário e mesa do token, parametrização escolhida, escopo e total da listagem, `podePegar` por linha, 401/403/404/409 e o porquê | `core/mocks/mock-bff.interceptor.ts` |
| `TEMPLATE` | JSON enxuto recebido → árvore interna montada (nós, estado inicial, ações, sources) | `shared/sdui-remote-screen.component.ts` |
| `SOURCE` | Uma consulta (tabela, contadores) sendo refeita e com quais parâmetros | `core/sdui/engine/sdui-sources.ts` |
| `AÇÃO` | `▶` início com a definição e a linha clicada · bloqueio/validação/confirmação · `executando …` · efeitos devolvidos pelo BFF · `■` concluída / `✕` falhou | `core/sdui/actions/sdui-action-dispatcher.ts` |
| `ESTADO` | Mudanças em `state`: filtros aplicados, página, ordenação, campos (texto só ao sair do campo) | `sdui-node-binder.ts`, `setState` |

**Exemplo real — Carlos (Mesa Veículos) entrando na fila** (capturado do console):

```text
 ROTA      /entrar?perfil=u-carlos
 AUTH      sessão iniciada (token recebido do SSO)
 HTTP      → #1 GET /v1/me
 BFF       GET /v1/me: token de Carlos Souza (Analista) → Mesa Veículos
 ROTA      /fila
 HTTP      → #2 GET /v1/telas/fila
 BFF       GET /v1/telas/fila: token de Carlos Souza (Analista) → Mesa Veículos
 BFF       fila: uma mesa → parametrização telas/fila/VEICULOS.json
 HTTP      ← #1 200 GET /v1/me (151 ms)
 HTTP      ← #2 200 GET /v1/telas/fila (460 ms)            ▸ resposta = JSON enxuto da fila
 TEMPLATE  "fila" v2.0 (VEICULOS) → 14 nós na árvore interna
 SOURCE    "fila" consultando /v1/propostas               ▸ parâmetros vindos do state
 HTTP      → #3 GET /v1/propostas?situacao=DISPONIVEL&page=0&size=10&sortBy=dataEnvio&sortDir=desc
 SOURCE    "resumo" consultando /v1/propostas/resumo
 HTTP      → #4 GET /v1/propostas/resumo
 BFF       listagem no escopo [VEICULOS]: 35 proposta(s) após filtros → página 1 com 10
 BFF       resumo no escopo [VEICULOS]
 HTTP      ← #4 200 GET /v1/propostas/resumo (210 ms)
 HTTP      ← #3 200 GET /v1/propostas?... (460 ms)           ▸ resposta = { items, total, page, size }
```

**Exemplo — clicar em "Filtrar" com Tipo de veículo = Usado** (ilustrativo e abreviado; totais e tempos variam):

```text
 ESTADO    state.filtros.tipoVeiculo ← "USADO"            (o select só muda o rascunho)
 AÇÃO      ▶ FILTRAR (setState)
 AÇÃO        executando setState state.consulta.filtros
 ESTADO    state.consulta.filtros ← {"busca":null,"situacao":"DISPONIVEL","tipoVeiculo":"USADO",...}
 AÇÃO          executando setState state.consulta.tabela.pageIndex      (onSuccess)
 ESTADO    state.consulta.tabela.pageIndex ← 0
 AÇÃO      ■ FILTRAR concluída (2 ms)
 SOURCE    "fila" consultando /v1/propostas               (reagiu à mudança do state)
 HTTP      → #5 GET /v1/propostas?situacao=DISPONIVEL&tipoVeiculo=USADO&page=0&...
 BFF       listagem no escopo [VEICULOS]: 22 proposta(s) após filtros → página 1 com 10
 HTTP      ← #5 200 ...
```

**Exemplo — "Pegar e Atuar" numa linha** (ilustrativo e abreviado; ids, contagens e tempos variam):

```text
 AÇÃO      ▶ LINHA_0 (http)                               ▸ escopo.item = a linha clicada
 AÇÃO        executando http POST /v1/propostas/{item.id}/atribuicao
 HTTP      → #6 POST /v1/propostas/948419/atribuicao
 BFF       proposta 948419 atribuída a Carlos Souza; devolvendo efeitos: notificar → navegar para a análise
 HTTP      ← #6 200 POST /v1/propostas/948419/atribuicao  ▸ resposta = { effects: [...] }
 AÇÃO        BFF devolveu 2 efeito(s): notify → navigate
 AÇÃO          executando notificação "Proposta #948419 atribuída a você."
 AÇÃO          executando navegação → /propostas/948419/analise
 ROTA      /propostas/948419/analise
 AÇÃO      ■ LINHA_0 concluída (468 ms)
 HTTP      → #7 GET /v1/propostas/948419/telas/analise
 BFF       compondo análise de 948419 (VEICULOS): 4 blocos, ações DEVOLVER, RECUSAR, SOLICITAR_VISTORIA, APROVAR
 HTTP      ← #7 200 ...                                    ▸ resposta = JSON enxuto da análise
 TEMPLATE  "analise" v2.0 (VEICULOS) → 32 nós na árvore interna
```

**Dicas**

- Filtre por categoria digitando o selo na caixa de filtro do console (ex.: `HTTP`, `BFF`, `AÇÃO`).
- A aba **Network** não mostra as chamadas enquanto o BFF é simulado (elas são respondidas dentro
  do navegador); o log `HTTP` cumpre esse papel. Com o BFF real, as duas coisas aparecem.
- Desligar/ligar sem recompilar: `localStorage.setItem('mesa.debug', 'off')` (ou `'on'`) e recarregar.
- O token aparece mascarado: o front o trata como opaco. Os claims ficam visíveis no log `BFF`,
  porque é o servidor quem os lê.
- Com o BFF real, os logs `BFF (mock)` somem (as decisões passam a ficar nos logs do servidor);
  todo o resto continua igual.

## 11. Receitas: como estender

### Novo filtro, coluna ou contador numa mesa — **só JSON (BFF)**

Acrescente o item em `filtros[]`, `colunas[]` ou `contadores[]` da fila da mesa. O template ajusta
larguras, envia o novo filtro como parâmetro da listagem e inclui a coluna. No BFF: aceitar o
parâmetro novo (whitelist) e devolver o campo nas linhas.

### Novo bloco, campo ou ação na análise — **só BFF**

Acrescente em `blocos[]`, `blocos[].campos[]`, `formulario.campos[]` ou `acoes[]`. Ordem é a do
array. Regras (quem pode, quando habilita) vão como `habilitada`/`exigePreenchidos`/`validar`.

### Nova mesa ou produto — **só BFF**

Criar o grupo, mapear grupo → mesa → produtos no Parametrizador e publicar a fila da mesa. No mock:
`mock-mesas.ts` + `public/mocks/telas/fila/<MESA>.json` e os blocos do produto em `mock-analysis.ts`.

### Novo tipo de campo/filtro (ex.: faixa de valores) — front

1. Contrato: novo `tipo` em `FiltroFila` ou `CampoFormulario` (`template-contract.model.ts`).
2. Template: tratar o `tipo` em `fila.template.ts` / `analise.template.ts`.
3. Se precisar de widget novo, siga a próxima receita.

### Novo componente visual (ex.: `display.timeline`) — front

1. `core/sdui/models/sdui-node.model.ts` → entrada em `SduiPropsCatalog`
   (e em `SduiInteractionCatalog`/`SduiRuntimeCatalog` se for interativo).
2. `npm run build` → o compilador aponta que `DS_COMPONENT_MAP` está incompleto.
3. Wrapper em `design-system/components/` implementando `SduiComponent<SduiViewOf<'display.timeline'>>`
   e registro em `ds-component-map.ts`.
4. Expor no contrato (ex.: novo `tipo` de bloco) e usar no template.

### Nova disposição de tela (novo template) — front

Quando uma tela não cabe em nenhum layout base (ex.: Tela 3 — Alçadas):

1. Contrato: nova interface com `template: 'alcadas'` em `template-contract.model.ts` e inclusão
   no union `TemplateScreen`.
2. Montador `alcadas.template.ts` (JSON enxuto → árvore interna).
3. Registrar em `TEMPLATES` e `REQUIRED_LISTS` (`compile-template.ts`) — o compilador exige.
4. Página em `features/` com `<app-sdui-remote-screen endpoint="...">` e rota em `app.routes.ts`.

### Novo tipo de ação interna (ex.: `download`)

1. Adicione a interface ao union `SduiAction` em `core/sdui/models/sdui-action.model.ts`.
2. Crie um `SduiActionHandler<'download'>` em `actions/sdui-action-handlers.ts` e registre no
   multi-provider `SDUI_ACTION_HANDLERS` (`provide-sdui.ts`).
3. Exponha no contrato como um novo `executa.tipo` e traduza em `template-actions.ts`.

---

## 12. Testes

```bash
npm test
```

| Arquivo | Cobre |
|---|---|
| `core/sdui/engine/sdui-engine.spec.ts` | Caminhos, condições, renderização a partir do JSON, `$tpl`/`$bind`/`$when`, fallback, validação bloqueando ação, two-way, `visibleWhen` na posição certa, payload resolvido, data source reativo, ação por linha com `item`, cadeia `setState` → `onSuccess` |
| `templates/templates.spec.ts` | Layout base: larguras dos filtros e quebra de linha dos botões, "Todos" nos selects, valor inicial × limpar, parâmetros da listagem, contadores, ações de linha com permissão do BFF; análise: ordem dos blocos, campos largos, tradução de `validar`/`exigePreenchidos`/`habilitada`/`enviar` |
| `core/mocks/mock-contract.spec.ts` | **Teste de contrato:** as 4 filas e as análises dos 3 produtos passam no compilador e geram árvore só com tipos registrados, ações existentes e caminhos válidos; recusa major ≠ 2, template desconhecido e listas ausentes |
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
| Contrato por **template** (BFF diz o quê, front diz como) em vez de layout completo no JSON | Nas mesas o conteúdo varia e a disposição não; JSON ~6× menor e legível; o BFF não precisa saber de grid; trocar o DS não afeta o contrato |
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
- Uma **disposição nova** (ex.: dois blocos lado a lado, filtros em outra posição) exige alterar
  ou criar um template — ou seja, deploy do front. É a troca consciente desta versão.
- O `compileTemplateScreen` valida versão, template e listas obrigatórias, não cada campo. Para
  endurecer, gerar um JSON Schema de `template-contract.model.ts` e validar no BFF (CI).
- `input.date` aceita digitação `dd/mm/aaaa` via um adapter próprio; se o DS tiver datepicker
  próprio, essa lógica sai junto com o Material.
- A atribuição "Pegar e Atuar" no mock vale só até recarregar a aba.
- A 1440px, textos longos em selects estreitos podem ser truncados (ex.: "Disponível para
  pegar"); a largura é regra do template (`fila.template.ts`).
- Tabelas com muitas colunas rolam horizontalmente dentro do card; a coluna Ações fica fixa à direita.
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
    │   ├── debug/                        modo debug: logger no console + interceptor HTTP
    │   ├── mocks/                        BFF simulado (identidade, mesas, fila, análise, interceptor)
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
    ├── templates/                        LAYOUT BASE + contrato do BFF (v2)
    │   ├── template-contract.model.ts    contrato: FilaScreen, AnaliseScreen, AcaoTela...
    │   ├── compile-template.ts           valida e escolhe o template
    │   ├── fila.template.ts              layout base da fila
    │   ├── analise.template.ts           layout base da análise
    │   └── template-actions.ts           ações do contrato → ações do motor
    ├── shared/sdui-remote-screen.component.ts   busca tela no BFF + loading/erro/403
    └── features/
        ├── work-queue/                   Tela 1
        ├── proposal-analysis/            Tela 2
        ├── placeholders/                 Tela 3 (provisório)
        └── dev-login/                    login simulado (só com mock)
public/mocks/                             filas por mesa (JSON enxuto) + base de propostas
```
