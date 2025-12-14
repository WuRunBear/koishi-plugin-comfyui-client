export function sanitizeUserPrompt(input: string) {
  if (!input) return ''
  return input
    .replaceAll('\n', ' ')
    .replaceAll('"', '\\\"')
    .replace(/\\/g, '\\\\')
}

export function applyPlaceholders(template: string, values: Record<string, string | number>) {
  let result = template
  for (const [key, val] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, String(val))
  }
  return result
}