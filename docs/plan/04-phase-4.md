# Phase 4 — Saved videos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/saved` tab that holds the owner's Instagram and YouTube links, grouped by an
owner-made category, ordered by priority, offline first and synced, with Profile moved to
a header avatar.

**Architecture:** 2 new synced entities, `video_categories` and `saved_videos`, follow
the Phase 2 path exactly: a zod schema each in `lib/schema/`, a paired Supabase
migration and Dexie version 7, repository writes with their outbox entry in 1
transaction, and push and pull cases in `lib/sync/worker.ts`. The screen is 1 client
route that reads through `lib/db/repository.ts` with `useLiveQuery`; the list order,
search and chips are pure functions in `lib/videos/list.ts`; how a link opens is 1 pure
function, `lib/links/openTarget.ts`, whose iPhone rule the owner settles on the device.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind v4, Dexie 4 with
`dexie-react-hooks`, Supabase, zod, react-hook-form, Vitest with `fake-indexeddb`,
Playwright.

**Spec:** `docs/specs/2026-10-23-saved-videos-design.md`. Every owner decision and every
"Claude's call" in it is settled. Read it with this plan.

## Global Constraints

- Tables `video_categories` and `saved_videos`. Route `/saved`. Tab label `Saved`.
- Link: required, `http` or `https` only, any site, max 2048 characters, trimmed.
- Title: required, 1 to 120 characters after trim.
- Category name: 1 to 40 characters. A "+ New" name equal to a live category,
  case-insensitive, reuses that row.
- Tags: optional, up to 10, each 1 to 30 characters, stored lower case with no `#`.
- Priority: `high`, `normal` or `low`. A new video is `normal`.
- Order: High, then Normal, then Low; inside a level `created_at` newest first. An edit
  does not move a video inside its level.
- Category colors, in this order: `data-cyan`, `data-violet`, `data-pink`, `data-blue`,
  `data-yellow`, `data-slate`. A database check holds the set.
- Badges: High shows an accent badge, Low a grey badge, Normal none.
- Delete soft deletes at once and shows the existing undo toast. No confirm.
- The bar: Today, Stats, centre action, Workouts, Saved. The sidebar: Today, Stats,
  Workouts, Saved, Profile.
- `ProfileAvatarLink`: a 44 px round link to `/profile`, the right-most item in the
  header of Today, Stats, Workouts and Saved only, shown under 1024 px only.
- Every rule in `CLAUDE.md` and `.claude/rules/` holds: client UUIDs, write plus outbox
  in 1 transaction, soft delete, `user_id = auth.uid()` RLS, no raw hex, 44 px targets,
  every `<button>` has a `type`, no code comments.
- Node from `.nvmrc`: `export PATH="$HOME/.nvm/versions/node/v$(cat .nvmrc)/bin:$PATH"`.
- Phase 4 runs on `main`, 1 step per session, each step in a fresh subagent. The agent
  stages and writes the commit report. **The owner commits.** The agent never runs
  `git commit` or `git push`.

## Review Focus

1. **A pasted link with junk.** `  https://youtu.be/x  ` saves trimmed; `HTTPS://…`
   saves; `javascript:alert(1)`, `instagram://reel/x` and `www.youtube.com/x` with no
   scheme are refused with a message under the field. Owner: 4.3 schema test, 4.4 form
   test.
2. **Tags typed the way people type.** `#Yoga`, `yoga` and `YOGA` become 1 tag `yoga`;
   a lone `#` is refused; an 11th tag is refused with a message. Owner: 4.3 schema test.
3. **The selected chip disappears.** Delete or edit the last video of the selected
   category: the filter falls back to "All", never an empty list with no chip selected.
   Undo brings the chip back. Owner: 4.4 `SavedVideos.test.tsx`.
4. **A long unbroken title, tag or category name at 320 px.** A 120-character title with
   no space and a 30-character tag wrap inside the card; the page never scrolls
   sideways. Owner: 4.4 `saved.spec.ts`, 4.5 `responsive.spec.ts`.
5. **A video whose category is not on this device.** A pulled video can name a category
   row that has not arrived. The card renders with no category line and no crash, and
   the "All" count includes it. Owner: 4.3 `listSavedVideos` test, 4.4 card test.

---

## How a step runs

