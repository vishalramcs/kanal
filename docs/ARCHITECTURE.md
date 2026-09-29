# ADAPT: how it works

Setup steps are in the [README](../README.md). This file explains the internals.

## Architecture

```
Browser (Next.js pages, JSX + Tailwind)
   │  Supabase session cookie (httpOnly, set by @supabase/ssr)
   ▼
proxy.js ── refreshes the session; signed out → /login (APIs: 401); non-@psgtech.ac.in → signed out (APIs: 403)
   ▼
app/api/** route handlers ── requireUser(): verify the session with Supabase Auth + check the domain again
   │  queries run with the USER's session (never the secret key) → Row Level Security applies
   ▼
Supabase: Auth (Google) · PostgreSQL + pgvector (RLS on every table) · Storage (private "materials" bucket)
Gemini: answers, explanations, study tools, embeddings (local fallbacks when unavailable)
```

**How the pieces relate:** User → Subject → Materials → text chunks with vectors → subject-filtered search → notebook answer with citations. Quiz scores flow back into the planner's topic confidence, and the planner reschedules around them.

## Folder structure

```
app/<route>/page.jsx     pages (dashboard, planner, subjects, subjects/[id], progress, settings, login)
app/api/**/route.js      server APIs (all wrapped with withUser)
app/auth/                Google callback + sign-out
app/components/          UI by screen (ui/ = shared primitives)
app/lib/                 planner engine, store, auth, supabase clients, notebook (RAG), gemini
proxy.js                 route protection (runs before every request)
supabase/migrations/     database schema, RLS and storage policies
scripts/                 db-migrate.mjs, dev.ps1
tests/                   unit + live security tests
```

## Authentication (Supabase Auth + Google, `@psgtech.ac.in` only)

- **Flow:** `/login` → **Continue with Google** → Google → Supabase → `/auth/callback`.
  - The callback exchanges the code, then **re-reads the user from Supabase Auth on the server** and checks the email domain.
  - Allowed users get a profile row (keyed by the Supabase user id, so repeat sign-ins create no duplicates).
  - Rejected users are signed out and their just-created account is deleted.
- **Domain rule** (`app/lib/auth/domain.js`): case-insensitive, and the domain must match *exactly*. `x@psgtech.ac.in.evil.com` and `x@sub.psgtech.ac.in` are rejected.
  - The value comes only from `ALLOWED_EMAIL_DOMAIN`.
  - Google's `hd` hint only pre-filters the account picker. It is **not** trusted.
- **Enforced in four layers:**
  1. the OAuth callback
  2. `proxy.js` on every request
  3. `requireUser()` in every API
  4. **the database**: every RLS policy requires `user_id = auth.uid()` **and** `is_allowed_user()`
- **Sessions:** Supabase cookies, refreshed by `proxy.js`. **Log out:** avatar menu → `POST /auth/signout`.
- **No passwords** are handled anywhere, and the secret key never reaches the browser.

## Subject workspaces & AI Notebook

Open **Subjects → a subject** to see five tabs: **Overview · Materials · Notebook · Quiz · Progress**.

- **Materials:** PDF, PPT, PPTX, DOC, DOCX, TXT and MD, up to 10 MB and 30 files per subject. Originals are kept in private Storage at `<user_id>/<subject_id>/<material_id>/<file>` and open through short-lived signed links.
- **Notebook:** answers stream from **this subject's materials only** (optionally one material), with `[n]` citations like `Trees.pdf — Page 2`. When the material doesn't cover a question, it says so.
- **Actions:** Summarize · Explain simply · Important points · Flashcards · Explain a topic · Study plan from the material.
- **Quiz:** 3–15 questions, chosen difficulty and material. Scores update topic confidence and planner priority.

### RAG pipeline (`app/lib/notebook/`)

```
Upload → validate (extension + file signature, size, zip-bomb guard, sanitised name) → Supabase Storage
       → extract (PDF per page · PPT/PPTX per slide · DOCX/MD per heading · DOC/TXT)
       → clean → chunk (~900 chars, 150 overlap, never across pages/slides/sections)
       → embeddings, ONCE (Gemini gemini-embedding-001, 768-d; local all-MiniLM-L6-v2 fallback)
       → material_chunks (pgvector)
Question → query embedding → match_material_chunks(subject, materials?) — SQL filters user = auth.uid(), subject, model
         → top 6 → Gemini with numbered sources + last 6 turns + subject study-plan digest
         → streamed answer with [n] citations
```

Isolation is enforced in the database: the search function filters by `auth.uid()` and subject, RLS applies on top, and composite foreign keys (`user_id, subject_id, material_id`) stop a chunk from belonging to another subject's or user's material.

## Database (`supabase/migrations/0001_init.sql`)

| Table | Purpose |
|---|---|
| `profiles` | email, display name, avatar |
| `subjects` | planner subjects (topics as JSON) |
| `planner_state` | the rest of the planner (plan, history, profile, session) |
| `materials` | uploaded files: storage path, type, size, status, page/slide count |
| `material_chunks` | text + `vector` + page/slide/section + embedding model |
| `notebook_conversations`, `notebook_messages` | per-subject chats with sources |
| `app_config` | `allowed_email_domain` (not readable through the API) |

Every user table has RLS (owner **and** allowed domain); the `anon` role has no access. The private `materials` bucket has per-user folder policies with the same check.

## Planner engine

Deterministic (`app/lib/planner.js`, `priority.js`): priority scores with plain-language reasons, a 15–25% daily buffer, missed-session redistribution (45/33/22%), Exam Crunch Mode and burnout checks. AI only explains; the engine builds the timetable.

## Tests

- `npm test`: 25 unit tests (domain rule, file extraction, chunking, RAG prompts, study tools, planner).
- `npm run test:security`: 7 live Supabase checks (RLS isolation between users, Gmail denied, anonymous denied, subject-filtered search, composite keys, storage policies, cascade delete). Creates and deletes temporary users.

## Known limitations

- **Old `.doc`:** body text only, so citations say "Part n". **Old `.ppt`:** slide numbers follow the file's internal order.
- **Scanned PDFs** (images only) have no text to extract; OCR isn't included.
- **Without a Gemini key**, a local embedding model runs on the server; the first upload downloads ~23 MB.
