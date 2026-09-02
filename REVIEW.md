# Map of Knowledge — Code Review

Date: 2026-09-01
Scope: full repository — `server/` (Express/MySQL API), `app/` (vanilla-JS + D3 frontend),
build/deploy config, DB schema/migration.

---

## 1. Summary

This is a well-built, thoughtfully-commented production codebase. Security fundamentals are
mostly in place: parameterized SQL everywhere, consistent per-user ownership checks on mutation
routes, deliberate auth hardening (required-env startup check, bcrypt cost 12, pre-auth rate
limiters, last-auth-method protection, non-enumerable password reset), and a per-user LLM
token-bucket with usage logging.

The most important problems are **not** classic injection bugs. They are:

1. The web server exposes the entire project directory — including deploy scripts, server
   source, and the DB schema — as downloadable static files.
2. Bot/abuse protection (Turnstile) is wired but disabled and fails open.
3. Several gamification and LLM-cost paths are unbounded and trivially abused by an
   authenticated user.
4. A couple of authorization gaps (subset IDOR, cross-provider account matching).

None of these are catastrophic in isolation, but #1–#3 are the ones a real user or a bored
attacker will hit first, so they lead the priority list.

---

## 2. What's good

**Security practted well**
- **SQL**: every query uses bound parameters. The codebase does a lot of dynamic SQL
  (`UPDATE ... SET ${sets.join(',')}`, dynamic column names for SSO-linked flags, `IN (${placeholders})`),
  and in every case the dynamic fragment is built from a hardcoded allowlist, never from request
  data. No SQL injection found.
- **Ownership checks**: profile/goals/reflections/credentials/relationships/tags/notifications
  mutation routes all scope by `passport_id` / `user_id` in the `WHERE` clause. This pattern is
  applied consistently.
- **Auth hardening already done**: `server/app.js` fails startup on any missing required env var,
  with a comment explaining the `SESSION_SECRET` fallback that used to exist. `deserializeUser`
  was narrowed from `SELECT *` so `password_hash` etc. no longer ride on `req.user`. bcrypt cost
  12. Pre-auth endpoints (`login`, `signup`, `reset`, `resend`, `invite`) all have per-IP or
  per-user token buckets with sensible capacities and documented rationale. `trust proxy` set
  to exactly 1 for the single Apache hop, with a comment explaining why.
- **Account enumeration**: `/auth/reset-password/request` always returns `{ok:true}` and only
  conditionally sends mail.
- **Last-method lockout protection**: `countAuthMethods` shared by SSO-disconnect and
  passkey-removal so an account can never be stripped of its final sign-in method (there is no
  admin-assisted recovery yet).
- **WebAuthn**: follows `@simplewebauthn`'s standard options/verify pattern, tracks the signature
  counter, stores public keys base64url, registration requires an existing session.
- **Mailer**: uses nodemailer's object form for `from` (no header-injection), no remote images,
  text + HTML parts, `List-Unsubscribe`. `_escHtml` on the one user-controlled field
  (inviter name).
- **GDPR**: `/api/account/export` and `DELETE /api/account` are complete, the delete runs in a
  transaction with a documented cascade map, and `token_usage` is anonymized rather than deleted
  for accounting integrity.
- **helmet** is enabled with an explicitly chosen subset and a comment for every toggle rather
  than blind defaults.
- **Deliberate fail-open** on Turnstile / SMTP / optional OAuth strategies so a partial deploy
  can't brick login — good instinct (see caveats below about closing these out).

**Engineering quality**
- Comment quality is exceptional. Nearly every non-obvious decision carries a rationale, a date,
  and often the bug number that motivated it. This is the single biggest maintainability asset
  in the repo.
- LLM layer is careful: token usage logged per user and call type, multi-turn tool loops
  accumulate usage across turns, streaming vs. non-streaming paths share generation functions,
  fake-streaming keeps the client rendering path uniform.
- `services/` split is sensible (game, whois, passportData, passportText, invites, authMethods,
  nodeKnowledge, mailer, llm).
