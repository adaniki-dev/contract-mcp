# contract-mcp

MCP server que funciona como linter de contratos para AI. Agentes AI usam o MCP ao invés de `ls`/`path` para entender projetos através de contratos YAML estruturados.

## Stack

- **Runtime:** Bun
- **Linguagem:** TypeScript (strict)
- **Protocolo:** MCP via `@modelcontextprotocol/sdk` (stdio transport)
- **Parsing:** `oxc-parser` (JS/TS AST), `es-module-lexer` (análise de imports)
- **Contratos:** YAML (input), XML (output para AI)

## Arquitetura

Feature Sliced Design adaptado para tooling:

```
shared ← entities ← features ← app
```

- `shared/` — sem lógica de negócio: helpers, tipos, config
- `entities/` — modelos de domínio: contract, dependency-graph
- `features/` — casos de uso: compiler, validator, indexer, dashboard
- `app/` — composição: MCP server, registro de tools

**Regra:** imports só descem na hierarquia. Features nunca importam entre si — comunicam via entities.

## Workflow de Desenvolvimento

```
contrato YAML → testes (TDD) → código
```

1. Escrever/atualizar o contrato YAML da feature
2. Derivar testes do contrato (rules, exports, tipos)
3. Implementar até os testes passarem
4. Nenhum código sem contrato. Nenhuma mudança de contrato sem atualizar testes.

## Comandos

```bash
bun install          # instalar deps
bun test             # rodar todos os testes
bun test --filter X  # rodar testes de uma feature
bun run dev          # MCP server em dev (stdio)
bun run build        # typecheck + bundle
tsc --noEmit         # typecheck apenas
```

## Convenções

- **Arquivos:** `kebab-case.ts`
- **Tipos:** `PascalCase`
- **Funções/variáveis:** `camelCase`
- **Exports:** sempre via barrel `index.ts` por slice
- **Erros:** pattern `Result<T, E>` — nunca `throw` para erros esperados
- **Testes:** colocados junto à implementação (`*.test.ts`)
- **Contratos:** `contracts/*.contract.yaml`
- **Output AI:** XML válido — nunca JSON
- **Sem `any`** — TypeScript strict sem exceções

## Contratos

Schema em `contracts/_schema/feature.schema.yaml`. Cada feature tem um `.contract.yaml` que define:

- Metadata (version, status, owner)
- Dependências internas e externas com razão
- Exports (funções e tipos públicos)
- Endpoints MCP (quando aplicável)
- Tipos de domínio
- Regras de negócio com severidade
- Estrutura de arquivos esperada

Índice em `contracts/_schema/index.schema.yaml` — mapa de todos os contratos.

## MCP Tools

| Tool | Descrição |
|------|-----------|
| `compile` | Compila todos os contratos, retorna diagnóstico XML |
| `get_feature` | Retorna contrato completo de uma feature |
| `get_dependencies` | Grafo de dependências de uma feature |
| `validate` | Verifica código vs contratos |
| `index` | Gera/atualiza índice YAML |

## Estrutura de Diretórios

```
contracts/
  _schema/           # meta-schemas YAML
  *.contract.yaml    # contratos por feature
src/
  app/               # entry point + MCP server
  features/          # compiler, validator, indexer, dashboard
  entities/          # contract, dependency-graph
  shared/            # lib, types, config
```
