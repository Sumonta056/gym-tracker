import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DAILY_PULLED_KEY, db } from '../../lib/db/dexie'
import {
  firstPullDone,
  ImportMergeRefused,
  ImportNeedsAChoice,
  ImportNeedsFirstSync,
  SignedOutOnThisDevice,
} from '../../lib/db/repository'

import {
  applyHint,
  countText,
  IMPORT_FAILED,
  ImportReview,
  LEFT_OUT,
  LOGGED_CHANGED,
  LOGGED_READ_FAILED,
  NOTHING_TO_IMPORT,
  summaryText,
  WAITING_FOR_FIRST_SYNC,
} from './ImportReview'

import type { ImportSource } from './ImportReview'
import type { ImportResult } from '../../lib/db/repository'

const SHEET = readFileSync(join(process.cwd(), 'tests/fixtures/gym-sheet.csv'), 'utf8')
const HEADER = 'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps'

const MIXED = [
  HEADER,
  'August 12,15.54,48.55,131,164,81.40,412,9874',
  'August 13,27.36,1:00:00,,,,,',
  'August 14,12.5,,,,,,',
].join('\n')

const RESULT: ImportResult = { created: 1, overwritten: 0, merged: 0, skipped: 0 }

function fakeSource(logged: string[] = [], pulled = true) {
  return {
    firstPullDone: vi.fn<ImportSource['firstPullDone']>(() => Promise.resolve(pulled)),
    loggedDates: vi.fn<ImportSource['loggedDates']>(() => Promise.resolve(new Set(logged))),
    importDays: vi.fn<ImportSource['importDays']>(() => Promise.resolve(RESULT)),
  }
}

function renderReview(
  text = SHEET,
  extra: Partial<Omit<Parameters<typeof ImportReview>[0], 'source'>> & {
    source?: ImportSource
  } = {},
) {
  const source = extra.source ?? fakeSource()
  const onImported = vi.fn()
  render(
    <ImportReview
      fileName="gym-sheet.csv"
      text={text}
      initialYear={2026}
      source={source}
      onImported={onImported}
      {...extra}
    />,
  )
  return { source: source as ReturnType<typeof fakeSource>, onImported }
}

function cards() {
  return within(screen.getByTestId('import-cards'))
}

function count() {
  return screen.getByTestId('import-count')
}

function pickGroup(name: string) {
  return within(cards().getByRole('group', { name: `${name} reads two ways. Pick one.` }))
}

function applyFor(name: string) {
  const group = cards().getByRole('group', { name: `${name} reads two ways. Pick one.` })
  const wrapper = group.parentElement
  if (wrapper === null) throw new Error('no wrapper')
  return within(wrapper).getByRole('button', { name: /^Apply to all similar/ })
}

function rowCard(name: string) {
  return within(cards().getByRole('group', { name }))
}

