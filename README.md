<p align="center">
  <img src="https://img.shields.io/badge/MCP-Contract%20Linter-58a6ff?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xNCAySDZhMiAyIDAgMCAwLTIgMnYxNmEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOFoiLz48cGF0aCBkPSJNMTQgMnY2aDYiLz48cGF0aCBkPSJtOSAxNSAyIDIgNC00Ii8+PC9zdmc+" alt="MCP Contractor" />
  <br/>
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/lang-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/protocol-MCP-8b5cf6?style=flat-square" alt="MCP" />
  <img src="https://img.shields.io/badge/contracts-YAML-cb171e?style=flat-square&logo=yaml" alt="YAML" />
  <img src="https://img.shields.io/badge/output-XML-f48024?style=flat-square" alt="XML" />
  <img src="https://img.shields.io/badge/tools-9-3fb950?style=flat-square" alt="9 Tools" />
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

## MCP Tools

9 tools available, organized by workflow:

### Discovery

| Tool | Description |
|------|-------------|
| `search` | Search contracts with filters (query, status, dependsOn, dependedBy, owner, hasRules, hasViolations) |
| `get_feature` | Get the full contract of a feature as optimized XML |
| `get_dependencies` | Get dependency graph (direct + transitive + circular detection) |

### Analysis

| Tool | Description |
|------|-------------|
| `compile` | Compile all contracts, return XML diagnostic report |
| `validate` | Verify implementation code matches contract declarations |
| `drift` | Detect drift between the index and actual contract files |
| `index` | Generate or update the contracts YAML index |

### Mutation

| Tool | Description |
|------|-------------|
| `scaffold` | Generate a YAML contract template for a new feature (configurable `basePath`) |
| `update` | Modify an existing contract (metadata, deps, rules, files) |

All responses are **token-optimized XML** -- compact, action-oriented, no redundancy.

### Example Workflows

**AI exploring a new codebase:**
```
search({ status: "active" })           -> overview of active features
get_feature({ feature: "auth" })       -> full contract details
get_dependencies({ feature: "auth" })  -> what auth depends on
```

**AI before modifying code:**
```
search({ dependsOn: "database" })      -> who depends on database?
validate({ feature: "database" })      -> is database currently valid?
get_feature({ feature: "database" })   -> read the rules before changing
```

**AI creating a new feature:**
```
scaffold({ feature: "payments", basePath: "src/modules", deps: "auth,database" })
update({ feature: "payments", addRules: "idempotent-charges", status: "draft" })
validate({ feature: "payments" })
```

**AI checking health:**
```
compile()                               -> any broken contracts?
drift()                                 -> index up to date?
search({ hasViolations: true })         -> which features have problems?
```

---

## Search Filters

The `search` tool supports combining multiple filters for precise queries:

| Filter | Type | Description |
|--------|------|-------------|
| `query` | string | Text search across all fields (name, description, deps, exports, rules, files) |
| `status` | string | Filter by `draft`, `active`, or `deprecated` |
| `dependsOn` | string | Find features that depend on this feature |
| `dependedBy` | string | Find features that this feature depends on |
| `owner` | string | Filter by contract owner |
| `hasRules` | string | Find features with rules matching this ID |
| `hasViolations` | boolean | `true` = only broken features, `false` = only clean |

All filters are combinable: `search({ dependsOn: "compiler", status: "active" })`

---

## Web Dashboard (for Humans)

A live dashboard auto-starts on `localhost:8000` (auto-fallback to next port if busy):

| View | URL | Description |
|------|-----|-------------|
| **Summary** | `/` | Status bar, metric cards, features table with inline violations |
| **Project** | `/project` | Tree view of contracts + humanized contract detail cards |
| **Brain Link** | `/graph` | Interactive force-directed dependency graph (Canvas 2D, drag & hover) |

API endpoints for integration:
- `GET /api/data` -- Dashboard summary (JSON)
- `GET /api/contracts` -- All compiled contracts (JSON)
- `GET /api/graph` -- Dependency graph nodes + edges (JSON)

---

## Contract Validation

The validator checks your code against its contracts:

- **exports-match** -- Barrel exports must match what the contract declares
- **deps-declared** -- Imports from other features must be declared in dependencies
- **no-circular-deps** -- Circular dependencies between features are detected
- **files-exist** -- Declared files must exist in the filesystem

Feature discovery is dynamic -- the validator searches `src/**/features/{name}/` and `src/**/{name}/` to find feature directories, supporting any project structure.

---

## Contract Discovery

Contracts are scanned from two locations:

- `contracts/` -- Centralized project-wide contracts (flat scan)
- `src/**/` -- Feature-local contracts colocated with code (recursive `**/*.contract.yaml`)

Ignored directories: `node_modules`, `dist`, `build`, `.git`, `.next`, `.nuxt`, `.svelte-kit`, `coverage`, `.turbo`, `.cache`

---

## Quick Start

### Install

```bash
bun install
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

Restart Claude Code. You'll see 9 new tools available. The dashboard opens automatically at **http://localhost:8000**.

### Run Standalone

```bash
bun run dev    # Start MCP server (stdio)
```

---

## Contract Anatomy

Every feature has a `.contract.yaml` that follows this structure:

```yaml
contract:
  version: "1.0.0"
  feature: auth
  description: "Authentication and authorization"
  owner: backend-team
  status: active              # draft | active | deprecated

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
    severity: error           # error | warning | info
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

The `scaffold` tool generates this template automatically:
```
scaffold({ feature: "auth", basePath: "src/modules", deps: "database,crypto", owner: "backend-team" })
```

---

## XML Output (for AI)

Responses are optimized for token efficiency:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<zero-human tool="search" status="success">
<results dependsOn="compiler" count="4">
<match feature="validator" status="draft" owner="adam" deps="compiler,contract-entity,dependency-graph" exports="validate,validateAll" rules="5">Verifica se o codigo corresponde aos contratos</match>
<match feature="dashboard" status="draft" owner="adam" deps="compiler,validator,indexer" exports="startDashboard,renderDashboard,renderHtml" rules="4">Web dashboard humanizado</match>
</results>
</zero-human>
```

One line per result. Attributes for data, text content for descriptions. Maximum information, minimum tokens.

---

## License

MIT
