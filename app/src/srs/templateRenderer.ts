/**
 * Anki-style template renderer.
 * Field values are HTML-escaped; template structure and CSS are sanitized
 * before use with dangerouslySetInnerHTML / <style>.
 */

const ALLOWED_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'u', 's', 'br', 'p', 'div', 'span', 'hr',
  'ul', 'ol', 'li', 'ruby', 'rt', 'rp', 'sub', 'sup', 'small', 'mark',
])

/** Escape field values so card content cannot inject markup/scripts. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip dangerous tags/attrs from template HTML structure (not field values). */
export function sanitizeTemplateHtml(html: string): string {
  let result = html
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove dangerous elements including their inner content where relevant.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:iframe|object|embed|svg|math|foreignObject)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|svg|math|foreignObject)>/gi, '')
    .replace(/<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|style|svg|math|foreignObject)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|(?:javascript|vbscript|data):[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  result = result.replace(/<\/?([a-zA-Z][\w:-]*)\b([^>]*)>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (match.startsWith('</')) return `</${tag}>`
    const safeAttrs = [...attrs.matchAll(/\s(lang|class|dir)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)]
      .map(a => ` ${a[1].toLowerCase()}=${a[2]}`)
      .join('')
    const selfClose = /\/\s*$/.test(attrs) || tag === 'br' || tag === 'hr' ? ' /' : ''
    return `<${tag}${safeAttrs}${selfClose}>`
  })

  return result
}

/** Allow only inert presentation rules — no imports, urls, or expression(). */
export function sanitizeTemplateCss(css: string): string {
  if (!css) return ''
  let out = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/@charset\b[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/url\s*\(\s*[^)]*\)/gi, 'url(about:blank)')
    .replace(/-moz-binding\s*:[^;}]*/gi, '')
    .replace(/behavior\s*:[^;}]*/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/vbscript\s*:/gi, 'blocked:')
  if (out.length > 8000) out = out.slice(0, 8000)
  return out
}

export function renderTemplate(template: string, fields: Record<string, string>): string {
  let result = template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim()
    const value = fields[trimmed] ?? ''
    return escapeHtml(value)
  })

  return sanitizeTemplateHtml(result)
}

/** Built-in field names that every card has */
export const BUILTIN_FIELDS = ['front', 'back', 'reading'] as const
export type BuiltinField = typeof BUILTIN_FIELDS[number]

/** Extract field names from a template string */
export function extractFieldNames(template: string): string[] {
  const matches = template.matchAll(/\{\{([^}]+)\}\}/g)
  const names = new Set<string>()
  for (const m of matches) {
    names.add(m[1].trim())
  }
  return [...names]
}