describe('ImportReview', () => {
  it('counts every review cell of the parsed sheet', () => {
    renderReview()
    expect(count()).toHaveTextContent('11 of 11 to check: 11 cells')
    expect(cards().getAllByText('Check')).toHaveLength(11)
  })

  it('lowers the count by one for one pick', async () => {
    renderReview()
    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    expect(count()).toHaveTextContent('10 of 11 to check: 11 cells')
  })

  it('does not lower the count again when the same cell is picked twice', async () => {
    renderReview()
    const group = pickGroup('Walk time 15.54')
    await userEvent.click(group.getByRole('button', { name: /^15m 54s/ }))
    await userEvent.click(group.getByRole('button', { name: /^15\.54 min/ }))
    expect(count()).toHaveTextContent('10 of 11 to check: 11 cells')
  })

  it('changes every matching cell with Apply to all similar, and only those', async () => {
    renderReview(MIXED)
    expect(count()).toHaveTextContent('4 of 4 to check: 4 cells')
    const first = pickGroup('Walk time 15.54')
    await userEvent.click(first.getByRole('button', { name: /^15m 54s/ }))
    expect(applyFor('Walk time 15.54')).toHaveTextContent('Apply to all similar · 1 more')
    await userEvent.click(applyFor('Walk time 15.54'))

    expect(pickGroup('Walk time 27.36').getByRole('button', { name: /^27m 36s/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const name of ['Walk time 12.5', 'Gym time 48.55']) {
      for (const button of pickGroup(name).getAllByRole('button')) {
        expect(button).toHaveAttribute('aria-pressed', 'false')
      }
    }
    expect(count()).toHaveTextContent('2 of 4 to check: 4 cells')
  })

  it('keeps Apply disabled while the count is above 0, and enables it at 0', async () => {
    renderReview()
    const apply = screen.getByRole('button', { name: 'Apply import' })
    expect(apply).toBeDisabled()
    await waitFor(() => {
      expect(apply).toHaveAccessibleDescription(
        'Pick the 11 readings left to apply. Nothing is written until you confirm.',
      )
    })

    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    expect(applyFor('Walk time 15.54')).toHaveTextContent('Apply to all similar · 7 more')
    await userEvent.click(applyFor('Walk time 15.54'))
    expect(apply).toBeDisabled()
    await userEvent.click(pickGroup('Gym time 48.55').getByRole('button', { name: /^48m 55s/ }))
    expect(applyFor('Gym time 48.55')).toHaveTextContent('Apply to all similar · 2 more')
    await userEvent.click(applyFor('Gym time 48.55'))

    expect(count()).toHaveTextContent('0 of 11 to check: 11 cells')
    await waitFor(() => {
      expect(apply).toBeEnabled()
    })
    expect(apply).toHaveAccessibleDescription(
      'Every reading is picked. Nothing is written until you confirm.',
    )
  })

  it('makes every pick a real button with a label', () => {
    renderReview()
    const groups = cards().getAllByRole('group', { name: /reads two ways/ })
    expect(groups).toHaveLength(11)
    for (const group of groups) {
      const buttons = within(group).getAllByRole('button')
      expect(buttons).toHaveLength(2)
      for (const button of buttons) {
        expect(button.tagName).toBe('BUTTON')
        expect(button).toHaveAttribute('type', 'button')
        expect(button).toHaveAccessibleName(/read as/)
      }
    }
  })

  it('shows a picked cell with its reading and the row as picked', async () => {
    renderReview(MIXED)
    const row = rowCard('Row 3 · 14 Aug')
    expect(row.getByText('1 to check')).toBeInTheDocument()
    await userEvent.click(pickGroup('Walk time 12.5').getByRole('button', { name: /^12m 5s/ }))
    expect(row.getByText('Picked')).toBeInTheDocument()
    expect(row.getByText('Walk time · 12.5')).toBeInTheDocument()
    expect(row.getByText('12m 5s', { selector: 'span.rounded-xl' })).toBeInTheDocument()
  })

  it('shows an error row with its reason, leaves it out and asks no pick on it', () => {
    renderReview([HEADER, 'August 12,15.54,,,,,,5.9k', 'August 13,20,,,,,,'].join('\n'))
    const row = rowCard('Row 1 · 12 Aug')
    expect(row.getByText('Error')).toBeInTheDocument()
    expect(
      row.getByText(`Steps "5.9k" could not be read. Enter a number. ${LEFT_OUT}`),
    ).toBeInTheDocument()
    expect(row.queryByRole('button')).not.toBeInTheDocument()
    expect(count()).toHaveTextContent('0 of 0 to check')
    expect(
      screen.getByText('Every duration reads one way. 1 row has an error.'),
    ).toBeInTheDocument()
  })

  it('shows the details of a clean row', () => {
    renderReview(MIXED)
    expect(
      rowCard('Row 1 · 12 Aug').getByText('HR 131 / 164 · 81.4 kg · 412 kcal · 9,874 steps'),
    ).toBeInTheDocument()
    expect(rowCard('Row 2 · 13 Aug').getByText('1:00:00')).toBeInTheDocument()
  })

  it('names the file and the row count', () => {
    renderReview()
    expect(screen.getByRole('heading', { level: 1, name: 'Import review' })).toBeInTheDocument()
    expect(screen.getByText('gym-sheet.csv · 16 rows')).toBeInTheDocument()
  })

  it('shows each sheet issue plainly', () => {
    renderReview(['Day,Walk Time,Notes', 'August 12,20,hi', ',,'].join('\n'))
    const issues = within(screen.getByTestId('import-issues'))
    expect(issues.getByText('The sheet has no Gym Time column.')).toBeInTheDocument()
    expect(
      issues.getByText('The Notes column is not part of a daily entry, so it is ignored.'),
    ).toBeInTheDocument()
    expect(issues.getByText('Line 3 is blank, so it is skipped.')).toBeInTheDocument()
  })

  it('shows no issue list for a clean sheet', () => {
    renderReview()
    expect(screen.queryByTestId('import-issues')).not.toBeInTheDocument()
  })

  it('reads the dates again with a new year and clears every pick', async () => {
    renderReview([HEADER, 'February 29,15.54,,,,,,'].join('\n'), { initialYear: 2024 })
    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    expect(count()).toHaveTextContent('0 of 1 to check: 1 cell')

    const change = screen.getByRole('button', { name: 'Change year' })
    expect(change).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(change)
    expect(change).toHaveAttribute('aria-expanded', 'true')
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '2020')
    await userEvent.click(screen.getByRole('button', { name: 'Read the sheet again' }))

    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(count()).toHaveTextContent('1 of 1 to check: 1 cell')
    expect(screen.queryByLabelText('Year of the sheet')).not.toBeInTheDocument()
  })

  it('shows a date that does not exist in the new year as an error', async () => {
    renderReview([HEADER, 'February 29,20,,,,,,'].join('\n'), { initialYear: 2024 })
    await userEvent.click(screen.getByRole('button', { name: 'Change year' }))
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '2023')
    await userEvent.click(screen.getByRole('button', { name: 'Read the sheet again' }))

    expect(
      cards().getByText(
        `Day "February 29" could not be read. February 29 does not exist in 2023. ${LEFT_OUT}`,
      ),
    ).toBeInTheDocument()
  })

  it('refuses a year it cannot read and keeps the old one', async () => {
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: 'Change year' }))
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '26')
    await userEvent.click(screen.getByRole('button', { name: 'Read the sheet again' }))

    expect(year).toHaveAttribute('aria-invalid', 'true')
    expect(year).toHaveAccessibleDescription(/Enter a year such as 2026\./)
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('points Change year at the year form only while the form is open', async () => {
    renderReview()
    const change = screen.getByRole('button', { name: 'Change year' })
    expect(change).not.toHaveAttribute('aria-controls')

    await userEvent.click(change)

    const form = screen.getByLabelText('Year of the sheet').closest('form')
    expect(form).not.toBeNull()
    expect(change).toHaveAttribute('aria-controls', form?.id)
  })

  it('clears the year error once the year is typed again', async () => {
    renderReview()
    await userEvent.click(screen.getByRole('button', { name: 'Change year' }))
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '26')
    await userEvent.click(screen.getByRole('button', { name: 'Read the sheet again' }))
    expect(year).toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(year, '2')

    expect(year).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Enter a year such as 2026.')).not.toBeInTheDocument()
  })

  it('lays the cards out one, then two per row, and the table from 1024 px', () => {
    renderReview()
    expect(screen.getByTestId('import-cards')).toHaveClass(
      'grid-cols-1',
      'md:grid-cols-2',
      'lg:hidden',
    )
    expect(screen.getByTestId('import-table')).toHaveClass('hidden', 'lg:block')
  })

  it('shows every row in the table, with Check on each review cell', () => {
    renderReview()
    const table = within(screen.getByRole('table', { name: 'Rows of the sheet' }))
    expect(table.getAllByRole('rowheader')).toHaveLength(16)
    expect(table.getAllByText('Check')).toHaveLength(11)
    expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Row',
      'Walk',
      'Gym',
      'Avg HR',
      'Max HR',
      'Weight',
      'Kcal',
      'Steps',
      'Status',
    ])
  })

  it('keeps the table and the cards on the same picks', async () => {
    renderReview(MIXED)
    const table = within(screen.getByRole('table', { name: 'Rows of the sheet' }))
    await userEvent.click(
      within(
        table.getByRole('group', { name: 'Walk time 12.5 reads two ways. Pick one.' }),
      ).getByRole('button', { name: /^12m 5s/ }),
    )
    expect(pickGroup('Walk time 12.5').getByRole('button', { name: /^12m 5s/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(table.getByText('12m 5s', { selector: 'span' })).toBeInTheDocument()
    expect(table.getByText('Picked')).toBeInTheDocument()
    expect(table.getAllByText('1 to check')).toHaveLength(1)
  })

  it('shows an error row and its reason in the table', () => {
    renderReview([HEADER, 'August 12,15.54,,,,,,5.9k'].join('\n'))
    const table = within(screen.getByRole('table', { name: 'Rows of the sheet' }))
    expect(table.getByText('Error')).toHaveClass('text-danger')
    expect(table.getByText('5.9k')).toHaveClass('text-danger')
    expect(table.getByText(new RegExp(LEFT_OUT))).toBeInTheDocument()
    expect(table.queryByText('Check')).not.toBeInTheDocument()
  })

  it('marks a clean row as ready in the table', () => {
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'))
    expect(
      within(screen.getByRole('table', { name: 'Rows of the sheet' })).getByText('Ready'),
    ).toBeInTheDocument()
  })

  it('renders the status slot and the way back', async () => {
    const onClose = vi.fn()
    renderReview(SHEET, { status: <span>Synced</span>, onClose })
    expect(screen.getByText('Synced')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to the profile' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves focus to its heading only when asked', () => {
    renderReview(SHEET, { focusOnMount: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('leaves focus alone by default', () => {
    renderReview()
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus()
  })
})

describe('summaryText', () => {
  it('counts the durations and the picks', () => {
    expect(summaryText(5, 3, 1)).toBe(
      '5 durations can be read two ways. 3 are picked. 1 row has an error.',
    )
  })

  it('writes one duration and one pick in the singular', () => {
    expect(summaryText(1, 1, 2)).toBe(
      '1 duration can be read two ways. 1 is picked. 2 rows have an error.',
    )
  })
})

const DUPES = [
  HEADER,
  'August 12,15.54,1:00:00,,,,,9874',
  'August 13,20,1:00:00,,,,,',
  'August 14,20,1:00:00,,,,,',
].join('\n')

function applyButton() {
  return screen.getByRole('button', { name: 'Apply import' })
}

function conflictGroup(title: string) {
  return within(cards().getByRole('group', { name: `${title}, already logged` }))
}

describe('ImportReview, applying the import', () => {
  it('asks Skip, Overwrite or Merge on a date already logged, with no choice made', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    const group = await waitFor(() => conflictGroup('Row 2, 13 August'))
    for (const name of ['Skip', 'Overwrite', 'Merge']) {
      expect(group.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(rowCard('Row 2 · 13 Aug').getByText('Choose')).toBeInTheDocument()
    expect(cards().queryByRole('group', { name: 'Row 3, 14 August, already logged' })).toBeNull()
  })

  it('reads Choose on the badge before a pick and Already logged after it', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-14']) })
    const row = rowCard('Row 3 · 14 Aug')
    expect(await row.findByText('Choose')).toBeInTheDocument()
    await userEvent.click(conflictGroup('Row 3, 14 August').getByRole('button', { name: 'Skip' }))
    expect(row.getByText('Already logged')).toBeInTheDocument()
    expect(row.queryByText('Choose')).not.toBeInTheDocument()
  })

  it('adds each date already logged to the count still to check', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13', '2026-08-14']) })
    await waitFor(() => {
      expect(count()).toHaveTextContent('3 of 3 to check: 1 cell, 2 dates')
    })
    await userEvent.click(conflictGroup('Row 2, 13 August').getByRole('button', { name: 'Skip' }))
    expect(count()).toHaveTextContent('2 of 3 to check: 1 cell, 2 dates')
  })

  it('keeps Apply disabled until every logged date has a choice', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    await waitFor(() => {
      expect(applyButton()).toHaveAccessibleDescription(
        'Pick a choice for the 1 logged date left to apply. Nothing is written until you confirm.',
      )
    })
    expect(applyButton()).toBeDisabled()

    await userEvent.click(conflictGroup('Row 2, 13 August').getByRole('button', { name: 'Merge' }))

    expect(applyButton()).toBeEnabled()
  })

  it('sets one choice on every logged date with Apply to all duplicates', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13', '2026-08-14']) })
    const all = await waitFor(() =>
      within(screen.getByRole('group', { name: 'Apply to all duplicates' })),
    )
    await userEvent.click(all.getByRole('button', { name: 'Overwrite' }))

    for (const title of ['Row 2, 13 August', 'Row 3, 14 August']) {
      expect(conflictGroup(title).getByRole('button', { name: 'Overwrite' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    expect(all.getByRole('button', { name: 'Overwrite' })).toHaveAttribute('aria-pressed', 'true')
    expect(count()).toHaveTextContent('1 of 3 to check: 1 cell, 2 dates')
  })

  it('keeps the gym time and walk time fields on a logged-date card', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    await waitFor(() => conflictGroup('Row 2, 13 August'))
    const row = rowCard('Row 2 · 13 Aug')
    expect(row.getByText('Gym time')).toBeInTheDocument()
    expect(row.getByText('Walk time')).toBeInTheDocument()
    expect(row.getByText('1:00:00')).toBeInTheDocument()
  })

  it('caps the shortcut at the width of the per-row choices from 1024 px', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    const all = await waitFor(() => screen.getByRole('group', { name: 'Apply to all duplicates' }))
    expect(all).toHaveClass('lg:max-w-[420px]')
    const table = within(screen.getByRole('table', { name: 'Rows of the sheet' }))
    const rowGroup = await waitFor(() =>
      table.getByRole('group', { name: 'Row 2, 13 August, already logged' }),
    )
    expect(rowGroup.closest('.max-w-\\[420px\\]')).not.toBeNull()
  })

  it('shows the shortcut unpressed once the dates hold different choices', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13', '2026-08-14']) })
    const all = await waitFor(() =>
      within(screen.getByRole('group', { name: 'Apply to all duplicates' })),
    )
    await userEvent.click(all.getByRole('button', { name: 'Skip' }))
    await userEvent.click(conflictGroup('Row 3, 14 August').getByRole('button', { name: 'Merge' }))
    for (const button of all.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('shows no shortcut when no date is already logged', async () => {
    const { source } = renderReview(DUPES)
    await waitFor(() => {
      expect(source.loggedDates).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('import-all-duplicates')).not.toBeInTheDocument()
  })

  it('asks the device only about the dates of rows that can be imported', async () => {
    const { source } = renderReview(
      [HEADER, 'August 12,20,,,,,,', 'August 13,20,,,,,,5.9k'].join('\n'),
    )
    await waitFor(() => {
      expect(source.loggedDates).toHaveBeenCalledWith(['2026-08-12'])
    })
  })

  it('shows the choice of a logged date in the table', async () => {
    renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    const table = within(screen.getByRole('table', { name: 'Rows of the sheet' }))
    const group = await waitFor(() =>
      within(table.getByRole('group', { name: 'Row 2, 13 August, already logged' })),
    )
    expect(table.getByText('Choose')).toHaveClass('text-warn')
    await userEvent.click(group.getByRole('button', { name: 'Merge' }))
    expect(table.getByText('Merge', { selector: 'span' })).toBeInTheDocument()
  })

  it('disables Apply with a reason when every row has an error', async () => {
    renderReview([HEADER, 'August 12,20,,,,,,5.9k', 'Augustus 13,20,,,,,,'].join('\n'))
    await waitFor(() => {
      expect(applyButton()).toHaveAccessibleDescription(NOTHING_TO_IMPORT)
    })
    expect(applyButton()).toBeDisabled()
  })

  it('disables Apply with a reason when every row is skipped', async () => {
    renderReview([HEADER, 'August 13,20,,,,,,'].join('\n'), {
      source: fakeSource(['2026-08-13']),
    })
    await userEvent.click(
      (await waitFor(() => conflictGroup('Row 1, 13 August'))).getByRole('button', {
        name: 'Skip',
      }),
    )
    expect(applyButton()).toBeDisabled()
    expect(applyButton()).toHaveAccessibleDescription(NOTHING_TO_IMPORT)
  })

  it('keeps Apply disabled while the device is read', () => {
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), {
      source: {
        firstPullDone: () => Promise.resolve(true),
        loggedDates: () => new Promise(() => undefined),
        importDays: vi.fn(),
      },
    })
    expect(applyButton()).toBeDisabled()
    expect(applyButton()).toHaveAccessibleDescription('Reading the days on this device…')
  })

  it('keeps Apply disabled with a reason when the device cannot be read', async () => {
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), {
      source: {
        firstPullDone: () => Promise.resolve(true),
        loggedDates: () => Promise.reject(new Error('no disk')),
        importDays: vi.fn(),
      },
    })
    await waitFor(() => {
      expect(applyButton()).toHaveAccessibleDescription(LOGGED_READ_FAILED)
    })
    expect(applyButton()).toBeDisabled()
  })

  it('leaves out a later row that repeats a date of the sheet', async () => {
    renderReview([HEADER, 'August 12,20,,,,,,', 'August 12,30,,,,,,'].join('\n'))
    const row = rowCard('Row 2 · 12 Aug')
    expect(row.getByText('Error')).toBeInTheDocument()
    expect(
      row.getByText(`Day 12 Aug is also on row 1, so only that row is imported. ${LEFT_OUT}`),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
  })

  it('shows a short row, a long row and an unclosed quote in About the sheet', () => {
    renderReview([HEADER, 'August 12,20', 'August 13,20,,,,,,,,', 'August 14,"20,,,,,,'].join('\n'))
    const issues = within(screen.getByTestId('import-issues'))
    expect(issues.getByText(/^Line 2 has fewer cells than the header/)).toBeInTheDocument()
    expect(issues.getByText(/^Line 3 has more cells than the header/)).toBeInTheDocument()
    expect(issues.getByText(/^Line 4 opens a quote that never closes/)).toBeInTheDocument()
  })

  it('writes nothing before the confirm, and nothing on Cancel', async () => {
    const { source } = renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    await userEvent.click(
      (await waitFor(() => conflictGroup('Row 2, 13 August'))).getByRole('button', {
        name: 'Skip',
      }),
    )
    await userEvent.click(applyButton())

    const dialog = within(screen.getByRole('dialog', { name: 'Apply the import?' }))
    expect(source.importDays).not.toHaveBeenCalled()

    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(source.importDays).not.toHaveBeenCalled()
  })

  it('states the counts new, overwritten, merged and skipped in the confirm sheet', async () => {
    const text = [
      HEADER,
      'August 12,20,,,,,,',
      'August 13,20,,,,,,',
      'August 14,20,,,,,,',
      'August 15,20,,,,,,',
      'August 16,20,,,,,,5.9k',
    ].join('\n')
    const source = fakeSource(['2026-08-13', '2026-08-14', '2026-08-15'])
    render(
      <ImportReview
        fileName="a.csv"
        text={text}
        initialYear={2026}
        source={source}
        onImported={vi.fn()}
      />,
    )
    await userEvent.click(
      (await waitFor(() => conflictGroup('Row 2, 13 August'))).getByRole('button', {
        name: 'Overwrite',
      }),
    )
    await userEvent.click(conflictGroup('Row 3, 14 August').getByRole('button', { name: 'Merge' }))
    await userEvent.click(conflictGroup('Row 4, 15 August').getByRole('button', { name: 'Skip' }))
    await userEvent.click(applyButton())

    const dialog = within(screen.getByRole('dialog', { name: 'Apply the import?' }))
    expect(dialog.getByTestId('confirm-created')).toHaveTextContent('1')
    expect(dialog.getByTestId('confirm-overwritten')).toHaveTextContent('1')
    expect(dialog.getByTestId('confirm-merged')).toHaveTextContent('1')
    expect(dialog.getByTestId('confirm-skipped')).toHaveTextContent('1')
    expect(dialog.getByTestId('confirm-leftOut')).toHaveTextContent('1')
    expect(dialog.getByRole('button', { name: 'Import 3 days' })).toBeEnabled()
  })

  it('imports on confirm with the picked readings and the choices, then reports the result', async () => {
    const { source, onImported } = renderReview(DUPES, { source: fakeSource(['2026-08-13']) })
    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    await userEvent.click(
      (await waitFor(() => conflictGroup('Row 2, 13 August'))).getByRole('button', {
        name: 'Merge',
      }),
    )
    await userEvent.click(applyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Import 3 days' }))

    expect(source.importDays).toHaveBeenCalledOnce()
    const days = source.importDays.mock.calls[0]?.[0] ?? []
    expect(days.map((day) => [day.entry.entry_date, day.choice])).toEqual([
      ['2026-08-12', undefined],
      ['2026-08-13', 'merge'],
      ['2026-08-14', undefined],
    ])
    expect(days[0]?.entry).toMatchObject({ walk_seconds: 954, gym_seconds: 3600, steps: 9874 })
    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith({ ...RESULT, leftOut: 0 })
    })
  })

  it('shows a plain error in the sheet when the import fails, and stays on the review', async () => {
    const source = fakeSource()
    source.importDays.mockRejectedValueOnce(new Error('the disk is full'))
    const { onImported } = renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source })
    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
    await userEvent.click(applyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(IMPORT_FAILED)
    expect(onImported).not.toHaveBeenCalled()
  })

  it('says the device is signed out when the import is refused for it', async () => {
    const source = fakeSource()
    source.importDays.mockRejectedValueOnce(new SignedOutOnThisDevice())
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source })
    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
    await userEvent.click(applyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This device is signed out. Sign in again to save.',
    )
  })

  it('keeps Apply disabled with the first sync hint until the first daily pull', async () => {
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source: fakeSource([], false) })
    await waitFor(() => {
      expect(applyButton()).toHaveAccessibleDescription(WAITING_FOR_FIRST_SYNC)
    })
    expect(applyButton()).toBeDisabled()
  })

  it('enables Apply as soon as the first daily pull lands on the device', async () => {
    await db.open()
    await db.syncMeta.clear()
    const source = { ...fakeSource(), firstPullDone }
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source })
    await waitFor(() => {
      expect(applyButton()).toHaveAccessibleDescription(WAITING_FOR_FIRST_SYNC)
    })

    await db.syncMeta.put({ key: DAILY_PULLED_KEY, value: '2026-10-03T00:00:00.000Z' })

    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
    await db.syncMeta.clear()
  })

  it('says the first sync is missing when the import is refused for it', async () => {
    const source = fakeSource()
    source.importDays.mockRejectedValueOnce(new ImportNeedsFirstSync())
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source })
    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
    await userEvent.click(applyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Waiting for the first sync. Connect to the internet to import. Nothing was written.',
    )
  })

  it('names the date when a Merge breaks a rule of the day', async () => {
    const source = fakeSource()
    source.importDays.mockRejectedValueOnce(
      new ImportMergeRefused('2026-08-12', 'The peak heart rate cannot be below the average.'),
    )
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source })
    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
    await userEvent.click(applyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Merging 2026-08-12 breaks a rule of the day: The peak heart rate cannot be below the average. Nothing was written.',
    )
  })

  it('reads the device again when a date was logged since the review began', async () => {
    const source = fakeSource()
    source.importDays.mockRejectedValueOnce(new ImportNeedsAChoice('2026-08-12'))
    renderReview([HEADER, 'August 12,20,,,,,,'].join('\n'), { source })
    await waitFor(() => {
      expect(applyButton()).toBeEnabled()
    })
    source.loggedDates.mockResolvedValue(new Set(['2026-08-12']))
    await userEvent.click(applyButton())
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 day' }))

    expect(await screen.findByText(LOGGED_CHANGED)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(count()).toHaveFocus()
    })
    expect(await waitFor(() => conflictGroup('Row 1, 12 August'))).toBeDefined()
    expect(source.loggedDates).toHaveBeenCalledTimes(2)
  })

  it('clears every choice when the year changes', async () => {
    renderReview([HEADER, 'August 13,20,,,,,,'].join('\n'), {
      source: fakeSource(['2026-08-13', '2025-08-13']),
    })
    await userEvent.click(
      (await waitFor(() => conflictGroup('Row 1, 13 August'))).getByRole('button', {
        name: 'Skip',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Change year' }))
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '2025')
    await userEvent.click(screen.getByRole('button', { name: 'Read the sheet again' }))

    const group = await waitFor(() => conflictGroup('Row 1, 13 August'))
    expect(group.getByRole('button', { name: 'Skip' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('countText', () => {
  it('counts only cells when no date is logged', () => {
    expect(countText(2, 11, 0, 0)).toBe('2 of 11 to check: 11 cells')
  })

  it('puts the cells and the logged dates under one total', () => {
    expect(countText(2, 2, 1, 1)).toBe('3 of 3 to check: 2 cells, 1 date')
    expect(countText(1, 2, 1, 1)).toBe('2 of 3 to check: 2 cells, 1 date')
  })

  it('writes one cell and one date in the singular, and several in the plural', () => {
    expect(countText(1, 1, 0, 2)).toBe('1 of 3 to check: 1 cell, 2 dates')
  })

  it('names only the dates when no cell reads two ways', () => {
    expect(countText(0, 0, 1, 1)).toBe('1 of 1 to check: 1 date')
  })

  it('names nothing when there is nothing to check', () => {
    expect(countText(0, 0, 0, 0)).toBe('0 of 0 to check')
  })
})

describe('applyHint', () => {
  it('names the readings left', () => {
    expect(applyHint(2, 0)).toBe(
      'Pick the 2 readings left to apply. Nothing is written until you confirm.',
    )
  })

  it('names both the readings and the logged dates left', () => {
    expect(applyHint(1, 2)).toBe(
      'Pick the 1 reading and a choice for the 2 logged dates left to apply. Nothing is written until you confirm.',
    )
  })
})

describe('summaryText with logged dates', () => {
  it('says how many dates are already logged', () => {
    expect(summaryText(0, 0, 0, 2)).toBe(
      'Every duration reads one way. 2 dates are already logged.',
    )
  })
})
