const words = new Intl.Segmenter('th', {granularity:'word'})

// Alternative spoken spellings resolve to catalog labels. They never add items to the shop.
const pronunciations = [
  [/โซนิคส์|โซนิ[คก]/gu,'sonic'],
  [/เฮลโล[่ว]?\s*คิตตี้/gu,'hello kitty'],
  [/คิตตี้/gu,'kitty'],
  [/คิส\s*มี/gu,'kiss me'],
  [/บีเอ็นเค\s*(?:สี่สิบแปด|48)/gu,'bnk48'],
  [/แผ่นซีดี|ซีดี/gu,'cd'],
  [/โฟโต้\s*บุ๊[คก]|โฟโต\s*บุ๊ก/gu,'photobook'],
]
const questionWords = new Set([
  'ช่วย','กรุณา','อยาก','ทราบ','ถาม','ขอ','ดู','หา','ค้น','ตรวจ','เช็ค','เช็ก','ราคา',
  'ใน','ที่','ทาง','ร้าน','เรา','มี','ยัง','เหลือ','ขาย','อยู่','ไหม','มั้ย','มั๊ย','หรือ','เปล่า','ให้','หน่อย','ด้วย',
  'รายการ','ทั้งหมด','ว่า','เท่า','ไหร่','เท่าไร','กี่','ชิ้น','บ้าง','อะไร','ครับ','ค่ะ','คะ','นะ','จ้า','จ๊ะ','sku','รหัส','สินค้า','รุ่น','แบบ','ของ',
])
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('th').trim()

function searchWords(value, question = false) {
  let text = normalize(value)
  for (const [pattern, name] of pronunciations) text = text.replace(pattern, ' ' + name + ' ')
  if (question) {
    // Separating common question phrases first avoids ambiguous Thai word breaks next to product names.
    text = text.replace(/(?:ช่วย(?:ตรวจสอบ|เช็ก|เช็ค|ดู)?|เช็[กค])?ราคา|ยังมีของไหม|มีรุ่นอะไรบ้าง|รุ่นไหนบ้าง|แค็ตตาล็อก|แคตตาล็อก/gu,' ')
  }
  return [...words.segment(text)].filter(word => word.isWordLike).map(word => word.segment)
}

function numberFilter(value, label, integer = false) {
  if (value === undefined) return
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) throw Error(label + 'ไม่ถูกต้อง')
  return value
}

function within(value, min, max) {
  if (min === undefined && max === undefined) return true
  return Number.isFinite(value) && (min === undefined || value >= min) && (max === undefined || value <= max)
}

function score(row, query, terms) {
  const fields = [row.id, row.productId, row.sellerSku, row.productName, row.name, row.category]
  if (fields.some(value => normalize(value) === query)) return {matched:true, overlap:terms.length}
  const labels = [row.sellerSku, row.productName, row.name, row.category]
  if (query.length >= 3 && labels.some(value => normalize(value).includes(query))) return {matched:true, overlap:terms.length}
  const vocabulary = new Set(labels.flatMap(value => searchWords(value)))
  const overlap = terms.filter(term => vocabulary.has(term)).length
  return {matched:terms.length > 0 && overlap === terms.length, overlap}
}

export function readManagerCatalog(world, input = {}) {
  if (input.query !== undefined && (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 120)) {
    throw Error('คำค้นสินค้าไม่ถูกต้อง')
  }
  const query = normalize(input.query)
  const terms = [...new Set(searchWords(query, true).filter(word => !questionWords.has(word)))]
  const wantsList = !query || (!terms.length && /แค็ตตาล็อก|แคตตาล็อก|สินค้า|ทั้งหมด|อะไร.*บ้าง|กี่รุ่น/u.test(query))
  const exactCategory = world.products.some(product => normalize(product.category) === query)
  const limit = numberFilter(input.limit === undefined ? 15 : input.limit, 'จำนวนรายการ', true)
  const offset = numberFilter(input.offset === undefined ? 0 : input.offset, 'ตำแหน่งรายการ', true)
  if (limit < 1 || limit > 25) throw Error('ระบุจำนวนรุ่นสินค้าระหว่าง 1 ถึง 25')
  const minPrice = numberFilter(input.minPrice, 'ราคาขั้นต่ำ')
  const maxPrice = numberFilter(input.maxPrice, 'ราคาสูงสุด')
  const minAvailable = numberFilter(input.minAvailable, 'สต็อกขั้นต่ำ', true)
  const maxAvailable = numberFilter(input.maxAvailable, 'สต็อกสูงสุด', true)
  if (minPrice > maxPrice || minAvailable > maxAvailable) throw Error('ค่าต่ำสุดต้องไม่เกินค่าสูงสุด')

  const matches = []
  const alternatives = new Map()
  const categories = new Set()
  let variantCount = 0
  for (const product of world.products) {
    categories.add(product.category)
    variantCount += product.variants.length
    for (const {id,sellerSku,name,price,cost,available,physical,reserved,updatedAt} of product.variants) {
      if (!within(price, minPrice, maxPrice) || !within(available, minAvailable, maxAvailable)) continue
      const row = {id,productId:product.id,productName:product.name,category:product.category,
        sellerSku,name,price,cost,available,physical,reserved,updatedAt}
      const {matched, overlap} = wantsList ? {matched:true, overlap:0} : score(row, query, terms)
      if (matched && (!exactCategory || normalize(product.category) === query)) matches.push(row)
      else if (!alternatives.has(product.name) || overlap > alternatives.get(product.name).overlap) {
        alternatives.set(product.name, {name:product.name, category:product.category, overlap})
      }
    }
  }
  const items = matches.slice(offset, offset + limit)
  const suggestions = []
  if (!matches.length) {
    const shownCategories = new Set()
    for (const alternative of [...alternatives.values()].sort((a,b) => b.overlap - a.overlap)) {
      if (!alternative.overlap && shownCategories.has(alternative.category)) continue
      suggestions.push(alternative.name)
      shownCategories.add(alternative.category)
      if (suggestions.length === 4) break
    }
  }
  return {
    matching:matches.length, items,
    nextOffset:offset + items.length < matches.length ? offset + items.length : null,
    catalog:{productCount:world.products.length,variantCount,categories:[...categories]},
    suggestions,
  }
}
