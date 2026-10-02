'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { parseSheet } from '../../lib/csv/import'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

import { Badge, ReviewCell, ReviewValue } from './ReviewCell'
import {
  applyToSimilar,
  cellKey,
  cellText,
  errorText,
  FIELD_LABEL,
  hasError,
  readYear,
  remaining,
  reviewTargets,
  rowDetail,
  rowTitle,
  similarTargets,
  YEAR_ERROR,
} from './reviewState'

import type { Picks, ReviewTarget } from './reviewState'
import type { ParsedRow, SheetField } from '../../lib/csv/import'
import type { ReactNode } from 'react'

export const LEFT_OUT = 'This row is left out of the import.'

const CARD_FIELDS: SheetField[] = ['gym_seconds', 'walk_seconds']

const TABLE_FIELDS: { field: SheetField; heading: string }[] = [
  { field: 'walk_seconds', heading: 'Walk' },
  { field: 'gym_seconds', heading: 'Gym' },
  { field: 'avg_heart_rate', heading: 'Avg HR' },
  { field: 'max_heart_rate', heading: 'Max HR' },
  { field: 'weight_kg', heading: 'Weight' },
  { field: 'calories_burnt', heading: 'Kcal' },
  { field: 'steps', heading: 'Steps' },
]

const TABLE_COLUMNS = TABLE_FIELDS.length + 2

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

export function summaryText(total: number, picked: number, errors: number): string {
  const durations =
    total === 0
      ? 'Every duration reads one way.'
      : `${plural(total, 'duration', 'durations')} can be read two ways. ${String(picked)} ${picked === 1 ? 'is' : 'are'} picked.`
  const broken = errors === 0 ? '' : ` ${plural(errors, 'row has', 'rows have')} an error.`

  return `${durations}${broken}`
}

type RowState = {
  row: ParsedRow
  rowIndex: number
  title: string
  error: boolean
  targets: ReviewTarget[]
  left: number
}

type CellPicker = (target: ReviewTarget) => ReactNode

function rowBadge(state: RowState) {
  if (state.error) {
    return <Badge tone="danger">Error</Badge>
  }

  if (state.targets.length === 0) {
    return null
  }

  return state.left === 0 ? (
    <Badge>Picked</Badge>
  ) : (
    <Badge tone="warn">{`${String(state.left)} to check`}</Badge>
  )
}

