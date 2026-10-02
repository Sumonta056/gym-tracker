import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { YEAR_ERROR } from '../csv/reviewState'

import { DataCard, EXPORT_HINT, READ_FILE_ERROR } from './DataCard'

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

  it('keeps the export inert and says why', () => {
    render(<DataCard />)
    const button = screen.getByRole('button', { name: 'Export everything as CSV' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(EXPORT_HINT)
  })
})
