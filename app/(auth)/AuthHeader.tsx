import { BrandMark } from '../../components/ui/BrandMark'

export function AuthHeader() {
  return (
    <div className="mb-2 flex flex-col items-center text-center">
      <BrandMark className="mb-[18px]" />
      <h1 className="text-text text-[23px] font-bold tracking-[-0.6px]">Gym Tracker</h1>
      <p className="text-muted mt-2 text-[13px]">One log. Works with no signal in the gym.</p>
    </div>
  )
}
