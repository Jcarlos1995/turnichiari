/**
 * Removes accents and non-letter characters, converts to lowercase.
 * e.g. "Rè" → "re", "D'Angelo" → "dangelo"
 */
export function normalizeStr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z]/g, '')           // keep only a-z
}

/**
 * Generates a deterministic username from nome and cognome.
 * Formula: normalizeStr(cognome)[0:5] + normalizeStr(nome)[0:3]
 *
 * Examples:
 *   generateUsername('Mario', 'Rossi')   → 'rossimar'
 *   generateUsername('Sonila', 'Mucka')  → 'muckason'
 *   generateUsername('Ana', 'Rè')        → 'reana'
 */
export function generateUsername(nome: string, cognome: string): string {
  return normalizeStr(cognome).slice(0, 5) + normalizeStr(nome).slice(0, 3)
}
