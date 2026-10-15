import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MAX_EXPLAINED, ZONE_MEANING, ZoneInfoButton } from './ZoneInfo'

describe('ZoneInfoButton', () => {
  it('opens the zone sheet when pressed', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByRole('dialog', { name: 'Heart rate zones' })).toBeInTheDocument()
  })

  it('explains each of the 4 zones in one sentence', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    for (const sentence of Object.values(ZONE_MEANING)) {
      expect(screen.getByText(sentence)).toBeInTheDocument()
    }
  })

  it('says how the max heart rate is found', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByText(MAX_EXPLAINED)).toBeInTheDocument()
  })

  it('names the bpm range of each zone when the max is known', async () => {
    render(<ZoneInfoButton maxHeartRate={{ bpm: 190, source: 'age' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByText('Cardio, 133–161 bpm')).toBeInTheDocument()
    expect(screen.getByText('Based on a max of 190 bpm, from your birth year.')).toBeInTheDocument()
  })

  it('asks for the birth year when the max is not known', async () => {
    render(<ZoneInfoButton maxHeartRate={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'What the zones mean' }))
    expect(screen.getByText('Add your birth year in Profile for real zones.')).toBeInTheDocument()
  })

  it('opens with the keyboard and gives focus back to the button on close', async () => {
    const user = userEvent.setup()
    render(<ZoneInfoButton maxHeartRate={null} />)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Heart rate zones' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'What the zones mean' })).toHaveFocus()
  })
})
