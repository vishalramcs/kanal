# ADAPT: AI Dynamic Academic Planning & Tracking

**Plan → Study → Track → Adapt.** ADAPT is a study planner for PSG Tech students.

Every subject gets its own **workspace**: Materials, an AI Notebook grounded in your uploaded files, a Quiz, and Progress. All of it plugs into the adaptive planner.

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

## Setup (Windows, PowerShell)

1. **Environment:** copy `.env.example` to `.env.local` and fill in the Supabase URL, publishable key, secret key and `DATABASE_URL`. `GEMINI_API_KEY` is optional.
2. **Database:** `npm run db:migrate` creates the tables, security rules (RLS), the vector search function and the private Storage bucket. It's safe to run more than once. It also stores `ALLOWED_EMAIL_DOMAIN` in the database.
3. **Google sign-in** (one-time, in the dashboards):
   - **Google Cloud Console:**
     - APIs & Services → Credentials → *Create OAuth client ID* → Web application.
     - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
     - OAuth consent screen: add the app name and a support email.
   - **Supabase → Authentication → Sign In / Providers → Google:** turn it on and paste the Client ID and Client Secret.
   - **Supabase → Authentication → URL Configuration:**
     - Site URL: `http://localhost:3000`
     - Redirect URLs: add `http://localhost:3000/auth/callback` (and your production URL + `/auth/callback`).
   - **Recommended:** turn off the **Email** provider, so Google is the only way to sign in.
4. **Run:** `powershell -ExecutionPolicy Bypass -File scripts\dev.ps1` → http://localhost:3000. The script uses the portable Node in `tools/node`.

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` + `npm start` | Develop / production |
| `npm test` | Unit tests: planner engine, domain rule, extraction, chunking, RAG prompts, study tools |
| `npm run test:security` | **Live** Supabase checks: RLS, storage policies, subject-filtered search. Creates and deletes temporary users. |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` |

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
  4. **the database**: every RLS policy requires `user_id = auth.uid()` **and** `is_allowed_user()`, which checks the login token's email against the configured domain
- **Sessions:** Supabase cookies, refreshed by `proxy.js`, so a refresh keeps you signed in.
- **Log out:** the avatar menu → `POST /auth/signout` → cookies cleared → `/login`.
- **Auth state:** one `AuthProvider` for the whole app (`user`, `session`, `loading`, `isAuthenticated`, `signOut`).
- **No passwords** are handled anywhere, and the secret key never reaches the browser.

## Subject workspaces & AI Notebook

Open **Subjects → a subject** to see five tabs: **Overview · Materials · Notebook · Quiz · Progress**.

- **Materials:** PDF, PPT, PPTX, DOC, DOCX, TXT and MD, up to 10 MB and 30 files per subject.
  - Each file shows its type, size, upload date, page or slide count, and status (Processing → Ready ✓ / Failed ✕).
  - Originals are kept in private Storage at `<user_id>/<subject_id>/<material_id>/<file>` and open through short-lived signed links. PDFs open at the cited page.
- **Notebook:**
  - Answers are streamed from **this subject's materials only**, and can be limited to one material ("Source").
  - Each answer shows its sources (e.g. `Trees.pdf — Page 2`); click one to read the exact passage or open the file.
  - Conversations are saved in the database, and follow-ups understand context from the last 6 turns.
  - When the material doesn't cover a question, the answer says: *"I couldn't find enough information about this in your uploaded Data Structures materials."* Any general explanation that follows is clearly labelled as not from your materials.
- **Actions:** Summarize · Explain simply · Important points · Flashcards · Explain a topic · Create a study plan from the material (adds topics; the planner schedules them).
- **Quiz:** choose the number of questions (3–15), the difficulty, and one material or the whole subject.
  - Scores are saved to the chosen topic, updating its confidence and therefore its planner priority.
  - Low scores offer a 30-minute revision session.
- **Overview:** material count, notebook conversation count, real quiz accuracy, weakest topic, and the next best step.

### RAG pipeline (`app/lib/notebook/`)

