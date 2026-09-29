'use client'

import { useEffect, useId, useRef, useState } from 'react'

import {
  archiveExercise,
  listExercises,
  renameExercise,
  restoreExercise,
} from '../../lib/db/repository'
import { exerciseSchema } from '../../lib/schema/exercise'
import { cn } from '../ui/cn'
import { Field } from '../ui/Field'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { SheetModal } from '../ui/SheetModal'
import { MUSCLE_GROUP_LABEL } from '../workout/MuscleGroupChips'

import type { Exercise } from '../../lib/db/dexie'
import type { ExerciseFilter } from '../../lib/db/repository'
import type { ReactNode } from 'react'

export type ManageExerciseSource = {
  listExercises: (filter: ExerciseFilter) => Promise<Exercise[]>
  renameExercise: (id: string, name: string) => Promise<Exercise>
  archiveExercise: (id: string) => Promise<void>
  restoreExercise: (id: string) => Promise<void>
}

export const REPOSITORY_MANAGE_SOURCE: ManageExerciseSource = {
  listExercises,
  renameExercise,
  archiveExercise,
  restoreExercise,
}

export const MANAGE_TITLE = 'Manage exercises'

export const MANAGE_READ_FAILED = 'The exercises could not be read on this device.'

export const CHANGE_FAILED = 'The exercise could not be changed on this device.'

export const NO_OWN_EXERCISES = 'No exercises of your own yet. Create one from the exercise picker.'

export const BUILT_IN = 'Built in'

const ACTION_CLASS =
  'bg-surface-2 border-border text-muted inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[13px] font-bold whitespace-nowrap'

type Action = 'rename' | 'archive' | 'restore'

export type ManageExercisesSheetProps = {
  open: boolean
  onClose: () => void
  source?: ManageExerciseSource
}

export function ManageExercisesSheet({ open, ...rest }: ManageExercisesSheetProps) {
  return open ? <ManageSheet {...rest} /> : null
}

function actionId(base: string, action: Action, id: string): string {
  return `${base}-${action}-${id}`
}

function RowAction({
  id,
  verb,
  name,
  onClick,
}: {
  id: string
  verb: string
  name: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      id={id}
      aria-label={`${verb} ${name}`}
      onClick={onClick}
      className={ACTION_CLASS}
    >
      {verb}
    </button>
  )
}

function Row({
  exercise,
  archived = false,
  children,
}: {
  exercise: Exercise
  archived?: boolean
  children: ReactNode
}) {
  return (
    <li className="border-border flex min-h-[52px] items-center justify-between gap-3 border-b py-2">
      <span className="flex min-w-0 flex-col">
        <span
          className={cn('text-[15px] font-bold break-words', archived ? 'text-muted' : 'text-text')}
        >
          {exercise.name}
        </span>
        <span className="text-muted text-xs">{MUSCLE_GROUP_LABEL[exercise.muscle_group]}</span>
      </span>
      <span className="flex shrink-0 gap-1.5">{children}</span>
    </li>
  )
}

function RenameRow({
  exercise,
  onSave,
  onCancel,
}: {
  exercise: Exercise
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const inputId = useId()
  const [text, setText] = useState(exercise.name)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const input = document.getElementById(inputId)

    if (input instanceof HTMLInputElement) {
      input.focus()
      input.select()
    }
  }, [inputId])

  function submit() {
    const parsed = exerciseSchema.shape.name.safeParse(text)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }

    setError(undefined)
    onSave(parsed.data)
  }

  return (
    <li className="border-border border-b py-3">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex flex-col gap-2.5"
      >
        <Field
          id={inputId}
          label={`New name for ${exercise.name}`}
          autoComplete="off"
          enterKeyHint="done"
          value={text}
          error={error}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton aria-label={`Cancel renaming ${exercise.name}`} onClick={onCancel}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" aria-label={`Save the new name for ${exercise.name}`}>
            Save
          </PrimaryButton>
        </div>
      </form>
    </li>
  )
}

function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <MicroLabel as="p" id={id}>
        {label}
      </MicroLabel>
      {children}
    </section>
  )
}

