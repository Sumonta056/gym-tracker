'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { parseSheet } from '../../lib/csv/import'
import {
  firstPullDone,
  ImportMergeRefused,
  ImportNeedsAChoice,
  ImportNeedsFirstSync,
  importDays,
  loggedDates,
  SignedOutOnThisDevice,
} from '../../lib/db/repository'
import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'
import { NumberField } from '../ui/NumberField'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SegmentedTabs } from '../ui/SegmentedTabs'

import { ImportConfirmSheet } from './ImportConfirmSheet'
import { CHOICE_LABEL, CHOICE_OPTIONS, ImportConflict } from './ImportConflict'
import { resultPath } from './importResult'
import { Badge, ReviewCell, ReviewValue } from './ReviewCell'
import {
  applyToSimilar,
  cellKey,
  cellText,
  chooseForAll,
  duplicateDates,
  errorText,
  FIELD_LABEL,
  hasError,
  importPlan,
  readYear,
  remaining,
  repeatedRows,
  repeatText,
  reviewTargets,
  rowDate,
  rowDetail,
  rowTitle,
  sharedChoice,
  spokenRowTitle,
  similarTargets,
  undecided,
  YEAR_ERROR,
} from './reviewState'

import type { ImportOutcome } from './importResult'
import type { Choices, Picks, ReviewTarget } from './reviewState'
import type { ParsedRow, ParsedSheet, SheetField } from '../../lib/csv/import'
import type { ImportChoice, ImportDay, ImportResult } from '../../lib/db/repository'
import type { ReactNode } from 'react'

export type ImportSource = {
  firstPullDone: () => Promise<boolean>
  loggedDates: (dates: string[]) => Promise<Set<string>>
  importDays: (days: ImportDay[]) => Promise<ImportResult>
}

export const REPOSITORY_IMPORT_SOURCE: ImportSource = { firstPullDone, loggedDates, importDays }

export const WAITING_FOR_FIRST_SYNC =
  'Waiting for the first sync. Connect to the internet to import.'

export const LOGGED_READ_FAILED =
  'The days on this device could not be read, so nothing can be imported.'

export const IMPORT_FAILED = 'The import could not be saved on this device. Nothing was written.'

export const LOGGED_CHANGED =
  'A date in the sheet was logged on this device a moment ago. Nothing was written. Check the review again.'

export const NOTHING_TO_IMPORT = 'No row can be imported. Every row has an error or is skipped.'

export function goToResult(outcome: ImportOutcome): void {
  window.location.assign(resultPath(outcome))
}

function sheetDates(sheet: ParsedSheet): string[] {
  return sheet.rows.flatMap((row) => {
    const date = rowDate(row)

    return date === null || hasError(row) ? [] : [date]
  })
}

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

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

export function summaryText(total: number, picked: number, errors: number, duplicates = 0): string {
  const durations =
    total === 0
      ? 'Every duration reads one way.'
      : `${plural(total, 'duration', 'durations')} can be read two ways. ${String(picked)} ${picked === 1 ? 'is' : 'are'} picked.`
  const broken = errors === 0 ? '' : ` ${plural(errors, 'row has', 'rows have')} an error.`
  const logged =
    duplicates === 0 ? '' : ` ${plural(duplicates, 'date is', 'dates are')} already logged.`

  return `${durations}${broken}${logged}`
}

export function countText(cellsLeft: number, cells: number, datesLeft: number, dates: number) {
  const head = `${String(cellsLeft + datesLeft)} of ${String(cells + dates)} to check`
  const parts = [
    cells === 0 ? null : plural(cells, 'cell', 'cells'),
    dates === 0 ? null : plural(dates, 'date', 'dates'),
  ].filter((part) => part !== null)

  return parts.length === 0 ? head : `${head}: ${parts.join(', ')}`
}

export function applyHint(cellsLeft: number, datesLeft: number): string {
  const parts = [
    cellsLeft === 0 ? null : `the ${plural(cellsLeft, 'reading', 'readings')}`,
    datesLeft === 0 ? null : `a choice for the ${plural(datesLeft, 'logged date', 'logged dates')}`,
  ].filter((part) => part !== null)

  return `Pick ${parts.join(' and ')} left to apply. Nothing is written until you confirm.`
}

type RowState = {
  row: ParsedRow
  rowIndex: number
  title: string
  error: boolean
  errors: string[]
  targets: ReviewTarget[]
  left: number
  duplicate: boolean
  choice: ImportChoice | null
}

