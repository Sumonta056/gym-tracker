'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  addSavedVideo,
  SavedVideoNotFound,
  SignedOutOnThisDevice,
  updateSavedVideo,
  VideoCategoryNotFound,
} from '../../lib/db/repository'
import { savedVideoSchema, tagsSchema } from '../../lib/schema/savedVideo'
import { MAX_CATEGORY_NAME_LENGTH, videoCategorySchema } from '../../lib/schema/videoCategory'
import { cn } from '../ui/cn'
import { Field, FIELD_INPUT_CLASS } from '../ui/Field'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SheetModal } from '../ui/SheetModal'

import { CHIP_CLASS, chipTone } from './CategoryChips'
import { PriorityControl } from './PriorityControl'
import { TagInput } from './TagInput'

import type { SavedVideo, VideoCategory } from '../../lib/db/dexie'
import type { ListedVideo, SavedVideoWrite } from '../../lib/db/repository'

export const NEW_CATEGORY = 'new'

export const SAVE_FAILED = 'The video could not be saved on this device. Try again.'

export const saveVideoFormSchema = savedVideoSchema
  .omit({ category_id: true })
  .extend({
    categoryId: z.string(),
    newName: z.string(),
    tagDraft: z.string(),
  })
  .superRefine((values, context) => {
    if (values.tagDraft.trim() !== '') {
      const tagged = tagsSchema.safeParse([...values.tags, values.tagDraft])

      if (!tagged.success) {
        context.addIssue({
          code: 'custom',
          path: ['tagDraft'],
          message: tagged.error.issues[0]?.message ?? '',
        })
      }
    }

    if (values.categoryId === '') {
      const picked = savedVideoSchema.shape.category_id.safeParse('')

      context.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: picked.error?.issues[0]?.message ?? '',
      })
    }

    if (values.categoryId === NEW_CATEGORY) {
      const named = videoCategorySchema.shape.name.safeParse(values.newName)

      if (!named.success) {
        context.addIssue({
          code: 'custom',
          path: ['newName'],
          message: named.error.issues[0]?.message ?? '',
        })
      }
    }
  })

type FormValues = z.input<typeof saveVideoFormSchema>

type FormOutput = z.output<typeof saveVideoFormSchema>

export type SaveVideo = (id: string | null, input: SavedVideoWrite) => Promise<SavedVideo>

export const saveToDevice: SaveVideo = (id, input) =>
  id === null ? addSavedVideo(input) : updateSavedVideo(id, input)

export type SaveVideoSheetProps = {
  open: boolean
  video: ListedVideo | null
  categories: readonly VideoCategory[]
  tags: readonly string[]
  onClose: () => void
  onSaved?: (video: SavedVideo) => void
  save?: SaveVideo
}

function messageFor(cause: unknown): string {
  if (
    cause instanceof SignedOutOnThisDevice ||
    cause instanceof VideoCategoryNotFound ||
    cause instanceof SavedVideoNotFound
  ) {
    return cause.message
  }

  return SAVE_FAILED
}

function defaultsFor(video: ListedVideo | null): FormValues {
  return {
    url: video?.url ?? '',
    title: video?.title ?? '',
    categoryId: video?.category?.id ?? '',
    newName: '',
    tagDraft: '',
    tags: video === null ? [] : [...video.tags],
    priority: video?.priority ?? 'normal',
  }
}

function toWrite(values: FormOutput): SavedVideoWrite {
  return {
    url: values.url,
    title: values.title,
    tags:
      values.tagDraft.trim() === ''
        ? values.tags
        : tagsSchema.parse([...values.tags, values.tagDraft]),
    priority: values.priority,
    category:
      values.categoryId === NEW_CATEGORY ? { name: values.newName } : { id: values.categoryId },
  }
}

type SaveVideoFormProps = Omit<SaveVideoSheetProps, 'open'> & {
  formId: string
  onError: (message: string | null) => void
}

