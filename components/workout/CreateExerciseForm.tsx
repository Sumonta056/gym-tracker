'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { exerciseSchema } from '../../lib/schema/exercise'
import { Field } from '../ui/Field'
import { MicroLabel } from '../ui/MicroLabel'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

import { MuscleGroupChips } from './MuscleGroupChips'

import type { Exercise } from '../../lib/db/dexie'
import type { ExerciseInput, MuscleGroup } from '../../lib/schema/exercise'
import type { z } from 'zod'

export const createExerciseSchema = exerciseSchema.pick({ name: true, muscle_group: true })

type CreateExerciseValues = z.input<typeof createExerciseSchema>

type CreateExerciseOutput = z.output<typeof createExerciseSchema>

export const CREATE_FAILED = 'The exercise could not be saved. Try again.'

export type CreateExerciseFormProps = {
  id: string
  initialName?: string
  initialMuscleGroup?: MuscleGroup
  onCreate: (input: ExerciseInput) => Promise<Exercise>
  onCreated: (exercise: Exercise) => void
}

export type CreateExerciseActionsProps = {
  formId: string
  onCancel: () => void
}

export function CreateExerciseActions({ formId, onCancel }: CreateExerciseActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <PrimaryButton type="submit" form={formId}>
        Create and pick
      </PrimaryButton>
      <SecondaryButton onClick={onCancel}>Back to the list</SecondaryButton>
    </div>
  )
}

export function CreateExerciseForm({
  id,
  initialName = '',
  initialMuscleGroup,
  onCreate,
  onCreated,
}: CreateExerciseFormProps) {
  const groupLabelId = useId()
  const groupErrorId = useId()
  const saving = useRef(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setFocus,
  } = useForm<CreateExerciseValues, unknown, CreateExerciseOutput>({
    resolver: zodResolver(createExerciseSchema),
    defaultValues: { name: initialName, muscle_group: initialMuscleGroup },
  })

  useEffect(() => {
    setFocus('name')
  }, [setFocus])

  const save = (values: CreateExerciseOutput) => {
    if (saving.current) {
      return Promise.resolve()
    }

    saving.current = true
    setSaveError(null)

    return onCreate({ ...values, is_archived: false }).then(onCreated, (reason: unknown) => {
      saving.current = false
      setSaveError(
        reason instanceof Error && reason.message !== '' ? reason.message : CREATE_FAILED,
      )
    })
  }

  const groupError = errors.muscle_group?.message

  return (
    <form
      id={id}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(save)(event)
      }}
      className="flex flex-col gap-4"
    >
      <Field
        label="Name"
        autoComplete="off"
        placeholder="Incline dumbbell press"
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="flex flex-col gap-[7px]">
        <MicroLabel id={groupLabelId}>Muscle group</MicroLabel>
        <Controller
          control={control}
          name="muscle_group"
          render={({ field }) => (
            <MuscleGroupChips
              includeAll={false}
              labelledBy={groupLabelId}
              describedBy={groupError === undefined ? undefined : groupErrorId}
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next)
              }}
            />
          )}
        />
        {groupError === undefined ? null : (
          <p id={groupErrorId} role="alert" className="text-danger text-xs">
            {groupError}
          </p>
        )}
      </div>

      {saveError === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {saveError}
        </p>
      )}
    </form>
  )
}
