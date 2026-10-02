import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ImportReview, LEFT_OUT, summaryText } from './ImportReview'

const SHEET = readFileSync(join(process.cwd(), 'tests/fixtures/gym-sheet.csv'), 'utf8')
const HEADER = 'Day,Walk Time,Gym Time,Avg Heart Rate,Highest Rate,Weight,Calories Burnt,Steps'

const MIXED = [
  HEADER,
  'August 12,15.54,48.55,131,164,81.40,412,9874',
  'August 13,27.36,1:00:00,,,,,',
  'August 14,12.5,,,,,,',
].join('\n')

function renderReview(text = SHEET, extra: Partial<Parameters<typeof ImportReview>[0]> = {}) {
  render(<ImportReview fileName="gym-sheet.csv" text={text} initialYear={2026} {...extra} />)
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
    expect(count()).toHaveTextContent('11 of 11 cells')
    expect(cards().getAllByText('Check')).toHaveLength(11)
  })

  it('lowers the count by one for one pick', async () => {
    renderReview()
    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    expect(count()).toHaveTextContent('10 of 11 cells')
  })

  it('does not lower the count again when the same cell is picked twice', async () => {
    renderReview()
    const group = pickGroup('Walk time 15.54')
    await userEvent.click(group.getByRole('button', { name: /^15m 54s/ }))
    await userEvent.click(group.getByRole('button', { name: /^15\.54 min/ }))
    expect(count()).toHaveTextContent('10 of 11 cells')
  })

  it('changes every matching cell with Apply to all similar, and only those', async () => {
    renderReview(MIXED)
    expect(count()).toHaveTextContent('4 of 4 cells')
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
    expect(count()).toHaveTextContent('2 of 4 cells')
  })

  it('keeps Apply disabled while the count is above 0, and enables it at 0', async () => {
    renderReview()
    const apply = screen.getByRole('button', { name: 'Apply import' })
    expect(apply).toBeDisabled()
    expect(apply).toHaveAccessibleDescription(
      'Pick the 11 readings left to apply. Nothing is written until you confirm.',
    )

    await userEvent.click(pickGroup('Walk time 15.54').getByRole('button', { name: /^15m 54s/ }))
    expect(applyFor('Walk time 15.54')).toHaveTextContent('Apply to all similar · 7 more')
    await userEvent.click(applyFor('Walk time 15.54'))
    expect(apply).toBeDisabled()
    await userEvent.click(pickGroup('Gym time 48.55').getByRole('button', { name: /^48m 55s/ }))
    expect(applyFor('Gym time 48.55')).toHaveTextContent('Apply to all similar · 2 more')
    await userEvent.click(applyFor('Gym time 48.55'))

    expect(count()).toHaveTextContent('0 of 11 cells')
    expect(apply).toBeEnabled()
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
    expect(count()).toHaveTextContent('0 of 0 cells')
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
    expect(count()).toHaveTextContent('0 of 1 cell')

    const change = screen.getByRole('button', { name: 'Change year' })
    expect(change).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(change)
    expect(change).toHaveAttribute('aria-expanded', 'true')
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '2020')
    await userEvent.click(screen.getByRole('button', { name: 'Read the sheet again' }))

    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(count()).toHaveTextContent('1 of 1 cell')
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
