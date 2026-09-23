# Chart rules

Every chart on `/analytics`, Phase 1 and Phase 2, follows these rules. The contract is
prototype plates `p5` and `p5-one-day`. The shared parts live in `components/charts/`.

## The frame

- Wrap every chart in `ChartCard`. It gives `role="img"`, the `aria-label`, the
  summary line, the legend and the empty state.
- Fill the card with `ResponsiveContainer width="100%"`. Never a fixed pixel width.
- Nothing inside the `role="img"` is focusable. Labels are SVG text. No tooltips, no
  tap to inspect.
- Every colour comes from `lib/design/tokens.ts`. The label styles come from
  `components/charts/chartStyle.ts`.

## Labels a user can read

1. **Day labels** under the x-axis on every daily chart, 11 px, `muted`.
   - Week: `M T W T F S S`.
   - Month: the dates 1, 8, 15, 22 and 29.
   - Day: the weekday and the date, for example `Wed 23`.
2. **Value labels** on bar charts, bold, in `text`.
   - Week: a value above every bar.
   - Month: a value above the highest bar only.
   - Numbers use `compactNumber` from `lib/format/compactNumber.ts`: `706`, `12k`,
     `12.5k`. Durations use `formatDuration(seconds, 'minutes')`: `72m`.
3. **Reference lines**, dashed, `muted`, with the label at the right edge of the chart
   (`ReferenceLabel`, `REFERENCE_GUTTER`).
   - A goal when the profile holds one, for example the steps goal.
   - Otherwise the average over logged days.
   - No average line with fewer than 2 logged days. A goal line always shows.
4. **End labels** on line charts: the last value at the end of each line, in the
   colour of its line. A weight chart also writes its min and max at the left.

## Sparse data

5. **Ghost slots.** On a bar chart, a day with no value gets a faint `surface-2` bar.
   A logged day of 0 counts as no value: a ghost slot and no label.
6. **Not enough data.** A line series needs 2 or more points to be drawn. When no series
   qualifies, show the latest value and `SPARSE_HINT`, "Log one more day to see a
   trend.", in `muted`. Never a lone dot.
7. **An honest legend.** A legend item shows only for a series that the chart draws.
8. **Empty state.** With no value at all, the card shows its empty state copy.

Bars are capped at `MAX_BAR_WIDTH`, 28 px, so a single bar keeps the width of a week bar.

## Text alternative

The `aria-label` states the same numbers as the chart: the trend in words, the total or
the last values, and the goal or the average when a reference line shows.

## Proof

- A unit test for each chart with an empty series, with one logged day and with a full
  range.
- The style guide Analytics section shows the full sample, "One logged day" and
  "Nothing logged".
- `tests/e2e/analytics.spec.ts` proves that no two labels overlap and none is cut off at
  320 px and 390 px.
