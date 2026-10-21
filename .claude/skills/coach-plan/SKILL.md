---
name: coach-plan
description: Add or change a coach plan step in the Gym Tracker — its 2 images saved
  locally as WebP, its muscles looked up in Free Exercise DB, its video link, and the
  row in `docs/data/coach-exercises.json`. Use when asked to "add an exercise", "add a
  step to a plan", "new plan from my coach", "change the image of", "set the video
  for", "remove a step", "retire a plan", or when a message holds an image link and an
  exercise name, even if it never names a plan or the skill.
---

# Coach plan

The 4 coach plans live in `docs/data/coach-exercises.json`. Every other file is built
from it: `scripts/coach-data.mjs` writes `lib/plans/coach.ts`, and
`scripts/exercise-image.mjs` writes `public/exercises/<slug>-<side>.webp` from the
JPEG in `docs/data/coach-images/`. There is no upload and no image hosting: the images
ship with the code.

This skill edits the JSON, the source JPEG files and the WebP files, then regenerates.
It never edits `lib/plans/coach.ts` by hand, because the next run of the generator
would undo it.

## The 5 requests

| Request                    | What changes                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Add a step to a plan       | 2 JPEG in `docs/data/coach-images/`, 2 WebP, 1 row in the JSON, a seed row if new     |
| Change the image of a step | 1 or 2 JPEG and WebP files replaced. The paths stay the same.                         |
| Set the video of a step    | `video` in the JSON row: the url, `kind: 'video'`, the length text                    |
| Add a new plan             | A new `PlanId`, the plan in the JSON, its files, a migration for the `plan_ids` check |
| Remove a step or a plan    | The step leaves the JSON. A plan gets `retired: true`, never a delete.                |

Every request ends with `node scripts/coach-data.mjs`.

## The rules

These protect the owner's data and the live database. Each one has bitten before or
would be hard to undo.

- **Sources.** Only an `https` link, or a local file the owner names. Only an image
  type. Refuse a file over 5 MB. A web page is not an image: refuse it and say what
  the link returned. A video link must be `https`.
- **Where you write.** Only `docs/data/`, `public/exercises/`, `lib/plans/`,
  `lib/schema/plan.ts` and `supabase/migrations/`. Nothing else. The one exception is
  in "The tests that pin the data" below, and it needs the owner's yes.
- **Never delete an image that another step still names.** Search the JSON for the
  path first.
- **Never remove a `PlanId`.** Old sessions carry it in `plan_ids`. A plan retires.
- **Copy the owner's how-to text word for word.** No rewording, no fixed typos, no
  added full stop. It is the coach's voice.
- **Ask, never guess.** A missing side, a missing how-to text, a missing equipment, a
  doubtful muscle match: ask. A missing position is the one default: the end of the
  group.
- **Never apply a migration.** Write the file under `supabase/migrations/` and tell
  the owner. Never call `apply_migration`, `execute_sql` or any other Supabase write
  tool, and never run `supabase db push`. Applying it to the live project is a
  separate step the owner approves.
- **Never commit.** No `git commit`, no `git push`, no `git stash`. Stop after the
  tests and report the changed files. The commit gate and the `commit-report` skill
  are the owner's call.

## Helper scripts

Both live in this skill's `scripts/` folder. Run them from the repository root.

