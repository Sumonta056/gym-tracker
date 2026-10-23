# Saved Videos — Design Specification

Date: 2026-10-23
Status: draft, waits for owner approval · Phase 4, on `main`, 1 step at a time
Mockups (temporary, local): `.superpowers/brainstorm/53004-1792733300/content/`
`saved-links-list-v5.html` is the accepted list and form. `nav-bar-options.html` option A
is the accepted bar.

---

## 1. Context

Every day the owner finds helpful videos on Instagram Reels and YouTube: a morning
stretch, a meditation, a home workout, a bench press tip, a gym trick. Today the owner
keeps the links in Apple Reminders. The links have no order and no grouping, and they
are not in the gym app.

The goal is a page in the app that holds these links, grouped by category, with the
important ones first. The owner opens it when they want to do the activity, at home
or in the gym, taps a link, and the video opens in Instagram or YouTube.

## 2. Goals, non-goals, anti-goals

**Goals**

1. Save a link with a title, 1 category, tags and a priority, in a few seconds.
2. Find a video fast: filter by category, search by title or tag.
3. The important videos show first.
4. Edit and delete a saved video.
5. Works offline and syncs, like the rest of the app.

**Non-goals**

- No video player in the app. A tap hands the link to the Instagram or YouTube app.
  See section 4a.
- No thumbnails, no source icons, no link preview fetch.
- No "share to app" from Instagram. That needs the Web Share Target API, which iOS
  Safari does not support for an installed web app.
- No drag-and-drop order. The owner tried it in the mockup and chose a priority field.
- No watched or done state. When a video is no longer needed, the owner deletes it.
- No category management screen.

**Anti-goals** (a failure even if it works)

- A form with too many fields. Saving a link must feel as fast as a reminder.
- A busy list. Normal items show no badge.

## 3. Owner decisions

| Topic          | Decision                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Layout         | Option B: 1 list, filter chips on top. Not sections per category.                                       |
| Card content   | Title, category (colored dot and name), tags, a priority badge, and a `⋯` button. Nothing else.         |
| No icons       | No Instagram or YouTube icon. No priority number. No `↗` open button.                                   |
| Open a video   | Tap the card.                                                                                           |
| `⋯` menu       | Edit and Delete only.                                                                                   |
| Priority       | A field in the form: High, Normal, Low. A new link is Normal.                                           |
| Order          | High, then Normal, then Low. The same order in "All" and in each category.                              |
| Badges         | High shows an accent badge. Low shows a grey badge. Normal shows none.                                  |
| Categories     | The owner makes them. No fixed list. "+ New" in the form makes one and selects it.                      |
| Tags           | Yes, free text, several per video.                                                                      |
| Navigation     | "Saved" takes the Profile slot in the bottom bar. Profile moves to an avatar button in the page header. |
| Laptop sidebar | Shows all 5: Today, Stats, Workouts, Saved, Profile.                                                    |

## 4. The screen: `/saved`

Follow the accepted mockup `saved-links-list-v5.html` and the design system skill.

1. **Header.** Title "Saved". A line under it: `<n> videos · <m> categories`.
   A `+ Save` primary pill button at the top right opens the form.
2. **Search.** 1 input, label "Search titles and tags". It matches the title and the
   tags, case-insensitive, as the owner types.
3. **Chips.** A row that scrolls sideways inside its own box (not the page). "All"
   first, then each category that has at least 1 video, by name A to Z. Each chip shows
   the color dot, the name and the count. 1 chip is selected at a time. The selected
   chip uses the accent fill.
4. **List.** The cards, in the order of section 6. Tap a card: the link opens as
   section 4a says. The `⋯` button opens Edit and Delete.
5. **Empty state.** No videos yet: 1 line and the `+ Save` button. A filter or search
   with no match: 1 line that says so.
6. **Delete.** It soft deletes at once and shows the existing undo toast. No confirm.

Responsive: 1 column under 640 px, 2 columns from 640 px, 3 columns from 1024 px, as
the contract says. The chips stay above the grid.

