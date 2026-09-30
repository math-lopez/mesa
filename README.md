# Mesa de Crédito — Front-end SDUI

Aplicação Angular (standalone, zoneless, signals) para a mesa de análise julgamental de crédito
(Crédito Varejo, Veículos e Consórcio). As telas são montadas por **Server-Driven UI por
templates**: o BFF diz **o que** aparece — filtros, colunas, blocos, campos, ações e permissões —
e o front é dono de **como** aparece (layout base de cada tela).

> 📘 Documentação completa — arquitetura, contrato do BFF, motor, API, autenticação por mesa e
> migração para o Design System da empresa: **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**

## Rodando

```bash
npm install
npm start        # http://localhost:4200 — BFF simulado no navegador (environment.development)
npm test         # Vitest: motor, templates, BFF simulado e teste de contrato
npm run build    # build de produção (sem mocks)
```

O login é simulado em `/entrar`. Cada perfil tem grupos diferentes no token e, portanto, uma fila
diferente (atalho: `/entrar?perfil=<id>`):

| Perfil | `perfil` | Visão |
|---|---|---|
| Maria Silva — Analista | `u-maria` | Mesa Crédito Varejo |
| Carlos Souza — Analista | `u-carlos` | Mesa Veículos |
| Fernanda Rocha — Analista | `u-fernanda` | Mesa Consórcio |
| Ricardo Alves — Supervisor | `u-ricardo` | Visão consolidada (Crédito + Veículos) |
| João Lima — sem mesa | `u-joao` | Acesso negado pelo BFF |

## Em uma olhada

```
BFF  ──►  { "template": "fila", "filtros": [...], "colunas": [...] }      contrato enxuto (v2)
            │
            ▼
src/app/templates/       layout base de cada tela (fila, análise) → árvore interna
src/app/core/sdui/       motor: estado (signals), bindings, ações, data sources, renderer
src/app/design-system/   wrappers ds-* (hoje Angular Material) — único lugar que troca no DS da empresa
```

- Mais filtros, colunas, blocos ou ações: **só no BFF**, sem deploy do front.
- Disposição nova de tela: novo template no front.
- Mesa do usuário: decidida pelo BFF a partir dos grupos do token; o front trata o token como opaco.

## Histórico

- `main` — primeira versão, com o layout completo (grid, larguras, alinhamento) no JSON do BFF.
- `feat/sdui-templates` — versão por templates (esta).
