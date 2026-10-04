'use client'

import { useId, useState } from 'react'

import { exportAllData } from '../../lib/csv/export'
import { readYear, YEAR_ERROR } from '../csv/reviewState'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'
import { SecondaryButton } from '../ui/SecondaryButton'

export const READ_FILE_ERROR = 'The file could not be read. Choose the CSV again.'
export const EXPORT_HINT = 'Every table as CSV in one zip, read from this device. Works offline.'
export const EXPORT_ERROR = 'The export failed. Try again.'

export type ChosenSheet = { fileName: string; text: string; year: number }

export type DataCardProps = {
  className?: string
  onSheet?: (sheet: ChosenSheet) => void
  onExport?: () => Promise<unknown>
}

export function DataCard({ className, onSheet, onExport = exportAllData }: DataCardProps) {
  const [open, setOpen] = useState(false)
  const [yearDraft, setYearDraft] = useState(() => String(new Date().getFullYear()))
  const [yearError, setYearError] = useState<string | undefined>(undefined)
  const [readError, setReadError] = useState<string | null>(null)
  const hintId = useId()
  const formId = useId()
  const fileId = useId()
  const readErrorId = useId()
  const exportErrorId = useId()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function runExport() {
    if (exporting) {
      return
    }

    setExporting(true)
    setExportError(null)

    try {
      await onExport()
    } catch {
      setExportError(EXPORT_ERROR)
    } finally {
      setExporting(false)
    }
  }

  async function choose(file: File) {
    const year = readYear(yearDraft)

    if (year === null) {
      setYearError(YEAR_ERROR)
      return
    }

    try {
      const text = await file.text()
      setReadError(null)
      onSheet?.({ fileName: file.name, text, year })
    } catch {
      setReadError(READ_FILE_ERROR)
    }
  }

  return (
    <Card className={className} data-testid="data-card">
      <MicroLabel as="p">Data</MicroLabel>
      <div className="mt-2.5 grid gap-2.5">
        <SecondaryButton
          aria-expanded={open}
          aria-controls={open ? formId : undefined}
          onClick={() => {
            setOpen((current) => !current)
          }}
        >
          Import the old sheet
        </SecondaryButton>
        {open ? (
          <div id={formId} className="flex flex-col gap-3">
            <NumberField
              label="Year of the sheet"
              inputMode="numeric"
              value={yearDraft}
              error={yearError}
              hint="The sheet names a month and a day. This year completes each date."
              onChange={(event) => {
                setYearDraft(event.target.value)
                setYearError(undefined)
              }}
            />
            <div className="flex flex-col gap-[7px]">
              <MicroLabel as="label" htmlFor={fileId}>
                The sheet as a CSV file
              </MicroLabel>
              <input
                id={fileId}
                type="file"
                accept=".csv,text/csv"
                aria-invalid={readError === null ? undefined : true}
                aria-describedby={readError === null ? undefined : readErrorId}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''

                  if (file !== undefined) {
                    void choose(file)
                  }
                }}
                className="text-muted file:bg-surface-2 file:border-border file:text-text file:rounded-input block min-h-11 w-full min-w-0 text-[13px] file:mr-3 file:min-h-11 file:border file:px-4 file:text-sm file:font-bold"
              />
              {readError === null ? null : (
                <p id={readErrorId} role="alert" className="text-danger text-xs">
                  {readError}
                </p>
              )}
            </div>
          </div>
        ) : null}
        <SecondaryButton
          aria-describedby={exportError === null ? hintId : `${hintId} ${exportErrorId}`}
          aria-busy={exporting}
          aria-disabled={exporting}
          className="aria-disabled:opacity-50"
          onClick={() => {
            void runExport()
          }}
        >
          {exporting ? 'Exporting…' : 'Export all data'}
        </SecondaryButton>
      </div>
      <p id={hintId} className="text-muted mt-2.5 text-xs">
        {EXPORT_HINT}
      </p>
      {exportError === null ? null : (
        <p id={exportErrorId} role="alert" className="text-danger mt-1.5 text-xs">
          {exportError}
        </p>
      )}
    </Card>
  )
}
