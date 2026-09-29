# ADAPT: AI study planner for PSG Tech

Plan → Study → Track → Adapt. Subjects, an adaptive timetable, and an AI notebook that answers from your own notes.
Sign-in is Google only, restricted to **@psgtech.ac.in** accounts.

How it works inside: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 1. What you need to install

| Install | Why | Get it |
|---|---|---|
| **Node.js 20 or newer** (LTS) | runs the app (npm comes with it) | https://nodejs.org |
| **Git** | download the code | https://git-scm.com |

Check both work: `node -v` and `git --version`.

All other libraries (Next.js, React, Tailwind, Supabase, etc.) are installed automatically by `npm install` in step 2.

## 2. What accounts and keys you need

| Key (in `.env.local`) | Required? | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Project Settings → **Data API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase → Project Settings → **API Keys** → Publishable key |
| `SUPABASE_SECRET_KEY` | Yes | Supabase → Project Settings → **API Keys** → Secret key |
| `DATABASE_URL` | Yes | Supabase → **Connect** button (top of the dashboard) → connection string |
| `ALLOWED_EMAIL_DOMAIN` | Yes | Leave it as `psgtech.ac.in` |
| `GEMINI_API_KEY` | Optional (recommended) | https://aistudio.google.com/apikey → Create API key |
| Google **Client ID + Client Secret** | Yes | Google Cloud Console (step 6). They go into **Supabase**, not `.env.local` |

Without `GEMINI_API_KEY` the app still works, but the AI answers are simpler (it uses local fallbacks).

---

## 3. Setup, step by step

### Step 1: Download the code

```bash
git clone https://github.com/vishalramcs/kanal.git
cd kanal
```

### Step 2: Install the libraries

```bash
npm install
```

### Step 3: Create a Supabase project

1. Sign up at https://supabase.com → **New project**.
2. Choose a name and a **database password**. Save the password; you need it in step 4.
3. Wait until the project finishes setting up (about 2 minutes).

### Step 4: Create `.env.local`

Copy the example file:

```bash
# Windows (PowerShell)
copy .env.example .env.local
# Mac / Linux
cp .env.example .env.local
```

Open `.env.local` and fill in the keys from the table in section 2.

For `DATABASE_URL`, replace `<password>` with your database password. If the password has special characters, write them encoded: `@` → `%40`, `#` → `%23`, `&` → `%26`, `)` → `%29`, `(` → `%28`.

> If `db:migrate` can't connect (common on home Wi-Fi), use the **Session pooler** connection string from the **Connect** button instead.

### Step 5: Create the database tables

```bash
npm run db:migrate
```

This creates all tables, security rules and the file storage bucket. It's safe to run more than once. You should see `applied 0001_init.sql` and `allowed email domain: psgtech.ac.in`.

### Step 6: Set up Google sign-in

**A. Google Cloud Console** (https://console.cloud.google.com)

1. Create a project (top bar → project picker → **New project**).
2. Go to **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**):
   - **User type / Audience:** **External**.
   - Fill in the app name (`ADAPT`), your support email and the developer email.
   - **Publish the app** (Audience → *Publish app*). If you keep it in *Testing*, add every student's email under **Test users**, or they can't sign in.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - **Application type:** **Web application**
   - **Authorized JavaScript origins:** `http://localhost:3000`
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (the same address as your Supabase URL, with `/auth/v1/callback` at the end)
   - Click **Create**, then copy the **Client ID** and **Client Secret**.

**B. Supabase dashboard**

1. **Authentication → Sign In / Providers → Google:** turn it **on**, paste the Client ID and Client Secret from the **same** Google client, and click **Save**.
2. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`
3. *(Recommended)* **Sign In / Providers → Email:** turn it **off**, so Google is the only way in.

> A new Google secret can take about 5 minutes to start working.

### Step 7: Run the app

```bash
npm run dev
```

Open **http://localhost:3000** → **Continue with Google** → pick your `@psgtech.ac.in` account. Your account is created automatically on the first sign-in.

---

## 4. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development (http://localhost:3000) |
| `npm run build` then `npm start` | Production build and run |
| `npm run db:migrate` | Create or update the database |
| `npm test` | Unit tests |
| `npm run test:security` | Live Supabase security checks (creates and deletes temporary test users) |

## 5. Deploy to Vercel

1. Push your latest code to GitHub (`git push`).
2. https://vercel.com → sign in with GitHub → **Add New → Project** → import the repo. Framework is detected as **Next.js**; keep the defaults.
3. Under **Environment Variables**, add everything from your `.env.local` **except** `DATABASE_URL` (only needed for `db:migrate` on your PC). **`GEMINI_API_KEY` is required on Vercel** (the offline model isn't bundled there).
4. Click **Deploy** and copy your URL, e.g. `https://adapt-xyz.vercel.app`.
5. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** your Vercel URL
   - **Redirect URLs:** add `https://adapt-xyz.vercel.app/auth/callback` (keep the localhost one for local development)
6. **Google Cloud → Credentials → your OAuth client:** add your Vercel URL under **Authorized JavaScript origins**. The redirect URI stays the Supabase one.
7. Open the Vercel URL and sign in. Every later `git push` to `main` redeploys automatically.

> Changed an environment variable in Vercel? Redeploy (Deployments → ⋯ → **Redeploy**) for it to take effect.

## 6. If something goes wrong

| You see | Fix |
|---|---|
| `Unsupported provider: provider is not enabled` / "Google sign-in isn't switched on yet" | Step 6B.1: turn Google on in Supabase and click **Save**. |
| "Details: Unable to exchange external code" | The Client Secret in Supabase doesn't match the Client ID. Copy **both** again from the **same** Google client (make a new secret if needed), save, wait 5 min. |
| Google keeps spinning or says *access blocked* | Step 6A.2: consent screen must be **External** and **Published** (or you must be a test user). If PSG's Google Workspace blocks unknown apps, a PSG admin must allow the Client ID. |
| `redirect_uri_mismatch` | The redirect URI in Google Cloud must exactly match `https://<ref>.supabase.co/auth/v1/callback`. |
| "This app is only for PSG Tech accounts" | You signed in with a non-`@psgtech.ac.in` account. Use your college account. |
| `db:migrate` fails with password or connection errors | Check the password encoding in step 4, or use the Session pooler connection string. |
| `'node' is not recognized` | Install Node.js 20+ and reopen the terminal. |
| On Vercel, sign-in returns to `localhost` | Step 5.5: set the Supabase **Site URL** and add the Vercel `/auth/callback` Redirect URL. |

## 7. Keep secrets safe

- `.env.local` is ignored by Git. **Never commit it** and never share the secret key, database password or Gemini key.
- Only the `NEXT_PUBLIC_` values are allowed in the browser. Everything else stays on the server.
