# Hours Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-static GitHub Pages hours tracker that commits flat JSON files to a private per-consultant data repo, with partner-level multi-tenancy (Sector Growth as first partner under SapienEx hosting), ironclad data-integrity guarantees, and AI-native maintainability.

**Architecture:** Vite + React 18 + TypeScript SPA → commits directly to a private GitHub data repo via Octokit + fine-grained PAT. Pure calc module for all billing math. Partner config-driven theming. Three multi-agent review gates (calc, UI, pre-release) enforce correctness.

**Tech Stack:** Vite, React 18, TypeScript (strict), Tailwind CSS, Zustand, @tanstack/react-query, @octokit/rest, ajv, Vitest, fast-check, ESLint (w/ custom integer-math rule).

**Authoritative spec:** `docs/superpowers/specs/2026-04-11-hours-tracker-design.md` — every task references specific sections. Read the spec first.

**Working directory at plan start:** `/Users/prash/Projects/oh-tap/consulting/sector-growth/prash-hours-tracker/`. This will become the working tree for the `sapienEx-AI/hours-tracker` repo. The spec doc already lives at `docs/superpowers/specs/`. No git repo exists yet — Task 1 initializes it.

---

## Phases

| Phase | Tasks | Gate |
|---|---|---|
| 1. Project scaffold | 1–4 | — |
| 2. Schemas & types | 5–10 | — |
| 3. Calc module | 11–18 | **Gate A** |
| 4. Partner system | 19–21 | — |
| 5. Auth | 22–24 | — |
| 6. Data layer | 25–31 | — |
| 7. UI foundations | 32–36 | — |
| 8. Core screens | 37–44 | **Gate B** |
| 9. March import | 45–47 | **Gate C** |
| 10. Deploy | 48–50 | — |
| 11. AI-native docs | 51–53 | — |

---

## PHASE 1 — Project scaffold

### Task 1: Initialize git repo and Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Initialize git repo in the working directory**

```bash
cd /Users/prash/Projects/oh-tap/consulting/sector-growth/prash-hours-tracker
git init
git branch -m main
```

Expected: `Initialized empty Git repository` message. The `docs/superpowers/specs/2026-04-11-hours-tracker-design.md` and `docs/superpowers/plans/2026-04-11-hours-tracker-plan.md` are already on disk from the brainstorming phase.

- [ ] **Step 2: Write `.gitignore`**

File: `.gitignore`

```
# Dependencies
node_modules
.pnp
.pnp.js

# Build outputs
dist
dist-ssr
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Testing
coverage
.vitest-cache

# Superpowers scratch
.superpowers/

# Env
.env
.env.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*
```

- [ ] **Step 3: Write `package.json` with pinned versions**

File: `package.json`

```json
{
  "name": "hours-tracker",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "description": "SapienEx Hours Tracker — a pure-static React app that logs consulting hours into per-consultant private GitHub data repos. First partner: Sector Growth.",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\" \"tests/**/*.{ts,tsx}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:golden": "vitest run tests/calc/golden.test.ts",
    "test:property": "vitest run tests/calc/property.test.ts",
    "test:unit": "vitest run tests/calc/unit.test.ts",
    "import:march": "tsx scripts/import-march-2026.ts",
    "new-partner": "tsx scripts/new-partner.ts"
  },
  "dependencies": {
    "@octokit/rest": "20.1.1",
    "@tanstack/react-query": "5.51.1",
    "ajv": "8.17.1",
    "ajv-formats": "3.0.1",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zustand": "4.5.4"
  },
  "devDependencies": {
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@typescript-eslint/eslint-plugin": "7.16.0",
    "@typescript-eslint/parser": "7.16.0",
    "@vitejs/plugin-react": "4.3.1",
    "autoprefixer": "10.4.19",
    "eslint": "8.57.0",
    "eslint-plugin-react": "7.34.3",
    "eslint-plugin-react-hooks": "4.6.2",
    "eslint-plugin-react-refresh": "0.4.7",
    "fast-check": "3.19.0",
    "postcss": "8.4.39",
    "prettier": "3.3.2",
    "tailwindcss": "3.4.4",
    "tsx": "4.16.2",
    "typescript": "5.5.3",
    "vite": "5.3.3",
    "vitest": "1.6.0"
  }
}
```

Note: **exact versions, no ^ or ~** per spec §15.9.

- [ ] **Step 4: Write `tsconfig.json` (strict)**

File: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests", "scripts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Write `tsconfig.node.json`**

File: `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Write `vite.config.ts` configured for project-scoped GitHub Pages**

File: `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Project-scoped Pages: served at https://sapienex-ai.github.io/hours-tracker/
// All asset URLs must be relative to `/hours-tracker/`.
export default defineConfig({
  base: '/hours-tracker/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts'],
    },
  },
});
```

- [ ] **Step 7: Write `index.html`**

File: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0A1628" />
    <title>Hours Tracker</title>
    <link rel="icon" type="image/png" href="/hours-tracker/partners/sector-growth/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Note: title and favicon will be swapped at runtime by the partner loader (§8.1 of spec). The static fallback points at Sector Growth because it's the only enabled partner at launch.

- [ ] **Step 8: Write minimal `src/main.tsx` and `src/App.tsx`**

File: `src/main.tsx`

```ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

File: `src/App.tsx`

```tsx
export default function App(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Hours Tracker — scaffold bootstrapped.</p>
    </div>
  );
}
```

File: `src/index.css` (empty placeholder — Tailwind directives added in Task 2)

```css
/* Tailwind directives added in Task 2 */
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`

Expected: `added N packages` with no errors. Creates `node_modules/` and `package-lock.json`.

- [ ] **Step 10: Run the dev server and verify**

Run: `npm run dev`

Expected: Vite prints `Local: http://localhost:5173/hours-tracker/`. Open the URL — should see "Hours Tracker — scaffold bootstrapped.". Kill with Ctrl+C.

- [ ] **Step 11: Run typecheck to confirm strict mode passes**

Run: `npm run typecheck`

Expected: Exit 0, no output.

- [ ] **Step 12: Write a minimal README.md**

File: `README.md`

```markdown
# Hours Tracker

A pure-static GitHub Pages app that logs consulting hours into private per-consultant GitHub data repos. Partner-branded (Sector Growth first), hosted by SapienEx.

**Design spec:** [`docs/superpowers/specs/2026-04-11-hours-tracker-design.md`](docs/superpowers/specs/2026-04-11-hours-tracker-design.md)
**Implementation plan:** [`docs/superpowers/plans/2026-04-11-hours-tracker-plan.md`](docs/superpowers/plans/2026-04-11-hours-tracker-plan.md)
**Claude Code guide:** [`CLAUDE.md`](CLAUDE.md)

## Quick start

```sh
npm install
npm run dev
```

See `CLAUDE.md` for the full development workflow.
```

- [ ] **Step 13: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx src/index.css README.md docs/
git commit -m "scaffold: vite + react 18 + typescript strict, project-scoped GH Pages base"
```

---

### Task 2: Configure Tailwind CSS with partner CSS custom properties

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Write `tailwind.config.ts` referencing partner CSS vars**

File: `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';

// Partner colors are exposed as CSS custom properties by src/partner/apply-theme.ts.
// Tailwind utilities read through var() so every theme swap is automatic.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        partner: {
          'bg-deep': 'var(--partner-bg-deep)',
          'bg-darker': 'var(--partner-bg-darker)',
          cyan: 'var(--partner-accent-cyan)',
          mid: 'var(--partner-accent-mid)',
          deep: 'var(--partner-accent-deep)',
          text: 'var(--partner-text-primary)',
          muted: 'var(--partner-text-muted)',
          'border-subtle': 'var(--partner-border-subtle)',
          'border-strong': 'var(--partner-border-strong)',
        },
      },
      fontFamily: {
        display: 'var(--partner-font-display)',
        body: 'var(--partner-font-body)',
        mono: 'var(--partner-font-mono)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Write `postcss.config.js`**

File: `postcss.config.js`

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Add Tailwind directives and default CSS vars to `src/index.css`**

File: `src/index.css` (overwrite)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
 * Default CSS custom properties for partner theme.
 * These get overwritten at runtime by src/partner/apply-theme.ts once the
 * active partner is loaded. The values here are the Sector Growth defaults
 * (dark theme) so we have a sensible fallback before the partner is resolved.
 */
:root {
  --partner-bg-deep: #0A1628;
  --partner-bg-darker: #050B16;
  --partner-accent-cyan: #6BCFEE;
  --partner-accent-mid: #2A85C4;
  --partner-accent-deep: #1E4DA8;
  --partner-text-primary: #F5F7FA;
  --partner-text-muted: #94A3B8;
  --partner-border-subtle: rgba(255, 255, 255, 0.08);
  --partner-border-strong: rgba(255, 255, 255, 0.16);
  --partner-font-display: 'Space Grotesk', system-ui, sans-serif;
  --partner-font-body: 'Inter', system-ui, sans-serif;
  --partner-font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

html, body, #root {
  min-height: 100vh;
  background: var(--partner-bg-darker);
  color: var(--partner-text-primary);
  font-family: var(--partner-font-body);
}
```

- [ ] **Step 4: Verify Tailwind works**

Update `src/App.tsx` temporarily to use a Tailwind class referencing a partner var:

```tsx
export default function App(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-partner-bg-darker text-partner-text font-display">
      <p className="text-2xl">Hours Tracker · scaffold bootstrapped</p>
    </div>
  );
}
```

Run: `npm run dev` — page should render dark navy background, light text, Space Grotesk font. Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts postcss.config.js src/index.css src/App.tsx
git commit -m "scaffold: tailwind wired to partner css custom properties"
```

---

### Task 3: Configure ESLint, Prettier, and custom integer-math rule

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `eslint-rules/no-float-money.cjs`

- [ ] **Step 1: Write `.prettierrc`**

File: `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

- [ ] **Step 2: Write `.prettierignore`**

File: `.prettierignore`

```
node_modules
dist
coverage
package-lock.json
.superpowers
```

- [ ] **Step 3: Write custom ESLint rule enforcing integer math on money/hours fields**

File: `eslint-rules/no-float-money.cjs`

```js
/**
 * Custom ESLint rule: forbid direct arithmetic on identifiers whose names end in
 * `_cents`, `_hundredths`, or contain `rate_cents` / `hours_hundredths`. Integer math
 * must go through helpers in src/calc/int.ts.
 *
 * Rationale: spec §7.2 layer 6. Enforces that a drive-by `x * 1.5` on a money
 * field cannot sneak in without lint failing.
 */
'use strict';

const FORBIDDEN_SUFFIXES = ['_cents', '_hundredths'];

function identifierLooksLikeIntegerField(name) {
  if (typeof name !== 'string') return false;
  return FORBIDDEN_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function nodeReferencesIntegerField(node) {
  if (!node) return false;
  if (node.type === 'Identifier') return identifierLooksLikeIntegerField(node.name);
  if (node.type === 'MemberExpression' && node.property && node.property.type === 'Identifier') {
    return identifierLooksLikeIntegerField(node.property.name);
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct arithmetic on _cents / _hundredths fields; use src/calc/int helpers.',
    },
    schema: [],
    messages: {
      forbidden:
        'Do not use `{{op}}` directly on `{{name}}`. Integer math must go through src/calc/int helpers (addCents, mulHundredths, etc.).',
    },
  },
  create(context) {
    // Allow arithmetic inside src/calc/int.ts — that IS the helper module.
    const filename = context.getFilename();
    if (filename.endsWith('/calc/int.ts') || filename.endsWith('\\calc\\int.ts')) {
      return {};
    }
    return {
      BinaryExpression(node) {
        if (!['+', '-', '*', '/', '%'].includes(node.operator)) return;
        const offender = nodeReferencesIntegerField(node.left) ? node.left : nodeReferencesIntegerField(node.right) ? node.right : null;
        if (!offender) return;
        const name = offender.type === 'Identifier' ? offender.name : offender.property.name;
        context.report({ node, messageId: 'forbidden', data: { op: node.operator, name } });
      },
      AssignmentExpression(node) {
        if (!['+=', '-=', '*=', '/=', '%='].includes(node.operator)) return;
        if (!nodeReferencesIntegerField(node.left)) return;
        const name = node.left.type === 'Identifier' ? node.left.name : node.left.property.name;
        context.report({ node, messageId: 'forbidden', data: { op: node.operator, name } });
      },
    };
  },
};
```

- [ ] **Step 4: Write `.eslintrc.cjs` loading the custom rule**

File: `.eslintrc.cjs`

```js
const path = require('node:path');

module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-refresh', 'local'],
  settings: { react: { version: '18.3' } },
  ignorePatterns: ['dist', 'node_modules', 'coverage', 'eslint-rules'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'local/no-float-money': 'error',
    complexity: ['warn', 10],
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
  },
  overrides: [
    {
      files: ['tests/**/*.ts', 'tests/**/*.tsx'],
      rules: {
        'max-lines-per-function': 'off',
        'local/no-float-money': 'off',
      },
    },
  ],
};
```

Because ESLint 8 doesn't load local rules from a file path out of the box, register via an `.eslintrc.cjs` snippet that uses `eslint-plugin-local-rules`. Actually — we'll pull in `eslint-plugin-local-rules` as a dev dep. Update `package.json`:

Run: `npm install --save-dev --save-exact eslint-plugin-local-rules@2.0.0`

Then in `.eslintrc.cjs` the `plugins: ['local']` line uses the `eslint-plugin-local-rules` package. Create one more file:

File: `eslint-local-rules.js`

```js
module.exports = {
  'no-float-money': require('./eslint-rules/no-float-money.cjs'),
};
```

- [ ] **Step 5: Run lint and verify it passes on current code**

Run: `npm run lint`

Expected: exit 0, no warnings/errors. (The scaffold code contains no integer-field math.)

- [ ] **Step 6: Commit**

```bash
git add .eslintrc.cjs .prettierrc .prettierignore eslint-rules/ eslint-local-rules.js package.json package-lock.json
git commit -m "scaffold: eslint + prettier + custom no-float-money rule for integer math"
```

---

### Task 4: Set up Vitest harness and empty test directories

**Files:**
- Create: `tests/setup.ts`
- Create: `tests/README.md`
- Create: `tests/fixtures/.gitkeep`
- Create: `tests/integration/.gitkeep`

- [ ] **Step 1: Write `tests/setup.ts`**

File: `tests/setup.ts`

```ts
// Vitest global setup. Extend with matchers or mocks here as needed.
// Keep this file minimal — tests should be self-contained (spec §15.4).
export {};
```

- [ ] **Step 2: Write `tests/README.md`**

File: `tests/README.md`

```markdown
# Tests

Three test categories:

- `tests/calc/unit.test.ts` — hand-crafted inputs, one test per public `src/calc` function.
- `tests/calc/property.test.ts` — fast-check invariants from spec §7.2 layer 2.
- `tests/calc/golden.test.ts` — March 2026 real-data golden fixture, spec §7.2 layer 3.
- `tests/integration/*.test.ts` — module-boundary tests (Octokit mocked).

**Test-as-documentation rules (spec §15.4):**
- Every test name is a full sentence describing observable behavior.
- No shared mutable fixtures.
- No mocks for the calc module. Only mock at the Octokit boundary.
- Property tests use the exact invariant names from spec §7.2 as descriptions.
```

- [ ] **Step 3: Create .gitkeeps for empty dirs**

```bash
mkdir -p tests/calc tests/fixtures tests/integration
touch tests/fixtures/.gitkeep tests/integration/.gitkeep
```

- [ ] **Step 4: Write a smoke test to prove Vitest works**

File: `tests/smoke.test.ts`

```ts
import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('executes a trivial test to prove the test runner is wired up', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: `1 passed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "scaffold: vitest harness with smoke test, test directory conventions"
```

---

## PHASE 2 — Schemas & shared types

All schemas live in `schemas/` at repo root (spec §4.1). They are the single source of truth; the data-repo CI validates against frozen copies of these files.

### Task 5: Write `schemas/partner.schema.json`

**Files:**
- Create: `schemas/partner.schema.json`

- [ ] **Step 1: Write the schema**

File: `schemas/partner.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/partner.schema.json",
  "title": "Partner",
  "type": "object",
  "required": [
    "schema_version", "id", "display_name", "currency", "currency_symbol",
    "currency_display_suffix", "data_repo_prefix", "theme", "fonts", "assets", "enabled"
  ],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "display_name": { "type": "string", "minLength": 1 },
    "tagline": { "type": "string" },
    "website": { "type": "string", "format": "uri" },
    "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
    "currency_symbol": { "type": "string", "minLength": 1 },
    "currency_display_suffix": { "type": "string" },
    "data_repo_prefix": { "type": "string", "pattern": "^hours-data-[a-z0-9-]+-$" },
    "theme": {
      "type": "object",
      "required": ["mode", "bg_deep", "bg_darker", "accent_cyan", "accent_mid", "accent_deep",
                   "text_primary", "text_muted", "border_subtle", "border_strong"],
      "additionalProperties": false,
      "properties": {
        "mode": { "enum": ["dark", "light"] },
        "bg_deep": { "type": "string" },
        "bg_darker": { "type": "string" },
        "accent_cyan": { "type": "string" },
        "accent_mid": { "type": "string" },
        "accent_deep": { "type": "string" },
        "text_primary": { "type": "string" },
        "text_muted": { "type": "string" },
        "border_subtle": { "type": "string" },
        "border_strong": { "type": "string" }
      }
    },
    "fonts": {
      "type": "object",
      "required": ["display", "body", "mono"],
      "additionalProperties": false,
      "properties": {
        "display": { "type": "string" },
        "body": { "type": "string" },
        "mono": { "type": "string" },
        "google_fonts_link": { "type": "string", "format": "uri" }
      }
    },
    "assets": {
      "type": "object",
      "required": ["logo", "logo_alt_text", "favicon"],
      "additionalProperties": false,
      "properties": {
        "logo": { "type": "string" },
        "logo_alt_text": { "type": "string" },
        "logo_width": { "type": "integer", "minimum": 1 },
        "logo_height": { "type": "integer", "minimum": 1 },
        "logo_dark_filter": { "type": "string" },
        "favicon": { "type": "string" }
      }
    },
    "enabled": { "type": "boolean" }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add schemas/partner.schema.json
git commit -m "schemas: partner.schema.json (partner config contract)"
```

---

### Task 6: Write `schemas/profile.schema.json`, `schemas/rates.schema.json`, `schemas/projects.schema.json`

These are mechanical translations of the type contracts in spec §5.2, §5.5, §5.4. Write all three in one task since they're small.

**Files:**
- Create: `schemas/profile.schema.json`
- Create: `schemas/rates.schema.json`
- Create: `schemas/projects.schema.json`

- [ ] **Step 1: Write profile schema**

File: `schemas/profile.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/profile.schema.json",
  "title": "Consultant profile",
  "type": "object",
  "required": ["schema_version", "partner_id", "consultant_id", "display_name", "created_at"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "partner_id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "consultant_id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "display_name": { "type": "string", "minLength": 1 },
    "email": { "type": "string", "format": "email" },
    "timezone": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

- [ ] **Step 2: Write rates schema**

File: `schemas/rates.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/rates.schema.json",
  "title": "Rate history",
  "type": "object",
  "required": ["schema_version", "default_rate_history"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "default_rate_history": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["effective_from", "rate_cents"],
        "additionalProperties": false,
        "properties": {
          "effective_from": { "type": "string", "format": "date" },
          "rate_cents": { "type": "integer", "minimum": 1 },
          "note": { "type": "string" }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Write projects schema**

File: `schemas/projects.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/projects.schema.json",
  "title": "Projects and buckets",
  "type": "object",
  "required": ["schema_version", "projects"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "active", "is_internal", "buckets"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "name": { "type": "string", "minLength": 1 },
          "client": { "type": ["string", "null"] },
          "active": { "type": "boolean" },
          "is_internal": { "type": "boolean" },
          "default_rate_cents": { "type": ["integer", "null"], "minimum": 1 },
          "buckets": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "type", "name", "budgeted_hours_hundredths", "status", "opened_at"],
              "additionalProperties": false,
              "properties": {
                "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
                "type": { "enum": ["hour_block", "discovery", "arch_tl", "dev", "custom"] },
                "name": { "type": "string", "minLength": 1 },
                "budgeted_hours_hundredths": { "type": "integer", "minimum": 1 },
                "rate_cents": { "type": ["integer", "null"], "minimum": 1 },
                "status": { "enum": ["active", "closed", "archived"] },
                "opened_at": { "type": "string", "format": "date" },
                "closed_at": { "type": ["string", "null"], "format": "date" },
                "notes": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add schemas/profile.schema.json schemas/rates.schema.json schemas/projects.schema.json
git commit -m "schemas: profile + rates + projects contracts"
```

---

### Task 7: Write `schemas/entries.schema.json` and `schemas/snapshot.schema.json`

**Files:**
- Create: `schemas/entries.schema.json`
- Create: `schemas/snapshot.schema.json`

- [ ] **Step 1: Write entries schema**

File: `schemas/entries.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/entries.schema.json",
  "title": "Monthly entries file",
  "type": "object",
  "required": ["schema_version", "month", "entries"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "month": { "type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "project", "date", "hours_hundredths", "rate_cents", "rate_source",
                     "billable_status", "bucket_id", "description", "review_flag", "created_at", "updated_at"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+-[a-f0-9]{6}$" },
          "project": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "date": { "type": "string", "format": "date" },
          "hours_hundredths": { "type": "integer", "minimum": 1, "maximum": 2400 },
          "rate_cents": { "type": "integer", "minimum": 0 },
          "rate_source": { "enum": ["entry_override", "project_default", "global_default"] },
          "billable_status": { "enum": ["billable", "non_billable", "needs_review"] },
          "bucket_id": { "type": ["string", "null"], "pattern": "^[a-z0-9-]+$" },
          "description": { "type": "string", "minLength": 1, "maxLength": 500 },
          "review_flag": { "type": "boolean" },
          "created_at": { "type": "string", "format": "date-time" },
          "updated_at": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write snapshot schema**

File: `schemas/snapshot.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://sapienex-ai.github.io/hours-tracker/schemas/snapshot.schema.json",
  "title": "Monthly snapshot",
  "type": "object",
  "required": ["schema_version", "month", "closed_at", "closed_at_commit_sha",
               "source_hash", "totals", "per_project", "entry_ids"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "month": { "type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    "closed_at": { "type": "string", "format": "date-time" },
    "closed_at_commit_sha": { "type": "string", "pattern": "^[a-f0-9]{7,40}$" },
    "source_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
    "totals": {
      "type": "object",
      "required": ["total_hours_hundredths", "billable_hours_hundredths",
                   "non_billable_hours_hundredths", "needs_review_hours_hundredths", "billable_amount_cents"],
      "additionalProperties": false,
      "properties": {
        "total_hours_hundredths": { "type": "integer", "minimum": 0 },
        "billable_hours_hundredths": { "type": "integer", "minimum": 0 },
        "non_billable_hours_hundredths": { "type": "integer", "minimum": 0 },
        "needs_review_hours_hundredths": { "type": "integer", "minimum": 0 },
        "billable_amount_cents": { "type": "integer", "minimum": 0 }
      }
    },
    "per_project": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["project", "billable_hours_hundredths", "billable_amount_cents",
                     "non_billable_hours_hundredths", "needs_review_hours_hundredths", "by_bucket"],
        "additionalProperties": false,
        "properties": {
          "project": { "type": "string" },
          "billable_hours_hundredths": { "type": "integer", "minimum": 0 },
          "billable_amount_cents": { "type": "integer", "minimum": 0 },
          "non_billable_hours_hundredths": { "type": "integer", "minimum": 0 },
          "needs_review_hours_hundredths": { "type": "integer", "minimum": 0 },
          "by_bucket": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["bucket_id", "consumed_hours_hundredths", "budgeted_hours_hundredths", "amount_cents"],
              "additionalProperties": false,
              "properties": {
                "bucket_id": { "type": "string" },
                "consumed_hours_hundredths": { "type": "integer", "minimum": 0 },
                "budgeted_hours_hundredths": { "type": "integer", "minimum": 0 },
                "amount_cents": { "type": "integer", "minimum": 0 }
              }
            }
          }
        }
      }
    },
    "entry_ids": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add schemas/entries.schema.json schemas/snapshot.schema.json
git commit -m "schemas: entries + snapshot contracts"
```

---

### Task 8: Write `src/schema/types.ts` (TypeScript mirror of all JSON schemas)

**Files:**
- Create: `src/schema/types.ts`
- Create: `src/schema/README.md`

- [ ] **Step 1: Write types**

File: `src/schema/types.ts`

```ts
/**
 * TypeScript types that mirror the JSON Schemas in /schemas/*.json.
 *
 * These are the in-memory representation. The schemas are the serialization
 * contract; types + ajv validators must stay in sync. Bumping schema_version
 * is a reviewed event (spec §15.5 `adding-a-field.md` playbook).
 */

// Partner
export type PartnerTheme = {
  mode: 'dark' | 'light';
  bg_deep: string;
  bg_darker: string;
  accent_cyan: string;
  accent_mid: string;
  accent_deep: string;
  text_primary: string;
  text_muted: string;
  border_subtle: string;
  border_strong: string;
};

export type PartnerFonts = {
  display: string;
  body: string;
  mono: string;
  google_fonts_link?: string;
};

export type PartnerAssets = {
  logo: string;
  logo_alt_text: string;
  logo_width?: number;
  logo_height?: number;
  logo_dark_filter?: string;
  favicon: string;
};

export type Partner = {
  schema_version: 1;
  id: string;
  display_name: string;
  tagline?: string;
  website?: string;
  currency: string;
  currency_symbol: string;
  currency_display_suffix: string;
  data_repo_prefix: string;
  theme: PartnerTheme;
  fonts: PartnerFonts;
  assets: PartnerAssets;
  enabled: boolean;
};

export type PartnersIndex = {
  schema_version: 1;
  partners: Array<{ id: string; display_name: string; enabled: boolean }>;
};

// Profile
export type Profile = {
  schema_version: 1;
  partner_id: string;
  consultant_id: string;
  display_name: string;
  email?: string;
  timezone?: string;
  created_at: string;
};

// Rates
export type RateHistoryEntry = {
  effective_from: string;
  rate_cents: number;
  note?: string;
};

export type RatesConfig = {
  schema_version: 1;
  default_rate_history: RateHistoryEntry[];
};

// Projects
export type BucketType = 'hour_block' | 'discovery' | 'arch_tl' | 'dev' | 'custom';
export type BucketStatus = 'active' | 'closed' | 'archived';

export type Bucket = {
  id: string;
  type: BucketType;
  name: string;
  budgeted_hours_hundredths: number;
  rate_cents: number | null;
  status: BucketStatus;
  opened_at: string;
  closed_at: string | null;
  notes: string;
};

export type Project = {
  id: string;
  name: string;
  client: string | null;
  active: boolean;
  is_internal: boolean;
  default_rate_cents: number | null;
  buckets: Bucket[];
};

export type ProjectsConfig = {
  schema_version: 1;
  projects: Project[];
};

// Entries
export type RateSource = 'entry_override' | 'project_default' | 'global_default';
export type BillableStatus = 'billable' | 'non_billable' | 'needs_review';

export type Entry = {
  id: string;
  project: string;
  date: string;
  hours_hundredths: number;
  rate_cents: number;
  rate_source: RateSource;
  billable_status: BillableStatus;
  bucket_id: string | null;
  description: string;
  review_flag: boolean;
  created_at: string;
  updated_at: string;
};

export type EntriesFile = {
  schema_version: 1;
  month: string;
  entries: Entry[];
};

// Totals (calc outputs)
export type BucketConsumption = {
  bucket_id: string;
  consumed_hours_hundredths: number;
  budgeted_hours_hundredths: number;
  amount_cents: number;
};

export type ProjectTotals = {
  project: string;
  billable_hours_hundredths: number;
  billable_amount_cents: number;
  non_billable_hours_hundredths: number;
  needs_review_hours_hundredths: number;
  by_bucket: BucketConsumption[];
};

export type MonthTotals = {
  month: string;
  total_hours_hundredths: number;
  billable_hours_hundredths: number;
  non_billable_hours_hundredths: number;
  needs_review_hours_hundredths: number;
  billable_amount_cents: number;
  per_project: ProjectTotals[];
};

// Snapshot
export type Snapshot = {
  schema_version: 1;
  month: string;
  closed_at: string;
  closed_at_commit_sha: string;
  source_hash: string;
  totals: {
    total_hours_hundredths: number;
    billable_hours_hundredths: number;
    non_billable_hours_hundredths: number;
    needs_review_hours_hundredths: number;
    billable_amount_cents: number;
  };
  per_project: ProjectTotals[];
  entry_ids: string[];
};
```

- [ ] **Step 2: Write module README**

File: `src/schema/README.md`

```markdown
# src/schema

**Purpose:** TypeScript types + ajv validators for every JSON file read or written by the app.

**Public API:**
- `types.ts` — in-memory types mirroring every JSON schema
- `validators.ts` — compiled ajv validators (Task 9)

**Invariants:**
1. Types in `types.ts` must match `/schemas/*.json` exactly.
2. Every write must pass through the matching validator (spec §11 guard 1).
3. Schema bumps are a reviewed event (spec §15.5 `adding-a-field.md`).

**Dependencies:** none (pure types + ajv library).
```

- [ ] **Step 3: Update `tsconfig.json` to allow JSON imports of schemas**

The `resolveJsonModule: true` flag is already set, so no changes needed.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/schema/types.ts src/schema/README.md
git commit -m "schema: typescript types mirroring json schemas"
```

---

### Task 9: Write `src/schema/validators.ts` with tests

**Files:**
- Create: `src/schema/validators.ts`
- Create: `tests/schema/validators.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/schema/validators.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  validatePartner,
  validateProfile,
  validateProjects,
  validateRates,
  validateEntries,
  validateSnapshot,
} from '@/schema/validators';

const validPartner = {
  schema_version: 1,
  id: 'test-partner',
  display_name: 'Test Partner',
  currency: 'USD',
  currency_symbol: '$',
  currency_display_suffix: 'USD',
  data_repo_prefix: 'hours-data-test-partner-',
  theme: {
    mode: 'dark', bg_deep: '#000', bg_darker: '#000', accent_cyan: '#fff',
    accent_mid: '#fff', accent_deep: '#fff', text_primary: '#fff', text_muted: '#ccc',
    border_subtle: 'rgba(0,0,0,0)', border_strong: 'rgba(0,0,0,0)',
  },
  fonts: { display: 'sans', body: 'sans', mono: 'mono' },
  assets: { logo: 'logo.png', logo_alt_text: 'Test', favicon: 'f.png' },
  enabled: true,
};

describe('schema validators', () => {
  it('validatePartner accepts a minimal valid partner config', () => {
    expect(validatePartner(validPartner).ok).toBe(true);
  });

  it('validatePartner rejects a partner whose data_repo_prefix is malformed', () => {
    const bad = { ...validPartner, data_repo_prefix: 'wrong-prefix' };
    expect(validatePartner(bad).ok).toBe(false);
  });

  it('validateEntries rejects an entry with hours_hundredths of 0', () => {
    const bad = {
      schema_version: 1, month: '2026-04',
      entries: [{
        id: '2026-04-11-sprosty-abcdef', project: 'sprosty', date: '2026-04-11',
        hours_hundredths: 0, rate_cents: 12500, rate_source: 'global_default',
        billable_status: 'billable', bucket_id: null, description: 'test',
        review_flag: false, created_at: '2026-04-11T00:00:00Z', updated_at: '2026-04-11T00:00:00Z',
      }],
    };
    expect(validateEntries(bad).ok).toBe(false);
  });

  it('validateEntries rejects an entry with hours_hundredths over 2400 (more than 24h/day)', () => {
    const bad = {
      schema_version: 1, month: '2026-04',
      entries: [{
        id: '2026-04-11-sprosty-abcdef', project: 'sprosty', date: '2026-04-11',
        hours_hundredths: 2500, rate_cents: 12500, rate_source: 'global_default',
        billable_status: 'billable', bucket_id: null, description: 'test',
        review_flag: false, created_at: '2026-04-11T00:00:00Z', updated_at: '2026-04-11T00:00:00Z',
      }],
    };
    expect(validateEntries(bad).ok).toBe(false);
  });

  it('validateRates rejects an empty history', () => {
    expect(validateRates({ schema_version: 1, default_rate_history: [] }).ok).toBe(false);
  });

  it('validateProjects rejects a project whose id has spaces', () => {
    const bad = {
      schema_version: 1,
      projects: [{
        id: 'Has Spaces', name: 'Bad', client: null, active: true,
        is_internal: false, default_rate_cents: null, buckets: [],
      }],
    };
    expect(validateProjects(bad).ok).toBe(false);
  });

  it('validateProfile accepts a minimal valid profile', () => {
    expect(validateProfile({
      schema_version: 1, partner_id: 'sector-growth', consultant_id: 'prash',
      display_name: 'Prash', created_at: '2026-04-11T00:00:00Z',
    }).ok).toBe(true);
  });

  it('validateSnapshot accepts a minimal valid snapshot', () => {
    expect(validateSnapshot({
      schema_version: 1, month: '2026-03',
      closed_at: '2026-04-03T10:14:22Z', closed_at_commit_sha: 'a3f9c1b',
      source_hash: 'sha256:' + 'a'.repeat(64),
      totals: { total_hours_hundredths: 0, billable_hours_hundredths: 0,
                non_billable_hours_hundredths: 0, needs_review_hours_hundredths: 0,
                billable_amount_cents: 0 },
      per_project: [], entry_ids: [],
    }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/schema/validators.test.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Write implementation**

File: `src/schema/validators.ts`

```ts
import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

import partnerSchema from '../../schemas/partner.schema.json';
import profileSchema from '../../schemas/profile.schema.json';
import ratesSchema from '../../schemas/rates.schema.json';
import projectsSchema from '../../schemas/projects.schema.json';
import entriesSchema from '../../schemas/entries.schema.json';
import snapshotSchema from '../../schemas/snapshot.schema.json';

import type {
  Partner, Profile, RatesConfig, ProjectsConfig, EntriesFile, Snapshot,
} from './types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const _partner = ajv.compile<Partner>(partnerSchema);
const _profile = ajv.compile<Profile>(profileSchema);
const _rates = ajv.compile<RatesConfig>(ratesSchema);
const _projects = ajv.compile<ProjectsConfig>(projectsSchema);
const _entries = ajv.compile<EntriesFile>(entriesSchema);
const _snapshot = ajv.compile<Snapshot>(snapshotSchema);

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ErrorObject[] };

