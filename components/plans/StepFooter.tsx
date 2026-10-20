import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'

export type StepFooterProps = {
  nextName: string | undefined
  busy?: boolean
  onSkip: () => void
  onNext: () => void
  onFinish: () => void
}

export function StepFooter({ nextName, busy = false, onSkip, onNext, onFinish }: StepFooterProps) {
  return (
    <div
      data-testid="step-footer"
      className="border-border bg-ground fixed inset-x-0 bottom-0 z-30 border-t px-5 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] md:px-7 lg:static lg:border-t-0 lg:bg-transparent lg:p-0"
    >
      {nextName === undefined ? (
        <div className="mx-auto w-full max-w-xl">
          <PrimaryButton disabled={busy} onClick={onFinish}>
            Finish session
          </PrimaryButton>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-xl grid-cols-[1fr_2fr] gap-2.5 lg:grid-cols-1 lg:gap-3">
          <SecondaryButton disabled={busy} onClick={onSkip} className="lg:order-last">
            <span>
              Skip<span className="hidden lg:inline"> this step</span>
            </span>
          </SecondaryButton>
          <PrimaryButton disabled={busy} onClick={onNext} className="flex-col gap-px">
            Next step
            <span className="max-w-full text-[11px] font-medium break-words opacity-75">
              {nextName}
            </span>
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}
