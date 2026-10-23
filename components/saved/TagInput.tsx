'use client'

import { useId, useState } from 'react'

import { MAX_TAGS, tagSchema } from '../../lib/schema/savedVideo'
import { cn } from '../ui/cn'
import { FIELD_INPUT_CLASS } from '../ui/Field'
import { MicroLabel } from '../ui/MicroLabel'

import { CHIP_CLASS, chipTone } from './CategoryChips'

import type { KeyboardEvent } from 'react'

export const TOO_MANY_TAGS = `A video takes at most ${String(MAX_TAGS)} tags.`

export type TagInputProps = {
  value: readonly string[]
  onChange: (tags: string[]) => void
  suggestions: readonly string[]
  error?: string
  draft?: string
  onDraftChange?: (draft: string) => void
}

export function TagInput({
  value,
  onChange,
  suggestions,
  error,
  draft: heldDraft,
  onDraftChange,
}: TagInputProps) {
  const labelId = useId()
  const inputId = useId()
  const errorId = useId()
  const [ownDraft, setOwnDraft] = useState('')
  const draft = heldDraft ?? ownDraft
  const setDraft = onDraftChange ?? setOwnDraft
  const [typed, setTyped] = useState<string | null>(null)
  const shown = typed ?? error ?? null

  const add = (raw: string): boolean => {
    const parsed = tagSchema.safeParse(raw)

    if (!parsed.success) {
      setTyped(parsed.error.issues[0]?.message ?? null)
      return false
    }

    if (value.includes(parsed.data)) {
      setTyped(null)
      return true
    }

    if (value.length >= MAX_TAGS) {
      setTyped(TOO_MANY_TAGS)
      return false
    }

    setTyped(null)
    onChange([...value, parsed.data])
    return true
  }

  const commit = () => {
    if (draft.trim() === '') {
      setTyped(null)
      return
    }

    if (add(draft)) {
      setDraft('')
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    }
  }

  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      setTyped(null)
      onChange(value.filter((kept) => kept !== tag))
      return
    }

    add(tag)
  }

  const chips = [...suggestions, ...value.filter((tag) => !suggestions.includes(tag))]

  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-2">
      <MicroLabel id={labelId}>Tags</MicroLabel>
      {chips.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {chips.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={value.includes(tag)}
              onClick={() => {
                toggle(tag)
              }}
              className={cn(
                CHIP_CLASS,
                chipTone(value.includes(tag)),
                'max-w-full whitespace-normal',
              )}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">#{tag}</span>
            </button>
          ))}
        </div>
      )}
      <label htmlFor={inputId} className="sr-only">
        Add a new tag
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="Add a new tag…"
        value={draft}
        aria-invalid={shown === null ? undefined : true}
        aria-describedby={shown === null ? undefined : errorId}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className={cn(FIELD_INPUT_CLASS, shown === null ? 'border-border' : 'border-danger')}
      />
      {shown === null ? null : (
        <p id={errorId} role="alert" className="text-danger text-xs">
          {shown}
        </p>
      )}
    </div>
  )
}