## 4a. Open the video in its own app

**Owner decision:** a tap on an Instagram link opens the Instagram app. A tap on a
YouTube link opens the YouTube app. Safari is not acceptable when the app is
installed.

**The risk.** The app runs from the iPhone home screen. A `target="_blank"` link there
often opens a Safari sheet, and the Instagram or YouTube app does not take over.
Nobody can prove the fix without the owner's real iPhone.

**So the first app step is a spike on the device.** A throwaway test page with 1
Instagram Reel and 1 YouTube link, each opened 3 ways:

1. `<a href target="_blank" rel="noopener noreferrer">`.
2. `<a href>` in the same window, no `target`.
3. The app scheme: `youtube://` with the video path for YouTube, `instagram://` for
   Instagram.

The owner taps each on the iPhone from the home screen and reports which one opens
the app. The plan then fixes 1 way per site in `lib/links/openTarget.ts` (a pure
function: URL in, the `href` and `target` out), with a unit test for each site and a
plain web link for any other site. On the laptop every link opens in a new tab.

If no way opens the Instagram app, the owner decides again before the screen step.

## 5. The form: add and edit

A sheet with the existing `SheetModal`. The same form adds and edits.

| Field    | Rule                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| Link     | Required. A valid `http` or `https` URL. Any site. Max 2048 characters. Trim spaces.                |
| Title    | Required. 1 to 120 characters after trim.                                                           |
| Category | Required. Chips of the current categories, then "+ New". "+ New" shows an input, max 40 characters. |
| Tags     | Optional. Up to 10 tags, each 1 to 30 characters, stored lower case with no `#`. Suggest used tags. |
| Priority | Required. A 3-part segmented control: High, Normal, Low. Default Normal.                            |

On Save the sheet closes and the list shows the new card at once.

## 6. Order

Sort by priority (High, Normal, Low), then by `created_at`, newest first. Editing a
video does not move it inside its priority level.

## 7. Data

2 new synced entities. Every rule in `.claude/rules/architecture.md` holds: a client
UUID, a write and its outbox entry in 1 transaction, soft delete, `user_id = auth.uid()`
Row Level Security, 1 zod schema per entity in `lib/schema/`.

**`video_categories`**

| Column       | Type        | Note                                                   |
| ------------ | ----------- | ------------------------------------------------------ |
| `id`         | uuid        | client made                                            |
| `user_id`    | uuid        | filled by the sync worker on push                      |
| `name`       | text        | 1 to 40 characters                                     |
| `color`      | text        | a data token name, for example `data-cyan`. See below. |
| `created_at` | timestamptz |                                                        |
| `updated_at` | timestamptz |                                                        |
| `deleted_at` | timestamptz | soft delete                                            |

**`saved_videos`**

| Column        | Type        | Note                               |
| ------------- | ----------- | ---------------------------------- |
| `id`          | uuid        | client made                        |
| `user_id`     | uuid        | filled by the sync worker on push  |
| `url`         | text        | checked by the zod schema          |
| `title`       | text        |                                    |
| `category_id` | uuid        | references `video_categories.id`   |
| `tags`        | text[]      | default empty                      |
| `priority`    | text        | `high`, `normal` or `low`, a check |
| `created_at`  | timestamptz |                                    |
| `updated_at`  | timestamptz |                                    |
| `deleted_at`  | timestamptz | soft delete                        |

