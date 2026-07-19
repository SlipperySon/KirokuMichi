import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  extractFieldNames,
  renderTemplate,
  sanitizeTemplateCss,
  sanitizeTemplateHtml,
} from './templateRenderer'

describe('escapeHtml', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&#39;f')
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('こんにちは')).toBe('こんにちは')
  })
})

describe('renderTemplate', () => {
  it('substitutes escaped field values', () => {
    const html = renderTemplate('<div>{{front}}</div>', {
      front: '<script>alert(1)</script>',
    })
    expect(html).toBe('<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>')
    expect(html).not.toContain('<script>')
  })

  it('strips script tags from the template structure itself', () => {
    const html = renderTemplate('<p>{{front}}</p><script>evil()</script>', {
      front: 'ok',
    })
    expect(html).toBe('<p>ok</p>')
  })

  it('strips event-handler attributes and disallowed tags', () => {
    const html = sanitizeTemplateHtml('<div onclick="steal()"><img src=x onerror=alert(1)><b>ok</b></div>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('img')
    expect(html).toContain('<b>ok</b>')
  })

  it('uses empty string for missing fields', () => {
    expect(renderTemplate('{{missing}}', {})).toBe('')
  })
})

describe('sanitizeTemplateCss', () => {
  it('blocks import and url()', () => {
    const css = sanitizeTemplateCss('@import url("https://evil.test/x.css"); .x { color: red; background: url(https://evil.test/a) }')
    expect(css).not.toMatch(/@import/i)
    expect(css).not.toContain('https://evil.test')
    expect(css).toContain('color: red')
  })
})

describe('extractFieldNames', () => {
  it('returns unique trimmed field names', () => {
    expect(extractFieldNames('{{front}} {{ back }} {{front}}')).toEqual(['front', 'back'])
  })
})
