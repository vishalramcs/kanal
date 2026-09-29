# CLAUDE.md: ADAPT study planner rules

See README.md for setup and docs/ARCHITECTURE.md for the architecture and RAG pipeline.

## Stack
- Next.js 16 (App Router) + React, **JavaScript with `.jsx` components** (no TypeScript), Tailwind 4 (theme in `app/globals.css`), Framer Motion, lucide-react.
- **Supabase**: Auth (Google only, `@psgtech.ac.in`), PostgreSQL + pgvector with RLS, private Storage bucket `materials`. Schema lives in `supabase/migrations/` (apply with `npm run db:migrate`).
- Gemini via REST, server only (`app/lib/gemini.js`). Secrets only in `.env.local`; never use `NEXT_PUBLIC_` for secrets.
- Windows + PowerShell. Node is portable in `tools/node`: prepend it to PATH before `npm`.

## Where code goes (flat; no extra layers)
- `app/<route>/page.jsx` pages; `app/api/**/route.js` APIs (wrap with `withUser`); `proxy.js` route protection.
- `app/components/` UI by screen (`ui/` primitives); `app/lib/` logic: planner engine (pure), `store.js` (browser state, synced to `/api/state`), `auth/`, `supabase/`, `notebook/` (server RAG).

## Rules
- Security in layers: `proxy.js` + `requireUser()`/`requireSubject()` + RLS. Always query with the user's Supabase client; the secret-key admin client is only for deleting rejected accounts (and tests).
- The allowed domain comes only from `ALLOWED_EMAIL_DOMAIN` (`app/lib/auth/domain.js`; the DB copy is written by db:migrate).
- Notebook retrieval must always be filtered by user + subject (the `match_material_chunks` SQL function). Answers cite `[n]` sources or say the materials don't cover it.
- The engine builds the timetable; AI explains, answers and writes structured JSON; every AI feature needs a fallback.
- Keep the UI calm; reuse `components/ui/*`. After refactors, delete obsolete files.
- Before claiming it works: `npm test`, `npm run build`, `npm run test:security`, and a browser run-through.
