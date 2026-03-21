const lowerWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

export function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
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
}

export function toInstitutionalText(value: string) {
  return toTitleCase(value)
}

export function toEmailCase(value: string) {
  return value.trim().toLowerCase()
}