function wrap<T>(fn: ValidateFunction<T>) {
  return (data: unknown): ValidationResult<T> => {
    if (fn(data)) return { ok: true, value: data };
    return { ok: false, errors: fn.errors ?? [] };
  };
}

export const validatePartner = wrap(_partner);
export const validateProfile = wrap(_profile);
export const validateRates = wrap(_rates);
export const validateProjects = wrap(_projects);
export const validateEntries = wrap(_entries);
export const validateSnapshot = wrap(_snapshot);

export function formatValidationErrors(errors: ErrorObject[]): string {
  return errors
    .map((e) => `  ${e.instancePath || '(root)'} ${e.message ?? ''}`)
    .join('\n');
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/schema/validators.test.ts`

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/schema/validators.ts tests/schema/
git commit -m "schema: ajv validators with tests for every json contract"
```

---

### Task 10: Stub `src/format/format.ts` with currency-aware formatters

**Files:**
- Create: `src/format/format.ts`
- Create: `src/format/README.md`
- Create: `tests/format/format.test.ts`

- [ ] **Step 1: Write test**

File: `tests/format/format.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { formatHours, formatCents, formatHoursDecimal } from '@/format/format';

describe('format', () => {
  it('formatHours renders 25 hundredths as "0.25h"', () => {
    expect(formatHours(25)).toBe('0.25h');
  });

  it('formatHours renders 400 hundredths as "4.00h"', () => {
    expect(formatHours(400)).toBe('4.00h');
  });

  it('formatHoursDecimal renders 25 hundredths as "0.25"', () => {
    expect(formatHoursDecimal(25)).toBe('0.25');
  });

  it('formatCents renders 12500 as "$125.00 CAD" for CAD partner', () => {
    expect(formatCents(12500, { currency_symbol: '$', currency_display_suffix: 'CAD' })).toBe(
      '$125.00 CAD',
    );
  });

  it('formatCents renders 1312500 with thousands separators', () => {
    expect(formatCents(1312500, { currency_symbol: '$', currency_display_suffix: 'CAD' })).toBe(
      '$13,125.00 CAD',
    );
  });

  it('formatCents renders 0 as "$0.00 CAD"', () => {
    expect(formatCents(0, { currency_symbol: '$', currency_display_suffix: 'CAD' })).toBe(
      '$0.00 CAD',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/format/format.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/format/format.ts`

```ts
/**
 * Display formatters at the UI edge.
 *
 * INPUT: integer fields from the data model (_cents, _hundredths).
 * OUTPUT: human-readable strings.
 *
 * Never do integer math here — this is the ONLY place in the app allowed to
 * convert integers to decimal strings for display. The lint rule no-float-money
 * explicitly exempts src/calc/int.ts; this module stays on integer inputs and
 * uses string slicing to render.
 */

export type CurrencyDisplay = {
  currency_symbol: string;
  currency_display_suffix: string;
};

/** Format hundredths of an hour as "N.NNh". */
export function formatHours(hoursHundredths: number): string {
  return `${formatHoursDecimal(hoursHundredths)}h`;
}

/** Format hundredths of an hour as "N.NN" (no suffix). */
export function formatHoursDecimal(hoursHundredths: number): string {
  const whole = Math.trunc(hoursHundredths / 100);
  const frac = hoursHundredths - whole * 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

/** Format cents as "$X,XXX.XX CAD" (or whatever the partner currency is). */
export function formatCents(amountCents: number, currency: CurrencyDisplay): string {
  const whole = Math.trunc(amountCents / 100);
  const frac = amountCents - whole * 100;
  const wholeWithSeparators = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency.currency_symbol}${wholeWithSeparators}.${frac.toString().padStart(2, '0')} ${currency.currency_display_suffix}`.trim();
}
```

- [ ] **Step 4: Write README**

File: `src/format/README.md`

```markdown
# src/format

**Purpose:** Display-edge conversion from integer fields (_cents, _hundredths) to human-readable strings.

**Public API:**
- `formatHours(hoursHundredths) → "4.25h"`
- `formatHoursDecimal(hoursHundredths) → "4.25"`
- `formatCents(cents, currencyDisplay) → "$125.00 CAD"`

**Invariants:**
1. Inputs are integers. Outputs are strings.
2. No floating-point arithmetic. String slicing only.
3. Currency settings come from `Partner.currency_symbol` + `currency_display_suffix` (spec §5.1).
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/format/format.test.ts`

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/format/ tests/format/
git commit -m "format: currency-aware display formatters with tests"
```

---

## PHASE 3 — Calc module (the most scrutinized code)

Spec §7. Pure, side-effect-free, I/O-free. Every function takes plain data, returns plain data. Integer math only.

**At the end of Phase 3, Gate A runs.** See Task 18 for the multi-agent review procedure.

### Task 11: `src/calc/int.ts` — integer math helpers

**Files:**
- Create: `src/calc/int.ts`
- Create: `src/calc/README.md`
- Create: `tests/calc/int.test.ts`

- [ ] **Step 1: Write failing tests**

File: `tests/calc/int.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  addCents, subCents, sumCents,
  addHundredths, sumHundredths,
  mulCentsByHundredths,
  assertInteger, assertNonNegativeInteger,
} from '@/calc/int';

describe('int helpers — cents', () => {
  it('addCents sums two positive integers', () => {
    expect(addCents(100, 250)).toBe(350);
  });

  it('addCents throws on a non-integer input', () => {
    expect(() => addCents(100.5, 0)).toThrow();
  });

  it('subCents returns a positive difference', () => {
    expect(subCents(500, 200)).toBe(300);
  });

  it('subCents allows a negative result (e.g., refund math)', () => {
    expect(subCents(100, 500)).toBe(-400);
  });

  it('sumCents sums an array of cent values exactly', () => {
    expect(sumCents([100, 200, 300, 50])).toBe(650);
  });

  it('sumCents returns 0 for an empty array', () => {
    expect(sumCents([])).toBe(0);
  });
});

describe('int helpers — hundredths', () => {
  it('addHundredths sums two values', () => {
    expect(addHundredths(25, 75)).toBe(100);
  });

  it('sumHundredths sums an array', () => {
    expect(sumHundredths([25, 50, 75, 100])).toBe(250);
  });
});

describe('int helpers — rate × hours', () => {
  it('mulCentsByHundredths computes exact amount: 12500c × 400h-hundredths = 50000c', () => {
    // $125/hr * 4h = $500 = 50000 cents.
    // rate_cents (per hour) * hours_hundredths / 100 = amount_cents
    expect(mulCentsByHundredths(12500, 400)).toBe(50000);
  });

  it('mulCentsByHundredths handles fractional hours: 12500c × 25h-hundredths = 3125c', () => {
    // $125/hr * 0.25h = $31.25 = 3125 cents.
    expect(mulCentsByHundredths(12500, 25)).toBe(3125);
  });

  it('mulCentsByHundredths throws if the result would not be an integer (rate * hours / 100 has remainder)', () => {
    // $1.01/hr × 0.01h = 0.0101 cents — truly non-integer. Reject.
    // rate_cents = 101, hours_hundredths = 1  →  101 * 1 / 100 = 1.01 (non-integer).
    expect(() => mulCentsByHundredths(101, 1)).toThrow();
  });

  it('mulCentsByHundredths returns 0 when hours is 0', () => {
    expect(mulCentsByHundredths(12500, 0)).toBe(0);
  });
});

describe('int helpers — assertions', () => {
  it('assertInteger passes integers', () => {
    expect(() => assertInteger(5)).not.toThrow();
    expect(() => assertInteger(0)).not.toThrow();
    expect(() => assertInteger(-3)).not.toThrow();
  });

  it('assertInteger throws on non-integer', () => {
    expect(() => assertInteger(1.5)).toThrow();
  });

  it('assertInteger throws on NaN', () => {
    expect(() => assertInteger(NaN)).toThrow();
  });

  it('assertNonNegativeInteger rejects negative', () => {
    expect(() => assertNonNegativeInteger(-1)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/calc/int.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/calc/int.ts`

```ts
/**
 * Integer-only arithmetic helpers for money (cents) and hours (hundredths).
 *
 * This is the ONLY file in src/ where raw arithmetic on _cents/_hundredths
 * fields is permitted (enforced by eslint-rules/no-float-money.cjs). Every
 * other module must call through this one.
 *
 * All functions assert their inputs are integers; any non-integer throws
 * immediately with a descriptive error. This catches a whole class of drift
 * bugs at the boundary instead of letting them propagate.
 */

export function assertInteger(n: number): void {
  if (!Number.isInteger(n)) {
    throw new Error(`int assertion failed: expected integer, got ${n}`);
  }
}

export function assertNonNegativeInteger(n: number): void {
  assertInteger(n);
  if (n < 0) {
    throw new Error(`int assertion failed: expected non-negative integer, got ${n}`);
  }
}

// ─── Cents ───

export function addCents(a: number, b: number): number {
  assertInteger(a);
  assertInteger(b);
  return a + b;
}

export function subCents(a: number, b: number): number {
  assertInteger(a);
  assertInteger(b);
  return a - b;
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertInteger(v);
    total += v;
  }
  return total;
}

// ─── Hundredths (of an hour) ───

export function addHundredths(a: number, b: number): number {
  assertNonNegativeInteger(a);
  assertNonNegativeInteger(b);
  return a + b;
}

export function sumHundredths(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertNonNegativeInteger(v);
    total += v;
  }
  return total;
}

// ─── Rate × Hours ───

/**
 * Compute amount_cents from rate_cents (per hour) × hours_hundredths.
 *
 * Math: amount_cents = rate_cents * hours_hundredths / 100.
 *
 * We insist the result be an exact integer. If `rate_cents * hours_hundredths`
 * is not divisible by 100, we throw — this would mean the billing amount has
 * sub-cent precision, which we refuse to silently round. The caller must pick
 * a rate that divides cleanly or explicitly round upstream.
 *
 * Examples:
 *   $125.00/h * 4.00h  →  12500 * 400 / 100 = 50000 cents  ✓
 *   $125.00/h * 0.25h  →  12500 * 25 / 100 = 3125 cents    ✓
 *   $1.01/h  * 0.01h   →  101 * 1 / 100 = 1.01             ✗ throws
 */
export function mulCentsByHundredths(rateCents: number, hoursHundredths: number): number {
  assertNonNegativeInteger(rateCents);
  assertNonNegativeInteger(hoursHundredths);
  const product = rateCents * hoursHundredths;
  if (product % 100 !== 0) {
    throw new Error(
      `mulCentsByHundredths produced non-integer cents: rate=${rateCents}, hours=${hoursHundredths}, product=${product}`,
    );
  }
  return product / 100;
}
```

- [ ] **Step 4: Write module README**

File: `src/calc/README.md`

```markdown
# src/calc

**Purpose:** All billing math for the hours tracker. Pure, side-effect-free, I/O-free.

**Public API:**
- `int.ts` — integer math helpers: `addCents`, `subCents`, `sumCents`, `addHundredths`, `sumHundredths`, `mulCentsByHundredths`, `assertInteger`, `assertNonNegativeInteger`.
- `rates.ts` — `resolveRateAtLogTime(projectId, date, projects, rates) → { rate_cents, source }`
- `totals.ts` — `computeMonthTotals(input, month)`, `computeProjectTotals(...)`, `computeBucketConsumption(...)`
- `hash.ts` — `canonicalizeEntriesForHashing`, `hashEntries`
- `index.ts` — public re-exports

**Invariants (spec §7):**
1. No DOM access, no fetch, no fs, no Octokit imports — purity is enforced by `eslint-no-restricted-imports` in calc/.
2. All arithmetic on _cents/_hundredths fields routes through `int.ts`.
3. Conservation: billable + non_billable + needs_review = total (Property test layer 2).
4. Rate snapshotting: changing rates never changes past totals.
5. Hash determinism: identical inputs produce identical hashes.

**Dependencies:**
- `@/schema/types` only.
- Crypto hashing uses `crypto.subtle` (browser native) — no npm lib.
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/calc/int.test.ts`

Expected: all int tests pass.

- [ ] **Step 6: Run lint to prove the custom rule is active**

Run: `npm run lint`

Expected: exit 0. (The rule exempts `src/calc/int.ts`; every other file has no integer-field math yet.)

- [ ] **Step 7: Commit**

```bash
git add src/calc/int.ts src/calc/README.md tests/calc/int.test.ts
git commit -m "calc: integer math helpers with assertion-first tests"
```

---

### Task 12: `src/calc/rates.ts` — `resolveRateAtLogTime`

**Files:**
- Create: `src/calc/rates.ts`
- Create: `tests/calc/rates.test.ts`

- [ ] **Step 1: Write failing tests**

File: `tests/calc/rates.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { resolveRateAtLogTime } from '@/calc/rates';
import type { ProjectsConfig, RatesConfig } from '@/schema/types';

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    {
      id: 'sprosty',
      name: 'Sprosty',
      client: null,
      active: true,
      is_internal: false,
      default_rate_cents: 12500,
      buckets: [
        {
          id: 'sprosty-skyvia-dev',
          type: 'dev',
          name: 'Skyvia Dev',
          budgeted_hours_hundredths: 2000,
          rate_cents: 2000,
          status: 'active',
          opened_at: '2026-03-25',
          closed_at: null,
          notes: '',
        },
      ],
    },
    {
      id: 'bayard',
      name: 'Bayard',
      client: null,
      active: true,
      is_internal: false,
      default_rate_cents: null,
      buckets: [],
    },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [
    { effective_from: '2026-01-01', rate_cents: 10000 },
    { effective_from: '2026-04-11', rate_cents: 12500 },
  ],
};

describe('resolveRateAtLogTime', () => {
  it('returns the bucket rate when a bucket_id is provided and the bucket has a rate override', () => {
    const result = resolveRateAtLogTime({
      project_id: 'sprosty',
      bucket_id: 'sprosty-skyvia-dev',
      date: '2026-04-11',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 2000, source: 'entry_override' });
  });

  it('returns the project default when bucket_id is null and project has a default', () => {
    const result = resolveRateAtLogTime({
      project_id: 'sprosty',
      bucket_id: null,
      date: '2026-04-11',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 12500, source: 'project_default' });
  });

  it('returns the global default when project has no default_rate_cents', () => {
    const result = resolveRateAtLogTime({
      project_id: 'bayard',
      bucket_id: null,
      date: '2026-04-11',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 12500, source: 'global_default' });
  });

  it('returns the historical global rate when the entry date predates the current rate', () => {
    const result = resolveRateAtLogTime({
      project_id: 'bayard',
      bucket_id: null,
      date: '2026-02-15',
      projects,
      rates,
    });
    expect(result).toEqual({ rate_cents: 10000, source: 'global_default' });
  });

  it('throws when the project is not found', () => {
    expect(() =>
      resolveRateAtLogTime({
        project_id: 'nonexistent',
        bucket_id: null,
        date: '2026-04-11',
        projects,
        rates,
      }),
    ).toThrow();
  });

  it('throws when the bucket is not found in the named project', () => {
    expect(() =>
      resolveRateAtLogTime({
        project_id: 'sprosty',
        bucket_id: 'nonexistent-bucket',
        date: '2026-04-11',
        projects,
        rates,
      }),
    ).toThrow();
  });

  it('throws when the date predates every entry in rate history', () => {
    expect(() =>
      resolveRateAtLogTime({
        project_id: 'bayard',
        bucket_id: null,
        date: '2025-12-31',
        projects,
        rates,
      }),
    ).toThrow();
  });

  it('falls back to project default when bucket has rate_cents=null (inherit)', () => {
    const projectsInherit: ProjectsConfig = {
      schema_version: 1,
      projects: [
        {
          id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false,
          default_rate_cents: 12500,
          buckets: [{
            id: 'sprosty-block', type: 'hour_block', name: 'Block',
            budgeted_hours_hundredths: 1000, rate_cents: null,
            status: 'active', opened_at: '2026-04-01', closed_at: null, notes: '',
          }],
        },
      ],
    };
    const result = resolveRateAtLogTime({
      project_id: 'sprosty',
      bucket_id: 'sprosty-block',
      date: '2026-04-11',
      projects: projectsInherit,
      rates,
    });
    expect(result).toEqual({ rate_cents: 12500, source: 'project_default' });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/calc/rates.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/calc/rates.ts`

```ts
import type { ProjectsConfig, RatesConfig, RateSource } from '@/schema/types';

export type ResolveRateArgs = {
  project_id: string;
  bucket_id: string | null;
  date: string; // YYYY-MM-DD
  projects: ProjectsConfig;
  rates: RatesConfig;
};

export type ResolvedRate = {
  rate_cents: number;
  source: RateSource;
};

/**
 * Resolve the effective rate for an entry at log time.
 *
 * Priority (spec §3 decision 4):
 *   1. Bucket override (`bucket.rate_cents` if set)       → `entry_override`
 *   2. Project default (`project.default_rate_cents`)    → `project_default`
 *   3. Global default valid at the entry's date          → `global_default`
 *
 * Throws on missing project, missing bucket, or unresolvable global rate.
 * Never returns a default value silently; bad input is a bug, not a soft failure.
 */
export function resolveRateAtLogTime(args: ResolveRateArgs): ResolvedRate {
  const { project_id, bucket_id, date, projects, rates } = args;

  const project = projects.projects.find((p) => p.id === project_id);
  if (!project) {
    throw new Error(`resolveRateAtLogTime: project "${project_id}" not found`);
  }

  if (bucket_id !== null) {
    const bucket = project.buckets.find((b) => b.id === bucket_id);
    if (!bucket) {
      throw new Error(
        `resolveRateAtLogTime: bucket "${bucket_id}" not found in project "${project_id}"`,
      );
    }
    if (bucket.rate_cents !== null) {
      return { rate_cents: bucket.rate_cents, source: 'entry_override' };
    }
    // Fall through to project/global lookup.
  }

  if (project.default_rate_cents !== null) {
    return { rate_cents: project.default_rate_cents, source: 'project_default' };
  }

  return { rate_cents: resolveGlobalRate(date, rates), source: 'global_default' };
}

/**
 * Walk rate history in descending order of effective_from; return the rate
 * of the first entry whose effective_from <= target date. Throws if no entry
 * covers the date.
 */
function resolveGlobalRate(date: string, rates: RatesConfig): number {
  // Sort a copy descending. History is expected to be small (~10 entries).
  const history = [...rates.default_rate_history].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  for (const h of history) {
    if (h.effective_from <= date) return h.rate_cents;
  }
  throw new Error(
    `resolveRateAtLogTime: no global rate valid at date ${date}. Earliest rate is ${history[history.length - 1]?.effective_from ?? '(none)'}.`,
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/calc/rates.test.ts`

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/calc/rates.ts tests/calc/rates.test.ts
git commit -m "calc: resolveRateAtLogTime with bucket/project/global fallback"
```

---

### Task 13: `src/calc/totals.ts` — `computeMonthTotals`

**Files:**
- Create: `src/calc/totals.ts`
- Create: `tests/calc/totals.test.ts`

- [ ] **Step 1: Write failing tests**

File: `tests/calc/totals.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computeMonthTotals } from '@/calc/totals';
import type { Entry, ProjectsConfig, RatesConfig } from '@/schema/types';

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    {
      id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false,
      default_rate_cents: null,
      buckets: [{
        id: 'sprosty-skyvia-dev', type: 'dev', name: 'Skyvia Dev',
        budgeted_hours_hundredths: 2000, rate_cents: 2000, status: 'active',
        opened_at: '2026-03-01', closed_at: null, notes: '',
      }],
    },
    {
      id: 'internal', name: 'Internal', client: null, active: true, is_internal: true,
      default_rate_cents: null, buckets: [],
    },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

function entry(partial: Partial<Entry> & { id: string; project: string; date: string; hours_hundredths: number; rate_cents: number; billable_status: Entry['billable_status'] }): Entry {
  return {
    rate_source: 'global_default',
    bucket_id: null,
    description: 'x',
    review_flag: false,
    created_at: '2026-03-25T00:00:00Z',
    updated_at: '2026-03-25T00:00:00Z',
    ...partial,
  };
}