1. Read `PROGRESS.md`, then the step file in `docs/plan/phase-4/`. Read only that file.
2. Do the step. Stop at its end.
3. Run `pnpm check:step`, then `pnpm e2e:step <spec>` for the spec the step names.
4. Run the `commit-report` skill. A UI change adds screenshots at 390, 768 and 1440 px
   next to the matching prototype plate.
5. Stage. Stop. The owner commits on `main`.
6. Update the **Next step** line in `PROGRESS.md`.

Load the `design-system` skill before any step that touches `app/` or `components/`.
The full `pnpm verify` runs at Checkpoint B only.

## The steps

| Step | File                      | Title                                    | Size | Depends on    | E2E spec             |
| ---- | ------------------------- | ---------------------------------------- | ---- | ------------- | -------------------- |
| 4.1  | `S4.1-design-contract.md` | The prototype plates                     | M    | spec approved | none                 |
| 4.2  | `S4.2-link-spike.md`      | The iPhone link spike and `openTarget`   | S    | 4.1           | none                 |
| 4.3  | `S4.3-data-and-sync.md`   | Schemas, migration, repository, sync     | L    | 4.1           | none                 |
| 4.4  | `S4.4-saved-screen.md`    | `/saved` and the add and edit form       | L    | 4.2, 4.3      | `saved.spec.ts`      |
| 4.5  | `S4.5-navigation.md`      | The Saved tab and the header avatar      | M    | 4.4           | `responsive`, `a11y` |
| 4.6  | `S4.6-verification.md`    | Full verify, browser check, device check | S    | 4.5, Ckpt A   | full `pnpm verify`   |

4.2 and 4.3 are independent after 4.1. Do 4.2 first so the owner can test on the iPhone
while 4.3 runs.

**The `/styleguide` samples** come with the components they show, in 4.4 and 4.5, not
in 4.1: a sample renders the real component, and none exists in 4.1. 4.1 sets the
plates; 4.4 and 4.5 add the samples that must match them.

## Checkpoints

### Checkpoint A — the iPhone link answer · owner, during 4.3 or 4.4

- [x] The owner opened `/link-test` from the home screen app and reported, per site,
      which of the 3 ways opens the Instagram app and the YouTube app.
- [x] `STANDALONE_WAY` in `lib/links/openTarget.ts` holds that answer, with its tests.
      The owner's answer on 2026-10-23: Instagram opens its app with the default way, so
      both sites stay `new-tab`. The spike page `/link-test` is removed.
- [x] If no way opens the Instagram app: stop. The owner decides again before 4.4 is
      called done (spec 4a).

4.4 is not done until this checkpoint is ticked.

### Checkpoint B — after 4.6

- [x] Every item in the Phase 4 checklist below passes.

## Phase 4 checklist

- [x] The owner accepted the 4 new plates (spec 9).
- [x] The migration is applied to the live project; `lib/supabase/database.types.ts`
      has both tables.
- [x] `lib/sync/**` coverage stays at 95 / 90 / 95; the `sync-auditor` found no lost
      write and no duplicate row.
- [x] On the iPhone, from the home screen, an Instagram link opens Instagram and a
      YouTube link opens YouTube (spec 13.1). The owner confirmed Instagram. YouTube on
      the iPhone is not yet confirmed.
- [x] A video saved offline with a new category shows at once and syncs with no
      duplicate row (13.2).
- [x] High above Normal above Low, in "All" and in a category (13.3).
- [x] Search matches a title word and a tag (13.4).
- [x] Delete, then undo, restores the video (13.5).
- [x] A category with no videos shows no chip (13.6).
- [x] The bar shows 4 tabs and the centre action from 320 to 1023 px; the avatar opens
      `/profile` (13.7).
- [x] 44 px targets; axe reports no serious or critical issue on `/saved` and the open
      form (13.8).
- [x] `/styleguide` matches the new plates.
- [x] `pnpm verify` passes (13.9).

The final commit is `docs(docs): mark phase 4 saved videos complete`.

## Settled before the build

Claude's calls on 2026-10-23. The owner can override any of them at plan review.

1. **Today's avatar.** Follow spec 8: under 1024 px only. On the laptop the sidebar
   Profile item replaces it.
2. **The spike entry point.** A temporary "Link test" link at the foot of `/profile`.
   4.4 removes the link and the page.
3. **Category rename.** Build it as 4.4 says: a "Rename" text button beside the chips
   when 1 category is selected, a 1-field sheet, and a name used by another live
   category is refused.
4. **The CSV export.** Saved videos stay out of it.