function RowCard({ state, picks, picker }: { state: RowState; picks: Picks; picker: CellPicker }) {
  const titleId = useId()
  const { row, rowIndex } = state
  const detail = rowDetail(row)

  return (
    <li className="min-w-0">
      <Card className="h-full" aria-labelledby={titleId} role="group">
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId}>
            <MicroLabel>{state.title}</MicroLabel>
          </h3>
          {rowBadge(state)}
        </div>
        {state.error ? (
          <p className="text-muted mt-2 text-[13px]">{[...errorText(row), LEFT_OUT].join(' ')}</p>
        ) : (
          <>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {CARD_FIELDS.map((field) => {
                const cell = row.cells[field]
                const pick = picks[cellKey(rowIndex, field)]
                const picked = cell.status === 'review' && pick !== undefined

                return (
                  <div key={field} className="flex min-w-0 flex-col gap-1">
                    <span className="text-muted text-[13px]">
                      {picked ? `${FIELD_LABEL[field]} · ${cell.raw}` : FIELD_LABEL[field]}
                    </span>
                    {cell.status === 'review' ? (
                      <ReviewValue
                        raw={cell.raw}
                        picked={pick === undefined ? null : cellText(field, cell, pick)}
                      />
                    ) : (
                      <span className="bg-surface-2 border-border flex min-h-11 items-center rounded-xl border px-3 text-[15px] font-bold">
                        {cellText(field, cell)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {state.targets.length === 0 ? null : (
              <div className="mt-3 flex flex-col gap-4">{state.targets.map(picker)}</div>
            )}
            {detail === '' ? null : <p className="text-muted mt-2 text-xs">{detail}</p>}
          </>
        )}
      </Card>
    </li>
  )
}

function statusWord(state: RowState): ReactNode {
  if (state.error) {
    return <span className="text-danger font-bold">Error</span>
  }

  if (state.left > 0) {
    return <span className="text-warn font-bold">{`${String(state.left)} to check`}</span>
  }

  return <span className="text-muted">{state.targets.length === 0 ? 'Ready' : 'Picked'}</span>
}

function TableRows({
  state,
  picks,
  picker,
}: {
  state: RowState
  picks: Picks
  picker: CellPicker
}) {
  const { row, rowIndex } = state

  return (
    <>
      <tr className="border-border border-t align-top">
        <th scope="row" className="px-3 py-3 text-left font-bold">
          {state.title}
        </th>
        {TABLE_FIELDS.map(({ field }) => {
          const cell = row.cells[field]
          const pick = picks[cellKey(rowIndex, field)]

          return (
            <td key={field} className="px-2 py-3 break-words">
              {cell.status === 'review' && pick === undefined && !state.error ? (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="text-warn font-bold">{cell.raw}</span>
                  <Badge tone="warn">Check</Badge>
                </span>
              ) : (
                <span className={cell.status === 'error' ? 'text-danger font-bold' : 'font-normal'}>
                  {cellText(field, cell, pick)}
                </span>
              )}
            </td>
          )
        })}
        <td className="px-2 py-3">{statusWord(state)}</td>
      </tr>
      {state.error ? (
        <tr>
          <td colSpan={TABLE_COLUMNS} className="text-muted px-3 pb-4 text-[13px]">
            {[...errorText(row), LEFT_OUT].join(' ')}
          </td>
        </tr>
      ) : null}
      {!state.error && state.targets.length > 0 ? (
        <tr>
          <td colSpan={TABLE_COLUMNS} className="px-3 pb-4">
            <div className="grid grid-cols-2 gap-4">{state.targets.map(picker)}</div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export type ImportReviewProps = {
  fileName: string
  text: string
  initialYear: number
  status?: ReactNode
  focusOnMount?: boolean
  onClose?: () => void
}

export function ImportReview({
  fileName,
  text,
  initialYear,
  status,
  focusOnMount = false,
  onClose,
}: ImportReviewProps) {
  const [year, setYear] = useState(initialYear)
  const [picks, setPicks] = useState<Picks>({})
  const [changingYear, setChangingYear] = useState(false)
  const [yearDraft, setYearDraft] = useState(String(initialYear))
  const [yearError, setYearError] = useState<string | undefined>(undefined)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const applyHintId = useId()
  const yearFormId = useId()

  useEffect(() => {
    if (focusOnMount) {
      headingRef.current?.focus()
    }
  }, [focusOnMount])

  const sheet = useMemo(() => parseSheet(text, { year }), [text, year])
  const targets = useMemo(() => reviewTargets(sheet), [sheet])
  const left = remaining(targets, picks)

  const rows: RowState[] = sheet.rows.map((row, rowIndex) => {
    const own = targets.filter((target) => target.rowIndex === rowIndex)

    return {
      row,
      rowIndex,
      title: rowTitle(row, rowIndex),
      error: hasError(row),
      targets: own,
      left: remaining(own, picks),
    }
  })

  const errorRows = rows.filter((state) => state.error).length

  const picker: CellPicker = (target) => {
    const cell = sheet.rows[target.rowIndex]?.cells[target.field]

    if (cell?.status !== 'review') {
      return null
    }

    const pick = picks[target.key]
    const similar = similarTargets(targets, target)

    return (
      <ReviewCell
        key={target.key}
        label={FIELD_LABEL[target.field]}
        raw={cell.raw}
        readings={cell.readings}
        pick={pick}
        onPick={(reading) => {
          setPicks((current) => ({ ...current, [target.key]: reading }))
        }}
        others={similar.length}
        similar={similar.filter((other) => picks[other.key] !== pick).length}
        onApplySimilar={() => {
          if (pick !== undefined) {
            setPicks((current) => applyToSimilar(current, targets, target, pick))
          }
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="import-review">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-text text-[23px] leading-tight font-bold tracking-[-0.6px]"
          >
            Import review
          </h1>
          <p className="text-muted text-[13px] break-all">
            {`${fileName} · ${plural(sheet.rows.length, 'row', 'rows')}`}
          </p>
        </div>
        {status}
      </header>

      <Card data-testid="import-summary">
        <div className="flex items-center justify-between gap-3">
          <MicroLabel as="p">Still to check</MicroLabel>
          {left === 0 ? (
            <Badge>All picked</Badge>
          ) : (
            <Badge tone="warn">{`${String(left)} left`}</Badge>
          )}
        </div>
        <p
          aria-live="polite"
          data-testid="import-count"
          className="text-text mt-2 text-[25px] font-bold tracking-[-0.9px]"
        >
          {`${String(left)} of ${plural(targets.length, 'cell', 'cells')}`}
        </p>
        <p className="text-muted mt-1.5 text-xs">
          {summaryText(targets.length, targets.length - left, errorRows)}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted text-[13px]">
            Dates read as <strong className="text-text">{year}</strong>
          </span>
          <button
            type="button"
            aria-expanded={changingYear}
            aria-controls={changingYear ? yearFormId : undefined}
            onClick={() => {
              setChangingYear((open) => !open)
              setYearDraft(String(year))
              setYearError(undefined)
            }}
            className="bg-surface-2 border-border text-muted min-h-11 rounded-full border px-4 text-[13px] font-bold whitespace-nowrap"
          >
            Change year
          </button>
        </div>
        {changingYear ? (
          <form
            id={yearFormId}
            className="mt-3 flex flex-col gap-2.5"
            onSubmit={(event) => {
              event.preventDefault()
              const next = readYear(yearDraft)

              if (next === null) {
                setYearError(YEAR_ERROR)
                return
              }

              setYear(next)
              setPicks({})
              setChangingYear(false)
            }}
          >
            <NumberField
              label="Year of the sheet"
              inputMode="numeric"
              value={yearDraft}
              error={yearError}
              hint="Reading the sheet again clears every pick."
              onChange={(event) => {
                setYearDraft(event.target.value)
                setYearError(undefined)
              }}
            />
            <SecondaryButton type="submit">Read the sheet again</SecondaryButton>
          </form>
        ) : null}
        {sheet.issues.length === 0 ? null : (
          <div className="border-border mt-3 border-t pt-3" data-testid="import-issues">
            <MicroLabel as="p">About the sheet</MicroLabel>
            <ul className="text-muted mt-1.5 flex list-none flex-col gap-1 p-0 text-[13px]">
              {sheet.issues.map((issue) => (
                <li key={`${issue.kind}-${String(issue.line)}-${issue.column ?? ''}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <ol
        className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 lg:hidden"
        data-testid="import-cards"
        aria-label="Rows of the sheet"
      >
        {rows.map((state) => (
          <RowCard key={state.row.line} state={state} picks={picks} picker={picker} />
        ))}
      </ol>

      <Card className="hidden overflow-hidden p-0 lg:block" data-testid="import-table">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <caption className="sr-only">Rows of the sheet</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[15%] px-3 py-3 text-left">
                <MicroLabel>Row</MicroLabel>
              </th>
              {TABLE_FIELDS.map(({ field, heading }) => (
                <th key={field} scope="col" className="px-2 py-3 text-left">
                  <MicroLabel>{heading}</MicroLabel>
                </th>
              ))}
              <th scope="col" className="w-[12%] px-2 py-3 text-left">
                <MicroLabel>Status</MicroLabel>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((state) => (
              <TableRows key={state.row.line} state={state} picks={picks} picker={picker} />
            ))}
          </tbody>
        </table>
      </Card>

      <PrimaryButton disabled={left > 0} aria-describedby={applyHintId}>
        Apply import
      </PrimaryButton>
      <p id={applyHintId} className="text-muted text-center text-xs">
        {left === 0
          ? 'Every reading is picked. Nothing is written until you confirm.'
          : `Pick the ${plural(left, 'reading', 'readings')} left to apply. Nothing is written until you confirm.`}
      </p>
      {onClose === undefined ? null : (
        <SecondaryButton onClick={onClose}>Back to the profile</SecondaryButton>
      )}
    </div>
  )
}