| Script                                                  | What it does                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch-source.mjs <link-or-file> <slug> <side> --check` | Reads the source and checks it: `https` only, an `image/*` type, 5 MB at most, a real image. Writes nothing.                                                        |
| `fetch-source.mjs <link-or-file> <slug> <side>`         | The same checks, then saves `docs/data/coach-images/<slug>-<side>.jpg`. A JPEG is kept byte for byte. Other types become JPEG. A file already there is not touched. |
| `fedb-match.mjs <name>`                                 | The 5 Free Exercise DB entries whose names match best: id, name, equipment, primary and secondary muscles, frame links.                                             |

`scripts/exercise-image.mjs` and `scripts/coach-data.mjs` are the project's own
scripts. Call them as they are.

## The procedure

### 1. Collect the input

The plan, the group, the position, the name, the how-to text, the start image, the end
image, the equipment, and the video link if any. Read
`docs/data/coach-exercises.json` to see the plans, their groups and the existing
slugs.

### 2. Ask for what is missing

Ask, then wait. Write nothing before the answer.

- **1 image link only.** Ask: "Is this the start position, the end position, or one
  image that shows both?" For "both", ask for the second image, or use the same
  source for the start and the end only if the owner says so.
- **No how-to text.** Ask for it.
- **No equipment.** Ask, from `dumbbell`, `barbell`, `cable`, `machine`, `body only`
  (the `EQUIPMENT` enum in `lib/schema/plan.ts`). The Free Exercise DB value may be
  shown as a hint, but the owner picks. `body only` makes the step a body-weight step.
- **No position.** Add the step at the end of the group. Say so in the summary.
- **No group, and the plan has more than 1.** Ask.

Then check every image source with `fetch-source.mjs ... --check`. A refusal stops the
request here. Tell the owner what the link returned, and ask for an image link.

### 3. Look up the muscles

Run `node .claude/skills/coach-plan/scripts/fedb-match.mjs "<name>"`. Show the owner
the best entry's name, its id, and its primary and secondary lists. Wait for a yes.

- Keep only muscles from the 16 names of `MUSCLES` in `lib/schema/plan.ts`. Free
  Exercise DB also has `adductors` and `abductors`: drop them and say so.
- No match, or the owner says no: ask for the primary muscle from `MUSCLES`, and any
  helper muscles.
- Record the match in the row as `freeExerciseDb: { id, name, instructions }`, so it
  can be checked later. The `frames` field is left out: this skill saves no Free
  Exercise DB photo unless the owner gives its link as a step image.

### 4. Show a summary and wait for a yes

List: the request, the plan and group and position, the slug, the name, the how-to
text as given, the 2 sources, the muscles, the equipment, the video, the seed row
(reused or new), any migration, and every file that will change. Wait for a yes.

### 5. Make the slug

Lower case. Each run of other characters becomes 1 dash. No dash at either end:

```js
name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
```

A slug that is already in `uuids` means a change, not an add. Say so and switch to the
change request.

### 6. Save the images

```bash
node .claude/skills/coach-plan/scripts/fetch-source.mjs <start-source> <slug> start
node .claude/skills/coach-plan/scripts/fetch-source.mjs <end-source> <slug> end
node scripts/exercise-image.mjs docs/data/coach-images/<slug>-start.jpg <slug> start
node scripts/exercise-image.mjs docs/data/coach-images/<slug>-end.jpg <slug> end
```

The WebP is always made from the saved JPEG, never straight from the link, so
`node scripts/exercise-image.mjs --all` rebuilds the same files later.

### 7. Look at each new WebP

Open `public/exercises/<slug>-start.webp` and `-end.webp` with the Read tool. Say what
each one shows: the exercise, the position, anything odd such as a watermark, a crop
that cuts off the person, or the wrong exercise. If it does not show the exercise,
stop and tell the owner.

### 8. Write the JSON row and regenerate

Add the row to the group's `steps` at its position. The shape, as every existing row:

```json
{
  "slug": "<slug>",
  "name": "<name as the owner wrote it>",
  "how": "<how-to text, word for word>",
  "images": {
    "start": "docs/data/coach-images/<slug>-start.jpg",
    "end": "docs/data/coach-images/<slug>-end.jpg"
  },
  "muscles": { "primary": ["..."], "secondary": ["..."] },
  "equipment": "<one of EQUIPMENT>",
  "freeExerciseDb": { "id": "...", "name": "...", "instructions": ["..."] },
  "video": { "url": "https://...", "kind": "video", "length": "4:12" }
}
```

- **The video.** With a link from the owner: `kind: "video"`, and `length` as the
  owner gives it, or left out. With no link: the search link every other step has,
  `https://www.youtube.com/results?search_query=` plus
  `encodeURIComponent('<name> form')`, `kind: "search"`. Every step carries a video,
  and a test checks it.
- **The UUID.** Add `"<slug>": "<uuid>"` to `uuids`. A name that matches a seed row
  (step 9) reuses that row's UUID. Otherwise make one with
  `node -e "console.log(crypto.randomUUID())"` once, and write it as a literal. Never
  generate it in code that runs again.

Then:

```bash
pnpm exec prettier --write docs/data/coach-exercises.json
node scripts/coach-data.mjs
```

### 9. A new exercise: the seed row

Every step's `exerciseId` must be a global row in `public.exercises`, because the
sets the user logs point at it.

1. Look for the name in the seed rows of `supabase/migrations/*_phase2_exercise_seed.sql`,
   `*_phase3_coach_plans.sql` and every `*_coach_exercise_*.sql`, case-insensitive.
   An exact match reuses that row's UUID. No migration.
2. A close name (for example `Back Squat` for `Squat`, `Lateral Raise` for
   `Side Lateral Raise`): ask the owner whether it is the same exercise. A yes reuses
   the row. Never decide this alone: a wrong reuse merges 2 exercises' history.
3. Otherwise, write 1 migration. This is a data-only change in the `db-migration`
   skill's sense: no table changes, so there is no Dexie bump, no zod change and no
   sync change. Name it with the UTC time, `date -u +%Y%m%d%H%M%S`:

   `supabase/migrations/<timestamp>_coach_exercise_<slug with _ for ->.sql`

   ```sql
   insert into public.exercises (id, user_id, name, muscle_group)
   values
     ('<uuid>', null, '<Name>', '<group>')
   on conflict (id) do nothing;
   ```

   - `<group>` is the app group of the first primary muscle, from the table in
     `docs/data/README.md` (quadriceps is `legs`, lats is `back`, and so on).
   - A `'` in the name is written `''`.
   - No comment in the file, as the Phase 3 migration.
   - Never edit a migration that already exists. It may have run.

Tell the owner the file is written and not applied.

### 10. A new plan

1. Ask for the id (lower case words and dashes), the title and the groups.
2. Add the id at the end of `PLAN_IDS` in `lib/schema/plan.ts`. Never remove or
   reorder one.
3. Add the plan to `plans` in the JSON, with its steps as in steps 5 to 9.
4. Write 1 migration that widens the check. Every id, old and new, in `PLAN_IDS`
   order:

   `supabase/migrations/<timestamp>_coach_plan_<id with _ for ->.sql`

   ```sql
   alter table public.workout_sessions
     drop constraint if exists workout_sessions_plan_ids_known;

   alter table public.workout_sessions
     add constraint workout_sessions_plan_ids_known
       check (
         cardinality(plan_ids) > 0
         and plan_ids <@ array['chest-triceps', 'back-biceps', 'shoulders', 'legs', '<new-id>']::text[]
       );
   ```

5. Tell the owner the file is written and not applied. Until it is applied, a session
   of the new plan fails to sync.

### 11. Change, set and remove

- **Change the image.** Steps 2, 6 and 7 only. The paths stay the same, so the JSON
  and `coach.ts` do not change. Run `node scripts/coach-data.mjs` anyway: it must
  report no change in `git status` for those 2 files.
- **Set the video.** Check the link is `https`. Ask for the length text if the owner
  wants it shown. Set `video` to `{ "url", "kind": "video", "length" }` on the row,
  then prettier and `node scripts/coach-data.mjs`.
- **Remove a step.** Take the row out of its group and its slug out of `uuids`. Delete
  its 2 JPEG and 2 WebP files only if no other step names them. Never delete the seed
  row: logged sets still point at it. A group left with no step is removed too. A plan
  left with no group cannot be: retire it instead.
- **Remove a plan.** Set `"retired": true` on the plan. Keep its rows, its images and
  its `PlanId`. `listPlans` hides it, and an old session still shows its title.

### 12. Run the tests, then stop

```bash
pnpm test lib/plans lib/schema lib/design
pnpm test components/plans
```

Both must pass. `pnpm check:step` runs them before any commit, so the owner needs to
know now.

Then report: the request, every file changed (`git status --short`), what each WebP
shows, any migration written and not applied, and any test you updated. Never commit.

## The tests that pin the data

Since step 3.10 the plan tests read their counts from the data: the step counts, the
plan list, the slug lists, the minutes, the WebP file count, the `uuids` count and the
`PlanId` list come from `docs/data/coach-exercises.json`, `COACH_PLANS` or
`combinePlans`. Every `*_coach_exercise_*.sql` file joins the seed lookup, and the
`plan_ids` check test reads the newest migration that sets
`workout_sessions_plan_ids_known`. An add, a remove or a new plan made by this skill
needs no test edit in `lib/plans`, `lib/schema/plan.test.ts` or `components/plans`.
Checked on 2026-10-21 with 1 step added to Legs, 1 step added to Chest, and a new plan
with its seed and check migrations.

A few facts stay pinned on purpose. When the request changes one, update only its
expected value, from the new data, and list the edit in the report:

| Request                    | Expected values to update                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A reused exact seed name   | `coach.test.ts`: the exact count and the `seedName` map.                                                                        |
| A `body only` step         | `coach.test.ts`: the body-weight list.                                                                                          |
| Retire a plan              | `coach.test.ts`: "retires no coach plan" names the retired plan.                                                                |
| A step before a named step | A test that names a step by its place, for example Rope Pushdown as step 7 in `tests/e2e/plans.spec.ts`, follows the new place. |

Never weaken a check, and never change a test to pass a mistake: when a check fails
for a reason the request did not cause, stop and report it.
