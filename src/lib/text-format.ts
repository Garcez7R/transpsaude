const lowerWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

export function toTitleCase(value: string) {
  const withoutLeadingSpaces = value.replace(/^\s+/g, '')
  const hasTrailingSpace = /\s$/.test(withoutLeadingSpaces)
  const collapsed = withoutLeadingSpaces
    .replace(/\s+/g, ' ')
    .replace(/\s$/g, '')

  if (!collapsed) {
    return ''
  }

  const formatted = collapsed
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase()

      if (index > 0 && lowerWords.has(lower)) {
        return lower
      }

      if (lower.length <= 2 && lower === lower.toUpperCase()) {
        return lower.toUpperCase()
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')

  return hasTrailingSpace ? `${formatted} ` : formatted
}

export function toInstitutionalText(value: string) {
  return toTitleCase(value)
}

export function toEmailCase(value: string) {
  return value.trim().toLowerCase()
}
