import { describe, expect, it } from 'vitest'

import { weightList } from './weights'

describe('weightList', () => {
  it('lists dumbbells from 2.5 to 50 kg in 2.5 kg steps', () => {
    const list = weightList('dumbbell')

    expect(list).toHaveLength(20)
    expect(list.slice(0, 3)).toEqual([2.5, 5, 7.5])
    expect(list.at(-1)).toBe(50)
  })

  it('lists cable weights from 5 to 100 kg in 5 kg steps', () => {
    const list = weightList('cable')

    expect(list).toHaveLength(20)
    expect(list.slice(0, 2)).toEqual([5, 10])
    expect(list.at(-1)).toBe(100)
  })

  it('lists machine weights the same as cable weights', () => {
    expect(weightList('machine')).toEqual(weightList('cable'))
  })

  it('lists barbell weights from 20 to 150 kg in 2.5 kg steps', () => {
    const list = weightList('barbell')

    expect(list).toHaveLength(53)
    expect(list.slice(0, 2)).toEqual([20, 22.5])
    expect(list.at(-1)).toBe(150)
  })

  it('lists no weight for a body-weight step', () => {
    expect(weightList('body only')).toEqual([])
  })
})
