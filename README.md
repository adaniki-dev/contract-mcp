<p align="center">
  <img src="https://img.shields.io/badge/MCP-Contract%20Linter-58a6ff?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xNCAySDZhMiAyIDAgMCAwLTIgMnYxNmEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOFoiLz48cGF0aCBkPSJNMTQgMnY2aDYiLz48cGF0aCBkPSJtOSAxNSAyIDIgNC00Ii8+PC9zdmc+" alt="MCP Contractor" />
  <br/>
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/lang-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/protocol-MCP-8b5cf6?style=flat-square" alt="MCP" />
  <img src="https://img.shields.io/badge/contracts-YAML-cb171e?style=flat-square&logo=yaml" alt="YAML" />
  <img src="https://img.shields.io/badge/output-XML-f48024?style=flat-square" alt="XML" />
</p>

# MCP Contractor

> **AI agents shouldn't guess. They should read the contract.**

MCP Contractor is a Model Context Protocol server that acts as a **contract linter for AI**. Instead of relying on `ls`, `find`, or scanning raw files, AI agents call MCP Contractor to understand a project through structured YAML contracts.

Each contract defines a feature's **dependencies**, **exports**, **business rules**, **file structure**, and **types** -- giving the AI everything it needs to work without breaking things.

---

## Why

AI agents working on large codebases often:
- Break dependencies they didn't know existed
- Forget business rules buried in code comments
- Produce code that doesn't follow project conventions
- Lose context across feature boundaries

**MCP Contractor solves this** by making contracts the source of truth. The AI reads the contract before touching the code.

---

## How It Works

```
   Developer                    AI Agent (Claude Code)
       |                              |
       |  writes contracts (.yaml)    |
       |----------------------------->|
       |                              |  calls MCP tools
       |                              |---------------->  MCP Contractor
       |                              |                      |
       |                              |  <-- XML response    |
       |                              |     (deps, rules,    |
       |                              |      exports, types) |
       |                              |                      |
       |       writes code that       |                      |
       |    <-- respects contracts    |                      |
       |                              |                      |
       |   opens dashboard (browser)  |                      |
       |----------------------------->|  http://localhost:8000
```

---

## Features

### MCP Tools (for AI)

| Tool | Description |
|------|-------------|
| `compile` | Compile all contracts, return XML diagnostic report |
| `get_feature` | Get the full contract of a feature as optimized XML |
| `get_dependencies` | Get dependency graph (direct + transitive + circular detection) |
| `validate` | Verify implementation code matches contract declarations |
| `index` | Generate or update the contracts YAML index |

All responses are **token-optimized XML** -- compact, action-oriented, no redundancy.

### Web Dashboard (for Humans)

A live dashboard served on `localhost:8000` with three views:

- **Summary** -- Status bar, metric cards, features table with inline violations
- **Project** -- Tree view of contracts + humanized contract detail cards
- **Brain Link** -- Interactive force-directed dependency graph (Canvas 2D, drag & hover)

The dashboard starts automatically alongside the MCP server.

### Contract Validation

The validator checks your code against its contracts:

- **exports-match** -- Barrel exports must match what the contract declares
- **deps-declared** -- Imports from other features must be declared in dependencies
- **no-circular-deps** -- Circular dependencies between features are detected
- **files-exist** -- Declared files must exist in the filesystem

### Contract Discovery

Contracts are scanned from two locations:

- `contracts/` -- Centralized project-wide contracts (flat scan)
- `src/**/` -- Feature-local contracts colocated with code (recursive `**/*.contract.yaml`)

---

## Quick Start

### Install

```bash
bun install
```

### Run as MCP Server

```bash
bun run dev
```

### Connect to Claude Code

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "zero-human": {
      "command": "bun",
      "args": ["run", "src/app/index.ts"],
      "cwd": "/path/to/zero-human"
    }
  }
}
```

Restart Claude Code. You'll see 5 new tools available.

### Open Dashboard

After the MCP server starts, open: **http://localhost:8000**

---

## Contract Anatomy

Every feature has a `.contract.yaml` that follows this structure:

```yaml
contract:
  version: "1.0.0"
  feature: auth
  description: "Authentication and authorization"
  owner: backend-team
  status: active

dependencies:
  internal:
    - feature: database
      reason: "Stores user sessions and credentials"
  external:
    - package: bcrypt
      version: "^5.1.0"
      reason: "Password hashing"

exports:
  functions:
    - name: authenticate
      signature: "(credentials: Credentials) => Result<AuthToken, AuthError>"
      description: "Validates credentials and returns a token"
      pure: true
  types:
    - name: AuthToken
      description: "JWT token wrapper with expiry"

rules:
  - id: token-expiry
    description: "Tokens must expire within 24 hours"
    severity: error
    testable: true
  - id: rate-limit
    description: "Max 5 failed attempts per minute per IP"
    severity: error
    testable: true

files:
  - path: src/features/auth/index.ts
    purpose: "Barrel export"
  - path: src/features/auth/auth.ts
    purpose: "Core authentication logic"
```

---

## Architecture

Built with [Feature Sliced Design](https://feature-sliced.design):

```
shared ← entities ← features ← app
```

```
src/
  shared/          # No business logic: helpers, types, config
    lib/           #   yaml, xml, parsers (oxc-parser, es-module-lexer)
    types/         #   TypeScript type definitions
    config/        #   Constants and defaults
  entities/        # Domain models
    contract/      #   YAML loader, structure validator
    dependency-graph/  # Graph builder, cycle detection (DFS)
  features/        # Use cases
    compiler/      #   Parse + validate contracts
    validator/     #   Verify code matches contracts
    indexer/       #   Build index, detect drift
    dashboard/     #   Web UI server (Bun.serve)
  app/             # Composition
    mcp-server/    #   MCP server + 5 tool handlers
    index.ts       #   Entry point
contracts/         # YAML contracts (source of truth)
  _schema/         #   Meta-schemas
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

### Workflow: Contract-Driven Development

```
contract YAML → tests (TDD) → code
```

1. Write or update the contract YAML
2. Derive tests from the contract (rules, exports, types)
3. Implement until tests pass
4. No code without a contract. No contract change without updating tests.

---

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

## XML Output (for AI)

Responses are optimized for token efficiency. Example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<zero-human tool="validate" status="success">
<results count="7" valid="true" totalViolations="0">
<result feature="compiler" valid="true" violations="0" />
<result feature="validator" valid="true" violations="0" />
<result feature="dashboard" valid="true" violations="0" />
</results>
</zero-human>
```

One line per valid feature. Violations only appear when present. Maximum information, minimum tokens.

---

## License

MIT
