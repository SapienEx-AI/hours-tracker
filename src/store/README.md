# src/store

**Purpose:** Zustand stores for auth and UI state. Kept minimal — most data lives in React Query cache (server state) rather than here.

**Public API:**
- `auth-store.ts` — `useAuthStore` (partner id, consultant slug, data repo, GitHub token) + `__resetAuthStoreForTests`

**Invariants:**
1. Token reads/writes go through `src/auth/pat-provider.ts`, never localStorage directly outside that module.
2. Store state + localStorage are written atomically inside `completeFirstRun` / `signOut`.
3. `signOut` clears everything — nothing left behind.

**Dependencies:** `zustand`, `@/auth/pat-provider`.
