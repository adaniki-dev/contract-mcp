# Contributing to MCP Contractor

## Stack

| Component | Technology |
|-----------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict, no `any`) |
| Protocol | [MCP](https://modelcontextprotocol.io) via `@modelcontextprotocol/sdk` |
| JS/TS Parsing | [oxc-parser](https://oxc-project.github.io) (Rust, via napi-rs) |
| Import Analysis | [es-module-lexer](https://github.com/nicolo-ribaudo/es-module-lexer) |
| Contracts | YAML in, XML out |
| Dashboard | Bun.serve, Canvas 2D, vanilla JS |

---

## Architecture

Built with [Feature Sliced Design](https://feature-sliced.design):

```
shared ← entities ← features ← app
```

```
src/
  shared/              # No business logic: helpers, types, config
    lib/               #   yaml, xml, parsers (oxc-parser, es-module-lexer)
    types/             #   TypeScript type definitions
    config/            #   Constants, defaults, ignored dirs
  entities/            # Domain models
    contract/          #   YAML loader, structure validator
    dependency-graph/  #   Graph builder, cycle detection (DFS)
  features/            # Use cases
    compiler/          #   Parse + validate contracts
    validator/         #   Verify code matches contracts
    indexer/           #   Build index, detect drift
    dashboard/         #   Web UI server (Bun.serve) + views
  app/                 # Composition
    mcp-server/        #   MCP server + 9 tool handlers
    index.ts           #   Entry point
contracts/             # YAML contracts (source of truth)
  _schema/             #   Meta-schemas
```

**Import rule:** layers only import downward. Features never import from each other -- they communicate through entities.

---

## Development

```bash
bun install          # Install dependencies
bun test             # Run all 51 tests
bun test --filter X  # Run tests for a feature
bun run dev          # Start MCP server (stdio)
bun run build        # Typecheck + bundle
tsc --noEmit         # Typecheck only
```

---

## Workflow: Contract-Driven Development

```
contract YAML → tests (TDD) → code
```

1. Write or update the contract YAML (or use `scaffold` to generate one)
2. Derive tests from the contract (rules, exports, types)
3. Implement until tests pass
4. Run `validate` to check compliance
5. Run `drift` to ensure the index is current

No code without a contract. No contract change without updating tests.

---

## Adding a New MCP Tool

1. Create handler at `src/app/mcp-server/tools/{name}.ts`
   - Export `handleToolName(args): Promise<string>`
   - Return `xmlSuccess()` or `xmlError()` — never throw
2. Register in `src/app/mcp-server/server.ts`
   - Use `server.registerTool()` with zod input schema
3. Update `contracts/mcp-server.contract.yaml`
   - Add endpoint with input/output/errors
   - Add file path to files section
4. Regenerate index: `bun -e "import { buildIndex } from './src/features/indexer'; ..."`
5. Run `validate` to ensure 0 violations

---

## Conventions

- **Files:** `kebab-case.ts`
- **Types:** `PascalCase`
- **Functions/variables:** `camelCase`
- **Exports:** always via barrel `index.ts` per slice
- **Errors:** `Result<T, E>` pattern — never `throw` for expected errors
- **Tests:** colocated (`*.test.ts` next to `*.ts`)
- **Contracts:** `*.contract.yaml`
- **Output:** XML for AI, YAML for contracts — never JSON for either
- **No `any`** — TypeScript strict, no exceptions