describe('computeMonthTotals', () => {
  it('returns zero totals for a month with no entries', () => {
    const result = computeMonthTotals({ entries: [], projects, rates }, '2026-03');
    expect(result).toEqual({
      month: '2026-03',
      total_hours_hundredths: 0,
      billable_hours_hundredths: 0,
      non_billable_hours_hundredths: 0,
      needs_review_hours_hundredths: 0,
      billable_amount_cents: 0,
      per_project: [],
    });
  });

  it('sums a single billable entry into billable + total and computes the amount', () => {
    const entries: Entry[] = [
      entry({
        id: '2026-03-25-sprosty-aaaaaa', project: 'sprosty', date: '2026-03-25',
        hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable',
      }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe(400);
    expect(result.billable_hours_hundredths).toBe(400);
    expect(result.non_billable_hours_hundredths).toBe(0);
    expect(result.needs_review_hours_hundredths).toBe(0);
    expect(result.billable_amount_cents).toBe(50000); // $500
  });

  it('segregates non_billable and needs_review hours out of billable total', () => {
    const entries: Entry[] = [
      entry({ id: '2026-03-01-internal-aaaaaa', project: 'internal', date: '2026-03-01',
              hours_hundredths: 100, rate_cents: 0, billable_status: 'non_billable' }),
      entry({ id: '2026-03-02-sprosty-bbbbbb', project: 'sprosty', date: '2026-03-02',
              hours_hundredths: 200, rate_cents: 12500, billable_status: 'needs_review' }),
      entry({ id: '2026-03-03-sprosty-cccccc', project: 'sprosty', date: '2026-03-03',
              hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable' }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe(700);
    expect(result.billable_hours_hundredths).toBe(400);
    expect(result.non_billable_hours_hundredths).toBe(100);
    expect(result.needs_review_hours_hundredths).toBe(200);
    expect(result.billable_amount_cents).toBe(50000);
  });

  it('aggregates per-project breakdown with each project in its own row', () => {
    const entries: Entry[] = [
      entry({ id: '2026-03-01-sprosty-aaaaaa', project: 'sprosty', date: '2026-03-01',
              hours_hundredths: 400, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-03-01-internal-bbbbbb', project: 'internal', date: '2026-03-01',
              hours_hundredths: 100, rate_cents: 0, billable_status: 'non_billable' }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.per_project).toHaveLength(2);
    const sprosty = result.per_project.find((p) => p.project === 'sprosty');
    expect(sprosty?.billable_hours_hundredths).toBe(400);
    expect(sprosty?.billable_amount_cents).toBe(50000);
    const internal = result.per_project.find((p) => p.project === 'internal');
    expect(internal?.non_billable_hours_hundredths).toBe(100);
  });

  it('aggregates bucket consumption under per_project.by_bucket', () => {
    const entries: Entry[] = [
      entry({ id: '2026-03-01-sprosty-aaaaaa', project: 'sprosty', date: '2026-03-01',
              hours_hundredths: 400, rate_cents: 2000, bucket_id: 'sprosty-skyvia-dev',
              billable_status: 'billable' }),
      entry({ id: '2026-03-02-sprosty-bbbbbb', project: 'sprosty', date: '2026-03-02',
              hours_hundredths: 200, rate_cents: 2000, bucket_id: 'sprosty-skyvia-dev',
              billable_status: 'billable' }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    const sprosty = result.per_project.find((p) => p.project === 'sprosty');
    expect(sprosty?.by_bucket).toHaveLength(1);
    expect(sprosty?.by_bucket[0]).toEqual({
      bucket_id: 'sprosty-skyvia-dev',
      consumed_hours_hundredths: 600,
      budgeted_hours_hundredths: 2000,
      amount_cents: 12000, // $20 × 6h = $120
    });
  });

  it('excludes entries that fall outside the requested month', () => {
    const entries: Entry[] = [
      entry({ id: '2026-02-28-sprosty-aaaaaa', project: 'sprosty', date: '2026-02-28',
              hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-03-01-sprosty-bbbbbb', project: 'sprosty', date: '2026-03-01',
              hours_hundredths: 200, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-04-01-sprosty-cccccc', project: 'sprosty', date: '2026-04-01',
              hours_hundredths: 300, rate_cents: 12500, billable_status: 'billable' }),
    ];
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe(200);
  });

  it('preserves the conservation invariant (billable + non_billable + needs_review === total)', () => {
    const entries: Entry[] = [
      entry({ id: '2026-03-01-a-aaaaaa', project: 'sprosty', date: '2026-03-01',
              hours_hundredths: 100, rate_cents: 12500, billable_status: 'billable' }),
      entry({ id: '2026-03-02-b-bbbbbb', project: 'internal', date: '2026-03-02',
              hours_hundredths: 200, rate_cents: 0, billable_status: 'non_billable' }),
      entry({ id: '2026-03-03-c-cccccc', project: 'sprosty', date: '2026-03-03',
              hours_hundredths: 300, rate_cents: 12500, billable_status: 'needs_review' }),
    ];
    const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
    expect(r.billable_hours_hundredths + r.non_billable_hours_hundredths + r.needs_review_hours_hundredths).toBe(r.total_hours_hundredths);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/calc/totals.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/calc/totals.ts`

```ts
import type {
  Entry,
  MonthTotals,
  ProjectsConfig,
  ProjectTotals,
  RatesConfig,
  BucketConsumption,
} from '@/schema/types';
import {
  sumCents,
  sumHundredths,
  mulCentsByHundredths,
  addCents,
  addHundredths,
} from './int';

export type CalcInput = {
  entries: readonly Entry[];
  projects: ProjectsConfig;
  rates: RatesConfig;
};

/**
 * Compute the full monthly totals for a given `month` (YYYY-MM).
 *
 * Entries are filtered by date prefix — dates outside the month are excluded.
 * Rate on each entry is used as-is (snapshotted at log time; spec §3 row 4).
 * The `rates` config is unused by the compute itself and included in the
 * input shape only so property tests can verify rate snapshot immutability.
 */
export function computeMonthTotals(input: CalcInput, month: string): MonthTotals {
  const { entries, projects } = input;
  const scoped = entries.filter((e) => e.date.startsWith(month));

  let billableHours = 0;
  let nonBillableHours = 0;
  let needsReviewHours = 0;
  let billableAmount = 0;

  const byProjectMap = new Map<string, {
    billable_hours: number;
    billable_amount: number;
    non_billable_hours: number;
    needs_review_hours: number;
    buckets: Map<string, number>; // bucket_id → consumed_hours_hundredths
    bucketAmounts: Map<string, number>; // bucket_id → amount_cents
  }>();

  for (const e of scoped) {
    if (!byProjectMap.has(e.project)) {
      byProjectMap.set(e.project, {
        billable_hours: 0,
        billable_amount: 0,
        non_billable_hours: 0,
        needs_review_hours: 0,
        buckets: new Map(),
        bucketAmounts: new Map(),
      });
    }
    const bucket = byProjectMap.get(e.project)!;

    switch (e.billable_status) {
      case 'billable': {
        const amount = mulCentsByHundredths(e.rate_cents, e.hours_hundredths);
        billableHours = addHundredths(billableHours, e.hours_hundredths);
        billableAmount = addCents(billableAmount, amount);
        bucket.billable_hours = addHundredths(bucket.billable_hours, e.hours_hundredths);
        bucket.billable_amount = addCents(bucket.billable_amount, amount);
        if (e.bucket_id !== null) {
          const prevHours = bucket.buckets.get(e.bucket_id) ?? 0;
          const prevAmount = bucket.bucketAmounts.get(e.bucket_id) ?? 0;
          bucket.buckets.set(e.bucket_id, addHundredths(prevHours, e.hours_hundredths));
          bucket.bucketAmounts.set(e.bucket_id, addCents(prevAmount, amount));
        }
        break;
      }
      case 'non_billable':
        nonBillableHours = addHundredths(nonBillableHours, e.hours_hundredths);
        bucket.non_billable_hours = addHundredths(bucket.non_billable_hours, e.hours_hundredths);
        break;
      case 'needs_review':
        needsReviewHours = addHundredths(needsReviewHours, e.hours_hundredths);
        bucket.needs_review_hours = addHundredths(bucket.needs_review_hours, e.hours_hundredths);
        break;
    }
  }

  const per_project: ProjectTotals[] = [];
  for (const [projectId, data] of byProjectMap.entries()) {
    const project = projects.projects.find((p) => p.id === projectId);
    const byBucket: BucketConsumption[] = [];
    for (const [bucketId, consumed] of data.buckets.entries()) {
      const bucketDef = project?.buckets.find((b) => b.id === bucketId);
      byBucket.push({
        bucket_id: bucketId,
        consumed_hours_hundredths: consumed,
        budgeted_hours_hundredths: bucketDef?.budgeted_hours_hundredths ?? 0,
        amount_cents: data.bucketAmounts.get(bucketId) ?? 0,
      });
    }
    per_project.push({
      project: projectId,
      billable_hours_hundredths: data.billable_hours,
      billable_amount_cents: data.billable_amount,
      non_billable_hours_hundredths: data.non_billable_hours,
      needs_review_hours_hundredths: data.needs_review_hours,
      by_bucket: byBucket,
    });
  }

  const totalHours = sumHundredths([billableHours, nonBillableHours, needsReviewHours]);

  // Redundant cross-check: sum per_project breakdown and verify it equals
  // the top-level billable amount. This is spec §7.2 layer 5 applied in
  // calc itself (cheap, deterministic).
  const crossCheckBillable = sumCents(per_project.map((p) => p.billable_amount_cents));
  if (crossCheckBillable !== billableAmount) {
    throw new Error(
      `computeMonthTotals invariant violation: per-project billable (${crossCheckBillable}) !== top-level billable (${billableAmount})`,
    );
  }

  return {
    month,
    total_hours_hundredths: totalHours,
    billable_hours_hundredths: billableHours,
    non_billable_hours_hundredths: nonBillableHours,
    needs_review_hours_hundredths: needsReviewHours,
    billable_amount_cents: billableAmount,
    per_project,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/calc/totals.test.ts`

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/calc/totals.ts tests/calc/totals.test.ts
git commit -m "calc: computeMonthTotals with conservation cross-check invariant"
```

---

### Task 14: `src/calc/hash.ts` — canonicalization and SHA-256

**Files:**
- Create: `src/calc/hash.ts`
- Create: `tests/calc/hash.test.ts`

- [ ] **Step 1: Write failing tests**

File: `tests/calc/hash.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { canonicalizeEntriesForHashing, hashEntries } from '@/calc/hash';
import type { Entry } from '@/schema/types';

const baseEntry: Entry = {
  id: '2026-03-25-sprosty-aaaaaa',
  project: 'sprosty',
  date: '2026-03-25',
  hours_hundredths: 400,
  rate_cents: 12500,
  rate_source: 'global_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'test',
  review_flag: false,
  created_at: '2026-03-25T22:15:04Z',
  updated_at: '2026-03-25T22:15:04Z',
};

describe('hash', () => {
  it('canonicalizeEntriesForHashing is stable across key-order differences', () => {
    const a = [baseEntry];
    // A re-ordered clone with same content but arbitrary key order.
    const b = [{
      updated_at: baseEntry.updated_at,
      created_at: baseEntry.created_at,
      review_flag: baseEntry.review_flag,
      description: baseEntry.description,
      bucket_id: baseEntry.bucket_id,
      billable_status: baseEntry.billable_status,
      rate_source: baseEntry.rate_source,
      rate_cents: baseEntry.rate_cents,
      hours_hundredths: baseEntry.hours_hundredths,
      date: baseEntry.date,
      project: baseEntry.project,
      id: baseEntry.id,
    }];
    expect(canonicalizeEntriesForHashing(a)).toBe(canonicalizeEntriesForHashing(b as unknown as Entry[]));
  });

  it('canonicalizeEntriesForHashing sorts entries by id for deterministic output', () => {
    const a: Entry[] = [
      { ...baseEntry, id: '2026-03-25-sprosty-bbbbbb' },
      { ...baseEntry, id: '2026-03-25-sprosty-aaaaaa' },
    ];
    const b: Entry[] = [
      { ...baseEntry, id: '2026-03-25-sprosty-aaaaaa' },
      { ...baseEntry, id: '2026-03-25-sprosty-bbbbbb' },
    ];
    expect(canonicalizeEntriesForHashing(a)).toBe(canonicalizeEntriesForHashing(b));
  });

  it('hashEntries returns a sha256-prefixed 64-char hex string', async () => {
    const h = await hashEntries([baseEntry]);
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('hashEntries is deterministic across repeated calls', async () => {
    const h1 = await hashEntries([baseEntry]);
    const h2 = await hashEntries([baseEntry]);
    expect(h1).toBe(h2);
  });

  it('hashEntries produces different hashes for different content', async () => {
    const h1 = await hashEntries([baseEntry]);
    const h2 = await hashEntries([{ ...baseEntry, description: 'different' }]);
    expect(h1).not.toBe(h2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/calc/hash.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/calc/hash.ts`

```ts
import type { Entry } from '@/schema/types';

/**
 * Canonicalize a list of entries into a deterministic JSON string suitable
 * for hashing. The output is independent of:
 *   - Key order within any entry object
 *   - Entry array order (we sort by `id`)
 *
 * This gives us a stable "snapshot source hash" (spec §5.6) that only changes
 * when the semantic content of the entries changes.
 */
export function canonicalizeEntriesForHashing(entries: readonly Entry[]): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted.map(canonicalizeEntry));
}

function canonicalizeEntry(e: Entry): Record<string, unknown> {
  // Emit keys in fixed order. Any future field addition must be appended here
  // and will change existing hashes — intentional, since new fields can affect
  // billing output.
  return {
    id: e.id,
    project: e.project,
    date: e.date,
    hours_hundredths: e.hours_hundredths,
    rate_cents: e.rate_cents,
    rate_source: e.rate_source,
    billable_status: e.billable_status,
    bucket_id: e.bucket_id,
    description: e.description,
    review_flag: e.review_flag,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

/**
 * Compute SHA-256 of the canonicalized entries, returning the string
 * `sha256:<hex>`. Uses the browser's crypto.subtle API (available in all
 * modern browsers and Node 18+).
 */
export async function hashEntries(entries: readonly Entry[]): Promise<string> {
  const canonical = canonicalizeEntriesForHashing(entries);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/calc/hash.test.ts`

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/calc/hash.ts tests/calc/hash.test.ts
git commit -m "calc: canonicalize + sha256 hash for snapshot drift detection"
```

---

### Task 15: `src/calc/index.ts` — public barrel

**Files:**
- Create: `src/calc/index.ts`

- [ ] **Step 1: Write barrel**

File: `src/calc/index.ts`

```ts
// Public re-exports for src/calc. Consumers should import from '@/calc' only.
export {
  addCents, subCents, sumCents,
  addHundredths, sumHundredths,
  mulCentsByHundredths,
  assertInteger, assertNonNegativeInteger,
} from './int';
export { resolveRateAtLogTime, type ResolvedRate, type ResolveRateArgs } from './rates';
export { computeMonthTotals, type CalcInput } from './totals';
export { canonicalizeEntriesForHashing, hashEntries } from './hash';
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/calc/index.ts
git commit -m "calc: public barrel re-exporting all calc primitives"
```

---

### Task 16: Property-based tests — `tests/calc/property.test.ts`

**Files:**
- Create: `tests/calc/property.test.ts`

- [ ] **Step 1: Write the property tests**

File: `tests/calc/property.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeMonthTotals, hashEntries } from '@/calc';
import type { Entry, ProjectsConfig, RatesConfig } from '@/schema/types';

// Arbitraries -----------------------------------------------------------
const billableArb: fc.Arbitrary<Entry['billable_status']> = fc.constantFrom(
  'billable', 'non_billable', 'needs_review',
);

const entryArb = (month: string): fc.Arbitrary<Entry> =>
  fc.record({
    id: fc.uuid().map((u) => `${month}-01-sprosty-${u.slice(0, 6)}`),
    project: fc.constantFrom('sprosty', 'internal'),
    date: fc.constant(`${month}-15`),
    hours_hundredths: fc.integer({ min: 1, max: 2400 }),
    rate_cents: fc.integer({ min: 100, max: 50000 }).filter((n) => n % 100 === 0),
    rate_source: fc.constant<Entry['rate_source']>('global_default'),
    billable_status: billableArb,
    bucket_id: fc.constant(null),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    review_flag: fc.boolean(),
    created_at: fc.constant('2026-03-01T00:00:00Z'),
    updated_at: fc.constant('2026-03-01T00:00:00Z'),
  });

const projects: ProjectsConfig = {
  schema_version: 1,
  projects: [
    { id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false,
      default_rate_cents: null, buckets: [] },
    { id: 'internal', name: 'Internal', client: null, active: true, is_internal: true,
      default_rate_cents: null, buckets: [] },
  ],
};

const rates: RatesConfig = {
  schema_version: 1,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

describe('calc invariants (property tests)', () => {
  it('Conservation: billable + non_billable + needs_review === total for any input', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
        return r.billable_hours_hundredths
             + r.non_billable_hours_hundredths
             + r.needs_review_hours_hundredths === r.total_hours_hundredths;
      }),
    );
  });

  it('Additivity: sum(per_project billable) === global billable for any project partition', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 50 }), (entries) => {
        const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
        const sum = r.per_project.reduce((acc, p) => acc + p.billable_amount_cents, 0);
        return sum === r.billable_amount_cents;
      }),
    );
  });

  it('Month-scoping: entries outside the month do not contribute to totals', () => {
    fc.assert(
      fc.property(fc.array(entryArb('2026-02'), { minLength: 1, maxLength: 10 }), (entries) => {
        const r = computeMonthTotals({ entries, projects, rates }, '2026-03');
        return r.total_hours_hundredths === 0;
      }),
    );
  });

  it('Monotonicity under insertion: adding a billable entry never decreases billable_amount', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 20 }),
        entryArb('2026-03'),
        (entries, extra) => {
          const billableExtra = { ...extra, billable_status: 'billable' as const };
          const before = computeMonthTotals({ entries, projects, rates }, '2026-03').billable_amount_cents;
          const after = computeMonthTotals({ entries: [...entries, billableExtra], projects, rates }, '2026-03').billable_amount_cents;
          return after >= before;
        },
      ),
    );
  });

  it('Hash determinism: hashEntries(X) === hashEntries(X) always', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(entryArb('2026-03'), { minLength: 0, maxLength: 20 }), async (entries) => {
        const h1 = await hashEntries(entries);
        const h2 = await hashEntries(entries);
        return h1 === h2;
      }),
    );
  });

  it('Hash key-order invariance: shuffled entry array produces the same hash', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(entryArb('2026-03'), { minLength: 1, maxLength: 20 }), async (entries) => {
        const shuffled = [...entries].reverse();
        const h1 = await hashEntries(entries);
        const h2 = await hashEntries(shuffled);
        return h1 === h2;
      }),
    );
  });
});
```

- [ ] **Step 2: Run property tests**

Run: `npm test -- tests/calc/property.test.ts`

Expected: all 6 properties pass (fast-check runs 100 samples per property by default).

- [ ] **Step 3: Commit**

```bash
git add tests/calc/property.test.ts
git commit -m "calc: property-based tests for §7.2 invariants (conservation, additivity, scoping, monotonicity, hash)"
```

---

### Task 17: Stub golden file for March 2026

The actual golden file is generated by the March import script in Task 45, but we want a minimal hand-crafted golden fixture NOW so the calc module has a real-data regression test at Gate A.

**Files:**
- Create: `tests/fixtures/2026-03-mini-golden.json`
- Create: `tests/fixtures/2026-03-mini-expected.json`
- Create: `tests/calc/golden-mini.test.ts`

- [ ] **Step 1: Write mini golden (5 representative entries)**

File: `tests/fixtures/2026-03-mini-golden.json`

```json
{
  "entries": {
    "schema_version": 1,
    "month": "2026-03",
    "entries": [
      {
        "id": "2026-03-25-sprosty-aaaaaa",
        "project": "sprosty",
        "date": "2026-03-25",
        "hours_hundredths": 400,
        "rate_cents": 2000,
        "rate_source": "entry_override",
        "billable_status": "billable",
        "bucket_id": null,
        "description": "skyvia HS + companies configs",
        "review_flag": false,
        "created_at": "2026-04-11T00:00:00Z",
        "updated_at": "2026-04-11T00:00:00Z"
      },
      {
        "id": "2026-03-01-internal-bbbbbb",
        "project": "internal",
        "date": "2026-03-01",
        "hours_hundredths": 100,
        "rate_cents": 0,
        "rate_source": "global_default",
        "billable_status": "non_billable",
        "bucket_id": null,
        "description": "Monthly planning",
        "review_flag": false,
        "created_at": "2026-04-11T00:00:00Z",
        "updated_at": "2026-04-11T00:00:00Z"
      },
      {
        "id": "2026-03-03-axiom-cccccc",
        "project": "axiom",
        "date": "2026-03-03",
        "hours_hundredths": 50,
        "rate_cents": 12500,
        "rate_source": "global_default",
        "billable_status": "needs_review",
        "bucket_id": null,
        "description": "prep for call, and call itself",
        "review_flag": true,
        "created_at": "2026-04-11T00:00:00Z",
        "updated_at": "2026-04-11T00:00:00Z"
      },
      {
        "id": "2026-03-04-bayard-dddddd",
        "project": "bayard",
        "date": "2026-03-04",
        "hours_hundredths": 100,
        "rate_cents": 12500,
        "rate_source": "global_default",
        "billable_status": "billable",
        "bucket_id": null,
        "description": "kick off call + prep",
        "review_flag": false,
        "created_at": "2026-04-11T00:00:00Z",
        "updated_at": "2026-04-11T00:00:00Z"
      },
      {
        "id": "2026-03-08-truvista-eeeeee",
        "project": "truvista",
        "date": "2026-03-08",
        "hours_hundredths": 200,
        "rate_cents": 12500,
        "rate_source": "global_default",
        "billable_status": "billable",
        "bucket_id": null,
        "description": "technical disco (light), scoping and estimations",
        "review_flag": false,
        "created_at": "2026-04-11T00:00:00Z",
        "updated_at": "2026-04-11T00:00:00Z"
      }
    ]
  },
  "projects": {
    "schema_version": 1,
    "projects": [
      { "id": "sprosty", "name": "Sprosty", "client": null, "active": true, "is_internal": false, "default_rate_cents": null, "buckets": [] },
      { "id": "internal", "name": "Internal", "client": null, "active": true, "is_internal": true, "default_rate_cents": null, "buckets": [] },
      { "id": "axiom", "name": "Axiom", "client": null, "active": true, "is_internal": false, "default_rate_cents": null, "buckets": [] },
      { "id": "bayard", "name": "Bayard", "client": null, "active": true, "is_internal": false, "default_rate_cents": null, "buckets": [] },
      { "id": "truvista", "name": "TruVista", "client": null, "active": true, "is_internal": false, "default_rate_cents": null, "buckets": [] }
    ]
  },
  "rates": {
    "schema_version": 1,
    "default_rate_history": [
      { "effective_from": "2026-01-01", "rate_cents": 12500, "note": "Initial rate" }
    ]
  }
}
```

- [ ] **Step 2: Hand-compute expected totals**

File: `tests/fixtures/2026-03-mini-expected.json`

```json
{
  "month": "2026-03",
  "total_hours_hundredths": 850,
  "billable_hours_hundredths": 700,
  "non_billable_hours_hundredths": 100,
  "needs_review_hours_hundredths": 50,
  "billable_amount_cents": 45500,
  "per_project_summary": {
    "sprosty_billable_cents": 8000,
    "internal_non_billable_hours": 100,
    "axiom_needs_review_hours": 50,
    "bayard_billable_cents": 12500,
    "truvista_billable_cents": 25000
  }
}
```

**Manual computation check (to be re-verified by Gate A agents):**
- sprosty billable: 4h × $20/h = $80 = 8000 cents
- bayard billable: 1h × $125/h = $125 = 12500 cents
- truvista billable: 2h × $125/h = $250 = 25000 cents
- total billable: 8000 + 12500 + 25000 = 45500 cents ✓
- total billable hours: 400 + 100 + 200 = 700 ✓
- non_billable: internal 100 ✓
- needs_review: axiom 50 ✓
- grand total: 700 + 100 + 50 = 850 ✓

- [ ] **Step 3: Write golden-file test**

File: `tests/calc/golden-mini.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computeMonthTotals } from '@/calc';
import golden from '../fixtures/2026-03-mini-golden.json';
import expected from '../fixtures/2026-03-mini-expected.json';
import type { EntriesFile, ProjectsConfig, RatesConfig } from '@/schema/types';

