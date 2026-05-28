import { normalizeStr, generateUsername } from '../username'

describe('normalizeStr', () => {
  it('converts to lowercase', () => {
    expect(normalizeStr('ROSSI')).toBe('rossi')
  })
  it('removes accents: è→e, à→a, ù→u, ì→i, ò→o', () => {
    expect(normalizeStr('àèìòù')).toBe('aeiou')
  })
  it('removes accent from real Italian names', () => {
    expect(normalizeStr('Rè')).toBe('re')
    expect(normalizeStr('José')).toBe('jose')
    expect(normalizeStr('Müller')).toBe('muller')
  })
  it('removes non-letter characters', () => {
    expect(normalizeStr("D'Angelo")).toBe('dangelo')
    expect(normalizeStr('van der Berg')).toBe('vanderberg')
  })
  it('handles empty string', () => {
    expect(normalizeStr('')).toBe('')
  })
})

describe('generateUsername', () => {
  it('Mario Rossi → rossimar (5 cognome + 3 nome)', () => {
    expect(generateUsername('Mario', 'Rossi')).toBe('rossimar')
  })
  it('Sonila Mucka → muckason', () => {
    expect(generateUsername('Sonila', 'Mucka')).toBe('muckason')
  })
  it('removes accents: Ana Rè → reana', () => {
    expect(generateUsername('Ana', 'Rè')).toBe('reana')
  })
  it('short names: Ed Li → lied (no padding)', () => {
    expect(generateUsername('Ed', 'Li')).toBe('lied')
  })
  it('long names get truncated: cognome max 5, nome max 3', () => {
    // "Castellano"→"caste", "Alessandro"→"ale"
    expect(generateUsername('Alessandro', 'Castellano')).toBe('casteale')
  })
  it('single-letter names: X Y → yx', () => {
    expect(generateUsername('X', 'Y')).toBe('yx')
  })
})