- Fresh-clone bootstrap now works: `schema.sql` is committed and `migrate.js` bootstraps only a
  genuinely empty DB (this was a gap noted in project memory — it's resolved).

---

## 3. Findings (prioritized)

Priority key: **P0** ship-blocker / active exposure · **P1** high user or security impact ·
**P2** should fix · **P3** cleanup / defense-in-depth.

### P0-1 — The entire repo is served as static files  ✅ FIXED (2026-09-01)

**Resolution**: `server/app.js` no longer mounts static on the repo root. `app/` is now the only
statically-served directory (`app.use('/app', express.static(APP_DIR, { dotfiles: 'deny' }))`),
and it's public (no `requireAuth`) — the app's HTML/CSS/JS carry no secrets and `/api/*` remains
the real auth boundary. The public entry pages moved under `app/` (`index.html` → `app/landing.html`,
`signup.html` → `app/signup.html`) and are served via explicit routes (`GET /`, `GET /signup`,
`GET /signup.html`). `images/`, `vendor/`, `audio/` moved to `app/…` and all refs updated.
Verified: `/deploy.ps1`, `/ecosystem.config.js`, `/package.json`, `/server/*`, `/server/db/*.sql`,
`/additions_log.txt`, `/.env`, `/.git/config`, `/REVIEW.md` all return 404; the app and its assets
still load. Follow-ups still open: the production server IP + SSH user in `deploy.ps1` were public
for some time — treat as burned, confirm key-only SSH; move `*_log.txt` out of the repo.

---
_Original finding:_

`server/app.js:124` — `app.use(express.static(path.join(__dirname, '..')))` mounts the **project
root**. Consequences, all reachable unauthenticated:

| URL | Leaks |
|---|---|
| `/deploy.ps1` | SSH user + production server IP (`virt147958@217.146.69.48`), deploy mechanism |
| `/ecosystem.config.js` | Unix socket path, log file paths, PM2 process name |
| `/server/routes/auth.js`, `/server/middleware/authRateLimit.js`, … | **All server source** — hardcoded admin emails in `ROLE_MAP`, exact rate-limit thresholds (tune a brute-force to stay under 8/2 min), the Turnstile fail-open logic, `ALERT_TO` |
| `/server/db/schema.sql`, `/server/db/i18n_seed.sql` | Full database structure |
| `/additions_log.txt`, `/collisions_log.txt` | Internal curriculum-generation data (~360 KB) |
| `/package.json`, `/package-lock.json` | Exact dependency versions |

`server/.env` and `.git/` are currently **not** served, but only because `serve-static` defaults
to ignoring dotfiles — that's incidental, not a deliberate control.

**Fix**: stop serving the root. Move genuinely public assets (`index.html`, `signup.html`,
`images/`, `audio/`, `vendor/`) into a `public/` directory and serve only that, or enumerate the
specific public files. Add `{ dotfiles: 'deny' }`. Move `*_log.txt`, `*.sql` into a gitignored
`docs/` or `data/` dir. Rotate nothing critical is exposed (no secrets in source), but treat the
server IP / SSH user as burned and confirm the server only accepts key auth.

### P0-2 — Turnstile disabled and fails open
`server/routes/auth.js:24-46` — `_verifyTurnstile` returns `true` when `TURNSTILE_SECRET_KEY`
is unset, **and** returns `true` on any network error even once it is set. Right now (key unset,
SMTP unset) signup / login / password-reset are protected only by per-IP rate limiting. 8 login
attempts / 2 min / IP is generous when spread across a botnet for credential stuffing, and
signup/reset become an email-bomb vector the moment SMTP is switched on.

**Fix**: set `TURNSTILE_SECRET_KEY`, then make a missing/invalid token fail **closed**. Keep the
network-error fail-open if you want, but log it loudly and rate-limit the fail-open path harder.

### P1-1 — Gamification currency is farmable
- `server/routes/api.js:932` `POST /api/learn/knobit/:id/complete` awards `game.awardLumens(…, 10, …)`
  on **every** call. The completion write is `INSERT … ON DUPLICATE KEY UPDATE`, so re-POSTing
  the same knobit id repeatedly mints 10 lumens per request indefinitely. `totalEver` (used for
  the notification) doesn't grow, but `lumen_total`, `lumen_transactions`, leaderboard rank and
  achievement unlocks all do.
- `server/routes/api.js:1732` `POST /api/test/evaluate` with `questionNum === 4` re-runs
  `_saveTestResult` (→ +10 lumens, event row, notification) on every resubmission.
- `POST /api/profile/reflections` and `POST /api/profile/events` award +5 lumens each with **no
  rate limit and no per-day cap** — a loop farms lumens and floods `passport_events`.

**Fix**: award only on the *first* transition to `done` (check `phase_reached` / prior row before
awarding). Cap self-serve awards (reflections, events, tags) per passport per day. Add a
lightweight per-user rate limit to the profile-write routes. Consider a cap on rows per passport
for `passport_reflections` / `passport_tags` / `passport_events`.

### P1-2 — Unbounded LLM spend via subset import
`server/routes/subsets.js:160` `POST /api/subsets/:id/import` has **no `llmRateLimit`**, does not
cap `terms.length`, and `services/subsetMatcher.js` makes one Anthropic call per fuzzily-matched
term. A single authenticated free-tier user can submit a few thousand terms and run up an
arbitrary API bill in one request. `POST /:id/commit` similarly loops uncapped `nodeIds` inserts.

**Fix**: add `llmRateLimit` to `/import`, cap `terms.length` (e.g. 200) and total LLM calls per
import, cap `nodeIds.length` on commit.

### P1-3 — IDOR on subset read endpoints
`server/routes/subsets.js:86` `GET /:id/nodes` and `:121` `GET /:id/staging` do **no**
visibility check. Any logged-in user can walk `id` values and read the node contents and the raw
import-staging rows (the user's typed terms + breadcrumbs) of anyone else's *personal* subset.
Every other route in this file gates on `created_by === req.user.id || type = 'public' || isAdmin`.

**Fix**: apply the same gate to `/nodes` and `/staging`.

### P1-4 — Cross-provider account matching without a verified-email check
`server/routes/auth.js:152` `handleOAuthLogin` logs into any existing account whose `email`
matches the one the provider reports, regardless of which provider originally created it (Google
account → later Discord login → same account). Google always verifies email and the Discord
strategy checks `profile.verified`, but the **LinkedIn OIDC path (`auth.js:268`) passes
`profile.emails[0].value` with no `email_verified` claim check**. Any provider (now or added
later) that allows an unverified email on the profile becomes an account-takeover path into
password accounts.

**Fix**: require a verified-email signal from every provider before matching
(`profile._json.email_verified` for the OIDC strategy); refuse the login otherwise.

### P1-5 — No server-side session revocation
`cookie-session` is stateless and the `regenerate` / `save` shims in `server/app.js:96` are
no-ops. Effects:
- `req.logout()` only clears the cookie on the one client that called it.
- A leaked/copied session cookie stays valid for the full 7-day `maxAge`.
- Password change (`/api/account/password`), password reset, and SSO disconnect do **not**
  invalidate other existing sessions.

**Fix**: add a `session_epoch` (int) column on `users`, stamp it into the session at login,
bump it on password change/reset and on account deletion, and compare in `deserializeUser`
(reject on mismatch). Or move to a server-side session store.

### P2-1 — `/api/settings` accepts arbitrary keys and values
`server/routes/api.js:152` — no key allowlist, no value length bound. A user can write unlimited
arbitrary rows into `user_settings` for their own id (storage bloat) and set keys the app trusts
elsewhere (`ui_locale`, `game_mode`). Not injectable (values are bound), but it should be an
allowlist with a value length cap.

### P2-2 — `POST /api/nodes/:id/knowledge` trusts client `percentage` / `source`
`server/routes/api.js:280` — `percentage` and `source` go straight into `user_node_knowledge`
with no validation. An out-of-range number or an invalid `source` enum value is written or
throws a 500. The learner already controls their own "I know this" state by design, but clamp
`percentage` to 0–100 and whitelist `source` (`self_reported` | `tested` | `estimated`).

### P2-3 — Content-Security-Policy is off
`server/app.js:59` `contentSecurityPolicy: false`. The frontend builds DOM via `innerHTML`
templating across ~15 files, mixing in LLM output and user profile fields. Escaping is applied
fairly consistently (`esc`, `_escHtml`), but:
- `esc()` in `app/js/profile.js:10` escapes only `& < >`, not quotes, and is occasionally used
  inside attribute context (`placeholder="${esc(...)}"`).
- One missed escape anywhere = stored XSS with **no CSP backstop**, and profile fields
  (`display_name`, `about`, relationship names, event titles) feed both the DOM and the LLM
  "WHOIS" context.

**Fix**: land the CSP allowlist the code comments already promise — `script-src 'self'` + the
four external origins (`cdnjs`, `challenges.cloudflare.com`, `googletagmanager`, `img.youtube.com`),
with nonces for the inline `<script>` blocks (or extract them). Add an escape-by-default render
helper and stop hand-concatenating HTML.

### P2-4 — CSRF protection is SameSite-Lax only
No CSRF token, origin check, or custom-header requirement on the JSON mutation routes. Lax
covers cross-site `POST`, but:
- `GET /auth/logout` is CSRF-able (logout CSRF — nuisance).
- The whole posture depends on one browser default.

**Fix**: require `Content-Type: application/json` and check `Origin`/`Sec-Fetch-Site` on
state-changing routes; make logout a `POST`.

### P2-5 — Session cookie `secure: false`
`server/app.js:91`. Justified (TLS ends at Apache) but the cookie is also sent over plain HTTP.
Set `secure` from `X-Forwarded-Proto`, or set it `true` and confirm Apache never proxies the
Node app over http. HSTS covers repeat visits, not the first.

### P2-6 — Personal emails hardcoded in source
`server/routes/auth.js:64` (`ROLE_MAP`) and `server/scripts/check-logs.js:33` (`ALERT_TO`).
Move to env vars — especially given P0-1 exposes the source publicly. Note `ROLE_MAP` grants
`super_admin` to an email on first login; anyone who can register that address gets the role.

### P2-7 — Error handling: crash / hang gaps and an inconsistent contract

**What's already solid**: the main learn/stream flow (`app/js/learning.js`) is careful —
`_httpError` / `_onApiError` helpers, `429` detection, silent stream-retry before any output is
emitted, real user-facing "connection error" strings. Every `api.js` request handler has a
`try/catch` that logs with a `[route]` tag and returns JSON. `_runStream` (`api.js:505`) clears
its keepalive interval and closes the SSE stream on error. The Anthropic SDK's built-in retry
(408/409/429/5xx) is understood and deliberately relied on (`llm.js:8`), with extra hand-rolled
retry for mid-stream drops (`llm.js:305`, `:990`).

**The gaps**:

1. **Async work runs outside `try`.** `subsets.js:168` and `:215` `await db.execute(...)`
   ownership checks *before* the `try` block; the same shape appears in other routes where a
   validation query runs pre-`try`. In Express 4 an async handler that rejects is **not** routed
   to the error middleware — the request hangs until the proxy times out and the rejection is
   unhandled.
2. **No `process.on('unhandledRejection')` / `process.on('uncaughtException')`.** Combined with
   #1 and the scattered fire-and-forget promises (§4 async bullet), one rejection can take the
   single PM2 fork down until `autorestart`.
3. **The global error handler (`app.js:147`) is nearly unreachable.** Express 4 doesn't forward
   async route rejections to it, and routes catch locally and `res.json` themselves — so it only
   ever fires for a sync throw in middleware. Adopt `express-async-errors` (monkey-patches the
   router to forward async rejections) or a `wrap(fn)` helper, then routes can `throw` and the
   response is centralized.
4. **Inconsistent error contract.** Responses are variously `{ error: 'message' }`,
   `{ error: true }` (`_runStream`), `{}` with no log (`api.js:1079`), and `200 { recommendation:
   null }` / `200 { top: [] }` on failure (`next-recommendation`, `leaderboard`). The frontend
   can't reliably tell "empty" from "broken".
5. **Internal detail leaked to the client.** `api.js:798` returns
   `{ error: 'LLM interaction failed: ' + err.message }`. Return a generic string; keep
   `err.message` in the log only.

**Fix**: add the two `process.on` handlers (log + graceful exit, let PM2 restart); move pre-`try`
`await`s inside the block, or adopt `express-async-errors` + one error handler; settle on a
single error-response shape (`{ error: string }` + the right HTTP status) and apply it; stop
concatenating `err.message` into responses; log the silent `catch` at `api.js:1079`.

### P3 — Defense-in-depth / cleanup
- **SSRF surface**: `_checkUrlAlive` (`api.js:873`) and the lootbox URL checks do server-side
  `fetch()` on URLs that originate from LLM output. Only `.ok` is returned to the client (no
  body), so impact is low, but add a protocol (`https:` only) + public-IP allowlist.
- **Password reset token in URL**: `mailer.js:123` puts the token in a query string. Global
  `Referrer-Policy: no-referrer` mitigates leakage, but it still lands in browser history and
  any intermediary logs. Consider an exchange-on-load endpoint.
- **`admin.js` POST `/users`**: no transaction — a failed `users` insert leaves an orphan
  `learner_passports` row. `PATCH /users/:id` can set another account to `super_admin`; fine
  within the super-admin trust boundary but there's no audit log.
- **404 handling** — _addressed 2026-09-01:_ `server/app.js` now has a 404 handler (branded
  `app/404.html` for browsers, JSON for API/auth callers) and a catch-all error handler. The
  remaining error-handling work (unhandled-rejection guards, pre-`try` async, dead global handler,
  inconsistent contract) is now its own finding — see **P2-7**.
- **`express.json()`** has no explicit size limit (defaults to 100 KB). Set it small
  (`{ limit: '32kb' }`) except where you genuinely need more.
- **`deserializeUser` returns `false` for a deleted user** → `req.user` is `undefined`, and
  several routes (`account.js`, parts of `subsets.js`) use `req.user.id` without `?.` → 500
  instead of 401. Harmless but noisy; `requireAuth` already covers the real case.
- **`SELECT *`** still used in `auth.js` login / signup / reset-confirm after the
  `deserializeUser` narrowing. One-off and low-risk, just inconsistent with the stated direction.
- **mysql2 `SUM()` returns a string**: already caused a silent bug (`api.js:458` comment). Audit
  remaining `SUM()` / `COALESCE(SUM())` reads for `===` / arithmetic against strings
  (`admin.js` cost math, `game.js` leaderboard).
- **Hourly reminder `setInterval`** (`server/index.js:45`) has no overlap guard if a run is slow.
  Low volume, low risk.
- **`.idea/`** is gitignored (good) — confirm no IDE files were committed in history.

---

## 4. Architecture / maintainability

- **`server/routes/api.js` is 1860 lines.** Split by concern: `learn`, `profile`, `game`,
  `test`, `notifications`, `map`. The SSE helpers (`_runStream`, `_fakeStreamText`,
  `_editedStreamFn`) belong in a shared module.
- **No tests.** There is meaningful logic worth protecting: `updateAncestorKnowledge` rollup,
  `countAuthMethods`, `knowledgeEstimatePercentage` / retention tiers, `handleOAuthLogin`
  find-or-create, the rate-limiter token math. Start with those as pure-function unit tests plus
  a few supertest hits on the auth routes.
- **Migrations**: `migrate.js` is a hand-rolled additive script (424 lines of
  `ALTER … IF NOT EXISTS`). It works, but a real migration tool (Knex, per project memory) with
  ordered up-migrations would remove the "is this column there yet" guesswork.
- **Frontend**: manual `innerHTML` string templating is XSS-prone by construction and hard to
  review. A tiny tagged-template helper that escapes interpolations by default would neutralize
  most of P2-3's residual risk. The 46 KB `index.html` and large inline `<script>` blocks also
  block a clean CSP.
- **Async style is inconsistent across the whole JS codebase — standardize on `async`/`await`.**
  - *Frontend:* every `app/*.html` and `app/js/*.js` file does `fetch(url).then(function (r) {
    return r.json(); }).then(function (data) { … }).catch(function () {})` with `function`
    expressions rather than arrow functions. Nested `.then(function () { return r.json().then(
    function (d) { … }) })` to get status + body together (`account.html:314`, `:432`, `:497`) is
    exactly the pyramid `await` removes; there is no `await Promise.all` anywhere, so independent
    `fetch`es that could run in parallel are chained sequentially; the settings-bootstrap inline
    scripts end in a bare `.catch(function () {})` that swallows failures silently.
  - *Backend:* the request/response path is `async`/`await`, but every best-effort side effect —
    ~40 call sites — is a detached `.then()` / `.catch(() => {})` chain: `_logUsage` in
    `services/llm.js:105`, `updateAncestorKnowledge(...).catch(() => {})`, `refreshWhoisIfDue(
    ...).catch(() => {})`, and the whole cluster of `game.awardLumens / checkAchievements /
    recordKnobitCompletion(...).catch(() => {})` calls in `routes/api.js` (lines 323, 333, 392,
    626–646, 948, 995–1055, 1268–1332, 1365–1426, 1544–1586, 1727–1743), plus
    `checkFriendJoinBonus(...).catch(() => {})` in `routes/auth.js` and the `.then()` chains in
    `services/llm.js:76` / `:97`. These are deliberately fire-and-forget so a failed lumen award
    can't fail the user's request — but `.catch(() => {})` also means a broken gamification query,
    a wedged WHOIS refresh, or a failed `token_usage` insert (billing data) produces **no log
    line anywhere**. Ties into P1-1 (farmable currency — you can't see the awards misbehaving)
    and the logging bullet above.
  - *Fix:* one shared `fireAndForget(promise, context)` helper that awaits, catches, and logs via
    the structured logger (§4 logging bullet) with the call context — replace every
    `.catch(() => {})` with it. Convert frontend chains to `async`/`await` + arrow functions
    file-by-file as each screen is touched. The genuine callback APIs that stay: Passport's
    `req.login()` / `req.logout()` and the `req.session.regenerate/save` shims in `app.js` (no
    promise API — wrap with `util.promisify` if you want them uniform too).
  - This is maintainability, not user-impact or security on its own, but the silent-swallow half
    is a real observability hole. An ESLint rule (`promise/no-floating-promises`,
    `promise/catch-or-return`) would stop new instances landing — see the linting bullet.
- **Logging is ad hoc.** Every module logs via bare `console.log` / `console.error` with a
  hand-typed `[module/route]` prefix, straight to PM2's stdout/stderr files. No log levels
  (can't dial verbosity up for a bug or down for noise), no structure (can't grep/query by
  field), no request/correlation id (can't tie a user report to a log line), no rotation config
  visible, and errors are frequently swallowed (`.catch(() => {})`) so they never reach a log at
  all. Introduce a small logging module (pino or similar) with levels + JSON output + a
  per-request id from middleware, and route every `console.*` through it. See §6.5 for the
  operational side (alerting, uptime, spend).
- **No linting or formatting.** There is no ESLint, no Prettier, no `.editorconfig`, and no
  `lint` script in `package.json` — consistency is currently maintained by hand. The code
  happens to be tidy and uniform, which is a credit to the author, but nothing enforces it, and
  a linter would also catch real classes of bug this codebase is exposed to: unhandled promise
  rejections, `no-floating-promises` (the fire-and-forget `.catch(() => {})` pattern is
  everywhere and easy to get wrong), shadowed variables, unused vars, `no-await-in-loop` (the
  sequential `await db.execute` loops in `subsets.js` / `knowledgeEstimate.js` / `api.js`),
  accidental `==`. Add ESLint (with `eslint-plugin-promise` and `eslint-plugin-security`) + a
  `lint` npm script, run it in CI / a pre-commit hook, and add Prettier so formatting stops
  being a review concern.
- **Repo hygiene**: `additions_log.txt` / `collisions_log.txt` are no longer web-reachable (P0-1
  fixed) but still sit in the repo root — move them into a gitignored `docs/` or `data/` dir.
  `deploy.ps1` should reference the server by a config value, not a committed IP. No CI pipeline
  at all — no automated check runs between `git push` and the `pm2 reload` on the server.

---

## 5. Suggested order of work

1. ~~**P0-1** — restrict static serving~~ ✅ done 2026-09-01 (see above).
2. **P0-2** — configure Turnstile and fail closed.
3. **P1-1 / P1-2** — guard lumen awards to first-completion; add `llmRateLimit` + input caps to
   subset import. (Stops currency farming and runaway API cost.)
4. **P1-3** — subset IDOR gate. (One-line-per-route change.)
5. **P1-4 / P1-5** — verified-email check on OAuth match; `session_epoch` for revocation.
6. **P2** batch — settings allowlist, knowledge-value validation, CSP, CSRF headers, cookie
   `secure`, de-hardcode emails, **P2-7** error handling (`process.on` guards + pre-`try` async
   are quick; the `express-async-errors` switch and contract cleanup are larger).
7. **P3 + architecture** — `api.js` split, first tests, move logs/SQL out of web root,
   standardize async style (§4).

---

## 6. Open questions

These aren't code defects — they're gaps in operational knowledge and process that a review
can't answer from the repo. They matter as much as the P0s for a one-maintainer production app,
because most of them are "how do we recover when something goes wrong" or "how does a second
person get up to speed". Answers should end up in a `docs/operations.md` (or similar) that is
kept current.

### 6.1 Production server access — onboarding
- The only path in is the SSH key referenced by `deploy.ps1` (`mapofknowledge_deploy`), which is
  gitignored and lives on one laptop. **If that laptop dies, is there another way in?** Is the
  hosting-panel (zone.ee / ZoneVS) login recorded somewhere a second person can reach?
- When a new person joins: what's the checklist? (Add their SSH public key to
  `~/.ssh/authorized_keys` on the server? Share the hosting-panel account? A shared password
  manager vault?)
- Is there a break-glass account / recovery contact with the hosting provider?
- Who besides the primary maintainer currently has any access at all?

### 6.2 Backup of production server configuration
- Apache vhost config, the `.htaccess` proxy rule, the PM2 setup, the panel cron entry for
  `check-logs.js`, the `.env` file itself — **is any of this backed up anywhere off the server?**
- `.env` is the single most important thing to have a copy of (real DB password,
  `SESSION_SECRET`, Anthropic key, and — once set — SMTP and Turnstile secrets). If the server
  is wiped, can it be reconstructed, and from what?
- Recommendation: a short, hand-maintained "server rebuild from scratch" runbook, plus an
  encrypted copy of `.env` and any non-repo config in a password manager / private vault.

### 6.3 Database backup and restore
- **Does the hosting provider take automatic DB backups?** What retention, what frequency, and
  has a restore ever actually been tested?
- Is there an independent backup (e.g. a nightly `mysqldump` pulled off-site), or is the only
  copy the one the provider holds?
- What's the documented restore procedure, and what's the realistic RPO/RTO — how much data
  would we lose and how long would recovery take if the DB were lost right now?
- The data at risk is not just curriculum (that's re-seedable from the JSON files) — it's every
  learner's passport, progress, reflections, credentials, and lumen history, which is
  unrecoverable if lost.

### 6.4 Database migrations — no rollback / roll-forward
- `migrate.js` is forward-only and additive (`ALTER … IF NOT EXISTS`, one-way data
  transformations). There is **no down-migration, no ordering, no "which migrations have run"
  ledger** — the script re-checks the live schema every run to decide what to do.
- Open questions: how do we safely revert a bad schema change in production? How do we know, for
  a given deploy, exactly which schema version is live? How does a second developer's local DB
  get to a known-good state?
- Options to weigh: adopt a real migration tool (Knex was already floated in project notes) with
  a `migrations` tracking table and up/down files; or, at minimum, keep an explicit numbered
  changelog and always take a `mysqldump` immediately before running a migration in prod.

### 6.5 Logging and observability
- Current state: `console.log` / `console.error` to PM2's `mok-error.log` / `mok-out.log`, plus
  the `check-logs.js` tripwire emailing on a few Apache-log patterns. There is no structured
  logging, no request IDs, no error aggregation, no uptime/health alerting.
- Open questions:
  - How would we find out the site is **down** (PM2 crash-looping, DB unreachable, disk full,
    Anthropic key exhausted) before a user tells us? Is there any external uptime monitor hitting
    `/health`?
  - When a user reports "the app broke at 3pm", can we correlate their session to a log line?
    (No request IDs today.)
  - Are PM2 logs rotated / size-capped? (`max_memory_restart` is set; log rotation isn't
    visible in `ecosystem.config.js` — check `pm2-logrotate`.)
  - Do we track Anthropic spend against a budget with an alert, or only after the fact via
    `token_usage`?
- Suggested minimum: an external uptime check on `/health` with alerting, `pm2-logrotate`,
  a request-id middleware threaded into every `console.error`, and a periodic (or threshold)
  alert on LLM spend.

### 6.6 TypeScript on the backend?
- The backend is plain JS with no type checking. A lot of the bugs the code comments describe
  are shape bugs that a type system would have caught at author time: mysql2 returning `SUM()`
  as a string (`api.js:458`), `req.user` being `undefined` vs. `false` after `deserializeUser`,
  the `pending`/`built` result-object contract passed around in `auth.js`, LLM JSON responses
  whose fields are assumed but not guaranteed.
- Questions to decide: is the robustness worth a build step in the deploy flow (currently
  `git pull && npm install && pm2 reload` — no compile)? Incremental adoption (`// @ts-check` +
  JSDoc, then `.ts` file by file) or a clean cut? Who maintains it — does the team have TS
  fluency?
- Middle-ground option if a full move is too much: turn on `checkJs` with `// @ts-check` on the
  files that touch auth and money (lumens), add JSDoc typedefs for the `req.user` shape and the
  LLM response shapes, and validate LLM/`req.body` payloads at the boundary with a schema
  library (zod) — that gets most of the safety with no build step.

### 6.7 Frontend framework + TypeScript?
- The frontend is hand-written vanilla JS building DOM through `innerHTML` string concatenation
  across ~20 files (`app/js/*.js`), with global `window.*` modules and manual event wiring. This
  is the direct cause of P2-3 (XSS surface — every interpolation is a potential injection point
  the reviewer has to check by hand) and a large share of the maintenance cost.
- Questions to decide: is a framework (Svelte / Vue / React / Preact / lit) worth the rewrite
  cost and the build tooling? Would it be a big-bang rewrite or screen-by-screen (the app is
  already split into `index.html` + iframe'd sub-pages, which makes incremental migration
  feasible)? Same TS question as 6.6 applies to the FE.
- Lower-cost alternative that still kills most of the XSS surface: adopt one escape-by-default
  render helper (a tagged-template `html`` `` that escapes interpolations, or `lit-html`
  standalone) and ban raw `innerHTML +=`, without changing the overall architecture.