function ManageSheet({
  onClose,
  source = REPOSITORY_MANAGE_SOURCE,
}: Omit<ManageExercisesSheetProps, 'open'>) {
  const base = useId()
  const yoursId = useId()
  const archivedId = useId()
  const builtInId = useId()
  const [rows, setRows] = useState<Exercise[] | null>(null)
  const [readFailed, setReadFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [changeError, setChangeError] = useState<string | null>(null)
  const busy = useRef(false)
  const focusNext = useRef<string | null>(null)

  useEffect(() => {
    let live = true

    source.listExercises({ includeArchived: true }).then(
      (read) => {
        if (live) {
          setRows(read)
          setReadFailed(false)
        }
      },
      () => {
        if (live) {
          setReadFailed(true)
        }
      },
    )

    return () => {
      live = false
    }
  }, [source, version])

  useEffect(() => {
    if (focusNext.current === null) {
      return
    }

    const target = document.getElementById(focusNext.current)

    if (target !== null) {
      focusNext.current = null
      target.focus()
    }
  }, [rows, editing])

  function run(change: () => Promise<unknown>, focus: string, after: () => void = () => undefined) {
    if (busy.current) {
      return
    }

    busy.current = true
    change().then(
      () => {
        busy.current = false
        setChangeError(null)
        focusNext.current = focus
        after()
        setVersion((current) => current + 1)
      },
      () => {
        busy.current = false
        setChangeError(CHANGE_FAILED)
      },
    )
  }

  function stopEditing(exercise: Exercise) {
    focusNext.current = actionId(base, 'rename', exercise.id)
    setEditing(null)
  }

  function save(exercise: Exercise, name: string) {
    if (name === exercise.name) {
      stopEditing(exercise)
      return
    }

    run(
      () => source.renameExercise(exercise.id, name),
      actionId(base, 'rename', exercise.id),
      () => {
        setEditing(null)
      },
    )
  }

  const own = (rows ?? []).filter((row) => row.user_id !== null)
  const active = own.filter((row) => !row.is_archived)
  const archived = own.filter((row) => row.is_archived)
  const builtIn = (rows ?? []).filter((row) => row.user_id === null)

  return (
    <SheetModal open title={MANAGE_TITLE} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {readFailed ? (
          <p role="alert" className="text-danger text-sm">
            {MANAGE_READ_FAILED}
          </p>
        ) : null}

        {changeError === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {changeError}
          </p>
        )}

        {rows === null ? null : (
          <Section id={yoursId} label={`Yours · ${String(active.length)} active`}>
            {active.length === 0 ? (
              <p className="text-muted text-sm">{NO_OWN_EXERCISES}</p>
            ) : (
              <ul>
                {active.map((exercise) =>
                  editing === exercise.id ? (
                    <RenameRow
                      key={exercise.id}
                      exercise={exercise}
                      onSave={(name) => {
                        save(exercise, name)
                      }}
                      onCancel={() => {
                        stopEditing(exercise)
                      }}
                    />
                  ) : (
                    <Row key={exercise.id} exercise={exercise}>
                      <RowAction
                        id={actionId(base, 'rename', exercise.id)}
                        verb="Rename"
                        name={exercise.name}
                        onClick={() => {
                          setChangeError(null)
                          setEditing(exercise.id)
                        }}
                      />
                      <RowAction
                        id={actionId(base, 'archive', exercise.id)}
                        verb="Archive"
                        name={exercise.name}
                        onClick={() => {
                          run(
                            () => source.archiveExercise(exercise.id),
                            actionId(base, 'restore', exercise.id),
                          )
                        }}
                      />
                    </Row>
                  ),
                )}
              </ul>
            )}
          </Section>
        )}

        {archived.length === 0 ? null : (
          <Section id={archivedId} label={`Archived · ${String(archived.length)}`}>
            <ul>
              {archived.map((exercise) => (
                <Row key={exercise.id} exercise={exercise} archived>
                  <RowAction
                    id={actionId(base, 'restore', exercise.id)}
                    verb="Restore"
                    name={exercise.name}
                    onClick={() => {
                      run(
                        () => source.restoreExercise(exercise.id),
                        actionId(base, 'archive', exercise.id),
                      )
                    }}
                  />
                </Row>
              ))}
            </ul>
          </Section>
        )}

        {builtIn.length === 0 ? null : (
          <Section id={builtInId} label={`${BUILT_IN} · ${String(builtIn.length)}`}>
            <ul>
              {builtIn.map((exercise) => (
                <Row key={exercise.id} exercise={exercise}>
                  <span className="bg-surface-2 border-border rounded-md border px-[7px] py-[3px]">
                    <MicroLabel tracking="tab">{BUILT_IN}</MicroLabel>
                  </span>
                </Row>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </SheetModal>
  )
}
