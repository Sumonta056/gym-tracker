'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  CategoryNameTaken,
  renameVideoCategory,
  SignedOutOnThisDevice,
  VideoCategoryNotFound,
} from '../../lib/db/repository'
import { MAX_CATEGORY_NAME_LENGTH, videoCategorySchema } from '../../lib/schema/videoCategory'
import { Field } from '../ui/Field'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SheetModal } from '../ui/SheetModal'

import type { VideoCategory } from '../../lib/db/dexie'
import type { z } from 'zod'

export const NAME_TAKEN = 'Another category has this name.'

export const RENAME_FAILED = 'The category could not be renamed on this device. Try again.'

const renameSchema = videoCategorySchema.pick({ name: true })

type RenameValues = z.input<typeof renameSchema>

type RenameOutput = z.output<typeof renameSchema>

export type RenameCategorySheetProps = {
  open: boolean
  category: VideoCategory
  onClose: () => void
}

function messageFor(cause: unknown): string {
  if (cause instanceof CategoryNameTaken) {
    return NAME_TAKEN
  }

  if (cause instanceof SignedOutOnThisDevice || cause instanceof VideoCategoryNotFound) {
    return cause.message
  }

  return RENAME_FAILED
}

function RenameForm({
  formId,
  category,
  onClose,
  onError,
}: {
  formId: string
  category: VideoCategory
  onClose: () => void
  onError: (message: string | null) => void
}) {
  const saving = useRef(false)
  const {
    formState: { errors },
    handleSubmit,
    register,
    setFocus,
  } = useForm<RenameValues, unknown, RenameOutput>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: category.name },
  })

  useEffect(() => {
    setFocus('name', { shouldSelect: true })
  }, [setFocus])

  const submit = (values: RenameOutput) => {
    if (saving.current) {
      return Promise.resolve()
    }

    saving.current = true
    onError(null)

    return renameVideoCategory(category.id, values.name).then(onClose, (cause: unknown) => {
      saving.current = false
      onError(messageFor(cause))
    })
  }

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submit)(event)
      }}
    >
      <Field
        label="Name"
        autoComplete="off"
        maxLength={MAX_CATEGORY_NAME_LENGTH}
        error={errors.name?.message}
        {...register('name')}
      />
    </form>
  )
}

export function RenameCategorySheet({ open, category, onClose }: RenameCategorySheetProps) {
  const formId = useId()
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    onClose()
  }

  return (
    <SheetModal
      open={open}
      title="Rename category"
      onClose={close}
      footer={
        <div className="flex flex-col gap-2">
          {error === null ? null : (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" form={formId}>
            Save
          </PrimaryButton>
        </div>
      }
    >
      <RenameForm formId={formId} category={category} onClose={close} onError={setError} />
    </SheetModal>
  )
}

export function RenameCategory({ category }: { category: VideoCategory | null }) {
  const [open, setOpen] = useState(false)

  if (category === null) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="text-accent inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-bold"
      >
        Rename <span className="sr-only">{category.name}</span>
      </button>
      <RenameCategorySheet
        open={open}
        category={category}
        onClose={() => {
          setOpen(false)
        }}
      />
    </>
  )
}