describe('calc golden-mini (March 2026 representative sample)', () => {
  it('computeMonthTotals matches hand-computed expected totals for the mini golden fixture', () => {
    const entries = (golden.entries as EntriesFile).entries;
    const projects = golden.projects as ProjectsConfig;
    const rates = golden.rates as RatesConfig;

    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');

    expect(result.total_hours_hundredths).toBe(expected.total_hours_hundredths);
    expect(result.billable_hours_hundredths).toBe(expected.billable_hours_hundredths);
    expect(result.non_billable_hours_hundredths).toBe(expected.non_billable_hours_hundredths);
    expect(result.needs_review_hours_hundredths).toBe(expected.needs_review_hours_hundredths);
    expect(result.billable_amount_cents).toBe(expected.billable_amount_cents);
  });

  it('per_project totals match expected (mini fixture)', () => {
    const entries = (golden.entries as EntriesFile).entries;
    const projects = golden.projects as ProjectsConfig;
    const rates = golden.rates as RatesConfig;
    const result = computeMonthTotals({ entries, projects, rates }, '2026-03');

    const find = (id: string) => result.per_project.find((p) => p.project === id);
    expect(find('sprosty')?.billable_amount_cents).toBe(expected.per_project_summary.sprosty_billable_cents);
    expect(find('bayard')?.billable_amount_cents).toBe(expected.per_project_summary.bayard_billable_cents);
    expect(find('truvista')?.billable_amount_cents).toBe(expected.per_project_summary.truvista_billable_cents);
    expect(find('internal')?.non_billable_hours_hundredths).toBe(expected.per_project_summary.internal_non_billable_hours);
    expect(find('axiom')?.needs_review_hours_hundredths).toBe(expected.per_project_summary.axiom_needs_review_hours);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/calc/golden-mini.test.ts`

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/2026-03-mini-golden.json tests/fixtures/2026-03-mini-expected.json tests/calc/golden-mini.test.ts
git commit -m "calc: mini golden fixture from march 2026 sample data, hand-verified totals"
```

---

### Task 18: **GATE A — Multi-agent calc review**

Before proceeding to Phase 4, dispatch 3 independent subagents to review the calc module end to end. All three must agree before moving on. This is spec §7.2 Layer 4 Gate A made concrete.

- [ ] **Step 1: Verify the entire calc suite still passes**

Run: `npm test -- tests/calc/`

Expected: unit + property + mini-golden all green.

- [ ] **Step 2: Run full lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: exit 0 on both.

- [ ] **Step 3: Dispatch Reviewer Agent 1 (calc purity and rate resolution)**

Dispatch a subagent with this prompt:

```
You are reviewing the calc module in src/calc/*.ts against the design spec at docs/superpowers/specs/2026-04-11-hours-tracker-design.md, section 7.

Your job is to independently verify THREE claims:

1. The calc module is pure: no DOM access, no fetch, no Octokit, no file I/O, no state. Read every .ts file under src/calc/ and grep for any import that would violate this. Report the exact files and line numbers if you find violations.

2. resolveRateAtLogTime (src/calc/rates.ts) correctly implements the priority order from spec §3 row 4:
   - bucket override (bucket.rate_cents if set)
   - project default (project.default_rate_cents)
   - global default (rate history walk at entry date)
   Verify the test cases in tests/calc/rates.test.ts cover every branch. Suggest any missing cases.

3. The conservation invariant (spec §7.2) holds in computeMonthTotals: billable + non_billable + needs_review = total. Verify this in src/calc/totals.ts. The property test exists; confirm the implementation cannot violate it structurally.

Report format: ✓ or ✗ per claim with file:line evidence. If anything is wrong, describe it precisely. Do not fix anything — just report.
```

- [ ] **Step 4: Dispatch Reviewer Agent 2 (integer math and no floating point)**

Dispatch a second subagent (parallel with Agent 1):

```
You are reviewing the calc module against spec §7.2 layer 6: "Integer math enforcement."

Your job is to independently verify:

1. No floating-point arithmetic on fields ending in _cents or _hundredths outside src/calc/int.ts. Grep src/ and tests/ for `* 1.`, `/ 100`, `Math.round`, `Math.floor`, `Math.ceil`, and `parseFloat` on any _cents or _hundredths identifier. Report any violations with file:line.

2. The ESLint custom rule eslint-rules/no-float-money.cjs would catch a drive-by violation. Demonstrate this by mentally running it against a hypothetical `entry.rate_cents * 1.5` — does the rule fire?

3. mulCentsByHundredths correctly rejects inputs whose product is not divisible by 100. Verify by walking the function and reading its test (tests/calc/int.test.ts).

Report format: ✓ or ✗ per claim with evidence. Do not fix anything.
```

- [ ] **Step 5: Dispatch Reviewer Agent 3 (hash + snapshot drift)**

Dispatch a third subagent (parallel):

```
You are reviewing src/calc/hash.ts against spec §5.6 (snapshot source_hash) and §7.2 (hash invariants).

Your job is to independently verify:

1. canonicalizeEntriesForHashing is deterministic regardless of input key order and array order. Read the implementation. Read tests/calc/hash.test.ts. Confirm the two relevant tests exercise both axes (key-order and array-order).

2. hashEntries returns the format `sha256:<64-char-lowercase-hex>`. Verify this matches the pattern in schemas/snapshot.schema.json `source_hash` field.

3. Adding a new entry field in future would change existing hashes. Read canonicalizeEntry in src/calc/hash.ts. Is the field emission order fixed? If so, future additions will append, changing hash — is that intentional? Confirm against spec §15.5 playbook `adding-a-field.md` expectations (even though the playbook doesn't exist yet, reason from spec §5.6).

Report format: ✓ or ✗ per claim with evidence. Do not fix anything.
```

- [ ] **Step 6: Collect all three reports**

All three reviewers must return ✓ on every claim. If ANY claim returns ✗, fix it in the current phase before moving on. Do not paper over disagreements — investigate, discuss with the user if needed, fix, and re-run the review.

- [ ] **Step 7: Tag the gate-pass commit**

```bash
git tag gate-a-calc-review
git commit --allow-empty -m "gate-a: calc module multi-agent review passed"
```

Expected: commit tagged. Future reference point for "when did calc get its first clean review".

---

## PHASE 4 — Partner system

Spec §5.1 + §0. The partner config file + logo assets + runtime theming.

### Task 19: Seed Sector Growth partner assets

**Files:**
- Create: `public/partners/index.json`
- Create: `public/partners/sector-growth/partner.json`
- Create: `public/partners/sector-growth/logo.webp` (copied from booking repo)
- Create: `public/partners/sector-growth/favicon.png` (copied from booking repo)

- [ ] **Step 1: Create directory and copy Sector Growth assets**

```bash
mkdir -p public/partners/sector-growth
cp /Users/prash/Projects/oh-tap/consulting/sector-growth/booking/assets/logo.webp public/partners/sector-growth/logo.webp
cp /Users/prash/Projects/oh-tap/consulting/sector-growth/booking/assets/favicon.png public/partners/sector-growth/favicon.png
```

Expected: two files copied, no errors.

- [ ] **Step 2: Write `public/partners/index.json`**

File: `public/partners/index.json`

```json
{
  "schema_version": 1,
  "partners": [
    { "id": "sector-growth", "display_name": "Sector Growth", "enabled": true }
  ]
}
```

- [ ] **Step 3: Write `public/partners/sector-growth/partner.json`**

File: `public/partners/sector-growth/partner.json`

```json
{
  "schema_version": 1,
  "id": "sector-growth",
  "display_name": "Sector Growth",
  "tagline": "Consulting hours for Sector Growth",
  "website": "https://sectorgrowth.com",
  "currency": "CAD",
  "currency_symbol": "$",
  "currency_display_suffix": "CAD",
  "data_repo_prefix": "hours-data-sector-growth-",
  "theme": {
    "mode": "dark",
    "bg_deep": "#0A1628",
    "bg_darker": "#050B16",
    "accent_cyan": "#6BCFEE",
    "accent_mid": "#2A85C4",
    "accent_deep": "#1E4DA8",
    "text_primary": "#F5F7FA",
    "text_muted": "#94A3B8",
    "border_subtle": "rgba(255,255,255,0.08)",
    "border_strong": "rgba(255,255,255,0.16)"
  },
  "fonts": {
    "display": "'Space Grotesk', system-ui, sans-serif",
    "body": "'Inter', system-ui, sans-serif",
    "mono": "'JetBrains Mono', ui-monospace, monospace",
    "google_fonts_link": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  },
  "assets": {
    "logo": "logo.webp",
    "logo_alt_text": "Sector Growth",
    "logo_width": 180,
    "logo_height": 48,
    "logo_dark_filter": "invert(1) hue-rotate(180deg) brightness(1.05)",
    "favicon": "favicon.png"
  },
  "enabled": true
}
```

- [ ] **Step 4: Commit**

```bash
git add public/partners/
git commit -m "partner: seed sector-growth config with real theme/logo from booking repo"
```

---

### Task 20: `src/partner/load-partner.ts` — fetch and validate partner config

**Files:**
- Create: `src/partner/load-partner.ts`
- Create: `src/partner/README.md`
- Create: `tests/partner/load-partner.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/partner/load-partner.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPartnersIndex, loadPartner } from '@/partner/load-partner';

describe('loadPartnersIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches partners index.json from the Pages base and returns the parsed list', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: 1,
        partners: [{ id: 'sector-growth', display_name: 'Sector Growth', enabled: true }],
      }),
    });
    const result = await loadPartnersIndex();
    expect(result.partners).toHaveLength(1);
    expect(result.partners[0].id).toBe('sector-growth');
  });

  it('throws when the fetch returns non-ok', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(loadPartnersIndex()).rejects.toThrow();
  });
});

describe('loadPartner', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a partner.json by id and validates it against the schema', async () => {
    const valid = {
      schema_version: 1, id: 'sector-growth', display_name: 'Sector Growth',
      currency: 'CAD', currency_symbol: '$', currency_display_suffix: 'CAD',
      data_repo_prefix: 'hours-data-sector-growth-',
      theme: {
        mode: 'dark', bg_deep: '#0A1628', bg_darker: '#050B16',
        accent_cyan: '#6BCFEE', accent_mid: '#2A85C4', accent_deep: '#1E4DA8',
        text_primary: '#F5F7FA', text_muted: '#94A3B8',
        border_subtle: 'rgba(255,255,255,0.08)', border_strong: 'rgba(255,255,255,0.16)',
      },
      fonts: { display: 's', body: 's', mono: 'm' },
      assets: { logo: 'logo.webp', logo_alt_text: 'Sector Growth', favicon: 'favicon.png' },
      enabled: true,
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => valid,
    });
    const result = await loadPartner('sector-growth');
    expect(result.id).toBe('sector-growth');
    expect(result.currency).toBe('CAD');
  });

  it('throws a descriptive error when the partner.json fails schema validation', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ schema_version: 1, id: 'bad' }), // missing required fields
    });
    await expect(loadPartner('bad')).rejects.toThrow(/validation/i);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/partner/load-partner.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/partner/load-partner.ts`

```ts
import type { Partner, PartnersIndex } from '@/schema/types';
import { validatePartner, formatValidationErrors } from '@/schema/validators';

// The Vite `base` config is '/hours-tracker/'. All fetches of static assets
// under public/ are prefixed with this base at build time via import.meta.env.
// During dev, import.meta.env.BASE_URL is '/hours-tracker/'.
function baseUrl(): string {
  // Fall back to '/' in test environments where import.meta.env isn't set.
  const b = typeof import.meta !== 'undefined' ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL : undefined;
  return b ?? '/';
}

export async function loadPartnersIndex(): Promise<PartnersIndex> {
  const url = `${baseUrl()}partners/index.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load partners index from ${url} (status ${res.status})`);
  }
  // We intentionally do not schema-validate the index here — it has no
  // type in src/schema/validators.ts. The shape is trivially verified by
  // the field access below.
  const data = (await res.json()) as PartnersIndex;
  if (!data || !Array.isArray(data.partners)) {
    throw new Error(`Invalid partners index at ${url}: missing 'partners' array`);
  }
  return data;
}

export async function loadPartner(partnerId: string): Promise<Partner> {
  const url = `${baseUrl()}partners/${partnerId}/partner.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load partner "${partnerId}" from ${url} (status ${res.status})`);
  }
  const data = await res.json();
  const result = validatePartner(data);
  if (!result.ok) {
    throw new Error(
      `Partner "${partnerId}" failed schema validation:\n${formatValidationErrors(result.errors)}`,
    );
  }
  return result.value;
}
```

- [ ] **Step 4: Write README**

File: `src/partner/README.md`

```markdown
# src/partner

**Purpose:** Load partner config at runtime from `public/partners/<id>/partner.json`, validate it, and apply theme tokens to the DOM.

**Public API:**
- `loadPartnersIndex() → PartnersIndex`
- `loadPartner(partnerId) → Partner` (validated)
- `applyPartnerTheme(partner)` — sets CSS custom properties and updates `<title>`, favicon, Google Fonts link

**Invariants:**
1. Every partner load goes through schema validation (spec §5.1).
2. Theme application is idempotent — calling twice with the same partner is a no-op.
3. Partner logo is always rendered through the `logo_dark_filter` when `theme.mode === 'dark'` (spec §5.1).

**Dependencies:** `@/schema/validators`, `@/schema/types`. No data-layer or Octokit imports.
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/partner/load-partner.test.ts`

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/partner/load-partner.ts src/partner/README.md tests/partner/
git commit -m "partner: loadPartner + loadPartnersIndex with ajv validation"
```

---

### Task 21: `src/partner/apply-theme.ts` — runtime theme injection

**Files:**
- Create: `src/partner/apply-theme.ts`
- Create: `tests/partner/apply-theme.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/partner/apply-theme.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyPartnerTheme } from '@/partner/apply-theme';
import type { Partner } from '@/schema/types';

const sectorGrowth: Partner = {
  schema_version: 1,
  id: 'sector-growth',
  display_name: 'Sector Growth',
  currency: 'CAD',
  currency_symbol: '$',
  currency_display_suffix: 'CAD',
  data_repo_prefix: 'hours-data-sector-growth-',
  theme: {
    mode: 'dark',
    bg_deep: '#0A1628',
    bg_darker: '#050B16',
    accent_cyan: '#6BCFEE',
    accent_mid: '#2A85C4',
    accent_deep: '#1E4DA8',
    text_primary: '#F5F7FA',
    text_muted: '#94A3B8',
    border_subtle: 'rgba(255,255,255,0.08)',
    border_strong: 'rgba(255,255,255,0.16)',
  },
  fonts: {
    display: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
    google_fonts_link: 'https://fonts.googleapis.com/css2?family=Inter&family=Space+Grotesk&family=JetBrains+Mono',
  },
  assets: {
    logo: 'logo.webp',
    logo_alt_text: 'Sector Growth',
    logo_dark_filter: 'invert(1) hue-rotate(180deg) brightness(1.05)',
    favicon: 'favicon.png',
  },
  enabled: true,
};

describe('applyPartnerTheme', () => {
  beforeEach(() => {
    // Reset document state between tests
    document.documentElement.removeAttribute('style');
    document.title = '';
    // Remove any existing favicon link
    document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
    document.querySelectorAll('link[data-partner-fonts]').forEach((el) => el.remove());
  });

  it('sets CSS custom properties on :root for every theme key', () => {
    applyPartnerTheme(sectorGrowth);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--partner-bg-deep')).toBe('#0A1628');
    expect(root.style.getPropertyValue('--partner-bg-darker')).toBe('#050B16');
    expect(root.style.getPropertyValue('--partner-accent-cyan')).toBe('#6BCFEE');
    expect(root.style.getPropertyValue('--partner-text-primary')).toBe('#F5F7FA');
  });

  it('sets font CSS custom properties from partner.fonts', () => {
    applyPartnerTheme(sectorGrowth);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--partner-font-display')).toContain('Space Grotesk');
    expect(root.style.getPropertyValue('--partner-font-body')).toContain('Inter');
    expect(root.style.getPropertyValue('--partner-font-mono')).toContain('JetBrains Mono');
  });

  it('updates document.title to "Hours · <partner display_name>"', () => {
    applyPartnerTheme(sectorGrowth);
    expect(document.title).toBe('Hours · Sector Growth');
  });

  it('injects a Google Fonts stylesheet link when google_fonts_link is set', () => {
    applyPartnerTheme(sectorGrowth);
    const link = document.querySelector('link[data-partner-fonts]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('Space+Grotesk');
  });

  it('is idempotent — calling twice produces one favicon and one fonts link', () => {
    applyPartnerTheme(sectorGrowth);
    applyPartnerTheme(sectorGrowth);
    expect(document.querySelectorAll('link[data-partner-favicon]').length).toBe(1);
    expect(document.querySelectorAll('link[data-partner-fonts]').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/partner/apply-theme.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/partner/apply-theme.ts`

```ts
import type { Partner } from '@/schema/types';

/**
 * Apply partner theme tokens to the DOM at runtime.
 *
 * Sets CSS custom properties on :root so Tailwind utilities (`bg-partner-*`)
 * and plain CSS (`var(--partner-...)`) pick up the active partner.
 *
 * Idempotent: calling twice produces exactly one favicon link, one fonts link,
 * and overwrites existing properties in place.
 *
 * Spec references: §0, §5.1, §8.1 branding placement rules.
 */
export function applyPartnerTheme(partner: Partner): void {
  applyCssCustomProperties(partner);
  updateTitle(partner);
  updateFavicon(partner);
  injectFontsLink(partner);
  updateMetaThemeColor(partner);
}

function applyCssCustomProperties(partner: Partner): void {
  const root = document.documentElement;
  const t = partner.theme;
  root.style.setProperty('--partner-bg-deep', t.bg_deep);
  root.style.setProperty('--partner-bg-darker', t.bg_darker);
  root.style.setProperty('--partner-accent-cyan', t.accent_cyan);
  root.style.setProperty('--partner-accent-mid', t.accent_mid);
  root.style.setProperty('--partner-accent-deep', t.accent_deep);
  root.style.setProperty('--partner-text-primary', t.text_primary);
  root.style.setProperty('--partner-text-muted', t.text_muted);
  root.style.setProperty('--partner-border-subtle', t.border_subtle);
  root.style.setProperty('--partner-border-strong', t.border_strong);
  root.style.setProperty('--partner-font-display', partner.fonts.display);
  root.style.setProperty('--partner-font-body', partner.fonts.body);
  root.style.setProperty('--partner-font-mono', partner.fonts.mono);
}

function updateTitle(partner: Partner): void {
  document.title = `Hours · ${partner.display_name}`;
}

function updateFavicon(partner: Partner): void {
  const existing = document.querySelector('link[data-partner-favicon]');
  if (existing) existing.remove();
  // Also remove any static favicon that was placed by index.html at build time.
  const staticFavicon = document.querySelector('link[rel="icon"]:not([data-partner-favicon])');
  if (staticFavicon) staticFavicon.remove();
  const link = document.createElement('link');
  link.setAttribute('rel', 'icon');
  link.setAttribute('data-partner-favicon', '');
  // Resolve relative to the Pages base.
  const base = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    : '/';
  link.setAttribute('href', `${base}partners/${partner.id}/${partner.assets.favicon}`);
  document.head.appendChild(link);
}

function injectFontsLink(partner: Partner): void {
  if (!partner.fonts.google_fonts_link) return;
  const existing = document.querySelector('link[data-partner-fonts]');
  if (existing) existing.remove();
  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('data-partner-fonts', '');
  link.setAttribute('href', partner.fonts.google_fonts_link);
  document.head.appendChild(link);
}

function updateMetaThemeColor(partner: Partner): void {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', partner.theme.bg_deep);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/partner/apply-theme.test.ts`

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/partner/apply-theme.ts tests/partner/apply-theme.test.ts
git commit -m "partner: applyPartnerTheme sets css vars, title, favicon, fonts, idempotent"
```

---

## PHASE 5 — Auth

Spec §6.1. Fine-grained PAT stored in localStorage, abstracted behind a TokenProvider interface for future OAuth swap.

### Task 22: `src/auth/token-provider.ts` — interface

**Files:**
- Create: `src/auth/token-provider.ts`
- Create: `src/auth/README.md`

- [ ] **Step 1: Write interface**

File: `src/auth/token-provider.ts`

```ts
/**
 * TokenProvider abstracts the source of the GitHub API token.
 *
 * This indirection exists so the PAT implementation (MVP) can be swapped for
 * a future OAuth device-flow implementation without touching Octokit consumers.
 * Spec §6.1 "Future upgrade path."
 */
export interface TokenProvider {
  /** Get the current token, or null if not signed in. */
  getToken(): string | null;
  /** Persist a new token. Throws if the format is obviously invalid. */
  setToken(token: string): void;
  /** Clear the stored token (sign out). */
  clearToken(): void;
}
```

- [ ] **Step 2: Write README**

File: `src/auth/README.md`

```markdown
# src/auth

**Purpose:** Own the GitHub API token — how it's obtained, stored, and cleared. Abstracts token source so Octokit consumers never touch localStorage directly.

**Public API:**
- `token-provider.ts` — `TokenProvider` interface
- `pat-provider.ts` — `PatTokenProvider` (localStorage-backed, the MVP impl)

**Invariants:**
1. Token is never sent anywhere except `api.github.com`.
2. Token format is validated client-side (starts with `github_pat_` or `ghp_`).
3. `clearToken()` is the ONLY way to sign out — Settings calls this, never touches localStorage.

**Dependencies:** none.
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/auth/token-provider.ts src/auth/README.md
git commit -m "auth: TokenProvider interface for future oauth swap"
```

---

### Task 23: `src/auth/pat-provider.ts` — localStorage-backed PAT provider

**Files:**
- Create: `src/auth/pat-provider.ts`
- Create: `tests/auth/pat-provider.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/auth/pat-provider.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PatTokenProvider } from '@/auth/pat-provider';

describe('PatTokenProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    const provider = new PatTokenProvider();
    expect(provider.getToken()).toBeNull();
  });

  it('stores and retrieves a valid fine-grained PAT', () => {
    const provider = new PatTokenProvider();
    const token = 'github_pat_' + 'a'.repeat(80);
    provider.setToken(token);
    expect(provider.getToken()).toBe(token);
  });

  it('throws when setting a token that does not start with github_pat_ or ghp_', () => {
    const provider = new PatTokenProvider();
    expect(() => provider.setToken('not-a-valid-token')).toThrow();
  });

  it('accepts a classic ghp_ token for compatibility', () => {
    const provider = new PatTokenProvider();
    const token = 'ghp_' + 'a'.repeat(36);
    provider.setToken(token);
    expect(provider.getToken()).toBe(token);
  });

  it('clearToken removes the token from storage', () => {
    const provider = new PatTokenProvider();
    provider.setToken('github_pat_' + 'a'.repeat(80));
    provider.clearToken();
    expect(provider.getToken()).toBeNull();
  });

  it('persists across PatTokenProvider instances via localStorage', () => {
    const p1 = new PatTokenProvider();
    p1.setToken('github_pat_' + 'a'.repeat(80));
    const p2 = new PatTokenProvider();
    expect(p2.getToken()).toBe('github_pat_' + 'a'.repeat(80));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/auth/pat-provider.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/auth/pat-provider.ts`

```ts
import type { TokenProvider } from './token-provider';

const STORAGE_KEY = 'sapienex:hours-tracker:token';

/**
 * localStorage-backed fine-grained PAT provider.
 *
 * The token must start with `github_pat_` (new fine-grained) or `ghp_`
 * (classic; allowed for backward compatibility but not recommended).
 * Any other format throws — we refuse to store obviously wrong input.
 *
 * Spec §6.1.
 */
export class PatTokenProvider implements TokenProvider {
  getToken(): string | null {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    if (!PatTokenProvider.looksLikeGitHubToken(token)) {
      throw new Error(
        'Rejected token: expected a fine-grained PAT starting with "github_pat_" (preferred) or a classic PAT starting with "ghp_".',
      );
    }
    window.localStorage.setItem(STORAGE_KEY, token);
  }

  clearToken(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  static looksLikeGitHubToken(token: string): boolean {
    return token.startsWith('github_pat_') || token.startsWith('ghp_');
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/auth/pat-provider.test.ts`

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/auth/pat-provider.ts tests/auth/pat-provider.test.ts
git commit -m "auth: PatTokenProvider (localStorage) with token format validation"
```

---

### Task 24: `src/store/auth-store.ts` — Zustand store for auth + partner + consultant

**Files:**
- Create: `src/store/auth-store.ts`
- Create: `src/store/README.md`
- Create: `tests/store/auth-store.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/store/auth-store.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth-store';

describe('useAuthStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState(useAuthStore.getInitialState());
  });

  it('starts unauthenticated with null partner and null consultant', () => {
    const state = useAuthStore.getState();
    expect(state.partnerId).toBeNull();
    expect(state.consultantSlug).toBeNull();
    expect(state.dataRepo).toBeNull();
    expect(state.token).toBeNull();
  });

  it('completeFirstRun stores partner, slug, data repo, and token in one atomic update', () => {
    useAuthStore.getState().completeFirstRun({
      partnerId: 'sector-growth',
      consultantSlug: 'prash',
      dataRepo: 'sapienEx-AI/hours-data-sector-growth-prash',
      token: 'github_pat_' + 'a'.repeat(80),
    });
    const state = useAuthStore.getState();
    expect(state.partnerId).toBe('sector-growth');
    expect(state.consultantSlug).toBe('prash');
    expect(state.dataRepo).toBe('sapienEx-AI/hours-data-sector-growth-prash');
    expect(state.token).toMatch(/^github_pat_/);
  });

  it('signOut clears all state', () => {
    useAuthStore.getState().completeFirstRun({
      partnerId: 'sector-growth',
      consultantSlug: 'prash',
      dataRepo: 'sapienEx-AI/hours-data-sector-growth-prash',
      token: 'github_pat_' + 'a'.repeat(80),
    });
    useAuthStore.getState().signOut();
    const state = useAuthStore.getState();
    expect(state.partnerId).toBeNull();
    expect(state.token).toBeNull();
  });

  it('rehydrates from localStorage on creation if all keys are present', () => {
    window.localStorage.setItem('sapienex:hours-tracker:partner_id', 'sector-growth');
    window.localStorage.setItem('sapienex:hours-tracker:consultant_slug', 'prash');
    window.localStorage.setItem('sapienex:hours-tracker:data_repo', 'sapienEx-AI/hours-data-sector-growth-prash');
    window.localStorage.setItem('sapienex:hours-tracker:token', 'github_pat_' + 'a'.repeat(80));
    // Reset store state to trigger rehydration
    useAuthStore.setState(useAuthStore.getInitialState());
    useAuthStore.getState().rehydrateFromStorage();
    const state = useAuthStore.getState();
    expect(state.partnerId).toBe('sector-growth');
    expect(state.consultantSlug).toBe('prash');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/store/auth-store.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/store/auth-store.ts`

```ts
import { create } from 'zustand';
import { PatTokenProvider } from '@/auth/pat-provider';

const KEYS = {
  partnerId: 'sapienex:hours-tracker:partner_id',
  consultantSlug: 'sapienex:hours-tracker:consultant_slug',
  dataRepo: 'sapienex:hours-tracker:data_repo',
} as const;

export type AuthState = {
  partnerId: string | null;
  consultantSlug: string | null;
  dataRepo: string | null;
  token: string | null;
  completeFirstRun: (args: {
    partnerId: string;
    consultantSlug: string;
    dataRepo: string;
    token: string;
  }) => void;
  signOut: () => void;
  rehydrateFromStorage: () => void;
};

const initialState = {
  partnerId: null,
  consultantSlug: null,
  dataRepo: null,
  token: null,
};

const tokenProvider = new PatTokenProvider();

/**
 * Auth store: partner, consultant slug, data repo, and GitHub token.
 *
 * Persisted in localStorage via four keys (spec §8.1.1). Rehydrates on app
 * start. Writes go through both the store and localStorage atomically inside
 * completeFirstRun / signOut.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,
  completeFirstRun({ partnerId, consultantSlug, dataRepo, token }) {
    window.localStorage.setItem(KEYS.partnerId, partnerId);
    window.localStorage.setItem(KEYS.consultantSlug, consultantSlug);
    window.localStorage.setItem(KEYS.dataRepo, dataRepo);
    tokenProvider.setToken(token);
    set({ partnerId, consultantSlug, dataRepo, token });
  },
  signOut() {
    window.localStorage.removeItem(KEYS.partnerId);
    window.localStorage.removeItem(KEYS.consultantSlug);
    window.localStorage.removeItem(KEYS.dataRepo);
    tokenProvider.clearToken();
    set(initialState);
  },
  rehydrateFromStorage() {
    const partnerId = window.localStorage.getItem(KEYS.partnerId);
    const consultantSlug = window.localStorage.getItem(KEYS.consultantSlug);
    const dataRepo = window.localStorage.getItem(KEYS.dataRepo);
    const token = tokenProvider.getToken();
    if (partnerId && consultantSlug && dataRepo && token) {
      set({ partnerId, consultantSlug, dataRepo, token });
    }
  },
}));

// Expose the initial state for test resets.
(useAuthStore as unknown as { getInitialState: () => AuthState }).getInitialState = () =>
  ({ ...initialState } as AuthState);
```

- [ ] **Step 4: Write README**

File: `src/store/README.md`

```markdown
# src/store

**Purpose:** Zustand stores for UI state and auth. Kept minimal — most data lives in React Query cache (server state) rather than here.

**Public API:**
- `auth-store.ts` — partner id, consultant slug, data repo, GitHub token
- `ui-store.ts` — transient UI state (toasts, modals, etc.) [added later in Task 32]

**Invariants:**
1. Token reads/writes go through `src/auth/pat-provider.ts`, never touch localStorage directly outside that module.
2. Store state + localStorage are always written together (atomic UX).
3. `signOut` clears everything, nothing is left behind.

**Dependencies:** `zustand`, `@/auth/pat-provider`.
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/store/auth-store.test.ts`

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/store/auth-store.ts src/store/README.md tests/store/
git commit -m "store: auth store with localStorage persistence and rehydrate"
```

---

## PHASE 6 — Data layer

Spec §6.2–§6.4. Octokit wrapper + per-domain repos + optimistic concurrency. Every read validates against schema; every write validates BEFORE hitting GitHub and retries once on 409 conflict.

### Task 25: `src/data/octokit-client.ts` — Octokit factory + base64 helpers

**Files:**
- Create: `src/data/octokit-client.ts`
- Create: `src/data/README.md`
- Create: `tests/data/octokit-client.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/data/octokit-client.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { encodeContent, decodeContent, splitRepoPath } from '@/data/octokit-client';

describe('octokit-client helpers', () => {
  it('encodeContent round-trips a simple JSON string through base64', () => {
    const original = '{"hello":"world"}';
    const encoded = encodeContent(original);
    expect(decodeContent(encoded)).toBe(original);
  });

  it('encodeContent handles unicode (hours symbols, accented names)', () => {
    const original = '{"description":"MS Fabric · 4.5h"}';
    const encoded = encodeContent(original);
    expect(decodeContent(encoded)).toBe(original);
  });

  it('splitRepoPath parses "owner/repo" into parts', () => {
    expect(splitRepoPath('sapienEx-AI/hours-data-sector-growth-prash')).toEqual({
      owner: 'sapienEx-AI',
      repo: 'hours-data-sector-growth-prash',
    });
  });

  it('splitRepoPath throws on malformed input', () => {
    expect(() => splitRepoPath('no-slash')).toThrow();
    expect(() => splitRepoPath('too/many/slashes')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/data/octokit-client.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/data/octokit-client.ts`

```ts
import { Octokit } from '@octokit/rest';

/**
 * Octokit factory. Takes a token and returns a configured client with retry
 * disabled (we handle retries explicitly in the repo modules for visibility).
 */
export function makeOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: 'hours-tracker',
    request: {
      retries: 0, // We do our own retry on 409 for write conflicts.
    },
  });
}

/** Base64-encode a UTF-8 string for the GitHub contents API. */
export function encodeContent(s: string): string {
  // btoa doesn't handle unicode. Encode as bytes first.
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Decode a base64 string from the GitHub contents API as UTF-8. */
export function decodeContent(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export type RepoParts = { owner: string; repo: string };

/** Parse "owner/repo" into {owner, repo}. Throws if malformed. */
export function splitRepoPath(path: string): RepoParts {
  const parts = path.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo path "${path}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}
```

- [ ] **Step 4: Write README**

File: `src/data/README.md`

```markdown
# src/data

**Purpose:** GitHub API ↔ JSON files. Read, validate, commit. Handles optimistic concurrency.

**Public API:**
- `octokit-client.ts` — `makeOctokit(token)`, `encodeContent`, `decodeContent`, `splitRepoPath`
- `commit-messages.ts` — structured commit message formatters (spec §6.3)
- `entries-repo.ts` — read/write per-month entries files
- `projects-repo.ts` — read/write projects config
- `rates-repo.ts` — read/write rates history
- `snapshots-repo.ts` — read/write immutable month snapshots
- `github-file.ts` — generic "read a JSON file / write a JSON file with sha" helper

**Invariants:**
1. Every write validates against the corresponding schema BEFORE hitting GitHub (spec §11 guard 1).
2. Writes include the file's current `sha`; on 409, one retry after refreshing (spec §6.4).
3. Two consecutive 409s surface a visible conflict banner — never silently discard.
4. Commit messages follow the structured prefix convention in spec §6.3.

**Dependencies:** `@octokit/rest`, `@/schema/*`, `@/calc/hash`.
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/data/octokit-client.test.ts`

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/data/octokit-client.ts src/data/README.md tests/data/
git commit -m "data: octokit client factory + base64 + repo path helpers"
```

---

### Task 26: `src/data/commit-messages.ts` — structured commit message formatters

**Files:**
- Create: `src/data/commit-messages.ts`
- Create: `tests/data/commit-messages.test.ts`

- [ ] **Step 1: Write test**

File: `tests/data/commit-messages.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  logMessage,
  editMessage,
  deleteMessage,
  bulkEditMessage,
  configAddProjectMessage,
  configAddRateMessage,
  snapshotCloseMessage,
  importMessage,
} from '@/data/commit-messages';

describe('commit-messages', () => {
  it('logMessage emits "log: <project> <date> <hours>h @ $<rate> (desc)"', () => {
    expect(
      logMessage({
        project: 'sprosty', date: '2026-03-25', hours_hundredths: 400,
        rate_cents: 2000, description: 'skyvia HS + companies configs',
      }),
    ).toBe('log: sprosty 2026-03-25 4.00h @ $20.00 (skyvia HS + companies configs)');
  });

  it('editMessage emits "edit: <id> — <change>"', () => {
    expect(editMessage('2026-03-25-sprosty-aaaaaa', 'hours 4.0 → 4.5')).toBe(
      'edit: 2026-03-25-sprosty-aaaaaa — hours 4.0 → 4.5',
    );
  });

  it('deleteMessage includes the id and reason', () => {
    expect(deleteMessage('2026-03-25-sprosty-aaaaaa', 'no longer applies')).toBe(
      'delete: 2026-03-25-sprosty-aaaaaa — no longer applies',
    );
  });

  it('bulkEditMessage describes count and filter', () => {
    expect(
      bulkEditMessage({ rate_cents: 17500, count: 22, filter: 'project: Sprosty, date: >= 2026-04-01' }),
    ).toBe('bulk-edit: apply $175.00 rate to 22 entries matching {project: Sprosty, date: >= 2026-04-01}');
  });

  it('configAddProjectMessage emits the expected format', () => {
    expect(configAddProjectMessage('Shannex')).toBe('config: add project "Shannex"');
  });

  it('configAddRateMessage includes rate and effective date', () => {
    expect(configAddRateMessage(17500, '2026-04-01')).toBe('config: add rate $175.00 effective 2026-04-01');
  });

  it('snapshotCloseMessage includes totals', () => {
    expect(
      snapshotCloseMessage({
        month: '2026-03',
        billable_hours_hundredths: 8750,
        non_billable_hours_hundredths: 1800,
        billable_amount_cents: 1312500,
      }),
    ).toBe('snapshot: close 2026-03 — 87.50h billable, 18.00h non-billable, $13,125.00');
  });

  it('importMessage includes source and count', () => {
    expect(importMessage('2026-03', 'Apple Notes', 95)).toBe(
      'import: 2026-03 from Apple Notes (95 entries)',
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/data/commit-messages.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/data/commit-messages.ts`

```ts
import { formatHoursDecimal, formatCents } from '@/format/format';

// Commit-message formatters use a currency-agnostic display so they embed in
// git logs without the partner suffix. The formatter here takes just the
// symbol; the display suffix is omitted on purpose.
const noSuffix = { currency_symbol: '$', currency_display_suffix: '' };

function formatDollars(cents: number): string {
  return formatCents(cents, noSuffix).trim();
}

// ─── log ───
export function logMessage(args: {
  project: string;
  date: string;
  hours_hundredths: number;
  rate_cents: number;
  description: string;
}): string {
  const hours = formatHoursDecimal(args.hours_hundredths);
  const rate = formatDollars(args.rate_cents);
  return `log: ${args.project} ${args.date} ${hours}h @ ${rate} (${args.description})`;
}

// ─── edit ───
export function editMessage(id: string, change: string): string {
  return `edit: ${id} — ${change}`;
}

export function deleteMessage(id: string, reason: string): string {
  return `delete: ${id} — ${reason}`;
}

export function bulkEditMessage(args: {
  rate_cents: number;
  count: number;
  filter: string;
}): string {
  return `bulk-edit: apply ${formatDollars(args.rate_cents)} rate to ${args.count} entries matching {${args.filter}}`;
}

// ─── config ───
export function configAddProjectMessage(name: string): string {
  return `config: add project "${name}"`;
}

export function configAddBucketMessage(bucketId: string, projectId: string): string {
  return `config: add bucket ${bucketId} to ${projectId}`;
}

export function configAddRateMessage(rate_cents: number, effective_from: string): string {
  return `config: add rate ${formatDollars(rate_cents)} effective ${effective_from}`;
}

// ─── snapshot ───
export function snapshotCloseMessage(args: {
  month: string;
  billable_hours_hundredths: number;
  non_billable_hours_hundredths: number;
  billable_amount_cents: number;
}): string {
  const billable = formatHoursDecimal(args.billable_hours_hundredths);
  const nonBillable = formatHoursDecimal(args.non_billable_hours_hundredths);
  const amount = formatDollars(args.billable_amount_cents);
  return `snapshot: close ${args.month} — ${billable}h billable, ${nonBillable}h non-billable, ${amount}`;
}

// ─── import ───
export function importMessage(month: string, source: string, count: number): string {
  return `import: ${month} from ${source} (${count} entries)`;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/data/commit-messages.test.ts`

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/data/commit-messages.ts tests/data/commit-messages.test.ts
git commit -m "data: structured commit message formatters per spec §6.3"
```

---

### Task 27: `src/data/github-file.ts` — generic JSON file read/write with optimistic concurrency

**Files:**
- Create: `src/data/github-file.ts`
- Create: `tests/data/github-file.test.ts`

- [ ] **Step 1: Write failing test**

File: `tests/data/github-file.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { readJsonFile, writeJsonFile, FileNotFoundError, ConflictError } from '@/data/github-file';

type MockOctokit = {
  rest: { repos: {
    getContent: ReturnType<typeof vi.fn>;
    createOrUpdateFileContents: ReturnType<typeof vi.fn>;
  } };
};

function makeMock(): MockOctokit {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
    },
  };
}

describe('readJsonFile', () => {
  it('reads and parses a JSON file from a github repo', async () => {
    const mock = makeMock();
    mock.rest.repos.getContent.mockResolvedValue({
      data: {
        type: 'file',
        content: btoa(JSON.stringify({ hello: 'world' })),
        sha: 'abc123',
        encoding: 'base64',
      },
    });
    const result = await readJsonFile(mock as never, {
      owner: 'test', repo: 'repo', path: 'config/test.json',
    });
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.sha).toBe('abc123');
  });

  it('throws FileNotFoundError on 404', async () => {
    const mock = makeMock();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    await expect(
      readJsonFile(mock as never, { owner: 'test', repo: 'repo', path: 'config/test.json' }),
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });
});

describe('writeJsonFile', () => {
  it('creates a new file when sha is not provided', async () => {
    const mock = makeMock();
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'new-sha' } },
    });
    const result = await writeJsonFile(mock as never, {
      owner: 'test', repo: 'repo', path: 'config/test.json',
      content: { hello: 'world' },
      message: 'test commit',
    });
    expect(result.sha).toBe('new-sha');
    expect(mock.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'test commit' }),
    );
  });

  it('updates an existing file when sha is provided', async () => {
    const mock = makeMock();
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'updated-sha' } },
    });
    await writeJsonFile(mock as never, {
      owner: 'test', repo: 'repo', path: 'config/test.json',
      content: { hello: 'world' }, message: 'test commit', sha: 'old-sha',
    });
    expect(mock.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'old-sha' }),
    );
  });

  it('throws ConflictError on a 409 response', async () => {
    const mock = makeMock();
    mock.rest.repos.createOrUpdateFileContents.mockRejectedValue({ status: 409 });
    await expect(
      writeJsonFile(mock as never, {
        owner: 'test', repo: 'repo', path: 'config/test.json',
        content: { hello: 'world' }, message: 'test', sha: 'old-sha',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/data/github-file.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/data/github-file.ts`

```ts
import type { Octokit } from '@octokit/rest';
import { encodeContent, decodeContent } from './octokit-client';

export class FileNotFoundError extends Error {
  constructor(path: string) {
    super(`GitHub file not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(path: string) {
    super(`GitHub write conflict on ${path}. File was modified concurrently.`);
    this.name = 'ConflictError';
  }
}

export type ReadArgs = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
};

export type ReadResult<T> = {
  data: T;
  sha: string;
  raw: string;
};

export async function readJsonFile<T>(octokit: Octokit, args: ReadArgs): Promise<ReadResult<T>> {
  try {
    const res = await octokit.rest.repos.getContent({
      owner: args.owner,
      repo: args.repo,
      path: args.path,
      ref: args.ref,
    });
    const d = res.data as { type: string; content: string; sha: string; encoding: string };
    if (d.type !== 'file') {
      throw new Error(`Expected file at ${args.path}, got ${d.type}`);
    }
    const raw = decodeContent(d.content);
    return { data: JSON.parse(raw) as T, sha: d.sha, raw };
  } catch (e) {
    if ((e as { status?: number }).status === 404) {
      throw new FileNotFoundError(args.path);
    }
    throw e;
  }
}

export type WriteArgs = {
  owner: string;
  repo: string;
  path: string;
  content: unknown;
  message: string;
  sha?: string; // Provide when updating an existing file; omit on create.
};

export type WriteResult = {
  sha: string;
};

export async function writeJsonFile(octokit: Octokit, args: WriteArgs): Promise<WriteResult> {
  const serialized = JSON.stringify(args.content, null, 2) + '\n';
  try {
    const res = await octokit.rest.repos.createOrUpdateFileContents({
      owner: args.owner,
      repo: args.repo,
      path: args.path,
      message: args.message,
      content: encodeContent(serialized),
      sha: args.sha,
    });
    const sha = (res.data as { content?: { sha?: string } }).content?.sha ?? '';
    return { sha };
  } catch (e) {
    if ((e as { status?: number }).status === 409) {
      throw new ConflictError(args.path);
    }
    throw e;
  }
}

/**
 * Write with one retry on conflict. On first 409, re-read the latest file,
 * let the caller transform the fresh data, and retry the write. If the retry
 * also fails with 409, surface a ConflictError (caller shows a banner).
 *
 * Spec §6.4.
 */
export async function writeJsonFileWithRetry<T>(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    transform: (current: T | null, currentSha: string | null) => unknown;
  },
): Promise<WriteResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let currentData: T | null = null;
    let currentSha: string | null = null;
    try {
      const read = await readJsonFile<T>(octokit, {
        owner: args.owner, repo: args.repo, path: args.path,
      });
      currentData = read.data;
      currentSha = read.sha;
    } catch (e) {
      if (!(e instanceof FileNotFoundError)) throw e;
    }
    const nextContent = args.transform(currentData, currentSha);
    try {
      return await writeJsonFile(octokit, {
        owner: args.owner, repo: args.repo, path: args.path,
        content: nextContent, message: args.message,
        sha: currentSha ?? undefined,
      });
    } catch (e) {
      if (e instanceof ConflictError && attempt === 0) continue;
      throw e;
    }
  }
  throw new ConflictError(args.path);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/data/github-file.test.ts`

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/data/github-file.ts tests/data/github-file.test.ts
git commit -m "data: readJsonFile + writeJsonFile with retry-on-conflict"
```

---

### Task 28: `src/data/entries-repo.ts` — per-month entries I/O

**Files:**
- Create: `src/data/entries-repo.ts`
- Create: `tests/data/entries-repo.test.ts`

- [ ] **Step 1: Write test**

File: `tests/data/entries-repo.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { loadMonthEntries, addEntry } from '@/data/entries-repo';
import type { Entry } from '@/schema/types';

function mockOctokit() {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
    },
  };
}

const sampleEntry: Omit<Entry, 'id' | 'created_at' | 'updated_at'> = {
  project: 'sprosty',
  date: '2026-04-11',
  hours_hundredths: 400,
  rate_cents: 12500,
  rate_source: 'global_default',
  billable_status: 'billable',
  bucket_id: null,
  description: 'test entry',
  review_flag: false,
};

describe('loadMonthEntries', () => {
  it('returns an empty file when the month does not exist yet', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    const result = await loadMonthEntries(mock as never, {
      owner: 'test', repo: 'data', month: '2026-04',
    });
    expect(result.data).toEqual({ schema_version: 1, month: '2026-04', entries: [] });
    expect(result.sha).toBeNull();
  });

  it('validates the loaded file against the schema and throws on malformed content', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockResolvedValue({
      data: {
        type: 'file',
        content: btoa(JSON.stringify({ not: 'valid' })),
        sha: 'abc',
        encoding: 'base64',
      },
    });
    await expect(
      loadMonthEntries(mock as never, { owner: 'test', repo: 'data', month: '2026-04' }),
    ).rejects.toThrow(/validation/i);
  });
});

describe('addEntry', () => {
  it('validates the entry against the schema before writing', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({
      data: { content: { sha: 'new' } },
    });
    // Invalid: hours_hundredths = 0
    await expect(
      addEntry(mock as never, {
        owner: 'test', repo: 'data',
        entry: { ...sampleEntry, hours_hundredths: 0 } as unknown as Entry,
      }),
    ).rejects.toThrow(/validation/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/data/entries-repo.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/data/entries-repo.ts`

```ts
import type { Octokit } from '@octokit/rest';
import type { Entry, EntriesFile } from '@/schema/types';
import { validateEntries, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';
import { logMessage } from './commit-messages';

function entriesPath(month: string): string {
  return `data/entries/${month}.json`;
}

export type LoadMonthEntriesArgs = {
  owner: string;
  repo: string;
  month: string; // YYYY-MM
};

export type LoadMonthEntriesResult = {
  data: EntriesFile;
  sha: string | null;
};

/**
 * Load a month's entries file. If the file doesn't exist yet, returns an
 * empty EntriesFile (caller doesn't need to special-case first-of-month).
 */
export async function loadMonthEntries(
  octokit: Octokit,
  args: LoadMonthEntriesArgs,
): Promise<LoadMonthEntriesResult> {
  const path = entriesPath(args.month);
  try {
    const read = await readJsonFile<EntriesFile>(octokit, { owner: args.owner, repo: args.repo, path });
    const result = validateEntries(read.data);
    if (!result.ok) {
      throw new Error(`Entries file ${path} failed validation:\n${formatValidationErrors(result.errors)}`);
    }
    return { data: result.value, sha: read.sha };
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      return { data: { schema_version: 1, month: args.month, entries: [] }, sha: null };
    }
    throw e;
  }
}

export type AddEntryArgs = {
  owner: string;
  repo: string;
  entry: Entry;
};

export async function addEntry(octokit: Octokit, args: AddEntryArgs): Promise<void> {
  const month = args.entry.date.slice(0, 7);
  const path = entriesPath(month);

  // Validate the full entry first as a standalone file (one entry).
  const probe = { schema_version: 1 as const, month, entries: [args.entry] };
  const validation = validateEntries(probe);
  if (!validation.ok) {
    throw new Error(`Entry failed validation:\n${formatValidationErrors(validation.errors)}`);
  }

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: logMessage({
      project: args.entry.project,
      date: args.entry.date,
      hours_hundredths: args.entry.hours_hundredths,
      rate_cents: args.entry.rate_cents,
      description: args.entry.description,
    }),
    transform: (current) => {
      const base: EntriesFile = current ?? { schema_version: 1, month, entries: [] };
      // Prevent duplicate id (spec §5.3 invariant).
      if (base.entries.some((e) => e.id === args.entry.id)) {
        throw new Error(`Duplicate entry id ${args.entry.id} — refusing to overwrite.`);
      }
      return {
        ...base,
        entries: [...base.entries, args.entry],
      };
    },
  });
}

export type UpdateEntryArgs = {
  owner: string;
  repo: string;
  entry: Entry; // The full updated entry; id must match an existing one.
  message: string; // Descriptive commit message (use editMessage helper).
};

export async function updateEntry(octokit: Octokit, args: UpdateEntryArgs): Promise<void> {
  const month = args.entry.date.slice(0, 7);
  const path = entriesPath(month);

  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) throw new Error(`Cannot update entry in a month file that doesn't exist: ${path}`);
      const idx = current.entries.findIndex((e) => e.id === args.entry.id);
      if (idx < 0) throw new Error(`Entry id ${args.entry.id} not found in ${path}`);
      const next = [...current.entries];
      next[idx] = { ...args.entry, updated_at: new Date().toISOString() };
      const updated: EntriesFile = { ...current, entries: next };
      const v = validateEntries(updated);
      if (!v.ok) throw new Error(`Updated entries file failed validation:\n${formatValidationErrors(v.errors)}`);
      return updated;
    },
  });
}

export type DeleteEntryArgs = {
  owner: string;
  repo: string;
  month: string;
  entryId: string;
  message: string;
};

export async function deleteEntry(octokit: Octokit, args: DeleteEntryArgs): Promise<void> {
  const path = entriesPath(args.month);
  await writeJsonFileWithRetry<EntriesFile>(octokit, {
    owner: args.owner,
    repo: args.repo,
    path,
    message: args.message,
    transform: (current) => {
      if (!current) throw new Error(`Cannot delete from missing file ${path}`);
      return {
        ...current,
        entries: current.entries.filter((e) => e.id !== args.entryId),
      };
    },
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/data/entries-repo.test.ts`

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/data/entries-repo.ts tests/data/entries-repo.test.ts
git commit -m "data: entries-repo with validate-before-write and duplicate-id guard"
```

---

### Task 29: `src/data/projects-repo.ts`, `src/data/rates-repo.ts`, `src/data/profile-repo.ts`, `src/data/snapshots-repo.ts`

Four repo modules with the same shape. Bundled into one task to avoid repetition.

**Files:**
- Create: `src/data/projects-repo.ts`
- Create: `src/data/rates-repo.ts`
- Create: `src/data/profile-repo.ts`
- Create: `src/data/snapshots-repo.ts`
- Create: `tests/data/projects-repo.test.ts` (one representative test file)

- [ ] **Step 1: Write `projects-repo.ts`**

File: `src/data/projects-repo.ts`

```ts
import type { Octokit } from '@octokit/rest';
import type { ProjectsConfig } from '@/schema/types';
import { validateProjects, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';

const PATH = 'config/projects.json';

export async function loadProjects(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<{ data: ProjectsConfig; sha: string | null }> {
  try {
    const read = await readJsonFile<ProjectsConfig>(octokit, {
      owner: args.owner, repo: args.repo, path: PATH,
    });
    const v = validateProjects(read.data);
    if (!v.ok) throw new Error(`Projects file failed validation:\n${formatValidationErrors(v.errors)}`);
    return { data: v.value, sha: read.sha };
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      return { data: { schema_version: 1, projects: [] }, sha: null };
    }
    throw e;
  }
}

export async function writeProjects(
  octokit: Octokit,
  args: { owner: string; repo: string; message: string; data: ProjectsConfig },
): Promise<void> {
  const v = validateProjects(args.data);
  if (!v.ok) throw new Error(`Projects file failed validation:\n${formatValidationErrors(v.errors)}`);
  await writeJsonFileWithRetry<ProjectsConfig>(octokit, {
    owner: args.owner, repo: args.repo, path: PATH, message: args.message,
    transform: () => args.data,
  });
}
```

- [ ] **Step 2: Write `rates-repo.ts`**

File: `src/data/rates-repo.ts`

```ts
import type { Octokit } from '@octokit/rest';
import type { RatesConfig } from '@/schema/types';
import { validateRates, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFileWithRetry, FileNotFoundError } from './github-file';

const PATH = 'config/rates.json';

export async function loadRates(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<{ data: RatesConfig; sha: string | null }> {
  try {
    const read = await readJsonFile<RatesConfig>(octokit, {
      owner: args.owner, repo: args.repo, path: PATH,
    });
    const v = validateRates(read.data);
    if (!v.ok) throw new Error(`Rates file failed validation:\n${formatValidationErrors(v.errors)}`);
    return { data: v.value, sha: read.sha };
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      // An empty rates history is INVALID by schema. Return a minimal fallback
      // that mirrors the spec §13 "Default rate" resolution ($125 CAD on project start day).
      return {
        data: {
          schema_version: 1,
          default_rate_history: [{
            effective_from: '2026-04-11', rate_cents: 12500, note: 'Initial rate — seeded by app',
          }],
        },
        sha: null,
      };
    }
    throw e;
  }
}

export async function writeRates(
  octokit: Octokit,
  args: { owner: string; repo: string; message: string; data: RatesConfig },
): Promise<void> {
  const v = validateRates(args.data);
  if (!v.ok) throw new Error(`Rates file failed validation:\n${formatValidationErrors(v.errors)}`);
  await writeJsonFileWithRetry<RatesConfig>(octokit, {
    owner: args.owner, repo: args.repo, path: PATH, message: args.message,
    transform: () => args.data,
  });
}
```

- [ ] **Step 3: Write `profile-repo.ts`**

File: `src/data/profile-repo.ts`

```ts
import type { Octokit } from '@octokit/rest';
import type { Profile } from '@/schema/types';
import { validateProfile, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFile, FileNotFoundError } from './github-file';

const PATH = 'config/profile.json';

export async function loadProfile(
  octokit: Octokit,
  args: { owner: string; repo: string },
): Promise<Profile | null> {
  try {
    const read = await readJsonFile<Profile>(octokit, {
      owner: args.owner, repo: args.repo, path: PATH,
    });
    const v = validateProfile(read.data);
    if (!v.ok) throw new Error(`Profile file failed validation:\n${formatValidationErrors(v.errors)}`);
    return v.value;
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
}

export async function createProfile(
  octokit: Octokit,
  args: { owner: string; repo: string; profile: Profile },
): Promise<void> {
  const v = validateProfile(args.profile);
  if (!v.ok) throw new Error(`Profile failed validation:\n${formatValidationErrors(v.errors)}`);
  await writeJsonFile(octokit, {
    owner: args.owner, repo: args.repo, path: PATH,
    content: args.profile,
    message: `config: init profile for ${args.profile.consultant_id}`,
  });
}
```

- [ ] **Step 4: Write `snapshots-repo.ts`**

File: `src/data/snapshots-repo.ts`

```ts
import type { Octokit } from '@octokit/rest';
import type { Snapshot } from '@/schema/types';
import { validateSnapshot, formatValidationErrors } from '@/schema/validators';
import { readJsonFile, writeJsonFile, FileNotFoundError } from './github-file';
import { snapshotCloseMessage } from './commit-messages';

function path(month: string): string {
  return `data/snapshots/${month}.json`;
}

export async function loadSnapshot(
  octokit: Octokit,
  args: { owner: string; repo: string; month: string },
): Promise<Snapshot | null> {
  try {
    const read = await readJsonFile<Snapshot>(octokit, {
      owner: args.owner, repo: args.repo, path: path(args.month),
    });
    const v = validateSnapshot(read.data);
    if (!v.ok) throw new Error(`Snapshot file failed validation:\n${formatValidationErrors(v.errors)}`);
    return v.value;
  } catch (e) {
    if (e instanceof FileNotFoundError) return null;
    throw e;
  }
}

export async function writeSnapshot(
  octokit: Octokit,
  args: { owner: string; repo: string; snapshot: Snapshot },
): Promise<void> {
  const v = validateSnapshot(args.snapshot);
  if (!v.ok) throw new Error(`Snapshot failed validation:\n${formatValidationErrors(v.errors)}`);
  await writeJsonFile(octokit, {
    owner: args.owner, repo: args.repo, path: path(args.snapshot.month),
    content: args.snapshot,
    message: snapshotCloseMessage({
      month: args.snapshot.month,
      billable_hours_hundredths: args.snapshot.totals.billable_hours_hundredths,
      non_billable_hours_hundredths: args.snapshot.totals.non_billable_hours_hundredths,
      billable_amount_cents: args.snapshot.totals.billable_amount_cents,
    }),
  });
}
```

- [ ] **Step 5: Write representative test file**

File: `tests/data/projects-repo.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { loadProjects, writeProjects } from '@/data/projects-repo';

function mockOctokit() {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
    },
  };
}

describe('projects-repo', () => {
  it('loadProjects returns an empty projects list when the file does not exist', async () => {
    const mock = mockOctokit();
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    const result = await loadProjects(mock as never, { owner: 't', repo: 'r' });
    expect(result.data.projects).toHaveLength(0);
  });

  it('writeProjects refuses to write an invalid projects config', async () => {
    const mock = mockOctokit();
    const bad = {
      schema_version: 1,
      projects: [{ id: 'Has Spaces', name: 'x', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] }],
    };
    await expect(
      writeProjects(mock as never, {
        owner: 't', repo: 'r', message: 'test', data: bad as never,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/data/projects-repo.test.ts`

Expected: 2 passed.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/data/projects-repo.ts src/data/rates-repo.ts src/data/profile-repo.ts src/data/snapshots-repo.ts tests/data/projects-repo.test.ts
git commit -m "data: projects, rates, profile, snapshots repo modules with validation"
```

---

### Task 30: `src/data/new-entry-id.ts` — generate unique entry ids

**Files:**
- Create: `src/data/new-entry-id.ts`
- Create: `tests/data/new-entry-id.test.ts`

- [ ] **Step 1: Write test**

File: `tests/data/new-entry-id.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { newEntryId } from '@/data/new-entry-id';

describe('newEntryId', () => {
  it('produces an id in the format YYYY-MM-DD-<slug>-<6-hex>', () => {
    const id = newEntryId({ date: '2026-04-11', projectSlug: 'sprosty' });
    expect(id).toMatch(/^2026-04-11-sprosty-[a-f0-9]{6}$/);
  });

  it('produces a different id on successive calls', () => {
    const a = newEntryId({ date: '2026-04-11', projectSlug: 'sprosty' });
    const b = newEntryId({ date: '2026-04-11', projectSlug: 'sprosty' });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/data/new-entry-id.test.ts`

Expected: module not found.

- [ ] **Step 3: Write implementation**

File: `src/data/new-entry-id.ts`

```ts
/**
 * Generate a new entry id: YYYY-MM-DD-<project-slug>-<6-char-hex-random>.
 *
 * The random suffix is 6 lowercase hex chars (24 bits) — enough to avoid
 * collisions at any realistic logging rate for one consultant per month
 * (birthday-paradox math: ~4000 entries in one month before 1% collision).
 */
export function newEntryId(args: { date: string; projectSlug: string }): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${args.date}-${args.projectSlug}-${hex}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/data/new-entry-id.test.ts`

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/data/new-entry-id.ts tests/data/new-entry-id.test.ts
git commit -m "data: newEntryId generator with crypto.getRandomValues"
```

---

### Task 31: React Query provider + query keys

**Files:**
- Create: `src/data/query-keys.ts`
- Create: `src/data/query-client.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write query keys**

File: `src/data/query-keys.ts`

```ts
/**
 * Centralized React Query key factory. Every cache key in the app is
 * defined here so invalidations are exhaustive and typo-free.
 */
export const qk = {
  all: ['hours-tracker'] as const,
  partnersIndex: () => [...qk.all, 'partners', 'index'] as const,
  partner: (partnerId: string) => [...qk.all, 'partners', partnerId] as const,
  profile: (repo: string) => [...qk.all, 'profile', repo] as const,
  projects: (repo: string) => [...qk.all, 'projects', repo] as const,
  rates: (repo: string) => [...qk.all, 'rates', repo] as const,
  monthEntries: (repo: string, month: string) => [...qk.all, 'entries', repo, month] as const,
  snapshot: (repo: string, month: string) => [...qk.all, 'snapshots', repo, month] as const,
};
```

- [ ] **Step 2: Write query client**

File: `src/data/query-client.ts`

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // GitHub data changes when WE write. Keep cache fresh.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0, // We handle retries explicitly in data/github-file.ts.
    },
  },
});
```

- [ ] **Step 3: Wire provider into `src/main.tsx`**

File: `src/main.tsx` (replace)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './data/query-client';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/data/query-keys.ts src/data/query-client.ts src/main.tsx
git commit -m "data: react-query provider + centralized query key factory"
```

---

## PHASE 7 — UI foundations

Spec §8.1. App shell with partner branding, routing, shared primitives. This phase builds the **structural UI** — visual polish (micro-interactions, spacing, animation) is applied per-screen during Phase 8 using the `frontend-design:frontend-design` skill inside each screen task.

### Task 32: `src/ui/layout/AppShell.tsx` — top bar, left nav, footer

**Files:**
- Create: `src/ui/layout/AppShell.tsx`
- Create: `src/ui/layout/Footer.tsx`
- Create: `src/ui/layout/LeftNav.tsx`
- Create: `src/ui/README.md`

- [ ] **Step 1: Write shell**

File: `src/ui/layout/AppShell.tsx`

```tsx
import type { ReactNode } from 'react';
import type { Partner } from '@/schema/types';
import { LeftNav } from './LeftNav';
import { Footer } from './Footer';

type Props = {
  partner: Partner;
  consultantDisplayName: string;
  onSignOut: () => void;
  children: ReactNode;
};

/**
 * Top-level app shell (spec §8.1).
 *
 * Layout:
 *   [partner logo]                            prash ▾  [Sign out]
 *   [left nav]  [main content]
 *               [footer: "Powered by SapienEx"]
 */
export function AppShell({ partner, consultantDisplayName, onSignOut, children }: Props): JSX.Element {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="min-h-screen flex flex-col bg-partner-bg-darker text-partner-text font-body">
      <header className="flex items-center justify-between px-6 py-4 border-b border-partner-border-subtle">
        <a
          href={partner.website ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={partner.display_name}
        >
          <img
            src={`${base}partners/${partner.id}/${partner.assets.logo}`}
            alt={partner.assets.logo_alt_text}
            width={partner.assets.logo_width ?? 180}
            height={partner.assets.logo_height ?? 40}
            style={{
              height: '40px',
              width: 'auto',
              filter: partner.theme.mode === 'dark' && partner.assets.logo_dark_filter
                ? partner.assets.logo_dark_filter
                : undefined,
            }}
          />
        </a>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-partner-muted">{consultantDisplayName}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="font-mono text-xs uppercase tracking-wide text-partner-muted hover:text-partner-cyan transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="flex-1 flex">
        <LeftNav />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Write `LeftNav`**

File: `src/ui/layout/LeftNav.tsx`

```tsx
import type { ReactNode } from 'react';

const SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'log', label: 'Log' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'entries', label: 'Entries' },
  { id: 'projects', label: 'Projects' },
  { id: 'rates', label: 'Rates' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'settings', label: 'Settings' },
];

type Props = {
  active?: string;
  onNavigate?: (id: string) => void;
};

export function LeftNav({ active = 'log', onNavigate }: Props): JSX.Element {
  return (
    <nav className="w-48 border-r border-partner-border-subtle p-4">
      <ul className="flex flex-col gap-2">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate?.(s.id)}
              className={`w-full text-left px-3 py-2 rounded font-mono text-sm transition-colors ${
                s.id === active
                  ? 'bg-partner-deep text-partner-text'
                  : 'text-partner-muted hover:text-partner-cyan'
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LeftNavPlaceholder({ children }: { children: ReactNode }): JSX.Element {
  return <div className="w-48 border-r border-partner-border-subtle p-4">{children}</div>;
}
```

- [ ] **Step 3: Write `Footer` with subtle SapienEx attribution**

File: `src/ui/layout/Footer.tsx`

```tsx
export function Footer(): JSX.Element {
  return (
    <footer className="px-6 py-3 border-t border-partner-border-subtle flex justify-end">
      <span className="font-body text-[11px] text-partner-muted">
        Powered by <span className="font-mono">SapienEx</span>
      </span>
    </footer>
  );
}
```

Spec §8.1: "muted text color, 11px, no logo, one line, zero visual weight."

- [ ] **Step 4: Write UI README**

File: `src/ui/README.md`

```markdown
# src/ui

**Purpose:** React components. Screens compose primitives from `components/`. Layout chrome lives in `layout/`.

**Public API:**
- `layout/AppShell.tsx` — top-level wrapper with partner logo, nav, footer
- `screens/*.tsx` — one file per spec §8 screen
- `components/*.tsx` — shared primitives (Button, Input, Select, etc.)

**Invariants:**
1. No data fetching inside components — use React Query hooks from `src/data/hooks/`.
2. No direct localStorage access — go through `src/store/auth-store`.
3. Partner branding (logo, theme) is always sourced from `src/partner/apply-theme.ts` having run at app start; components read from CSS variables.
4. SapienEx attribution never appears outside `layout/Footer.tsx`.

**Dependencies:** React, `@/schema/types`, `@/store/*`, `@/data/*`, `@/calc/*`.
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/ui/layout/ src/ui/README.md
git commit -m "ui: AppShell + LeftNav + Footer with partner branding placement"
```

---

### Task 33: `src/ui/components/` — shared primitives (Button, Input, Select, FieldLabel, HoursChips)

**Files:**
- Create: `src/ui/components/Button.tsx`
- Create: `src/ui/components/Input.tsx`
- Create: `src/ui/components/Select.tsx`
- Create: `src/ui/components/FieldLabel.tsx`
- Create: `src/ui/components/HoursChips.tsx`
- Create: `src/ui/components/Banner.tsx`

- [ ] **Step 1: Write Button**

File: `src/ui/components/Button.tsx`

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
};

export function Button({ variant = 'primary', className = '', children, ...rest }: Props): JSX.Element {
  const base = 'px-4 py-2 rounded font-mono text-sm transition-colors disabled:opacity-50';
  const variants: Record<NonNullable<Props['variant']>, string> = {
    primary: 'bg-partner-deep text-partner-text hover:bg-partner-mid',
    secondary: 'border border-partner-border-strong text-partner-text hover:bg-partner-deep/30',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Write Input**

File: `src/ui/components/Input.tsx`

```tsx
import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = '', ...rest }: Props): JSX.Element {
  return (
    <input
      className={`w-full px-3 py-2 rounded bg-partner-bg-deep border border-partner-border-subtle text-partner-text font-mono text-sm focus:outline-none focus:border-partner-cyan ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 3: Write Select**

File: `src/ui/components/Select.tsx`

```tsx
import type { SelectHTMLAttributes, ReactNode } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function Select({ className = '', children, ...rest }: Props): JSX.Element {
  return (
    <select
      className={`w-full px-3 py-2 rounded bg-partner-bg-deep border border-partner-border-subtle text-partner-text font-mono text-sm focus:outline-none focus:border-partner-cyan ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
```

- [ ] **Step 4: Write FieldLabel**

File: `src/ui/components/FieldLabel.tsx`

```tsx
import type { ReactNode } from 'react';

export function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-partner-muted">{label}</span>
      {children}
      {hint && <span className="font-body text-xs text-partner-muted">{hint}</span>}
    </label>
  );
}
```

- [ ] **Step 5: Write HoursChips (quick-fill preset chips for the Quick Log form)**

File: `src/ui/components/HoursChips.tsx`

```tsx
const PRESETS = [25, 50, 75, 100, 150, 200, 300, 400]; // hundredths

export function HoursChips({ onPick }: { onPick: (hoursHundredths: number) => void }): JSX.Element {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onPick(h)}
          className="px-2 py-1 rounded border border-partner-border-subtle font-mono text-xs text-partner-muted hover:text-partner-cyan hover:border-partner-cyan transition-colors"
        >
          {(h / 100).toFixed(2)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write Banner**

File: `src/ui/components/Banner.tsx`

```tsx
import type { ReactNode } from 'react';

type Props = {
  variant: 'info' | 'warning' | 'error' | 'success';
  children: ReactNode;
};

export function Banner({ variant, children }: Props): JSX.Element {
  const colors: Record<Props['variant'], string> = {
    info: 'bg-partner-deep/30 border-partner-cyan text-partner-text',
    warning: 'bg-yellow-900/30 border-yellow-500 text-yellow-100',
    error: 'bg-red-900/30 border-red-500 text-red-100',
    success: 'bg-green-900/30 border-green-500 text-green-100',
  };
  return (
    <div className={`px-4 py-3 rounded border-l-4 ${colors[variant]}`} role="alert">
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/
git commit -m "ui: shared primitives — Button, Input, Select, FieldLabel, HoursChips, Banner"
```

---

### Task 34: Simple hash-based router and `src/ui/App.tsx` orchestrator

**Files:**
- Create: `src/ui/Router.tsx`
- Modify: `src/App.tsx`
- Create: `src/ui/screens/FirstRun.tsx` (stub — full flow in Task 36)

- [ ] **Step 1: Write the router**

File: `src/ui/Router.tsx`

```tsx
import { useEffect, useState } from 'react';

export type Route = 'log' | 'dashboard' | 'entries' | 'projects' | 'rates' | 'snapshots' | 'settings';

const DEFAULT: Route = 'log';

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRouteState] = useState<Route>(() => parseHash());
  useEffect(() => {
    const onHash = () => setRouteState(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setRoute = (r: Route) => {
    window.location.hash = r;
  };
  return [route, setRoute];
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  const valid: Route[] = ['log', 'dashboard', 'entries', 'projects', 'rates', 'snapshots', 'settings'];
  return (valid as string[]).includes(raw) ? (raw as Route) : DEFAULT;
}
```

- [ ] **Step 2: Write FirstRun stub**

File: `src/ui/screens/FirstRun.tsx`

```tsx
import { Banner } from '@/ui/components/Banner';

export function FirstRun(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-partner-bg-darker">
      <Banner variant="info">
        First-run flow will be implemented in Task 36.
      </Banner>
    </div>
  );
}
```

- [ ] **Step 3: Update `src/App.tsx` to orchestrate auth + partner load + routing**

File: `src/App.tsx` (replace)

```tsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { loadPartner } from '@/partner/load-partner';
import { applyPartnerTheme } from '@/partner/apply-theme';
import type { Partner } from '@/schema/types';
import { AppShell } from '@/ui/layout/AppShell';
import { Banner } from '@/ui/components/Banner';
import { FirstRun } from '@/ui/screens/FirstRun';
import { useRoute } from '@/ui/Router';

export default function App(): JSX.Element {
  const auth = useAuthStore();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [route, setRoute] = useRoute();

  // Rehydrate auth on mount.
  useEffect(() => {
    auth.rehydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load + apply partner theme when partnerId becomes known.
  useEffect(() => {
    if (!auth.partnerId) return;
    let cancelled = false;
    loadPartner(auth.partnerId)
      .then((p) => {
        if (cancelled) return;
        setPartner(p);
        applyPartnerTheme(p);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setPartnerError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.partnerId]);

  if (!auth.partnerId || !auth.token) return <FirstRun />;
  if (partnerError) {
    return (
      <div className="p-6"><Banner variant="error">Failed to load partner: {partnerError}</Banner></div>
    );
  }
  if (!partner) return <div className="p-6 text-partner-muted">Loading partner…</div>;

  return (
    <AppShell
      partner={partner}
      consultantDisplayName={auth.consultantSlug ?? ''}
      onSignOut={() => auth.signOut()}
    >
      <div className="text-partner-muted font-mono text-sm">
        Route: {route} (screens land in Phase 8).
        <button onClick={() => setRoute('dashboard')} className="ml-2 underline">
          go dashboard
        </button>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: exit 0 on both.

- [ ] **Step 5: Run dev server and verify first-run screen renders**

Run: `npm run dev`

Open `http://localhost:5173/hours-tracker/`. Expected: FirstRun stub with info banner. Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Router.tsx src/ui/screens/FirstRun.tsx src/App.tsx
git commit -m "ui: hash router + app orchestrator (auth → partner → shell)"
```

---

### Task 35: React Query hooks for data layer consumption

**Files:**
- Create: `src/data/hooks/use-projects.ts`
- Create: `src/data/hooks/use-rates.ts`
- Create: `src/data/hooks/use-month-entries.ts`
- Create: `src/data/hooks/use-octokit.ts`

- [ ] **Step 1: Write `use-octokit.ts`**

File: `src/data/hooks/use-octokit.ts`

```ts
import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { makeOctokit } from '@/data/octokit-client';

/**
 * Returns a memoized Octokit instance bound to the current auth token.
 * Returns null when unauthenticated.
 */
export function useOctokit() {
  const token = useAuthStore((s) => s.token);
  return useMemo(() => (token ? makeOctokit(token) : null), [token]);
}
```

- [ ] **Step 2: Write `use-projects.ts`**

File: `src/data/hooks/use-projects.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadProjects } from '@/data/projects-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useProjects() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.projects(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const result = await loadProjects(octokit, { owner, repo });
      return result.data;
    },
  });
}
```

- [ ] **Step 3: Write `use-rates.ts`**

File: `src/data/hooks/use-rates.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadRates } from '@/data/rates-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useRates() {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.rates(dataRepo ?? 'none'),
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const result = await loadRates(octokit, { owner, repo });
      return result.data;
    },
  });
}
```

- [ ] **Step 4: Write `use-month-entries.ts`**

File: `src/data/hooks/use-month-entries.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { loadMonthEntries } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { qk } from '@/data/query-keys';
import { useOctokit } from './use-octokit';

export function useMonthEntries(month: string) {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);

  return useQuery({
    queryKey: qk.monthEntries(dataRepo ?? 'none', month),
    enabled: !!octokit && !!dataRepo,
    queryFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const result = await loadMonthEntries(octokit, { owner, repo, month });
      return result.data;
    },
  });
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/hooks/
git commit -m "data: react-query hooks for projects, rates, monthly entries"
```

---

### Task 36: Real First Run screen (partner select → PAT setup → repo validation)

**Files:**
- Modify: `src/ui/screens/FirstRun.tsx`
- Create: `src/ui/screens/first-run/PartnerStep.tsx`
- Create: `src/ui/screens/first-run/ConnectStep.tsx`
- Create: `src/ui/screens/first-run/validate-data-repo.ts`

- [ ] **Step 1: Write `validate-data-repo.ts`**

File: `src/ui/screens/first-run/validate-data-repo.ts`

```ts
import type { Octokit } from '@octokit/rest';
import { loadProfile } from '@/data/profile-repo';

export type ValidateResult =
  | { ok: true; profileExists: boolean }
  | { ok: false; error: string };

/**
 * Validate that the computed data repo exists and (if profile.json is present)
 * matches the selected partner. Spec §8.1.1 Step 2.
 */
export async function validateDataRepo(
  octokit: Octokit,
  args: { owner: string; repo: string; partnerId: string },
): Promise<ValidateResult> {
  try {
    await octokit.rest.repos.get({ owner: args.owner, repo: args.repo });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      return { ok: false, error: `Repo ${args.owner}/${args.repo} not found. Ask your partner admin to create it.` };
    }
    if (status === 403) {
      return { ok: false, error: `Token lacks access to ${args.owner}/${args.repo}. Check the token's repository permissions.` };
    }
    if (status === 401) {
      return { ok: false, error: 'Token invalid or expired. Generate a new one.' };
    }
    return { ok: false, error: (e as Error).message ?? 'Unknown error' };
  }

  // If profile.json exists, enforce partner match.
  const profile = await loadProfile(octokit, { owner: args.owner, repo: args.repo });
  if (profile && profile.partner_id !== args.partnerId) {
    return {
      ok: false,
      error: `Repo belongs to partner "${profile.partner_id}", but you selected "${args.partnerId}".`,
    };
  }
  return { ok: true, profileExists: profile !== null };
}
```

- [ ] **Step 2: Write `PartnerStep.tsx`**

File: `src/ui/screens/first-run/PartnerStep.tsx`

```tsx
import { useEffect, useState } from 'react';
import { loadPartnersIndex } from '@/partner/load-partner';
import type { PartnersIndex } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';

export function PartnerStep({ onNext }: { onNext: (partnerId: string) => void }): JSX.Element {
  const [index, setIndex] = useState<PartnersIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    loadPartnersIndex().then((i) => {
      setIndex(i);
      const firstEnabled = i.partners.find((p) => p.enabled);
      if (firstEnabled) setSelected(firstEnabled.id);
    }).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <Banner variant="error">{error}</Banner>;
  if (!index) return <div className="text-partner-muted">Loading organizations…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">Who are you logging hours for?</h1>
      <FieldLabel label="Organization">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {index.partners.filter((p) => p.enabled).map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </Select>
      </FieldLabel>
      <p className="text-xs text-partner-muted">Don't see your org? Contact SapienEx support.</p>
      <Button onClick={() => onNext(selected)} disabled={!selected}>Continue →</Button>
    </div>
  );
}
```

- [ ] **Step 3: Write `ConnectStep.tsx`**

File: `src/ui/screens/first-run/ConnectStep.tsx`

```tsx
import { useEffect, useState } from 'react';
import { loadPartner } from '@/partner/load-partner';
import { applyPartnerTheme } from '@/partner/apply-theme';
import { makeOctokit } from '@/data/octokit-client';
import type { Partner } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { validateDataRepo } from './validate-data-repo';
import { useAuthStore } from '@/store/auth-store';

const OWNER = 'sapienEx-AI';

type Props = {
  partnerId: string;
  onBack: () => void;
};

export function ConnectStep({ partnerId, onBack }: Props): JSX.Element {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [consultantSlug, setConsultantSlug] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const completeFirstRun = useAuthStore((s) => s.completeFirstRun);

  useEffect(() => {
    loadPartner(partnerId).then((p) => {
      setPartner(p);
      applyPartnerTheme(p);
    }).catch((e: Error) => setError(e.message));
  }, [partnerId]);

  if (error) return <Banner variant="error">{error}</Banner>;
  if (!partner) return <div className="text-partner-muted">Loading partner…</div>;

  const computedRepo = `${OWNER}/${partner.data_repo_prefix}${consultantSlug}`;

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      const octokit = makeOctokit(token);
      const result = await validateDataRepo(octokit, {
        owner: OWNER,
        repo: `${partner!.data_repo_prefix}${consultantSlug}`,
        partnerId,
      });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      completeFirstRun({
        partnerId,
        consultantSlug,
        dataRepo: computedRepo,
        token,
      });
      // App will re-render into authenticated mode automatically.
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <img
        src={`${import.meta.env.BASE_URL}partners/${partner.id}/${partner.assets.logo}`}
        alt={partner.display_name}
        style={{
          height: '40px',
          width: 'auto',
          filter: partner.theme.mode === 'dark' && partner.assets.logo_dark_filter
            ? partner.assets.logo_dark_filter
            : undefined,
        }}
      />
      <h1 className="font-display text-2xl">Connect your GitHub data repo</h1>
      <p className="font-body text-sm text-partner-muted">
        You need a fine-grained Personal Access Token scoped to your private data repo{' '}
        <span className="font-mono">{computedRepo || '(enter slug below)'}</span>.
      </p>
      <ol className="list-decimal list-inside font-body text-sm text-partner-muted space-y-1">
        <li>
          <a
            className="underline hover:text-partner-cyan"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >Open GitHub token settings ↗</a>
        </li>
        <li>Name: <span className="font-mono">hours-tracker</span></li>
        <li>Repository access → "Only select repositories" → <span className="font-mono">{computedRepo || 'your repo'}</span></li>
        <li>Permissions → Contents: Read and write</li>
        <li>Generate and paste below.</li>
      </ol>
      <FieldLabel label="Consultant slug" hint="lowercase, numbers, dashes only — e.g. prash">
        <Input
          value={consultantSlug}
          onChange={(e) => setConsultantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        />
      </FieldLabel>
      <FieldLabel label="Personal Access Token">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..."
        />
      </FieldLabel>
      {error && <Banner variant="error">{error}</Banner>}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} disabled={busy}>← Back</Button>
        <Button onClick={handleConnect} disabled={busy || !consultantSlug || !token}>
          {busy ? 'Connecting…' : 'Connect →'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `FirstRun.tsx` to wire the two steps**

File: `src/ui/screens/FirstRun.tsx` (replace)

```tsx
import { useState } from 'react';
import { PartnerStep } from './first-run/PartnerStep';
import { ConnectStep } from './first-run/ConnectStep';

export function FirstRun(): JSX.Element {
  const [step, setStep] = useState<'partner' | 'connect'>('partner');
  const [partnerId, setPartnerId] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-partner-bg-darker">
      <div className="w-full max-w-xl">
        {step === 'partner' && (
          <PartnerStep
            onNext={(id) => {
              setPartnerId(id);
              setStep('connect');
            }}
          />
        )}
        {step === 'connect' && partnerId && (
          <ConnectStep partnerId={partnerId} onBack={() => setStep('partner')} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: Dev-server smoke test**

Run: `npm run dev`. Open `http://localhost:5173/hours-tracker/`. Expected: Partner select → Connect step with SG branding applied. Kill dev server.

- [ ] **Step 7: Commit**

```bash
git add src/ui/screens/FirstRun.tsx src/ui/screens/first-run/
git commit -m "ui: first-run flow — partner select → PAT connect → data repo validation"
```

---

## PHASE 8 — Core screens

Spec §8.2–§8.8. Each screen is a self-contained `.tsx` file under `src/ui/screens/`. The critical path is **Quick Log + Dashboard** — those get full task detail. The other screens (Entries, Projects, Rates, Snapshots, Settings) each get a focused task that shows the key integration code, and reference spec §8 for behavioral details.

**For every screen task in this phase: before committing, run `npm run lint && npm run typecheck && npm test` and ensure all pass.**

### Task 37: `src/ui/screens/QuickLog.tsx` — the hot path

**Files:**
- Create: `src/ui/screens/QuickLog.tsx`

- [ ] **Step 1: Write QuickLog**

File: `src/ui/screens/QuickLog.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { addEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { newEntryId } from '@/data/new-entry-id';
import { resolveRateAtLogTime } from '@/calc';
import type { Entry, BillableStatus } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Select } from '@/ui/components/Select';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { HoursChips } from '@/ui/components/HoursChips';
import { qk } from '@/data/query-keys';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function QuickLog(): JSX.Element {
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const projects = useProjects();
  const rates = useRates();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [hoursHundredths, setHoursHundredths] = useState(0);
  const [bucketId, setBucketId] = useState<string | null>(null);
  const [status, setStatus] = useState<BillableStatus>('billable');
  const [rateCents, setRateCents] = useState<number>(0);
  const [rateOverridden, setRateOverridden] = useState(false);
  const [description, setDescription] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Auto-resolve rate when project/bucket/date changes (if not manually overridden).
  useEffect(() => {
    if (!projects.data || !rates.data || !projectId) return;
    if (rateOverridden) return;
    try {
      const resolved = resolveRateAtLogTime({
        project_id: projectId,
        bucket_id: bucketId,
        date,
        projects: projects.data,
        rates: rates.data,
      });
      setRateCents(resolved.rate_cents);
    } catch {
      // Silent — bad state handled at save time.
    }
  }, [projectId, bucketId, date, projects.data, rates.data, rateOverridden]);

  // A bucket selection auto-locks status to 'billable' (spec §8.2).
  useEffect(() => {
    if (bucketId !== null) setStatus('billable');
  }, [bucketId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      const project = projects.data?.projects.find((p) => p.id === projectId);
      const resolved = resolveRateAtLogTime({
        project_id: projectId,
        bucket_id: bucketId,
        date,
        projects: projects.data!,
        rates: rates.data!,
      });
      const now = new Date().toISOString();
      const entry: Entry = {
        id: newEntryId({ date, projectSlug: projectId }),
        project: projectId,
        date,
        hours_hundredths: hoursHundredths,
        rate_cents: rateOverridden ? rateCents : resolved.rate_cents,
        rate_source: rateOverridden ? 'entry_override' : resolved.source,
        billable_status: status,
        bucket_id: bucketId,
        description,
        review_flag: false,
        created_at: now,
        updated_at: now,
      };
      await addEntry(octokit, { owner, repo, entry });
      return project?.name ?? projectId;
    },
    onSuccess: (projectName) => {
      setToast(`Logged ${(hoursHundredths / 100).toFixed(2)}h to ${projectName}`);
      setHoursHundredths(0);
      setBucketId(null);
      setDescription('');
      setRateOverridden(false);
      queryClient.invalidateQueries({ queryKey: qk.monthEntries(dataRepo ?? 'none', date.slice(0, 7)) });
    },
  });

  if (projects.isLoading || rates.isLoading) return <div className="text-partner-muted">Loading…</div>;
  if (projects.error) return <Banner variant="error">Failed to load projects: {(projects.error as Error).message}</Banner>;
  if (rates.error) return <Banner variant="error">Failed to load rates: {(rates.error as Error).message}</Banner>;

  const activeProjects = projects.data?.projects.filter((p) => p.active) ?? [];
  const selectedProject = activeProjects.find((p) => p.id === projectId);
  const activeBuckets = selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <h1 className="font-display text-2xl">Log hours</h1>
      {toast && <Banner variant="success">{toast}</Banner>}

      <FieldLabel label="Project">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— select —</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FieldLabel>

      <FieldLabel label="Hours">
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={hoursHundredths === 0 ? '' : (hoursHundredths / 100).toString()}
          onChange={(e) => setHoursHundredths(Math.round(parseFloat(e.target.value || '0') * 100))}
        />
      </FieldLabel>
      <HoursChips onPick={(h) => setHoursHundredths(h)} />

      <FieldLabel label="Bucket">
        <Select value={bucketId ?? ''} onChange={(e) => setBucketId(e.target.value || null)}>
          <option value="">(none — general billable)</option>
          {activeBuckets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="Status">
        <div className="flex gap-4 font-mono text-sm">
          {(['billable', 'non_billable', 'needs_review'] as const).map((s) => (
            <label key={s} className={`flex items-center gap-1 ${bucketId ? 'opacity-50' : ''}`}>
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                disabled={bucketId !== null}
              />
              {s.replace('_', '-')}
            </label>
          ))}
        </div>
      </FieldLabel>

      <FieldLabel label="Rate (cents)" hint={rateOverridden ? 'override' : 'inherited'}>
        <Input
          type="number"
          step="1"
          value={rateCents}
          onChange={(e) => {
            setRateCents(parseInt(e.target.value || '0', 10));
            setRateOverridden(true);
          }}
        />
      </FieldLabel>

      <FieldLabel label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 rounded bg-partner-bg-deep border border-partner-border-subtle text-partner-text font-mono text-sm focus:outline-none focus:border-partner-cyan"
        />
      </FieldLabel>

      {mutation.error && <Banner variant="error">{(mutation.error as Error).message}</Banner>}

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !projectId || !hoursHundredths || !description.trim()}
      >
        {mutation.isPending ? 'Saving…' : 'Save (⌘↵)'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/QuickLog.tsx
git commit -m "ui: QuickLog screen — keyboard-first logging with rate auto-resolve"
```

---

### Task 38: `src/ui/screens/Dashboard.tsx`

**Files:**
- Create: `src/ui/screens/Dashboard.tsx`

- [ ] **Step 1: Write Dashboard**

File: `src/ui/screens/Dashboard.tsx`

```tsx
import { useMemo, useState } from 'react';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { computeMonthTotals } from '@/calc';
import type { Partner } from '@/schema/types';
import { formatCents, formatHours } from '@/format/format';
import { Banner } from '@/ui/components/Banner';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Dashboard({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(currentMonth());
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const rates = useRates();

  const totals = useMemo(() => {
    if (!entries.data || !projects.data || !rates.data) return null;
    return computeMonthTotals(
      { entries: entries.data.entries, projects: projects.data, rates: rates.data },
      month,
    );
  }, [entries.data, projects.data, rates.data, month]);

  if (entries.isLoading || projects.isLoading || rates.isLoading) return <div className="text-partner-muted">Loading…</div>;
  if (entries.error) return <Banner variant="error">Failed to load entries: {(entries.error as Error).message}</Banner>;
  if (!totals) return <div className="text-partner-muted">No data</div>;

  const currency = { currency_symbol: partner.currency_symbol, currency_display_suffix: partner.currency_display_suffix };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">{month}</h1>
        <div className="flex gap-2 font-mono text-sm">
          <button className="text-partner-muted hover:text-partner-cyan" onClick={() => setMonth(prevMonth(month))}>← Prev</button>
          <button className="text-partner-muted hover:text-partner-cyan" onClick={() => setMonth(nextMonth(month))}>Next →</button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <TotalRow label="Billable" hours={totals.billable_hours_hundredths} amount={formatCents(totals.billable_amount_cents, currency)} />
        <TotalRow label="Non-billable" hours={totals.non_billable_hours_hundredths} />
        <TotalRow label="Needs review" hours={totals.needs_review_hours_hundredths} />
        <TotalRow label="Total" hours={totals.total_hours_hundredths} />
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Per project</h2>
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="text-left text-partner-muted">
              <th className="py-1">Project</th>
              <th className="py-1 text-right">Hours</th>
              <th className="py-1 text-right">Billable</th>
            </tr>
          </thead>
          <tbody>
            {totals.per_project.map((p) => {
              const project = projects.data?.projects.find((pp) => pp.id === p.project);
              const totalProjectHours = p.billable_hours_hundredths + p.non_billable_hours_hundredths + p.needs_review_hours_hundredths;
              return (
                <tr key={p.project} className="border-t border-partner-border-subtle">
                  <td className="py-1">{project?.name ?? p.project}</td>
                  <td className="py-1 text-right">{formatHours(totalProjectHours)}</td>
                  <td className="py-1 text-right">{formatCents(p.billable_amount_cents, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TotalRow({ label, hours, amount }: { label: string; hours: number; amount?: string }): JSX.Element {
  return (
    <div className="p-4 rounded border border-partner-border-subtle">
      <div className="font-mono text-xs uppercase tracking-wide text-partner-muted">{label}</div>
      <div className="font-display text-2xl">{formatHours(hours)}</div>
      {amount && <div className="font-mono text-sm text-partner-cyan">{amount}</div>}
    </div>
  );
}

function prevMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr, 10), mo = parseInt(mStr, 10);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}
function nextMonth(m: string): string {
  const [yStr, mStr] = m.split('-');
  const y = parseInt(yStr, 10), mo = parseInt(mStr, 10);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck && npm run lint
git add src/ui/screens/Dashboard.tsx
git commit -m "ui: Dashboard with three-line totals and per-project breakdown"
```

---

### Task 39: Entries / Projects / Rates / Snapshots / Settings screens

**Files:**
- Create: `src/ui/screens/Entries.tsx`
- Create: `src/ui/screens/ProjectsAndBuckets.tsx`
- Create: `src/ui/screens/Rates.tsx`
- Create: `src/ui/screens/Snapshots.tsx`
- Create: `src/ui/screens/Settings.tsx`

Each screen is a thin view over its corresponding data repo module. For MVP, ship **minimum-viable functional** for each — the spec details in §8.3–§8.8 enumerate the full feature set; anything not implemented here goes on the "post-MVP" backlog and is tracked in `docs/superpowers/backlog.md` (created in Task 53).

- [ ] **Step 1: Write `Entries.tsx` (table with delete + edit modal)**

File: `src/ui/screens/Entries.tsx`

```tsx
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { deleteEntry } from '@/data/entries-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { deleteMessage } from '@/data/commit-messages';
import { formatHours } from '@/format/format';
import type { Partner, Entry } from '@/schema/types';
import { formatCents } from '@/format/format';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';

export function Entries({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filter, setFilter] = useState('');
  const entries = useMonthEntries(month);
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (entry: Entry) => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      const { owner, repo } = splitRepoPath(dataRepo);
      await deleteEntry(octokit, {
        owner, repo, month,
        entryId: entry.id,
        message: deleteMessage(entry.id, 'deleted via UI'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.monthEntries(dataRepo ?? 'none', month) });
    },
  });

  const visible = (entries.data?.entries ?? []).filter((e) =>
    !filter || e.project.includes(filter) || e.description.toLowerCase().includes(filter.toLowerCase()),
  );
  const currency = { currency_symbol: partner.currency_symbol, currency_display_suffix: partner.currency_display_suffix };

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <h1 className="font-display text-2xl">Entries · {month}</h1>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>
      {entries.isLoading && <div className="text-partner-muted">Loading…</div>}
      {entries.error && <Banner variant="error">{(entries.error as Error).message}</Banner>}
      {deleteMutation.error && <Banner variant="error">{(deleteMutation.error as Error).message}</Banner>}
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="text-left text-partner-muted">
            <th>Date</th><th>Project</th><th>Hours</th><th>Rate</th><th>Status</th><th>Description</th><th />
          </tr>
        </thead>
        <tbody>
          {visible.map((e) => (
            <tr key={e.id} className="border-t border-partner-border-subtle">
              <td className="py-1">{e.date}</td>
              <td className="py-1">{e.project}</td>
              <td className="py-1">{formatHours(e.hours_hundredths)}</td>
              <td className="py-1">{formatCents(e.rate_cents, currency)}</td>
              <td className="py-1">{e.billable_status}</td>
              <td className="py-1 truncate max-w-xs">{e.description}</td>
              <td className="py-1">
                <Button variant="danger" onClick={() => {
                  if (confirm(`Delete entry ${e.id}?`)) deleteMutation.mutate(e);
                }}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write `ProjectsAndBuckets.tsx` (CRUD via projects-repo)**

File: `src/ui/screens/ProjectsAndBuckets.tsx`

```tsx
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useProjects } from '@/data/hooks/use-projects';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { writeProjects } from '@/data/projects-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { configAddProjectMessage } from '@/data/commit-messages';
import type { Project } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { Banner } from '@/ui/components/Banner';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { qk } from '@/data/query-keys';

export function ProjectsAndBuckets(): JSX.Element {
  const projects = useProjects();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [newProjName, setNewProjName] = useState('');
  const [newProjId, setNewProjId] = useState('');

  const addProjectMutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo) throw new Error('Not authenticated');
      if (!projects.data) throw new Error('Projects not loaded');
      const { owner, repo } = splitRepoPath(dataRepo);
      const next: Project = {
        id: newProjId,
        name: newProjName,
        client: null,
        active: true,
        is_internal: false,
        default_rate_cents: null,
        buckets: [],
      };
      await writeProjects(octokit, {
        owner, repo,
        data: { ...projects.data, projects: [...projects.data.projects, next] },
        message: configAddProjectMessage(newProjName),
      });
    },
    onSuccess: () => {
      setNewProjName('');
      setNewProjId('');
      queryClient.invalidateQueries({ queryKey: qk.projects(dataRepo ?? 'none') });
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="font-display text-2xl">Projects & Buckets</h1>
      {projects.error && <Banner variant="error">{(projects.error as Error).message}</Banner>}
      <section className="flex items-end gap-2">
        <FieldLabel label="New project id"><Input value={newProjId} onChange={(e) => setNewProjId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></FieldLabel>
        <FieldLabel label="Name"><Input value={newProjName} onChange={(e) => setNewProjName(e.target.value)} /></FieldLabel>
        <Button onClick={() => addProjectMutation.mutate()} disabled={!newProjId || !newProjName || addProjectMutation.isPending}>Add</Button>
      </section>
      {addProjectMutation.error && <Banner variant="error">{(addProjectMutation.error as Error).message}</Banner>}
      <ul className="flex flex-col gap-2">
        {projects.data?.projects.map((p) => (
          <li key={p.id} className="p-3 rounded border border-partner-border-subtle">
            <div className="flex items-center justify-between">
              <span className="font-display">{p.name}</span>
              <span className="font-mono text-xs text-partner-muted">{p.id}</span>
            </div>
            {p.buckets.length > 0 && (
              <ul className="mt-2 pl-4 font-mono text-sm text-partner-muted">
                {p.buckets.map((b) => (
                  <li key={b.id}>{b.type} · {b.name} · {b.budgeted_hours_hundredths / 100}h · {b.status}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Banner variant="info">MVP: project add only. Bucket CRUD and full editing is the first post-MVP follow-up (see backlog).</Banner>
    </div>
  );
}
```

- [ ] **Step 3: Write `Rates.tsx`**

File: `src/ui/screens/Rates.tsx`

```tsx
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { writeRates } from '@/data/rates-repo';
import { splitRepoPath } from '@/data/octokit-client';
import { configAddRateMessage } from '@/data/commit-messages';
import { formatCents } from '@/format/format';
import type { Partner } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { Banner } from '@/ui/components/Banner';
import { qk } from '@/data/query-keys';

export function Rates({ partner }: { partner: Partner }): JSX.Element {
  const rates = useRates();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();
  const [dollars, setDollars] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const currency = { currency_symbol: partner.currency_symbol, currency_display_suffix: partner.currency_display_suffix };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo || !rates.data) throw new Error('Not ready');
      const { owner, repo } = splitRepoPath(dataRepo);
      const rateCents = Math.round(parseFloat(dollars) * 100);
      await writeRates(octokit, {
        owner, repo,
        data: {
          ...rates.data,
          default_rate_history: [
            ...rates.data.default_rate_history,
            { effective_from: effectiveFrom, rate_cents: rateCents, note },
          ],
        },
        message: configAddRateMessage(rateCents, effectiveFrom),
      });
    },
    onSuccess: () => {
      setDollars('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: qk.rates(dataRepo ?? 'none') });
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="font-display text-2xl">Rates</h1>
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="text-left text-partner-muted"><th>Effective from</th><th>Rate</th><th>Note</th></tr>
        </thead>
        <tbody>
          {rates.data?.default_rate_history.map((r) => (
            <tr key={r.effective_from} className="border-t border-partner-border-subtle">
              <td className="py-1">{r.effective_from}</td>
              <td className="py-1">{formatCents(r.rate_cents, currency)}</td>
              <td className="py-1 text-partner-muted">{r.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="flex items-end gap-2">
        <FieldLabel label="New rate (dollars)"><Input type="number" step="0.01" value={dollars} onChange={(e) => setDollars(e.target.value)} /></FieldLabel>
        <FieldLabel label="Effective from"><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></FieldLabel>
        <FieldLabel label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FieldLabel>
        <Button onClick={() => addMutation.mutate()} disabled={!dollars || addMutation.isPending}>Add</Button>
      </section>
      {addMutation.error && <Banner variant="error">{(addMutation.error as Error).message}</Banner>}
      <Banner variant="info">Bulk rate update tool (spec §7 row 9) lands in post-MVP.</Banner>
    </div>
  );
}
```

- [ ] **Step 4: Write `Snapshots.tsx`**

File: `src/ui/screens/Snapshots.tsx`

```tsx
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useMonthEntries } from '@/data/hooks/use-month-entries';
import { useProjects } from '@/data/hooks/use-projects';
import { useRates } from '@/data/hooks/use-rates';
import { useOctokit } from '@/data/hooks/use-octokit';
import { useAuthStore } from '@/store/auth-store';
import { splitRepoPath } from '@/data/octokit-client';
import { writeSnapshot } from '@/data/snapshots-repo';
import { computeMonthTotals, hashEntries } from '@/calc';
import type { Partner, Snapshot } from '@/schema/types';
import { formatCents, formatHours } from '@/format/format';
import { Banner } from '@/ui/components/Banner';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { qk } from '@/data/query-keys';

export function Snapshots({ partner }: { partner: Partner }): JSX.Element {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const entries = useMonthEntries(month);
  const projects = useProjects();
  const rates = useRates();
  const octokit = useOctokit();
  const dataRepo = useAuthStore((s) => s.dataRepo);
  const queryClient = useQueryClient();

  const currency = { currency_symbol: partner.currency_symbol, currency_display_suffix: partner.currency_display_suffix };

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!octokit || !dataRepo || !entries.data || !projects.data || !rates.data) throw new Error('Not ready');
      const { owner, repo } = splitRepoPath(dataRepo);
      const totals = computeMonthTotals(
        { entries: entries.data.entries, projects: projects.data, rates: rates.data },
        month,
      );
      const sourceHash = await hashEntries(entries.data.entries);
      const snap: Snapshot = {
        schema_version: 1,
        month,
        closed_at: new Date().toISOString(),
        closed_at_commit_sha: '0000000', // best-effort; CI deploy tracks real sha
        source_hash: sourceHash,
        totals: {
          total_hours_hundredths: totals.total_hours_hundredths,
          billable_hours_hundredths: totals.billable_hours_hundredths,
          non_billable_hours_hundredths: totals.non_billable_hours_hundredths,
          needs_review_hours_hundredths: totals.needs_review_hours_hundredths,
          billable_amount_cents: totals.billable_amount_cents,
        },
        per_project: totals.per_project,
        entry_ids: entries.data.entries.map((e) => e.id),
      };
      await writeSnapshot(octokit, { owner, repo, snapshot: snap });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.snapshot(dataRepo ?? 'none', month) });
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="font-display text-2xl">Snapshots</h1>
      <FieldLabel label="Month to close">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </FieldLabel>
      {entries.data && projects.data && rates.data && (() => {
        const totals = computeMonthTotals(
          { entries: entries.data.entries, projects: projects.data, rates: rates.data },
          month,
        );
        return (
          <div className="p-4 rounded border border-partner-border-subtle font-mono text-sm">
            <div>Billable: {formatHours(totals.billable_hours_hundredths)} · {formatCents(totals.billable_amount_cents, currency)}</div>
            <div>Non-billable: {formatHours(totals.non_billable_hours_hundredths)}</div>
            <div>Needs review: {formatHours(totals.needs_review_hours_hundredths)}</div>
          </div>
        );
      })()}
      {closeMutation.error && <Banner variant="error">{(closeMutation.error as Error).message}</Banner>}
      <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
        {closeMutation.isPending ? 'Closing…' : `Close ${month}`}
      </Button>
      <Banner variant="warning">Drift detection + snapshot list view land in post-MVP (see backlog).</Banner>
    </div>
  );
}
```

- [ ] **Step 5: Write `Settings.tsx`**

File: `src/ui/screens/Settings.tsx`

```tsx
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';

export function Settings(): JSX.Element {
  const auth = useAuthStore();
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="font-display text-2xl">Settings</h1>
      <section className="font-mono text-sm">
        <div><span className="text-partner-muted">partner_id:</span> {auth.partnerId}</div>
        <div><span className="text-partner-muted">consultant_slug:</span> {auth.consultantSlug}</div>
        <div><span className="text-partner-muted">data_repo:</span> {auth.dataRepo}</div>
      </section>
      <Banner variant="warning">Signing out clears your token and sends you back to the first-run flow.</Banner>
      <Button variant="danger" onClick={() => auth.signOut()}>Sign out</Button>
    </div>
  );
}
```

- [ ] **Step 6: Wire all screens into `src/App.tsx`**

Update `src/App.tsx` to replace the placeholder `<div>Route: {route}...</div>` with a real switch:

```tsx
import { QuickLog } from '@/ui/screens/QuickLog';
import { Dashboard } from '@/ui/screens/Dashboard';
import { Entries } from '@/ui/screens/Entries';
import { ProjectsAndBuckets } from '@/ui/screens/ProjectsAndBuckets';
import { Rates } from '@/ui/screens/Rates';
import { Snapshots } from '@/ui/screens/Snapshots';
import { Settings } from '@/ui/screens/Settings';
```

And replace the children of `<AppShell>` with:

```tsx
{route === 'log' && <QuickLog />}
{route === 'dashboard' && <Dashboard partner={partner} />}
{route === 'entries' && <Entries partner={partner} />}
{route === 'projects' && <ProjectsAndBuckets />}
{route === 'rates' && <Rates partner={partner} />}
{route === 'snapshots' && <Snapshots partner={partner} />}
{route === 'settings' && <Settings />}
```

Also pass `active={route}` and `onNavigate={setRoute}` to `LeftNav` (requires threading those props through AppShell — update AppShell to accept `active` and `onNavigate` and forward them to `LeftNav`).

- [ ] **Step 7: Typecheck + lint + commit**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: all green.

```bash
git add src/ui/screens/ src/App.tsx src/ui/layout/AppShell.tsx
git commit -m "ui: entries, projects, rates, snapshots, settings screens wired to router"
```

---

### Task 40: `src/ui/runtime-invariants.ts` — cross-path verification

**Files:**
- Create: `src/ui/runtime-invariants.ts`
- Modify: `src/ui/screens/Dashboard.tsx`

- [ ] **Step 1: Write invariant checker**

File: `src/ui/runtime-invariants.ts`

```ts
import { sumCents, sumHundredths } from '@/calc';
import type { MonthTotals } from '@/schema/types';

/**
 * Cross-path verification of MonthTotals (spec §7.2 layer 5).
 *
 * Recomputes the same numbers via a second path:
 *   - top-level billable_amount_cents should equal sum of per_project billable_amount_cents
 *   - top-level total_hours should equal billable + non_billable + needs_review
 *
 * Throws on any mismatch. Caller renders an error banner instead of wrong numbers.
 */
export function assertMonthTotalsInvariants(totals: MonthTotals): void {
  const billableCrossCheck = sumCents(totals.per_project.map((p) => p.billable_amount_cents));
  if (billableCrossCheck !== totals.billable_amount_cents) {
    throw new Error(
      `Invariant violation: per-project billable sum (${billableCrossCheck}) !== top-level (${totals.billable_amount_cents})`,
    );
  }
  const conservedTotal = sumHundredths([
    totals.billable_hours_hundredths,
    totals.non_billable_hours_hundredths,
    totals.needs_review_hours_hundredths,
  ]);
  if (conservedTotal !== totals.total_hours_hundredths) {
    throw new Error(
      `Invariant violation: conservation breach total=${totals.total_hours_hundredths} parts=${conservedTotal}`,
    );
  }
}
```

- [ ] **Step 2: Call the invariant check in Dashboard before render**

In `src/ui/screens/Dashboard.tsx`, wrap the totals computation:

```tsx
import { assertMonthTotalsInvariants } from '@/ui/runtime-invariants';

const totals = useMemo(() => {
  if (!entries.data || !projects.data || !rates.data) return null;
  const t = computeMonthTotals(
    { entries: entries.data.entries, projects: projects.data, rates: rates.data },
    month,
  );
  assertMonthTotalsInvariants(t); // throws → React error boundary handles it
  return t;
}, [entries.data, projects.data, rates.data, month]);
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add src/ui/runtime-invariants.ts src/ui/screens/Dashboard.tsx
git commit -m "ui: runtime invariant check in dashboard render path"
```

---

### Task 41: **GATE B — Multi-agent UI integration review**

Before proceeding to March import, dispatch 2 subagents to independently verify the UI correctly renders calc results.

- [ ] **Step 1: Run full test suite**

```bash
npm test
npm run lint
npm run typecheck
```

Expected: exit 0 on all.

- [ ] **Step 2: Dispatch Reviewer Agent 1**

```
You are reviewing the UI integration of src/calc against the design spec.

Verify:
1. src/ui/screens/Dashboard.tsx calls computeMonthTotals AND assertMonthTotalsInvariants, and the invariant check runs on every render where totals change. Read src/ui/runtime-invariants.ts and Dashboard.tsx.
2. src/ui/screens/QuickLog.tsx calls resolveRateAtLogTime for rate population, not a custom lookup. Verify no ad-hoc rate math lives in the screen file.
3. src/format/format.ts is the ONLY place in src/ui/ that converts _cents/_hundredths to display strings. Grep src/ui/ for `/ 100`, `.toFixed`, `Math.round`, and confirm every hit routes through format.ts.
4. Numbers shown in Dashboard per-project rows match numbers shown in top-level totals when both are summed (i.e. the invariant check would fire if they diverged).

Report ✓/✗ per claim with file:line evidence.
```

- [ ] **Step 3: Dispatch Reviewer Agent 2**

```
You are reviewing the partner branding layer against spec §0, §5.1, §8.1.

Verify:
1. Partner logo is ALWAYS rendered top-left in src/ui/layout/AppShell.tsx and never in src/ui/layout/Footer.tsx.
2. SapienEx attribution appears ONLY in src/ui/layout/Footer.tsx and is a single line of muted text (no logo).
3. src/ui/screens/FirstRun.tsx flow: partner select → connect → validate (matches spec §8.1.1 flow).
4. Every partner theme token referenced by components maps to a CSS custom property set by src/partner/apply-theme.ts. Cross-reference tailwind.config.ts colors.partner.* with apply-theme.ts.
5. document.title is set to "Hours · <partner display_name>" by apply-theme.ts.

Report ✓/✗ per claim with file:line evidence.
```

- [ ] **Step 4: Both reviewers must agree on every claim.**

Fix any ✗ before proceeding. Any disagreement on a claim blocks progress.

- [ ] **Step 5: Tag the gate**

```bash
git commit --allow-empty -m "gate-b: ui integration multi-agent review passed"
git tag gate-b-ui-integration
```

---

## PHASE 9 — March 2026 import

Spec §9. One-time importer that parses your Apple Notes March content into `entries/2026-03.json`.

### Task 42: `scripts/import-march-2026.ts`

**Files:**
- Create: `scripts/import-march-2026.ts`
- Create: `scripts/march-2026-source.md` (the raw notes as you provided them)
- Create: `tests/scripts/import-march-2026.test.ts`

- [ ] **Step 1: Save the raw notes**

File: `scripts/march-2026-source.md`

Paste the full March 2026 notes block from the user's original message (the block beginning with "Internal - March 1 - 1 hr - Monthly planning (not billing)" and ending with "Bayard - March 31 - 1 hr - order object design..."). Use the actual content verbatim, one entry per line, including blank lines that separate groupings.

- [ ] **Step 2: Write the parser**

File: `scripts/import-march-2026.ts`

```ts
#!/usr/bin/env -S npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

// Reuse types but NOT validators at script time — validation happens after
// building the EntriesFile so we can print a precise per-line error report.
import type { Entry, EntriesFile, BillableStatus, RateSource } from '../src/schema/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'march-2026-source.md');
const OUT = join(HERE, '..', 'tests', 'fixtures', '2026-03-golden.json');
const IMPORT_TS = '2026-04-11T00:00:00Z';
const GLOBAL_RATE_CENTS = 12500; // Spec §13 resolved rate.

// Project slug normalizer. Any unknown project throws — no silent "default" project.
const SLUGS: Record<string, string> = {
  internal: 'internal',
  sprosty: 'sprosty',
  shannex: 'shannex',
  axiom: 'axiom',
  bayard: 'bayard',
  truvista: 'truvista',
  pickleplex: 'pickleplex',
  'sparc bc': 'sparc-bc',
  sparcbc: 'sparc-bc',
  sterling: 'sterling',
  'tech lead': 'tech-lead',
  bluejlegal: 'bluej-legal',
  'pre-sales': 'pre-sales',
  imagelift: 'image-lift',
};

function slugify(projectRaw: string): string {
  const key = projectRaw.trim().toLowerCase();
  const slug = SLUGS[key];
  if (!slug) throw new Error(`Unknown project: "${projectRaw}"`);
  return slug;
}

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

function parseDate(text: string): string {
  // "March 25" → "2026-03-25"
  const m = text.trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!m) throw new Error(`Bad date: "${text}"`);
  const month = MONTH_NAME_TO_NUMBER[m[1].toLowerCase()];
  if (!month) throw new Error(`Bad month: "${m[1]}"`);
  return `2026-${month}-${m[2].padStart(2, '0')}`;
}

function parseHours(text: string): number {
  // "1 hr", "0.75 hr", "0.15 hr", "2hr"
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*hr/);
  if (!m) throw new Error(`Bad hours: "${text}"`);
  return Math.round(parseFloat(m[1]) * 100);
}

/**
 * Detect annotations inside a line segment. Returns:
 *   { billableStatus, rateOverrideCents | null, cleaned description }
 */
function extractAnnotations(line: string): { billable: BillableStatus; rateOverride: number | null; description: string; reviewFlag: boolean } {
  let billable: BillableStatus = 'billable';
  let rateOverride: number | null = null;
  let reviewFlag = false;
  let cleaned = line;

  // (at $X hourly rate)
  const rateMatch = cleaned.match(/\(at\s+\$(\d+(?:\.\d+)?)\s+hourly rate\)/i);
  if (rateMatch) {
    rateOverride = Math.round(parseFloat(rateMatch[1]) * 100);
    cleaned = cleaned.replace(rateMatch[0], '').trim();
  }

  // (not billing?) / (billing?)
  if (/\(not billing\?\)/i.test(cleaned) || /\(billing\?\)/i.test(cleaned)) {
    billable = 'needs_review';
    reviewFlag = true;
    cleaned = cleaned.replace(/\((?:not\s+)?billing\?\)/gi, '').trim();
  } else if (/\(not billing\)/i.test(cleaned)) {
    billable = 'non_billable';
    cleaned = cleaned.replace(/\(not billing\)/gi, '').trim();
  }

  return { billable, rateOverride, description: cleaned, reviewFlag };
}

function newId(date: string, projectSlug: string): string {
  return `${date}-${projectSlug}-${randomBytes(3).toString('hex')}`;
}

function parseLine(line: string): Entry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Format: Project - Date - HOURS hr [- (annotations)] - description
  // Or:     Project - Date (annotation) - HOURS hr - description
  // The notes are inconsistent; we split on " - " and identify segments heuristically.
  const parts = trimmed.split(/\s+-\s+/);
  if (parts.length < 3) throw new Error(`Cannot parse (need >= 3 parts): "${trimmed}"`);

  const projectRaw = parts[0];
  const projectSlug = slugify(projectRaw);

  // Find the hours segment — it's the one matching /\d+(\.\d+)?\s*hr/.
  const hoursIdx = parts.findIndex((p) => /\d+(?:\.\d+)?\s*hr/.test(p));
  if (hoursIdx < 0) throw new Error(`No hours segment: "${trimmed}"`);

  // Date is parts[1] with any annotation stripped.
  const rawDate = parts[1].replace(/\([^)]*\)/g, '').trim();
  const date = parseDate(rawDate);

  // Hours comes from parts[hoursIdx] (may itself have annotations).
  const hoursSegment = parts[hoursIdx];
  const hours = parseHours(hoursSegment);

  // Description is everything after hoursIdx joined back with " - ".
  const descParts = parts.slice(hoursIdx + 1);
  const rawDesc = descParts.join(' - ') || parts.slice(1).filter((_, i) => i !== hoursIdx - 1).join(' - ');
  // Pull annotations from both the hours segment AND the date segment (notes put them anywhere).
  const annotationsFromLine = extractAnnotations([parts[1], hoursSegment, rawDesc].join(' '));

  const baseDescription = annotationsFromLine.description.replace(/\s+/g, ' ').trim();

  const rateCents = annotationsFromLine.rateOverride ?? GLOBAL_RATE_CENTS;
  const rateSource: RateSource =
    annotationsFromLine.rateOverride !== null ? 'entry_override' : 'global_default';

  return {
    id: newId(date, projectSlug),
    project: projectSlug,
    date,
    hours_hundredths: hours,
    rate_cents: annotationsFromLine.billable === 'non_billable' ? 0 : rateCents,
    rate_source: rateSource,
    billable_status: annotationsFromLine.billable,
    bucket_id: null,
    description: baseDescription || '(no description)',
    review_flag: annotationsFromLine.reviewFlag,
    created_at: IMPORT_TS,
    updated_at: IMPORT_TS,
  };
}

function main() {
  const source = readFileSync(SOURCE, 'utf8');
  const lines = source.split('\n');
  const entries: Entry[] = [];
  const errors: Array<{ line: number; msg: string; text: string }> = [];

  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const e = parseLine(line);
      if (e) entries.push(e);
    } catch (err) {
      errors.push({ line: i + 1, msg: (err as Error).message, text: line });
    }
  });

  if (errors.length > 0) {
    console.error(`\n${errors.length} parse errors:`);
    for (const e of errors) console.error(`  line ${e.line}: ${e.msg}\n    > ${e.text}`);
    process.exit(1);
  }

  const file: EntriesFile = {
    schema_version: 1,
    month: '2026-03',
    entries,
  };

  writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${entries.length} entries to ${OUT}`);

  // Also emit a content hash so the user can detect future changes.
  const hash = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  console.log(`Content sha256: ${hash}`);
}

main();
```

- [ ] **Step 3: Run the importer**

Run: `npm run import:march`

Expected: "Wrote N entries to tests/fixtures/2026-03-golden.json" with no errors. If any line fails to parse, fix the parser OR add the variant to the test data. The goal is **zero errors with perfect line coverage**.

- [ ] **Step 4: Open the output and spot-check**

Read the generated `tests/fixtures/2026-03-golden.json`. Verify:
- The count matches the number of non-blank lines in `scripts/march-2026-source.md`.
- Rate overrides at $20 appear only on Sprosty Skyvia entries.
- Non-billable / needs-review flags match your annotations.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-march-2026.ts scripts/march-2026-source.md tests/fixtures/2026-03-golden.json
git commit -m "scripts: march 2026 importer + generated golden fixture"
```

---

### Task 43: Hand-verify expected totals for March 2026 golden

**Files:**
- Create: `tests/fixtures/2026-03-expected.json`
- Create: `tests/calc/golden-full.test.ts`

- [ ] **Step 1: Create a Prash-verified expected-totals file**

This is a **manual** step. Prash reads the output `tests/fixtures/2026-03-golden.json` and computes expected totals by hand (or verifies the parser's output matches their Apple Notes total). The computation is mechanical once the parser is correct: sum hours per billable_status, sum rates × hours per billable entry.

Create `tests/fixtures/2026-03-expected.json` with the following shape (values filled in during the manual verification):

```json
{
  "_notes": "Hand-verified by Prash on YYYY-MM-DD after running import:march.",
  "month": "2026-03",
  "total_hours_hundredths": 0,
  "billable_hours_hundredths": 0,
  "non_billable_hours_hundredths": 0,
  "needs_review_hours_hundredths": 0,
  "billable_amount_cents": 0
}
```

Run a helper to get the numbers you'd plug in:

Run: `npx tsx -e 'import("./src/calc/totals.ts").then(async (m) => { const f = (await import("node:fs")).readFileSync("tests/fixtures/2026-03-golden.json", "utf8"); const data = JSON.parse(f); const projects = { schema_version: 1, projects: [{id:"sprosty",name:"Sprosty",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"internal",name:"Internal",client:null,active:true,is_internal:true,default_rate_cents:null,buckets:[]},{id:"shannex",name:"Shannex",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"axiom",name:"Axiom",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"bayard",name:"Bayard",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"truvista",name:"TruVista",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"pickleplex",name:"Pickleplex",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"sparc-bc",name:"Sparc BC",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"sterling",name:"Sterling",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"tech-lead",name:"Tech Lead",client:null,active:true,is_internal:true,default_rate_cents:null,buckets:[]},{id:"bluej-legal",name:"BlueJ Legal",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]},{id:"pre-sales",name:"Pre-sales",client:null,active:true,is_internal:true,default_rate_cents:null,buckets:[]},{id:"image-lift",name:"ImageLift",client:null,active:true,is_internal:false,default_rate_cents:null,buckets:[]}] }; const rates = { schema_version: 1, default_rate_history: [{ effective_from: "2026-01-01", rate_cents: 12500 }] }; console.log(JSON.stringify(m.computeMonthTotals({ entries: data.entries, projects, rates }, "2026-03"), null, 2)); });'`

Copy the returned totals into `tests/fixtures/2026-03-expected.json`. **Verify by hand** against the Apple Notes source before committing — this is the immutable regression fixture for every future build.

- [ ] **Step 2: Write golden-full test**

File: `tests/calc/golden-full.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computeMonthTotals } from '@/calc';
import golden from '../fixtures/2026-03-golden.json';
import expected from '../fixtures/2026-03-expected.json';
import type { EntriesFile } from '@/schema/types';

const projects = {
  schema_version: 1 as const,
  projects: [
    { id: 'sprosty', name: 'Sprosty', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'internal', name: 'Internal', client: null, active: true, is_internal: true, default_rate_cents: null, buckets: [] },
    { id: 'shannex', name: 'Shannex', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'axiom', name: 'Axiom', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'bayard', name: 'Bayard', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'truvista', name: 'TruVista', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'pickleplex', name: 'Pickleplex', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'sparc-bc', name: 'Sparc BC', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'sterling', name: 'Sterling', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'tech-lead', name: 'Tech Lead', client: null, active: true, is_internal: true, default_rate_cents: null, buckets: [] },
    { id: 'bluej-legal', name: 'BlueJ Legal', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
    { id: 'pre-sales', name: 'Pre-sales', client: null, active: true, is_internal: true, default_rate_cents: null, buckets: [] },
    { id: 'image-lift', name: 'ImageLift', client: null, active: true, is_internal: false, default_rate_cents: null, buckets: [] },
  ],
};

const rates = {
  schema_version: 1 as const,
  default_rate_history: [{ effective_from: '2026-01-01', rate_cents: 12500 }],
};

describe('March 2026 full golden', () => {
  it('totals match the hand-verified expected values', () => {
    const file = golden as EntriesFile;
    const result = computeMonthTotals({ entries: file.entries, projects, rates }, '2026-03');
    expect(result.total_hours_hundredths).toBe((expected as any).total_hours_hundredths);
    expect(result.billable_hours_hundredths).toBe((expected as any).billable_hours_hundredths);
    expect(result.non_billable_hours_hundredths).toBe((expected as any).non_billable_hours_hundredths);
    expect(result.needs_review_hours_hundredths).toBe((expected as any).needs_review_hours_hundredths);
    expect(result.billable_amount_cents).toBe((expected as any).billable_amount_cents);
  });
});
```

- [ ] **Step 3: Run golden test**

Run: `npm run test:golden`

Expected: passing. If it fails, the parser has a bug — investigate and fix before committing.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/2026-03-expected.json tests/calc/golden-full.test.ts
git commit -m "tests: full march 2026 golden regression test"
```

---

### Task 44: **GATE C — Pre-release calc review on real data**

- [ ] **Step 1: Full test suite**

```bash
npm test
npm run lint
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Dispatch 3 parallel reviewer agents**

Agent prompts (customize as needed):

```
AGENT 1 — Import correctness:
Review scripts/import-march-2026.ts and scripts/march-2026-source.md. Verify every line in the source maps to an entry in tests/fixtures/2026-03-golden.json. For 10 random lines, trace: source line → parser output → expected entry fields. Report any drift. Also: confirm `(at $20 hourly rate)` entries all have rate_source="entry_override" and rate_cents=2000.

AGENT 2 — Hand verification:
Read tests/fixtures/2026-03-expected.json. For each of the 5 top-level numbers (total, billable, non-billable, needs_review, billable_amount_cents), recompute from the raw Apple Notes source in scripts/march-2026-source.md. Show your work. Flag any discrepancies.

AGENT 3 — Regression safety:
Verify the golden-full test (tests/calc/golden-full.test.ts) passes AND that modifying any single hour in tests/fixtures/2026-03-golden.json would cause it to fail. (Run the test once, then mutate one hours_hundredths field temporarily, re-run, verify fail, revert.) Confirm the fixture is truly immutable regression.
```

All three must agree. If any dissent, fix and re-review.

- [ ] **Step 3: Tag the gate**

```bash
git commit --allow-empty -m "gate-c: pre-release march import review passed"
git tag gate-c-march-golden
```

---

## PHASE 10 — Deploy

### Task 45: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write CI**

File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck, lint, test, build on every push and pr"
```

---

### Task 46: Deploy workflow for project-scoped GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write deploy**

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run typecheck && npm run lint && npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "deploy: github pages workflow for project-scoped hosting"
```

---

### Task 47: Data-repo scaffolding

The data repo is a separate GitHub repo; this task creates a template and instructions, not code changes in the app repo.

**Files:**
- Create: `docs/architecture/data-repo-scaffold.md`
- Create: `scripts/scaffold-data-repo.sh`

- [ ] **Step 1: Write scaffold instructions**

File: `docs/architecture/data-repo-scaffold.md`

```markdown
# Scaffolding a new data repo

Each consultant has their own private data repo at `sapienEx-AI/hours-data-<partner-id>-<consultant-slug>`. This is a short guide to creating one.

## One-time setup (per consultant)

1. **Create the repo** under the `sapienEx-AI` org. Name: `hours-data-sector-growth-<your-slug>`. **Private** visibility. Initialize with README.
2. **Clone locally:** `git clone git@github.com:sapienEx-AI/hours-data-sector-growth-<you>.git`
3. **Scaffold initial files** using `scripts/scaffold-data-repo.sh`:
   ```sh
   ./scripts/scaffold-data-repo.sh <your-slug> <display-name>
   ```
   This writes `config/profile.json`, `config/projects.json` (seeded from spec §13 project list), `config/rates.json` (seeded with $125 CAD effective 2026-04-11), `.gitignore`, and `.github/workflows/validate.yml`.
4. **Commit and push.**
5. **Generate a fine-grained PAT** at github.com/settings/personal-access-tokens/new:
   - Repo access: only this data repo
   - Contents: read + write
6. **Open** `https://sapienex-ai.github.io/hours-tracker/`, complete the first-run flow, paste the PAT.

## What lives in the data repo

See spec §4.2 for the full layout. In short:
- `config/` — profile, projects, rates
- `data/entries/YYYY-MM.json` — monthly entries (the hot data)
- `data/snapshots/YYYY-MM.json` — immutable closed-month snapshots
- `schemas/` — frozen schema copies from the app repo
- `.github/workflows/validate.yml` — ajv validation on every push
```

- [ ] **Step 2: Write the scaffold script**

File: `scripts/scaffold-data-repo.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-}"
DISPLAY="${2:-}"
if [[ -z "$SLUG" || -z "$DISPLAY" ]]; then
  echo "Usage: $0 <slug> <display-name>"
  exit 1
fi

mkdir -p config data/entries data/snapshots schemas .github/workflows

# profile.json
cat > config/profile.json <<EOF
{
  "schema_version": 1,
  "partner_id": "sector-growth",
  "consultant_id": "$SLUG",
  "display_name": "$DISPLAY",
  "timezone": "America/Toronto",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# projects.json (seeded from spec §13)
cat > config/projects.json <<'EOF'
{
  "schema_version": 1,
  "projects": [
    {"id":"sprosty","name":"Sprosty","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"internal","name":"Internal","client":null,"active":true,"is_internal":true,"default_rate_cents":null,"buckets":[]},
    {"id":"shannex","name":"Shannex","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"axiom","name":"Axiom","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"bayard","name":"Bayard","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"truvista","name":"TruVista","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"pickleplex","name":"Pickleplex","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"sparc-bc","name":"Sparc BC","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"sterling","name":"Sterling","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"tech-lead","name":"Tech Lead","client":null,"active":true,"is_internal":true,"default_rate_cents":null,"buckets":[]},
    {"id":"bluej-legal","name":"BlueJ Legal","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]},
    {"id":"pre-sales","name":"Pre-sales","client":null,"active":true,"is_internal":true,"default_rate_cents":null,"buckets":[]},
    {"id":"image-lift","name":"ImageLift","client":null,"active":true,"is_internal":false,"default_rate_cents":null,"buckets":[]}
  ]
}
EOF

# rates.json
cat > config/rates.json <<'EOF'
{
  "schema_version": 1,
  "default_rate_history": [
    { "effective_from": "2026-04-11", "rate_cents": 12500, "note": "Initial rate — $125 CAD/hr" }
  ]
}
EOF

# .gitignore
cat > .gitignore <<'EOF'
exports/
*.local
.DS_Store
EOF

# Copy schemas from the app repo (adjust path as needed)
SCHEMAS_SRC="${HOURS_TRACKER_REPO:-/Users/prash/Projects/oh-tap/consulting/sector-growth/prash-hours-tracker}/schemas"
if [[ -d "$SCHEMAS_SRC" ]]; then
  cp "$SCHEMAS_SRC"/*.json schemas/
fi

# validate.yml
cat > .github/workflows/validate.yml <<'EOF'
name: Validate JSON

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm init -y && npm install ajv@8 ajv-formats@3
      - run: |
          node -e "
            const Ajv = require('ajv').default;
            const addFormats = require('ajv-formats').default;
            const fs = require('fs'); const path = require('path');
            const ajv = new Ajv({ allErrors: true, strict: false });
            addFormats(ajv);
            const schemas = {
              profile: require('./schemas/profile.schema.json'),
              projects: require('./schemas/projects.schema.json'),
              rates: require('./schemas/rates.schema.json'),
              entries: require('./schemas/entries.schema.json'),
              snapshot: require('./schemas/snapshot.schema.json'),
            };
            const validate = Object.fromEntries(Object.entries(schemas).map(([k, s]) => [k, ajv.compile(s)]));
            const check = (file, kind) => {
              const data = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (!validate[kind](data)) {
                console.error(file + ' FAILED:', JSON.stringify(validate[kind].errors, null, 2));
                process.exit(1);
              }
            };
            if (fs.existsSync('config/profile.json')) check('config/profile.json', 'profile');
            if (fs.existsSync('config/projects.json')) check('config/projects.json', 'projects');
            if (fs.existsSync('config/rates.json')) check('config/rates.json', 'rates');
            for (const f of fs.readdirSync('data/entries').filter(f => f.endsWith('.json'))) {
              check(path.join('data/entries', f), 'entries');
            }
            for (const f of fs.readdirSync('data/snapshots').filter(f => f.endsWith('.json'))) {
              check(path.join('data/snapshots', f), 'snapshot');
            }
            console.log('All files valid.');
          "
EOF

# README
cat > README.md <<EOF
# hours-data-sector-growth-$SLUG

Private data repo consumed by \`sapienEx-AI/hours-tracker\`.
Do not edit by hand unless you know what you're doing.
EOF

chmod +x scripts/scaffold-data-repo.sh 2>/dev/null || true
echo "Scaffolded. Review, commit, push."
```

- [ ] **Step 3: Commit**

```bash
chmod +x scripts/scaffold-data-repo.sh
git add docs/architecture/data-repo-scaffold.md scripts/scaffold-data-repo.sh
git commit -m "docs: data repo scaffolding script + instructions"
```

---

## PHASE 11 — AI-native docs

### Task 48: `CLAUDE.md` at repo root

**Files:**
- Create: `CLAUDE.md`
- Create: `AGENTS.md` (symlink)

- [ ] **Step 1: Write `CLAUDE.md`**

File: `CLAUDE.md`

```markdown
# CLAUDE.md — Hours Tracker

Authoritative guide for AI agents working on this codebase. Read before editing anything.

## Project purpose
A pure-static GitHub Pages app that logs consulting hours into per-consultant private GitHub data repos. Partner-branded (Sector Growth first), hosted by SapienEx. Full design: `docs/superpowers/specs/2026-04-11-hours-tracker-design.md`. Implementation plan: `docs/superpowers/plans/2026-04-11-hours-tracker-plan.md`.

## Non-negotiable invariants (spec §11)

1. **Integer math only** for `_cents` and `_hundredths` fields. All arithmetic goes through `src/calc/int.ts`. The ESLint rule `local/no-float-money` enforces this — never disable it locally.
2. **Every write validates against the schema** via `src/schema/validators.ts` BEFORE hitting GitHub. Never bypass.
3. **Every commit uses a structured prefix** (see `src/data/commit-messages.ts`). `log: …`, `edit: …`, `bulk-edit: …`, `snapshot: close …`, `config: …`, `import: …`.
4. **Partner logo is always primary.** Top-left in `AppShell.tsx`. SapienEx attribution is **footer only** in `Footer.tsx`, muted, 11px, no logo. Never co-brand.
5. **Profile partner_id is validated** against the selected partner on every load (`src/ui/screens/first-run/validate-data-repo.ts`).
6. **Rate is snapshotted on every entry** at log time (spec §5.3). Changing `config/rates.json` never moves historical numbers.
7. **Snapshots are immutable.** Never rewrite a file in `data/snapshots/`.

## Do-not-touch-without-review list

- `src/calc/**` — every change re-runs Gate A (see §7.2 spec). Property tests, golden tests, and a multi-agent review must all pass.
- `schemas/**` — any change is a schema bump. Update `src/schema/types.ts`, bump `schema_version`, write a migration note in `docs/architecture/adding-a-field.md`.
- `public/partners/<partner-id>/partner.json` — partner-facing config. Verify with the partner before committing changes to their theme.
- `tests/fixtures/2026-03-golden.json` and `tests/fixtures/2026-03-expected.json` — the immutable regression fixture. Only regenerate if the import script itself changes, and **re-run Gate C** when you do.

## Run commands

```sh
npm install             # deps
npm run dev             # local dev server (http://localhost:5173/hours-tracker/)
npm run typecheck       # tsc --noEmit
npm run lint            # eslint + no-float-money rule
npm test                # vitest: unit + property + golden
npm run test:golden     # just the golden regression
npm run test:property   # just the fast-check invariants
npm run build           # production build
npm run preview         # preview the production build
npm run import:march    # re-run the march 2026 importer (regenerates golden)
```

**Before claiming any change is complete:**
1. `npm run typecheck` passes
2. `npm run lint` passes
3. `npm test` — ALL tests pass, including golden and property
4. For calc changes: re-dispatch Gate A review

## Where to find things

```
src/calc/       → all billing math (pure, tested to death)
src/schema/     → types + ajv validators
src/data/       → GitHub API I/O + commit messages + repo modules
src/auth/       → TokenProvider interface + PAT implementation
src/partner/    → partner config load + theme application
src/store/      → Zustand stores (auth, UI)
src/format/     → display formatters (cents→dollars, hundredths→hours)
src/ui/         → React components (layout, screens, primitives)
schemas/        → JSON Schemas (source of truth)
public/partners/→ partner configs + logos + favicons
tests/          → unit, property, golden, integration
docs/           → spec, plan, architecture playbooks
```

## Testing expectations

- **Unit tests** for every calc function. Hand-crafted inputs.
- **Property tests** for every invariant in spec §7.2. Use `fast-check`.
- **Golden tests** for the March 2026 regression fixture. `npm run test:golden` must always pass.
- **Schema tests** for every validator.
- **Component tests** optional for MVP — UI is thin over calc and data.

Test names are **full sentences** describing observable behavior (spec §15.4). Bad: `"sums entries"`. Good: `"computeMonthTotals sums only entries whose date falls within the target month"`.

## Common tasks (recipes)

- **Add a new field to an entry:** `docs/architecture/adding-a-field.md`
- **Add a new partner:** `docs/architecture/partner-onboarding.md`
- **Change default rate (forward or retro):** `docs/architecture/rate-change-sop.md`
- **Trace a hour-log write end to end:** `docs/architecture/data-flow.md`
- **Every calc invariant and its test:** `docs/architecture/calc-invariants.md`

## When to STOP and ask the human

- Any change to `schemas/*.json` that bumps `schema_version`
- Any change to `tests/fixtures/2026-03-expected.json` (the hand-verified regression)
- Adding a new partner to `public/partners/index.json`
- Changing currency semantics
- Any change that would move historical billing totals

## No-go rules

- No metaprogramming, no decorators, no runtime type generation, no dynamic imports in production paths.
- No mocks for the calc module — use real inputs.
- No floating-point arithmetic on money or hours fields outside `src/calc/int.ts`.
- No direct localStorage access outside `src/auth/` and `src/store/`.
- No SapienEx branding outside `src/ui/layout/Footer.tsx`.
- No silent write failures — always surface errors to the user.
```

- [ ] **Step 2: Create `AGENTS.md` symlink**

Run: `ln -s CLAUDE.md AGENTS.md`

Expected: symlink created. Verify with `ls -l AGENTS.md`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: CLAUDE.md (authoritative ai-native guide) + AGENTS.md symlink"
```

---

### Task 49: `docs/architecture/` playbooks

**Files:**
- Create: `docs/architecture/data-flow.md`
- Create: `docs/architecture/calc-invariants.md`
- Create: `docs/architecture/partner-onboarding.md`
- Create: `docs/architecture/adding-a-field.md`
- Create: `docs/architecture/rate-change-sop.md`

- [ ] **Step 1: Write `data-flow.md`**

File: `docs/architecture/data-flow.md`

```markdown
# Data flow — logging a single hour

End-to-end trace of what happens when the user clicks "Save" in Quick Log.

## Steps

1. **User fills Quick Log form** (`src/ui/screens/QuickLog.tsx`). Project/date/hours/description required. Bucket optional. Rate auto-resolved via `resolveRateAtLogTime`, user may override.
2. **Save click** triggers `mutation.mutate()` (React Query mutation).
3. **Mutation function** constructs an `Entry` object, calling `newEntryId` and `resolveRateAtLogTime` one final time.
4. **`addEntry`** (`src/data/entries-repo.ts`) validates the entry against `entries.schema.json` via ajv. On failure → throw (banner shown).
5. **`writeJsonFileWithRetry`** (`src/data/github-file.ts`) reads the current month file, merges the new entry, and PUTs back to GitHub with `sha`. On 409, one retry with fresh sha.
6. **Commit message** built from `logMessage(...)` (`src/data/commit-messages.ts`). Structured prefix `log: ...`.
7. **React Query cache invalidated** on success via `queryClient.invalidateQueries({ queryKey: qk.monthEntries(...) })`.
8. **Dashboard and Entries screens** re-fetch automatically on next focus.

## Checklist for touching this flow

- [ ] Validator still runs before GitHub write
- [ ] New entry id unique within the target month file (duplicate guard in `addEntry`)
- [ ] Commit message uses `logMessage` helper (not hand-built string)
- [ ] React Query key invalidated via `qk.monthEntries`
- [ ] Error surface to user via banner (never silent)
- [ ] Unit test + integration test updated if behavior changed
```

- [ ] **Step 2: Write `calc-invariants.md`**

File: `docs/architecture/calc-invariants.md`

```markdown
# Calc invariants — full list

Every invariant the calc module must uphold, with the test that proves it.

| # | Invariant | Test |
|---|---|---|
| 1 | `billable + non_billable + needs_review = total` | `tests/calc/property.test.ts` "Conservation" |
| 2 | `sum(per_project.billable) = global.billable` | `tests/calc/property.test.ts` "Additivity" |
| 3 | Entries outside target month excluded | `tests/calc/property.test.ts` "Month-scoping" |
| 4 | Adding billable entry never decreases billable_amount | `tests/calc/property.test.ts` "Monotonicity" |
| 5 | `hashEntries(X) === hashEntries(X)` | `tests/calc/property.test.ts` "Hash determinism" |
| 6 | Hash invariant under key-order + array-order | `tests/calc/property.test.ts` "Hash key-order invariance" + `tests/calc/hash.test.ts` |
| 7 | `mulCentsByHundredths` rejects non-integer results | `tests/calc/int.test.ts` |
| 8 | `resolveRateAtLogTime` bucket > project > global fallback | `tests/calc/rates.test.ts` |
| 9 | Runtime cross-check in Dashboard (per-project sum = top-level) | `src/ui/runtime-invariants.ts` |
| 10 | March 2026 totals match hand-verified expected | `tests/calc/golden-full.test.ts` |
| 11 | March mini fixture matches hand-verified expected | `tests/calc/golden-mini.test.ts` |

## Checklist for adding a new invariant

- [ ] Invariant stated in prose in this table
- [ ] Property test added with the EXACT invariant name as the test description
- [ ] Unit test(s) exercise the edge cases that inspired the invariant
- [ ] Spec §7.2 layer 2 list updated if it's a new layer-2 invariant
- [ ] `CLAUDE.md` "Non-negotiable invariants" list updated if it's non-negotiable
```

- [ ] **Step 3: Write `partner-onboarding.md`**

File: `docs/architecture/partner-onboarding.md`

```markdown
# Adding a new partner

Full recipe for onboarding a new partner (e.g., "Acme Consulting") to Hours Tracker.

## Prerequisites

- Partner name, display name, and brand colors (primary, accent)
- Partner logo file (SVG or WebP preferred) and favicon
- Currency (ISO 4217 code, e.g., `USD`, `CAD`, `EUR`)
- Partner website URL

## Steps

1. **Create the partner folder.**
   ```sh
   mkdir public/partners/acme
   ```
2. **Copy logo + favicon into the folder.** Supported formats: `.webp`, `.png`, `.svg`.
3. **Write `public/partners/acme/partner.json`** following the schema in `schemas/partner.schema.json`. Use `public/partners/sector-growth/partner.json` as a template. Pay attention to:
   - `data_repo_prefix`: must be `hours-data-<partner-id>-` (e.g., `hours-data-acme-`)
   - `theme.mode`: dark or light
   - `assets.logo_dark_filter`: CSS filter string if the logo needs inversion on dark bg; omit for light themes
4. **Register the partner** in `public/partners/index.json`:
   ```json
   {
     "partners": [
       { "id": "sector-growth", "display_name": "Sector Growth", "enabled": true },
       { "id": "acme", "display_name": "Acme Consulting", "enabled": true }
     ]
   }
   ```
5. **Validate locally** before committing:
   ```sh
   node -e "const v = require('./schemas/partner.schema.json'); const p = require('./public/partners/acme/partner.json'); const Ajv = require('ajv').default; const ajv = new Ajv({strict:false}); require('ajv-formats').default(ajv); const f = ajv.compile(v); if (!f(p)) { console.error(f.errors); process.exit(1); } else console.log('ok');"
   ```
6. **Test in the dev server.** `npm run dev`. Open first-run flow. Verify Acme appears in the dropdown. Select it. Verify branding applies.
7. **Commit** with message: `partner: onboard Acme Consulting`.
8. **Create the first consultant data repo** under `sapienEx-AI/hours-data-acme-<consultant-slug>`. Ask the consultant to run the PAT setup in the live app.

## Checklist

- [ ] Partner folder created with logo + favicon
- [ ] partner.json written and schema-validated
- [ ] index.json updated
- [ ] Dev-server smoke test passed
- [ ] Sector Growth branding still unchanged (no regression)
- [ ] Committed with structured message
```

- [ ] **Step 4: Write `adding-a-field.md`**

File: `docs/architecture/adding-a-field.md`

```markdown
# Adding a new field to a schema

Any new field on `Entry`, `Project`, `Bucket`, `Partner`, `Profile`, `RatesConfig`, or `Snapshot` is a **schema bump**. This is a reviewed event — don't sneak it in.

## Steps

1. **Bump `schema_version`** in the relevant `schemas/*.json`. Change `"const": 1` to `"const": 2`. Add the new field to `required` if appropriate, or `properties` if optional.
2. **Update `src/schema/types.ts`** to match. Add the field to the relevant TypeScript type.
3. **Update the matching validator** if the field has constraints beyond type (e.g., min/max, format).
4. **Update calc code** if the new field affects billing. Add unit + property tests.
5. **Update `src/calc/hash.ts`** if the field is part of the semantic content of an entry (add it to `canonicalizeEntry` in a fixed position). This will change existing hashes — document as a one-time migration.
6. **Update the relevant UI screen** to surface/edit the new field.
7. **Update `src/data/commit-messages.ts`** if the field appears in a commit message.
8. **Write a migration note** below in this file:

   ```markdown
   ## Migrations

   ### 1 → 2 (2026-MM-DD): added `<field>` to `<schema>`
   - Files affected: `<list>`
   - Calc impact: `<yes/no>`
   - Hash change: `<yes/no>`
   - Existing data: `<how to migrate or "no-op — optional field">`
   ```
9. **Run the full test suite.** All tests must pass.
10. **Bump version in `package.json`.** Patch bump for additive optional field; minor for required new field.

## Checklist

- [ ] `schema_version` bumped in JSON schema
- [ ] `src/schema/types.ts` updated
- [ ] Validator updated (if constraints beyond type)
- [ ] Calc code updated (if relevant)
- [ ] Hash emission updated (if field is semantic)
- [ ] UI surface updated
- [ ] Commit message helper updated (if relevant)
- [ ] Migration note written in this file
- [ ] All tests pass
- [ ] `package.json` version bumped

## Migrations

(none yet — MVP is at schema_version 1)
```

- [ ] **Step 5: Write `rate-change-sop.md`**

File: `docs/architecture/rate-change-sop.md`

```markdown
# Changing your default rate

Rates are append-only. You add a new `default_rate_history` entry; old entries stay untouched.

## Forward-only (the normal case)

1. Open the Rates screen.
2. Click "Add rate".
3. Enter new rate (dollars), effective date (today or a future date), optional note.
4. Save. A commit is written with message `config: add rate $X.XX effective YYYY-MM-DD`.

From the effective date onward, new entries use the new rate as their default. Historical entries are unaffected.

## Retroactive (rare — requires explicit intent)

When you need to retroactively apply a new rate to entries that have already been logged (e.g., a client agreed to pay a higher rate in arrears):

1. **Bulk edit tool** — not shipped in MVP. Manual process for MVP:
2. Open the Entries screen, filter to the affected entries.
3. For each entry, click edit, change the rate field, save. (Tedious but auditable — each change is a separate commit with a descriptive message.)
4. For a bulk change, consider writing a one-off script in `scripts/one-off/<date>-<description>.ts` that:
   - Reads the current entries file
   - Applies the transformation (filter + rate change)
   - Validates against schema
   - Commits with message `bulk-edit: apply $X.XX rate to N entries matching {filter}`
   - Leaves a comment at the top of the script describing the one-off nature.

## Do NOT

- Edit the `rate_cents` field on historical entries without a descriptive commit message.
- Bypass schema validation.
- Remove entries from `default_rate_history` — the history is append-only.

## Checklist

- [ ] Decided: forward-only or retroactive?
- [ ] If retroactive: documented the reason in the commit message
- [ ] Ran tests after the change (totals still match expected)
- [ ] If retroactive affected a closed month, noted the drift in the snapshot view
```

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/
git commit -m "docs: architecture playbooks (data-flow, calc-invariants, partner-onboarding, adding-a-field, rate-change-sop)"
```

---

### Task 50: Per-module READMEs audit

Every module in `src/` should have a `README.md`. Phase 2–4 created most of them. Verify and fill in any gaps.

- [ ] **Step 1: Enumerate modules missing a README**

```bash
find src -type d | while read d; do
  [ -f "$d/README.md" ] || echo "MISSING: $d/README.md"
done
```

Expected missing: any directory that got files but no README. Likely: `src/data/hooks/`, `src/ui/layout/`, `src/ui/screens/`, `src/ui/screens/first-run/`, `src/ui/components/`, `src/format/` (if missed).

- [ ] **Step 2: Write missing READMEs using the template from `src/schema/README.md`**

For each directory, follow this shape:

```markdown
# <module path>

**Purpose:** <one sentence>

**Public API:** <bullet list of exported symbols>

**Invariants:** <numbered list of constraints this module upholds>

**Dependencies:** <what it imports from>
```

Fill in the blanks based on what's actually in each directory.

- [ ] **Step 3: Commit**

```bash
git add src/**/README.md
git commit -m "docs: per-module READMEs for every src/ directory"
```

---

### Task 51: Backlog document and final README polish

**Files:**
- Create: `docs/superpowers/backlog.md`
- Modify: `README.md`

- [ ] **Step 1: Write the backlog**

File: `docs/superpowers/backlog.md`

```markdown
# Hours Tracker — post-MVP backlog

Tracked features deferred from MVP (Phase 1–11). Each item references the spec section that motivates it.

## Near-term

- **Bucket CRUD** — edit/close/archive buckets from the UI (spec §8.5). MVP only supports creating projects.
- **Edit modal for entries** — click a row in Entries to open Quick Log form pre-filled (spec §8.4). MVP supports delete only.
- **Snapshot list + drift diff** — full snapshots screen with drift indicator and diff view (spec §8.7). MVP supports close only.
- **Bulk rate update tool** — preview + filter + apply (spec §7 row 9). MVP supports manual per-entry edits.
- **CSV export** — export any month or filtered set as CSV (spec §3 row 12).
- **Keyboard shortcut `⌘/Ctrl+K` to focus Quick Log** from any screen (spec §8.1).
- **Needs-review queue on dashboard** — clickable review-all (spec §8.3).
- **Drift indicator on snapshots** — source_hash comparison (spec §5.6).

## Medium-term

- **Offline logging with replay queue** (spec §12 known constraint).
- **PDF invoice export** (spec §2 non-goal for MVP — revisit if Prash asks).
- **Multi-device sync conflict UX** — full conflict banner with 3-way merge.
- **Partner-level config editing from UI** — for partner admins. MVP requires a PR.
- **Rate history editing** (currently append-only via UI).

## Speculative

- **OAuth device flow** to replace PAT (spec §6.1 "Future upgrade path").
- **Additional partners** onboarded.
- **Calendar integration** — log from Google Calendar events.
- **Mobile PWA** with offline-first entry.
```

- [ ] **Step 2: Update `README.md`**

File: `README.md` (replace)

```markdown
# Hours Tracker

A pure-static GitHub Pages app that logs consulting hours into private per-consultant GitHub data repos. Partner-branded (Sector Growth first), hosted by SapienEx.

**Live app:** https://sapienex-ai.github.io/hours-tracker/
**Design spec:** [`docs/superpowers/specs/2026-04-11-hours-tracker-design.md`](docs/superpowers/specs/2026-04-11-hours-tracker-design.md)
**Implementation plan:** [`docs/superpowers/plans/2026-04-11-hours-tracker-plan.md`](docs/superpowers/plans/2026-04-11-hours-tracker-plan.md)
**Backlog:** [`docs/superpowers/backlog.md`](docs/superpowers/backlog.md)
**AI-native development guide:** [`CLAUDE.md`](CLAUDE.md)

## Quick start (dev)

```sh
npm install
npm run dev
```

Opens at http://localhost:5173/hours-tracker/

## Adding yourself as a consultant

1. Have a partner admin create your private data repo at `sapienEx-AI/hours-data-<partner>-<your-slug>`.
2. Use `scripts/scaffold-data-repo.sh` to initialize it (see `docs/architecture/data-repo-scaffold.md`).
3. Generate a fine-grained GitHub PAT scoped to your data repo (Contents: read + write).
4. Open the live app, complete the first-run flow, paste your PAT.

## Development

All contributions must pass:
```sh
npm run typecheck
npm run lint
npm test
```

See `CLAUDE.md` for full development rules.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/backlog.md README.md
git commit -m "docs: post-mvp backlog + polished README"
```

---

### Task 52: Final end-to-end smoke test

- [ ] **Step 1: Run the full test suite**

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all exit 0.

- [ ] **Step 2: Dev-server smoke test**

```bash
npm run dev
```

In the browser:
1. See the First Run → Partner Select step. Pick "Sector Growth". Theme should apply.
2. See the Connect step with SG branding. Enter consultant slug `prash` and paste a test PAT (use a real one scoped to a real data repo, or test against a fresh test repo).
3. Validate repo. Should land on Dashboard (empty if repo is fresh).
4. Navigate to Log. Log a test entry. Verify it commits to the data repo (check the repo on github.com).
5. Navigate to Dashboard. Verify the entry appears in totals.
6. Navigate to Entries. Delete the test entry. Verify it disappears.
7. Navigate to Rates. Add a test rate. Verify it commits.
8. Navigate to Settings. Sign out. Verify you're back at First Run.

- [ ] **Step 3: Commit any fixes**

If any step of the smoke test revealed a bug, fix it with its own commit and re-run.

- [ ] **Step 4: Tag release**

```bash
git tag v0.1.0
```

---

### Task 53: Push to GitHub and enable Pages

This is the terminal step. Requires a real `sapienEx-AI/hours-tracker` repo to exist on GitHub.

- [ ] **Step 1: Create the remote repo**

Manual step on github.com: create `sapienEx-AI/hours-tracker` as a **public** repo, no initial commit.

- [ ] **Step 2: Add remote + push**

```bash
git remote add origin git@github.com:sapienEx-AI/hours-tracker.git
git push -u origin main --tags
```

- [ ] **Step 3: Enable GitHub Pages**

Manual step: on the repo settings → Pages → Source = "GitHub Actions" (uses the deploy workflow).

- [ ] **Step 4: Verify first deploy**

Wait for the Deploy workflow to complete. Open `https://sapienex-ai.github.io/hours-tracker/`. Verify First Run screen renders.

- [ ] **Step 5: Create the first data repo**

On github.com: create `sapienEx-AI/hours-data-sector-growth-prash` as a **private** repo. Clone, run `scripts/scaffold-data-repo.sh prash "Prash"`, commit, push.

- [ ] **Step 6: First real login**

Generate a fine-grained PAT. Open the live app. Complete first-run. Import March 2026 data via the import script (locally generated, manually copied into the data repo).

---

## Self-review

### Spec coverage

| Spec section | Task(s) |
|---|---|
| §0 Platform context | 19, 20, 21, 34, 36, 48 |
| §1 Purpose | covered by README + CLAUDE.md |
| §2 Non-goals | enforced by scope discipline across all tasks |
| §3 Architecture decisions | all 13 rows → phase gates in plan |
| §4 Repo layout | 1 (scaffold) + 47 (data repo) |
| §5.1 Partner config | 5, 19, 20 |
| §5.2 Profile | 6, 29 (profile-repo) |
| §5.3 Entries | 9, 28, 37 |
| §5.4 Projects | 6, 29, 39 |
| §5.5 Rates | 6, 29, 39 (Rates screen) |
| §5.6 Snapshot | 7, 29 (snapshots-repo), 39 (Snapshots screen) |
| §6.1 Auth (PAT) | 22, 23, 24, 36 |
| §6.2 Octokit | 25 |
| §6.3 Commit messages | 26 |
| §6.4 Concurrency | 27 (writeJsonFileWithRetry) |
| §7 Calc | 11–18 (Phase 3 + Gate A) |
| §8 UX | 32–41 (Phase 7–8 + Gate B) |
| §9 March import | 42–44 (Phase 9 + Gate C) |
| §10 Tech stack | 1 (package.json) |
| §11 Data integrity | enforced across all phases (validators + tests + invariants) |
| §12 Constraints | documented in README + backlog |
| §13 Resolved decisions | reflected in seeded data (task 19, 47) |
| §15 AI-native | 48 (CLAUDE.md), 49 (playbooks), 50 (READMEs), 51 (backlog), 3 (ESLint rules) |

**Gaps:** none identified. Every spec requirement maps to at least one task.

### Placeholder scan

All tasks contain concrete file paths, runnable code, exact commands, and expected output. No "TBD", "implement later", or hand-waving. Task 39 explicitly acknowledges MVP-scope trimming and points at the backlog (Task 51) for the trimmed features — this is an explicit deferral, not a placeholder.

### Type consistency

- `Entry`, `ProjectsConfig`, `RatesConfig`, `Partner`, `Profile`, `Snapshot` defined once in `src/schema/types.ts` (Task 8), used everywhere without divergence.
- `MonthTotals`, `ProjectTotals`, `BucketConsumption` defined in same file, consumed by `computeMonthTotals` (Task 13) and all screens.
- `CalcInput` defined in `src/calc/totals.ts` (Task 13), consumed by property tests and Dashboard.
- `TokenProvider` interface (Task 22), `PatTokenProvider` implementation (Task 23), `useAuthStore` (Task 24) — all three agree on the token lifecycle.

### Known compromises

- The visual polish of each screen is intentionally MVP-level. The plan explicitly mentions applying `frontend-design:frontend-design` skill per-screen during Phase 8 execution to elevate the UI. I left that as a "do-at-implementation-time" note rather than baking specific CSS into the plan.
- Bucket CRUD, edit modals, snapshot drift diff, and bulk rate update are on the backlog. Each is a spec requirement deferred to post-MVP to keep the plan shippable; all are explicitly listed in `docs/superpowers/backlog.md` (Task 51).
- The golden fixture (Task 43) has a **manual hand-verification step** — the plan cannot auto-verify Prash's specific expected numbers. Gate C is where that verification happens with multiple agents cross-checking.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-hours-tracker-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
