import { Card } from '../ui/Card'
import { MicroLabel } from '../ui/MicroLabel'

export type NoteCardProps = { note: string; className?: string }

export function NoteCard({ note, className }: NoteCardProps) {
  return (
    <Card className={className}>
      <h2>
        <MicroLabel>Note</MicroLabel>
      </h2>
      <p className="text-text mt-1.5 text-sm break-words whitespace-pre-line">{note}</p>
    </Card>
  )
}