```
Upload → validate (extension + file signature, size, zip-bomb guard, sanitised name) → Supabase Storage
       → extract (PDF per page · PPT/PPTX per slide · DOCX per heading · MD per heading · DOC/TXT)
       → clean → chunk (~900 chars, 150 overlap, never across pages/slides/sections)
       → metadata (user_id, subject_id, material_id, page/slide/section, chunk index)
       → embeddings, ONCE (Gemini gemini-embedding-001, 768-d; local all-MiniLM-L6-v2 fallback)
       → material_chunks (pgvector)
Question → query embedding → match_material_chunks(subject, materials?) — SQL filters user = auth.uid(), subject, model
         → top 6 → Gemini with numbered sources + last 6 turns + subject study-plan digest (built on the server from the DB)
         → streamed answer with [n] citations
```

- **Isolation is enforced in the database.**
  - The search function filters by `auth.uid()` and the subject, and RLS applies on top.
  - Composite foreign keys (`user_id, subject_id, material_id`) make it impossible for a chunk to belong to another subject's or another user's material.
- **Why RAG?** Sending whole documents on every question is slow and costly, and it dilutes the model's attention. Retrieval sends only the few relevant passages. Each has a known page or slide, so answers can cite exactly where they came from, and the app can admit when the material doesn't cover something.

## Database (`supabase/migrations/0001_init.sql`)

| Table | Purpose |
|---|---|
| `profiles` | email, display name, avatar (`user_id` → `auth.users`) |
| `subjects` | planner subjects (`(user_id, id)` key; topics as JSON) |
| `planner_state` | the rest of the planner (plan, history, profile, session) |
| `materials` | uploaded files: storage path, type, size, status, page/slide count |
| `material_chunks` | text + `vector` + page/slide/section + embedding model |
| `notebook_conversations`, `notebook_messages` | per-subject chats with sources |
| `app_config` | `allowed_email_domain` (not readable through the API) |

Every user table has RLS (`owner access`: owner **and** allowed domain), and the `anon` role has no access. The private `materials` bucket has per-user folder policies with the same domain check.

## Planner engine

Unchanged and deterministic (`app/lib/planner.js`, `priority.js`):
- priority scores with plain-language reasons
- a 15–25% daily buffer
- missed-session redistribution (45/33/22%)
- Exam Crunch Mode and burnout checks

## Testing done

- **`npm test`:** 25 unit tests. They cover:
  - the domain rule: `student@psgtech.ac.in` and `Student@PSGTECH.AC.IN` allowed; `@gmail.com`, `@yahoo.com`, `@outlook.com`, `@othercollege.edu` and look-alikes rejected
  - PDF, PPT, PPTX, DOCX, MD and TXT extraction with page/slide numbers
  - chunk metadata, the subject "not found" message, quiz options, and real quiz statistics
  - plus the planner tests
- **`npm run test:security`:** 7 live checks against Supabase:
  - User B cannot read, change or delete User A's rows or files
  - a Gmail account is denied even on its own rows
  - anonymous access is denied
  - DSA search never returns Java chunks, and vice versa
  - the composite key blocks filing a chunk under another subject
  - deleting a subject cascades
- **Browser test in Edge** (real Supabase users signed in through one-time links, since only the Google screen itself was skipped). All passed:
  - logged-out `/dashboard` → `/login`
  - Gmail → rejected with a message
  - your full Data Structures (`Trees.pdf`) and Java (`OOP.pdf`) scenario, including follow-ups, isolation both ways, one-material search, quizzes feeding progress, and refresh persistence
  - User B gets 404 on User A's subject, file, chat and delete
  - logout, and mobile layouts at 390px

## Known limitations

- **The real Google sign-in wasn't tested** here: Google must be enabled in the Supabase dashboard (setup step 3) and needs a real `@psgtech.ac.in` account.
- **Old `.doc`:** body text only (no headings), so citations say "Part n".
- **Old `.ppt`:** slide numbers follow the file's internal order, which can differ from the visible order in unusual files.
- **Scanned PDFs** (images only) have no text to extract. OCR isn't included.
- **Local embedding model:** without a Gemini key it runs on the server, and the first upload downloads ~23 MB.
