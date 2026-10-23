# Decisions

Settled. Do not reopen without the owner.

## Auth

- **Email and password, with open registration.** `/sign-up` makes an account. The magic link, `/auth/callback` and `SITE_URL` are gone. (2026-10-04)
- **Phase B, the 6-digit email code, waits for a domain.** Resend refuses `*.vercel.app`, so the owner buys a domain and the sender is `mail.<domain>`. (2026-10-04)
- **"Confirm email" is off and "Allow new users to sign up" is on** in the Supabase dashboard. Phase A has no email check. (2026-10-04)
- **The password limit counts 72 characters, not 72 bytes.** A multi-byte password over 72 bytes gets the generic error. (2026-10-03)

## Testing

- **Signed-in e2e tests use the test account** `E2E_EMAIL` in `.env.test.local` and the CI secrets. A setup project signs in with the password and the anon key. No service-role key.
- **Never save a Stats layout on the shared e2e account.** `journey.spec.ts` and `openRoute` expect the default layout. If they break, set its `profiles.stats_layout` back to `null`.
- **The plan tests read their counts from the data.** A new step or a new plan breaks no test. (2026-10-21)
- **Playwright WebKit gets no service worker.** A WebKit offline test cuts Supabase only, and the offline image check is a named `skip`. True iPhone offline is proven on the device. (2026-10-21)

## Data and Supabase

- **These migrations are applied to the live project. Never apply them again:** `20260927142258_phase2_workouts`, `20260927151153_phase2_exercise_seed`, `20260928084529_phase2_set_policy_reps`, `20261008014222_feedback_goals_and_swim`, `20261019125214_phase3_coach_plans` and `20261023095029_phase4_saved_videos`.
- **`apply_migration` records its own version.** Rename the local file to the version that `list_migrations` shows.
- **`pnpm types:db` needs `SUPABASE_PROJECT_ID` exported in the shell.** Without it the script empties `lib/supabase/database.types.ts`. The MCP `generate_typescript_types` gives the same output.
- **The `coach-plan` skill writes migration files only.** It never applies one to the live project. (2026-10-20)
- **`workout_sets` has no `user_id`.** Its policy is an `exists` check on its session. `exercises.user_id` null is a global, read-only row.
- **Global exercise ids are permanent.** The seed has 40 rows; the coach plans add 14. 4 coach steps reuse a seed row by an alias the owner chose. (2026-10-19)
- **A new coach exercise row stores the Free Exercise DB id, name and instructions,** not its frames. (2026-10-20)
- **`workout_sessions.plan_ids` refuses an empty list and an unknown id.** Null means no plan. (2026-10-19)
- **`toServerSession` sends `plan_ids` only when it is not null,** so a local null never wipes the server. (2026-10-20)
- **No Supabase response goes in Cache Storage.** The Supabase rule in `app/sw.ts` is `NetworkOnly`.

## Design

- **The recipe wins over the prototype,** unless the recipe is wrong for real use.
- **A helper muscle chip has a dashed `border-dim` border,** in the app and the prototype. (2026-10-19)
- **Coach thumbnails are a plain `<img>` in `<picture>`,** not `next/image`. The images are local and precached. (2026-10-20)

## Coach plans

- **The coach images are for personal use while the repository is private.** Their source is unknown. Before the repository goes public, switch to `docs/data/fedb-images/` or confirm the source. (2026-10-19)
- **A video is a link out,** never a player in the app. (2026-10-17)
- **A plan id never leaves `PlanId`.** A removed plan gets `retired: true`, so old sessions still resolve.
- **A never-done plan is suggested first,** then the plan done least recently. (2026-10-19)
- **The last sets of a lift count finished, live sessions on this device only.** The picker's Recent list leaves out the live session. (2026-10-20)
- **A body-weight step shows a fixed `Body` cell and saves a null load.** Only `equipment === 'body only'` makes a step body weight. (2026-10-20)
- **Skip is hidden on the last step.** Untick deletes the set with the undo toast. A first-time step fills reps with `repsMin`. (2026-10-20)
- **The step image has no caption,** in the app and the plates. (2026-10-20)
- **A plan session ends on the full Done screen;** a free session keeps the summary sheet. The Done screen turns focus mode off, so the tab bar shows. (2026-10-20)
- **The 1-row laptop rest card has no `Change`,** as the plate shows. (2026-10-21)

## Saved videos

- **`STANDALONE_WAY` stays `new-tab` for both sites.** On the owner's iPhone the default way opens the Instagram app. (2026-10-23)
- **Saved videos stay out of the CSV export.** (2026-10-23)

## Workflow

- **Node comes from `.nvmrc`:** `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`. Node 20 breaks the jsdom tests.
- **Stop any `next dev` before `pnpm verify`.** A shared `.next` breaks the build, and once overwrote the production manifest. After a branch change that deletes a route, delete `.next`. (2026-10-20)
- **A hook blocks Claude's commit and push on `main`.** The owner runs both. (2026-10-20)
- **Each step runs in a fresh subagent.** It stages, writes the commit report and stops. The owner commits.

## Known limits

- **Anyone can register on the production deploy with no email check.** The owner accepts the risk until Phase B. (2026-10-04)
- **Claude cannot check production.** Vercel protection sends every `*.vercel.app` URL to the sign-in page. (2026-10-21)
- **`git merge` makes a commit with no gate report.** The hook watches `git commit` only. (2026-10-04)
- **A sync call during a drain queues one follow-up drain.** It costs one pull when nothing changed. Kept. (2026-10-01)
- **The rest timer keeps Skip and +30 s in memory.** A reload drops them.
- **`lastSetFor` reads every set,** because `workoutSets` has no `exercise_id` index. Acceptable for one user.
- **No unique index on global exercise names.** Only the seed adds global rows. The owner deferred it.
- **A body-weight step takes no added load,** so a weighted dip cannot be logged. (2026-10-20)
- **The error log can miss an error that comes with a navigation,** because the write is deferred. The Errors card loop guard matches a text prefix. (2026-10-16)
- **`/sign-up` loads more than `/sign-in`,** because zod ships with `signUpSchema`. Accepted. (2026-10-04)
