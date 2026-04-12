# src/auth

**Purpose:** Own the GitHub API token — how it's obtained, stored, and cleared. Abstracts token source so Octokit consumers never touch localStorage directly.

**Public API:**
- `token-provider.ts` — `TokenProvider` interface
- `pat-provider.ts` — `PatTokenProvider` (localStorage-backed, the MVP impl)

**Invariants:**
1. Token is never sent anywhere except `api.github.com` (enforced by audit, not code).
2. Token format is validated client-side (starts with `github_pat_` or `ghp_`).
3. `clearToken()` is the only sign-out path — Settings calls this, never touches localStorage directly.

**Dependencies:** none.