function SaveVideoForm({
  formId,
  video,
  categories,
  tags,
  onClose,
  onSaved,
  onError,
  save = saveToDevice,
}: SaveVideoFormProps) {
  const categoryLabelId = useId()
  const categoryErrorId = useId()
  const newNameId = useId()
  const newNameRef = useRef<HTMLInputElement | null>(null)
  const newChipRef = useRef<HTMLButtonElement | null>(null)
  const beforeNew = useRef('')
  const saving = useRef(false)

  const {
    control,
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setFocus,
    setValue,
    watch,
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(saveVideoFormSchema),
    defaultValues: defaultsFor(video),
  })

  useEffect(() => {
    setFocus('url')
  }, [setFocus])

  const categoryId = watch('categoryId')
  const tagDraft = watch('tagDraft')
  const { ref: newNameField, ...newNameProps } = register('newName')

  const submit = (values: FormOutput) => {
    if (saving.current) {
      return Promise.resolve()
    }

    saving.current = true
    onError(null)

    return save(video?.id ?? null, toWrite(values)).then(
      (saved) => {
        onSaved?.(saved)
        onClose()
      },
      (cause: unknown) => {
        saving.current = false
        onError(messageFor(cause))
      },
    )
  }

  const categoryError = errors.categoryId?.message
  const newNameError = errors.newName?.message

  const pick = (id: string) => {
    if (id === NEW_CATEGORY && categoryId !== NEW_CATEGORY) {
      beforeNew.current = categoryId
    }

    setValue('categoryId', id, { shouldValidate: errors.categoryId !== undefined })

    if (id === NEW_CATEGORY) {
      requestAnimationFrame(() => {
        newNameRef.current?.focus()
      })
    }
  }

  const cancelNew = () => {
    setValue('newName', '')
    setValue('categoryId', beforeNew.current)
    clearErrors(['newName', 'categoryId'])
    requestAnimationFrame(() => {
      newChipRef.current?.focus()
    })
  }

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submit)(event)
      }}
      className="flex flex-col gap-4"
    >
      <Field
        label="Link"
        type="url"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="https://"
        error={errors.url?.message}
        {...register('url')}
      />
      <Field
        label="Title"
        autoComplete="off"
        placeholder="Morning yoga flow"
        error={errors.title?.message}
        {...register('title')}
      />

      <div
        role="group"
        aria-labelledby={categoryLabelId}
        aria-describedby={categoryError === undefined ? undefined : categoryErrorId}
        className="flex min-w-0 flex-col gap-2"
      >
        <MicroLabel id={categoryLabelId}>Category</MicroLabel>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={categoryId === category.id}
              onClick={() => {
                pick(category.id)
              }}
              className={cn(
                CHIP_CLASS,
                chipTone(categoryId === category.id),
                'max-w-full whitespace-normal',
              )}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{category.name}</span>
            </button>
          ))}
          {categoryId === NEW_CATEGORY ? null : (
            <button
              type="button"
              ref={newChipRef}
              aria-pressed={false}
              onClick={() => {
                pick(NEW_CATEGORY)
              }}
              className={cn(CHIP_CLASS, chipTone(false))}
            >
              + New
            </button>
          )}
        </div>
        {categoryId === NEW_CATEGORY ? (
          <>
            <div className="relative">
              <label htmlFor={newNameId} className="sr-only">
                New category name
              </label>
              <input
                id={newNameId}
                type="text"
                autoComplete="off"
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                placeholder="New category"
                aria-invalid={newNameError === undefined ? undefined : true}
                aria-describedby={newNameError === undefined ? undefined : `${newNameId}-error`}
                className={cn(
                  FIELD_INPUT_CLASS,
                  'pr-14',
                  newNameError === undefined ? 'border-border' : 'border-danger',
                )}
                ref={(element) => {
                  newNameField(element)
                  newNameRef.current = element
                }}
                {...newNameProps}
              />
              <button
                type="button"
                aria-label="Cancel new category"
                onClick={cancelNew}
                className="text-muted absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center text-xl"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {newNameError === undefined ? null : (
              <p id={`${newNameId}-error`} role="alert" className="text-danger text-xs">
                {newNameError}
              </p>
            )}
          </>
        ) : null}
        {categoryError === undefined ? null : (
          <p id={categoryErrorId} role="alert" className="text-danger text-xs">
            {categoryError}
          </p>
        )}
      </div>

      <Controller
        control={control}
        name="tags"
        render={({ field }) => (
          <TagInput
            value={field.value ?? []}
            onChange={field.onChange}
            suggestions={tags}
            error={errors.tags?.message ?? errors.tagDraft?.message}
            draft={tagDraft}
            onDraftChange={(next) => {
              setValue('tagDraft', next)
            }}
          />
        )}
      />

      <Controller
        control={control}
        name="priority"
        render={({ field }) => (
          <PriorityControl value={field.value ?? 'normal'} onChange={field.onChange} />
        )}
      />
    </form>
  )
}

export function SaveVideoSheet({ open, video, onClose, ...rest }: SaveVideoSheetProps) {
  const formId = useId()
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    onClose()
  }

  return (
    <SheetModal
      open={open}
      title={video === null ? 'Save a video' : 'Edit video'}
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
      <SaveVideoForm formId={formId} video={video} onClose={close} onError={setError} {...rest} />
    </SheetModal>
  )
}
