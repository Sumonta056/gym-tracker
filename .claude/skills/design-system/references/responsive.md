# The responsive contract

Three ranges. One layout each. Nothing between them is invented on the spot.

| Range          | Layout                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Under 640 px   | One column. 20 px side gutters. Bottom tab bar with a centre action button.                               |
| 640 to 1023 px | Two-column card grid. Bottom tab bar stays. Gutters grow to 28 px.                                        |
| 1024 px and up | Left sidebar 240 px. Content column capped at 1100 px and centred. Three-column card grid. No bottom bar. |

`md:` is 640 px. `lg:` is 1024 px.

## The fixed rules

- **Mobile first.** Write the base style for the phone. Add `md:` and `lg:` upward
  only. A `max-md:` or a `lg:hidden` used to undo a desktop-first base is a sign the
  base was written at the wrong width.
- **The bottom tab bar adds `padding-bottom: env(safe-area-inset-bottom)`**, so it
  clears the iPhone home indicator.
- **Set `viewport-fit=cover` and `interactive-widget=resizes-content`** in the viewport
  meta, so the safe-area inset resolves and the on-screen keyboard shrinks the layout
  instead of covering the field being typed into.
- **No horizontal scroll at any width from 320 px to 2560 px.**
- **Every tap target is 44 px or taller, at every breakpoint.** Not only on the phone.
- **Charts fill their container width.** Never a fixed pixel width. In Recharts that
  means a `ResponsiveContainer`; the height may be fixed, the width may not.
- **Check every screen at 390 px, 768 px and 1440 px before you call it done.** Add 320
  px and 1024 px when checking for horizontal scroll.

## The layout in practice

```tsx
<main className="mx-auto w-full max-w-[1100px] px-5 pb-28 md:px-7 lg:pb-8 lg:pl-60">
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">{cards}</div>
</main>
```

- `px-5` is 20 px, `md:px-7` is 28 px.
- `gap-3` is 12 px, inside the 11–12 px band.
- `pb-28` clears the tab bar; it is released at `lg`, where the tab bar is gone.
- `max-w-[1100px]` with `mx-auto` is the capped, centred content column.
- The 240 px sidebar is `lg:w-60`, and the content is pushed past it with `lg:pl-60`.

A card that must stay full width across the grid takes `md:col-span-2 lg:col-span-3` —
the hero card usually does.

## The tab bar and the sidebar

They are the same five destinations, rendered two ways by `AppShell`.

- Five slots. The middle slot is a filled accent button that starts a live session.
- The other four are an icon plus a 10 px label.
- The current destination carries `aria-current="page"` as well as the accent colour,
  so the state is not colour alone.
- The tab bar is `lg:hidden`. The sidebar is `hidden lg:flex`. **Never both at once,
  never neither.**

## Finding horizontal scroll

The usual causes, in order of how often they happen:

1. A fixed `width` or `min-width` on a chart or a table.
2. A long unbroken number or email with no `break-words`.
3. A negative margin that is not matched by padding on the parent.
4. A `100vw` where `100%` was meant — `100vw` includes the scrollbar on desktop.
5. A pill row that should scroll inside its own container, not push the page.

## Things that are easy to get wrong

- **A 44 px target is the hit area, not the icon.** An icon button gets padding; do not
  shrink the icon and call the box small.
- **A grid gap is not a gutter.** The gutter is the page padding, 20 px then 28 px. The
  gap between cards stays 11–12 px at every width.
- **The desktop is not a stretched phone.** At `lg` the cards flow into three columns;
  they do not grow to 1100 px wide each.
