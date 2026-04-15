# Google Calendar integration — one-time setup

This playbook sets up the Google Cloud project that backs the calendar integration for all consultants. Run it once per SapienEx deployment. Individual consultants never do any of this — they only click Connect in Settings.

## Prerequisites

- A Google account that will own the Cloud project (ideally a SapienEx-owned workspace account, not personal).
- ~15 minutes.

## Steps

### 1. Create the Cloud project

1. Visit <https://console.cloud.google.com/>.
2. Click the project selector → "New Project".
3. Name: `hours-tracker`. Organization: none (or SapienEx if your workspace has one).
4. Create.

### 2. Enable the Calendar API

1. Navigation → "APIs & Services" → "Library".
2. Search "Google Calendar API".
3. Click → Enable.

### 3. Configure the OAuth consent screen

1. "APIs & Services" → "OAuth consent screen".
2. User type: **External**. Next.
3. App name: `Hours Tracker`. User support email: your address. Developer email: your address. Save and continue.
4. Scopes → Add or remove scopes → check `.../auth/calendar.readonly` → Update. Save and continue.
5. Test users → Add Users → add each consultant's Google address (up to 100). Save.
6. **Leave publishing status as Testing.** Do not publish; that triggers verification (paid, slow).

### 4. Create the OAuth Web client

1. "APIs & Services" → "Credentials" → "Create credentials" → "OAuth client ID".
2. Application type: **Web application**.
3. Name: `Hours Tracker web`.
4. Authorized JavaScript origins — add each of these, one per row:
   - `https://sapienex-ai.github.io`
   - `http://localhost:5173`
   - `http://localhost:5174`
5. Authorized redirect URIs: leave empty (GIS token flow uses origin-only).
6. Create.
7. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).

### 5. Wire the client ID into the app

Paste the client ID into `src/integrations/google/client-id.ts`:

```ts
export const GOOGLE_CLIENT_ID = '123456789012-abc...apps.googleusercontent.com';
```

Commit. Deploy.

## Adding a new consultant

Not a Cloud-side change — just add their Google address to the **Test users** list in the consent screen. They can Connect in the app immediately after.

## Calendar-sourced entries auto-tag effort

When a consultant applies a calendar suggestion to the Quick Log form, `effort_kind` is prefilled as `meeting` and `effort_count` as `1`. This keeps meetings off the pure-hours path and onto the effort dashboard by default. Both fields are user-overridable before save.

## Adding a new origin (custom domain, new localhost port)

"APIs & Services" → "Credentials" → click the OAuth client → add to Authorized JavaScript origins → Save. Takes a minute or two to propagate.

## If something fails

| Symptom | Cause | Fix |
|---|---|---|
| `origin_mismatch` 403 | The page's origin isn't in Authorized JavaScript origins | Add it (step above). |
| `access_denied` in GIS callback | User isn't a Test user on the consent screen | Add their email to Test users. |
| Consent screen says "This app isn't verified" | Normal — Testing mode always shows this | User clicks "Advanced → Go to Hours Tracker (unsafe)". |
