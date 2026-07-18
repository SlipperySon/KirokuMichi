/**
 * Simple Anki-style template renderer.
 * Replaces {{fieldName}} placeholders with HTML-escaped field values.
 * Strips <script> tags from the template structure for safety.
 */

/** Escape field values so card content cannot inject markup/scripts. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderTemplate(template: string, fields: Record<string, string>): string {
  // Replace {{fieldName}} with escaped field values
  let result = template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim()
    const value = fields[trimmed] ?? ''
    return escapeHtml(value)
  })

  // Strip <script> tags from template structure (basic XSS protection)
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  return result
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