type CellPicker = (target: ReviewTarget) => ReactNode

type ConflictPicker = (state: RowState) => ReactNode

function rowBadge(state: RowState) {
  if (state.error) {
    return <Badge tone="danger">Error</Badge>
  }

  if (state.left > 0) {
    return <Badge tone="warn">{`${String(state.left)} to check`}</Badge>
  }

  if (state.duplicate) {
    return state.choice === null ? <Badge tone="warn">Choose</Badge> : <Badge>Already logged</Badge>
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

function RowCard({
  state,
  picks,
  picker,
  conflict,
}: {
  state: RowState
  picks: Picks
  picker: CellPicker
  conflict: ConflictPicker
}) {
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
          <p className="text-muted mt-2 text-[13px]">{[...state.errors, LEFT_OUT].join(' ')}</p>
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
            {state.duplicate ? <div className="mt-3">{conflict(state)}</div> : null}
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

  if (state.duplicate) {
    return state.choice === null ? (
      <span className="text-warn font-bold">Choose</span>
    ) : (
      <span className="text-muted">{CHOICE_LABEL[state.choice]}</span>
    )
  }

  return <span className="text-muted">{state.targets.length === 0 ? 'Ready' : 'Picked'}</span>
}

function TableRows({
  state,
  picks,
  picker,
  conflict,
}: {
  state: RowState
  picks: Picks
  picker: CellPicker
  conflict: ConflictPicker
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
            {[...state.errors, LEFT_OUT].join(' ')}
          </td>
        </tr>
      ) : null}
      {!state.error && state.duplicate ? (
        <tr>
          <td colSpan={TABLE_COLUMNS} className="px-3 pb-4">
            <div className="max-w-[420px]">{conflict(state)}</div>
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
  source?: ImportSource
  onImported?: (outcome: ImportOutcome) => void
}

export function ImportReview({
  fileName,
  text,
  initialYear,
  status,
  focusOnMount = false,
  onClose,
  source = REPOSITORY_IMPORT_SOURCE,
  onImported = goToResult,
}: ImportReviewProps) {
  const [year, setYear] = useState(initialYear)
  const [picks, setPicks] = useState<Picks>({})
  const [changingYear, setChangingYear] = useState(false)
  const [yearDraft, setYearDraft] = useState(String(initialYear))
  const [yearError, setYearError] = useState<string | undefined>(undefined)
  const [logged, setLogged] = useState<ReadonlySet<string> | null>(null)
  const [loggedFailed, setLoggedFailed] = useState(false)
  const [reads, setReads] = useState(0)
  const [choices, setChoices] = useState<Choices>({})
  const [confirming, setConfirming] = useState(false)
  const [focusCount, setFocusCount] = useState(0)
  const countRef = useRef<HTMLParagraphElement>(null)
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
  const repeated = useMemo(() => repeatedRows(sheet), [sheet])
  const cellsLeft = remaining(targets, picks)

  useEffect(() => {
    let cancelled = false

    setLogged(null)
    setLoggedFailed(false)
    source.loggedDates(sheetDates(sheet)).then(
      (dates) => {
        if (!cancelled) setLogged(dates)
      },
      () => {
        if (!cancelled) setLoggedFailed(true)
      },
    )

    return () => {
      cancelled = true
    }
  }, [sheet, source, reads])

  const duplicates = useMemo(
    () => (logged === null ? [] : duplicateDates(sheet, logged)),
    [sheet, logged],
  )
  const datesLeft = undecided(duplicates, choices)
  const left = cellsLeft + datesLeft
  const plan = importPlan(sheet, picks, logged ?? new Set(), choices)

  const rows: RowState[] = sheet.rows.map((row, rowIndex) => {
    const own = targets.filter((target) => target.rowIndex === rowIndex)
    const earlier = repeated.get(rowIndex)
    const date = rowDate(row)
    const duplicate = date !== null && earlier === undefined && duplicates.includes(date)

    return {
      row,
      rowIndex,
      title: rowTitle(row, rowIndex),
      error: hasError(row) || earlier !== undefined,
      errors: earlier === undefined ? errorText(row) : [repeatText(sheet, rowIndex, earlier)],
      targets: own,
      left: remaining(own, picks),
      duplicate,
      choice: duplicate ? (choices[date] ?? null) : null,
    }
  })

  const conflict: ConflictPicker = (state) => {
    const date = rowDate(state.row)

    if (date === null) {
      return null
    }

    return (
      <ImportConflict
        label={spokenRowTitle(state.row, state.rowIndex)}
        choice={state.choice}
        onChoose={(choice) => {
          setChoices((current) => ({ ...current, [date]: choice }))
        }}
      />
    )
  }

  const pulled = useLiveQuery(() => source.firstPullDone(), [source], null)
  const ready = pulled === true && logged !== null && left === 0 && plan.writes > 0

  function hint(): string {
    if (loggedFailed) {
      return LOGGED_READ_FAILED
    }

    if (pulled === false) {
      return WAITING_FOR_FIRST_SYNC
    }

    if (logged === null || pulled === null) {
      return 'Reading the days on this device…'
    }

    if (left > 0) {
      return applyHint(cellsLeft, datesLeft)
    }

    if (plan.writes === 0) {
      return NOTHING_TO_IMPORT
    }

    return 'Every reading is picked. Nothing is written until you confirm.'
  }

  async function confirmImport(): Promise<void> {
    setBusy(true)
    setApplyError(null)

    let result: ImportResult

    try {
      result = await source.importDays(plan.days)
    } catch (cause) {
      setBusy(false)

      if (cause instanceof ImportNeedsAChoice) {
        setConfirming(false)
        setNotice(LOGGED_CHANGED)
        setReads((count) => count + 1)
        setFocusCount((count) => count + 1)
        return
      }

      setApplyError(
        cause instanceof SignedOutOnThisDevice ||
          cause instanceof ImportMergeRefused ||
          cause instanceof ImportNeedsFirstSync
          ? cause.message
          : IMPORT_FAILED,
      )
      return
    }

    onImported({ ...result, leftOut: plan.counts.leftOut })
  }

  useEffect(() => {
    if (focusCount > 0) {
      countRef.current?.focus()
    }
  }, [focusCount])

  const errorRows = rows.filter((state) => state.error).length
  const allChoice = sharedChoice(duplicates, choices)

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
          ref={countRef}
          tabIndex={-1}
          aria-live="polite"
          data-testid="import-count"
          className="text-text mt-2 text-[25px] font-bold tracking-[-0.9px]"
        >
          {countText(cellsLeft, targets.length, datesLeft, duplicates.length)}
        </p>
        <p className="text-muted mt-1.5 text-xs">
          {summaryText(targets.length, targets.length - cellsLeft, errorRows, duplicates.length)}
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
              setChoices({})
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
        {duplicates.length === 0 ? null : (
          <div className="border-border mt-3 border-t pt-3" data-testid="import-all-duplicates">
            <p className="text-muted mb-2 text-[13px]">
              {`Apply to all duplicates · ${plural(duplicates.length, 'date', 'dates')}`}
            </p>
            <SegmentedTabs
              label="Apply to all duplicates"
              options={CHOICE_OPTIONS}
              value={allChoice}
              onValueChange={(choice) => {
                setChoices(chooseForAll(duplicates, choice))
              }}
              className="lg:max-w-[420px] [&>button]:px-2"
            />
          </div>
        )}
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
          <RowCard
            key={state.row.line}
            state={state}
            picks={picks}
            picker={picker}
            conflict={conflict}
          />
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
              <TableRows
                key={state.row.line}
                state={state}
                picks={picks}
                picker={picker}
                conflict={conflict}
              />
            ))}
          </tbody>
        </table>
      </Card>

      {notice === null ? null : (
        <p role="alert" className="text-warn text-center text-[13px]">
          {notice}
        </p>
      )}
      <PrimaryButton
        disabled={!ready}
        aria-describedby={applyHintId}
        onClick={() => {
          setApplyError(null)
          setNotice(null)
          setConfirming(true)
        }}
      >
        Apply import
      </PrimaryButton>
      <p id={applyHintId} className="text-muted text-center text-xs">
        {hint()}
      </p>
      {onClose === undefined ? null : (
        <SecondaryButton onClick={onClose}>Back to the profile</SecondaryButton>
      )}
      <ImportConfirmSheet
        open={confirming}
        counts={plan.counts}
        busy={busy}
        error={applyError}
        onConfirm={() => {
          void confirmImport()
        }}
        onCancel={() => {
          setConfirming(false)
        }}
      />
    </div>
  )
}
