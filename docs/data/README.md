# Phase 3 source data

Real data, saved on 2026-10-17, before any Phase 3 code. Every Phase 3 step reads from
here. Nothing in this folder ships to the browser as it is. Steps 3.2, 3.4 and 3.4b
copy what the app needs into `lib/` and `public/`.

| File or folder          | What it is                                                                                                                                            | Licence                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coach-exercises.json`  | The 4 plans, 26 steps, in the coach's order. Each step: slug, name, how, muscles, video, images.                                                      | The coach's text. Private use.                                                                                                                                                                  |
| `coach-images/`         | 52 JPEG files, 420 × 280, `<slug>-start.jpg` and `<slug>-end.jpg`, from the coach plan HTML file (removed from the repository; git history keeps it). | Unknown source. The owner chose this set on 2026-10-19, for personal use while the repository is private. Before the repository becomes public, switch to `fedb-images/` or confirm the source. |
| `fedb-images/`          | 52 JPEG photos, `<slug>-0.jpg` and `<slug>-1.jpg`, the 2 frames of each Free Exercise DB entry.                                                       | Unlicense, public domain.                                                                                                                                                                       |
| `body-polygons.json`    | 22 body regions as SVG polygons, front and back, `viewBox 0 0 100 200`.                                                                               | MIT, `body-polygons.LICENSE`.                                                                                                                                                                   |
| `body-polygons.LICENSE` | The MIT notice of react-body-highlighter 2.0.5.                                                                                                       |                                                                                                                                                                                                 |

## Where each field comes from

- `muscles.primary` and `muscles.secondary`: Free Exercise DB, `dist/exercises.json`,
  876 entries. Each coach name was matched by hand to 1 entry. The entry is in
  `freeExerciseDb.name` and `freeExerciseDb.id`, so the match can be checked.
- `freeExerciseDb.frames`: the 2 public domain photos of that entry, as a second
  source of a start and an end picture.
- `video.url`: a YouTube search for `<name> form`. No per-exercise video set with a
  licence to bundle exists. The link opens outside the app. The owner may replace it
  with a specific video through the `coach-plan` skill.
- `body-polygons.json`: `src/assets/index.ts` of react-body-highlighter 2.0.5, with
  the region names in lower case and a dash.

## The muscle names and the body regions

| Free Exercise DB | App group   | Body regions                      |
| ---------------- | ----------- | --------------------------------- |
| chest            | `chest`     | chest                             |
| shoulders        | `shoulders` | front-deltoids, back-deltoids     |
| neck             | `shoulders` | neck                              |
| triceps          | `arms`      | triceps                           |
| biceps           | `arms`      | biceps                            |
| forearms         | `arms`      | forearm                           |
| abdominals       | `core`      | abs                               |
| obliques         | `core`      | obliques                          |
| lats             | `back`      | upper-back                        |
| middle back      | `back`      | upper-back                        |
| lower back       | `back`      | lower-back                        |
| traps            | `back`      | trapezius                         |
| quadriceps       | `legs`      | quadriceps                        |
| hamstrings       | `legs`      | hamstring                         |
| glutes           | `legs`      | gluteal                           |
| calves           | `legs`      | calves, left-soleus, right-soleus |

The app group is the Phase 2 `muscle_group` enum, so the map uses the same colour as
the muscle balance chart on Stats.

## How to refresh

The scripts that built this folder ran once, by hand, from the sources above. Step 3.4
writes `scripts/exercise-image.mjs`, which converts `coach-images/` to WebP. A new
exercise comes through the `coach-plan` skill, step 3.11, which adds its row here too.
