/**
 * Simple Anki-style template renderer.
 * Replaces {{fieldName}} placeholders with values from the fields map.
 * Strips <script> tags for safety.
 */
export function renderTemplate(template: string, fields: Record<string, string>): string {
  // Replace {{fieldName}} with field values
  let result = template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim()
    return fields[trimmed] ?? ''
  })

  // Strip <script> tags (basic XSS protection)
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
