import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { exportTables } from '../../lib/db/repository'
import { YEAR_ERROR } from '../csv/reviewState'

import { DataCard, EXPORT_ERROR, EXPORT_HINT, READ_FILE_ERROR } from './DataCard'

import type { DailyEntry } from '../../lib/db/dexie'
import type * as Repository from '../../lib/db/repository'

vi.mock('../../lib/db/repository', async (importOriginal) => ({
  ...(await importOriginal<typeof Repository>()),
  exportTables: vi.fn(),
}))

const LOGGED_DAY: DailyEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  entry_date: '2026-09-02',
  walk_seconds: 954,
  gym_seconds: null,
  avg_heart_rate: null,
  max_heart_rate: null,
  weight_kg: null,
  calories_burnt: null,
  steps: 4321,
  note: null,
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
  deleted_at: null,
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const CSV = 'Day,Walk Time\nAugust 12,15.54\n'

function sheetFile(text = CSV) {
  return new File([text], 'gym-sheet.csv', { type: 'text/csv' })
}

async function openImport() {
  await userEvent.click(screen.getByRole('button', { name: 'Import the old sheet' }))
}

describe('DataCard', () => {
  it('offers the import as a real button that opens the form', async () => {
    render(<DataCard />)
    const button = screen.getByRole('button', { name: 'Import the old sheet' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('The sheet as a CSV file')).not.toBeInTheDocument()

    await openImport()

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('The sheet as a CSV file')).toHaveAttribute('type', 'file')
  })

  it('points the import button at the form only while the form is open', async () => {
    render(<DataCard />)
    const button = screen.getByRole('button', { name: 'Import the old sheet' })
    expect(button).not.toHaveAttribute('aria-controls')

    await openImport()

    const id = button.getAttribute('aria-controls')
    expect(id).not.toBeNull()
    expect(document.getElementById(id ?? '')).toContainElement(
      screen.getByLabelText('The sheet as a CSV file'),
    )
  })

  it('asks the year up front, set to this year', async () => {
    render(<DataCard />)
    await openImport()
    expect(screen.getByLabelText('Year of the sheet')).toHaveValue(String(new Date().getFullYear()))
  })

  it('reads the chosen file and hands its text, its name and the year to its owner', async () => {
    const onSheet = vi.fn()
    render(<DataCard onSheet={onSheet} />)
    await openImport()
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '2025')

    await userEvent.upload(screen.getByLabelText('The sheet as a CSV file'), sheetFile())

    await vi.waitFor(() => {
      expect(onSheet).toHaveBeenCalledWith({ fileName: 'gym-sheet.csv', text: CSV, year: 2025 })
    })
  })

  it('refuses a file while the year cannot be read', async () => {
    const onSheet = vi.fn()
    render(<DataCard onSheet={onSheet} />)
    await openImport()
    const year = screen.getByLabelText('Year of the sheet')
    await userEvent.clear(year)
    await userEvent.type(year, '20')

    await userEvent.upload(screen.getByLabelText('The sheet as a CSV file'), sheetFile())

    expect(await screen.findByText(YEAR_ERROR)).toBeInTheDocument()
    expect(year).toHaveAttribute('aria-invalid', 'true')
    expect(onSheet).not.toHaveBeenCalled()
  })

  it('says so when the file cannot be read', async () => {
    const onSheet = vi.fn()
    render(<DataCard onSheet={onSheet} />)
    await openImport()
    const file = sheetFile()
    Object.defineProperty(file, 'text', { value: () => Promise.reject(new Error('gone')) })
    const input = screen.getByLabelText('The sheet as a CSV file')

    await userEvent.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent(READ_FILE_ERROR)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(READ_FILE_ERROR)
    expect(onSheet).not.toHaveBeenCalled()
  })

  it('offers the export as a real button and says what it saves', () => {
    render(<DataCard onExport={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Export all data' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toBeEnabled()
    expect(button).toHaveAccessibleDescription(EXPORT_HINT)
  })

  it('calls the export and starts a download of the zip', async () => {
    vi.mocked(exportTables).mockResolvedValue({
      dailyEntries: [LOGGED_DAY],
      exercises: [],
      sessions: [],
      sets: [],
    })
    const createObjectURL = vi.fn<(file: Blob) => string>(() => 'blob:export')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<DataCard />)

    await userEvent.click(screen.getByRole('button', { name: 'Export all data' }))

    await vi.waitFor(() => {
      expect(click).toHaveBeenCalledOnce()
    })
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toMatch(/^gym-tracker-\d{4}-\d{2}-\d{2}\.zip$/)
    expect(link.href).toBe('blob:export')
    expect(exportTables).toHaveBeenCalledOnce()
    const zip = createObjectURL.mock.calls[0]?.[0]
    expect(zip?.type).toBe('application/zip')
    expect(new TextDecoder().decode(await zip?.arrayBuffer())).toContain(
      'September 2,0:15:54,,,,,,4321,',
    )
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('shows the export is running and takes no second tap meanwhile', async () => {
    let finish: (value: unknown) => void = () => undefined
    const onExport = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(<DataCard onExport={onExport} />)

    await userEvent.click(screen.getByRole('button', { name: 'Export all data' }))

    const busy = screen.getByRole('button', { name: 'Exporting…' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveFocus()
    await userEvent.click(busy)
    expect(onExport).toHaveBeenCalledOnce()
    finish(undefined)
    const idle = await screen.findByRole('button', { name: 'Export all data' })
    expect(idle).toHaveAttribute('aria-disabled', 'false')
    expect(idle).toHaveFocus()
  })

  it('says so when the export fails, and clears it on the next try', async () => {
    const onExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValueOnce('downloaded')
    render(<DataCard onExport={onExport} />)
    const button = screen.getByRole('button', { name: 'Export all data' })

    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(EXPORT_ERROR)
    expect(button).toHaveAccessibleDescription(`${EXPORT_HINT} ${EXPORT_ERROR}`)

    await userEvent.click(screen.getByRole('button', { name: 'Export all data' }))
    await vi.waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
