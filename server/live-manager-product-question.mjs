// In a Thai availability question the final ไหม can be a question particle or part of a product name (silk).
// Resolve only against the owner's sentence; standalone catalog names are left intact.
export function ownerProductSubject(candidate, question) {
  if (typeof candidate !== 'string' || typeof question !== 'string') return candidate
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('th').trim()
  const utterance = normalize(question)
  const match = utterance.match(/^(?:(?:ที่|ใน|ทาง)?ร้าน(?:เรา|นี้)?\s*)?(?:ตอนนี้\s*)?(?:ยัง)?มี\s*(?:สินค้า(?:ชื่อ)?\s*)?(.{1,90}?)(มีขาย|ขายอยู่|อยู่ในร้าน|ขาย|อยู่)?\s*(ไหม|มั้ย|มั๊ย|หรือเปล่า)(?=$|[\s?？.,]|คะ|ค่ะ|ครับ|จ๊ะ|จ้ะ|แล้ว|ถ้า|ช่วย|ราคา)/u)
  if (!match) return candidate
  const name = match[1].trim()
  if (!name) return candidate
  const phrase = normalize(candidate).replace(/\s+/gu,'')
  const withParticle = (name + match[3]).replace(/\s+/gu,'')
  const withVerb = (name + (match[2] || '') + match[3]).replace(/\s+/gu,'')
  return phrase === withParticle || phrase === withVerb || normalize(candidate) === utterance ? name : candidate
}
