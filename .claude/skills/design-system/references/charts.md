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
3. **Reference lines**, dashed, `muted`, full width. The label sits **inside the plot**,
   ending at its right edge, just above the line (`ReferenceLabel`). A bar chart keeps
   no right gutter for it, so the bars get the whole width.
   - The label carries the same `surface` halo as the value labels, so it reads over a
     bar.
   - `referencePlacement` in `components/charts/DailyBars.tsx` picks the spot. It checks
     the value labels in the right 22 % of the slots, the ones the label spans at 320 px.
     1. **Above the line**, when no value label there sits on it.
     2. **Just below the line**, when above collides, below is clear and below still
        clears the day labels.
     3. **The band**, when both collide: the plot drops by one 14 px label row and the
        label sits in that row at the top right. It is never beside its line there, but
        it never overlaps a value.
   - A goal when the profile holds one, for example the steps goal.
   - Otherwise the average over logged days.
   - No average line with fewer than 2 logged days. A goal line always shows.
   - The steps goal, the calories average and the gym time average all use this one
     label, so every bar chart places it the same way.
4. **End labels** on line charts: the last value at the end of each line, in the
   colour of its line. A weight chart also writes its min and max at the left.
   - **Named exception: the raw weight end label is `muted`,** not the violet of its
     line. The raw weight line is drawn at half opacity, and its label in that colour
     would fall below 4.5:1 on `surface`. The 7-day average, the line the user reads,
     keeps its violet end label. The prototype `p5` plate does the same.
   - A weight chart widens its left range axis for a five character value
     (`rangeAxisWidth`), so `223.3` lb keeps its first digit.

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
  320 px, 390 px and 430 px, on the full week, the one logged day and a heavy week in
  pounds with five character values.
