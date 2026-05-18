import { describe, expect, it, vi } from 'vitest'
import { KeyboardShortcutManager } from './keyboard-shortcuts'

describe('KeyboardShortcutManager', () => {
  it('does not intercept typing spaces inside text inputs', () => {
    const manager = new KeyboardShortcutManager()
    const callback = vi.fn()
    manager.on('show-answer', callback)

    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)

    expect(callback).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)

    input.remove()
  })

  it('still handles review shortcuts outside editable fields', () => {
    const manager = new KeyboardShortcutManager()
    const callback = vi.fn()
    manager.on('show-answer', callback)

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(event)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })
})