- **Color.** The stored value is a token name from a fixed set of 6: `data-cyan`,
  `data-violet`, `data-pink`, `data-blue`, `data-yellow`, `data-slate`. A database check
  holds the set. A new category takes the first name in that order that the owner's live
  categories do not use. When all 6 are used, it starts again at the first. The color is
  stored, so it is the same on every device. Accent, warn, danger and ok are left out:
  an accent dot vanishes on the selected accent chip, and warn and danger already mean
  warning and destructive. (Claude's call.)
- **Rename.** A rename changes 1 row. Every video follows, since it holds the id.
- **An empty category** stays as a row but shows nowhere. "+ New" with the name of an
  existing category (case-insensitive) reuses that row and does not make a second one.
- **Push order.** A category must reach the server before a video that points at it.
  The outbox sequence already keeps that order, since the form writes the category
  first in the same transaction.

Use the `db-migration` skill: 1 Supabase migration and 1 Dexie version bump together.

## 8. Navigation change

- `lib/nav.ts`: `NAV_DESTINATIONS` becomes Today, Stats, Workouts, Saved. The bar keeps
  2 tabs on each side of the centre action.
- The laptop sidebar lists Today, Stats, Workouts, Saved, Profile.
- `AppShell` has no shared page header today; each screen draws its own `<h1>`. A new
  `ProfileAvatarLink` component (a 44 px round link to `/profile`) goes into the header of
  the 4 tab screens only: Today, Stats, Workouts and Saved. It is the right-most item in
  each header. On `/saved` the `+ Save` pill sits to its left. It is not on `/log`,
  `/workout`, a plan detail page, `/profile` or in focus mode. It shows under 1024 px
  only; from 1024 px the sidebar has Profile. (Claude's call.)
- The `/profile` page does not change.
- `tests/e2e/responsive.spec.ts` keeps "exactly 1 navigation visible at every width".

## 9. The visual contract

`docs/design/prototype/index.html` is the visual contract, so the first build step adds
to it, before any app code:

1. A Saved list plate at 390 px, from `saved-links-list-v5.html`.
2. A Save form plate.
3. The new bottom bar (option A of `nav-bar-options.html`) and the avatar in the 4 tab
   headers.
4. The 1440 laptop sidebar with 5 items.

`/styleguide` then gets the matching samples. The `.superpowers/` mockups stay
temporary; the prototype plates replace them as the reference.

## 10. Offline

- The list, the form, add, edit and delete all work offline, like every other screen.
- Opening a video needs a network. That is outside the app.
- `/saved` joins the offline route tests.

## 11. Known limits

- **2 devices offline can make 2 categories with the same name.** Each device checks
  only its own rows. After sync the chips show 2 "Yoga" chips. The owner can rename 1
  and move its videos by edit. Kept on purpose: 1 person, rarely offline on 2 devices
  at once. A server unique rule needs a remap step like the duplicate date rule, which
  costs more than the case it closes.
- **Last push wins,** as in every other table.
- **The URL is not checked for reach.** A dead link stays until the owner deletes it.

## 12. Calls left to the builder

Marked here so the owner can check them.

1. Inside a priority level, newest first. (Claude's call.)
2. The category color comes from the data tokens, not from the owner. (Claude's call.)
3. The avatar shows the first letter of the profile name, or a person glyph when there
   is no name. It sits only in the 4 tab screen headers. (Claude's call.)
4. The 6 category colors in section 7. (Claude's call.)
5. The prototype plates come first, as section 9 says. (From the project rules.)
6. The order of Phase 4: prototype plates, the iPhone spike, data and sync, the screen
   and form, the navigation change. (Claude's call.)
7. Where the rename of a category lives. Suggested: a "Rename" text button that shows
   beside the chips when 1 category is selected. (Claude's call, open to the owner.)
8. The route name `/saved` and the tab label "Saved". (Claude's call.)

## 13. Acceptance

1. On the owner's iPhone, from the home screen, a tap on an Instagram link opens the
   Instagram app, and a tap on a YouTube link opens the YouTube app.
2. Save a video with a new category offline. It shows at once. Online, it syncs with no
   duplicate row.
3. High shows above Normal, Normal above Low, in "All" and in a category.
4. Search matches a title word and a tag.
5. Delete, then undo, restores the video.
6. A category with no videos does not show a chip.
7. The bar shows 4 tabs and a centred action from 320 px to 1023 px. The avatar opens
   `/profile`.
8. Every tap target is 44 px or more. axe reports no serious or critical issue on
   `/saved` and on the open form.
9. `pnpm verify` passes.
