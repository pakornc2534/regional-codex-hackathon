import {bahtAmount} from './baht.mjs'

export const customerCatalog = world => (world.products ?? []).flatMap(product =>
  product.variants.map(({sellerSku:sku,name:variant,price,available}) => ({sku,name:product.name,variant,price,available})))
const normalize = value => value.normalize('NFKC').toLowerCase()
export const catalogReply = rows => rows.length ? rows.map(({sku,name,variant,price,available}) =>
  [name + ' (' + sku + ')', variant,
    price == null ? 'ยังไม่มีข้อมูลราคา' : 'ราคา ฿' + bahtAmount(price),
    available == null ? 'ยังไม่มีข้อมูลสต็อก' : available > 0 ? 'เหลือขาย ' + available + ' ชิ้น' : 'สินค้าหมด'].filter(Boolean).join(' · ')
).join('\n') : 'ระบุชื่อสินค้า รุ่น หรือรหัส SKU ที่สนใจได้เลยครับ'

const faq = [
  [/ร้านจริง|ข้อมูลจริง|ข้อมูลจำลอง|(?:ใช่|เป็น)ร้าน.*shopee|เชื่อม.*shopee/i,
    'แชทนี้ใช้ข้อมูลร้านจำลองสำหรับทดลองถามสินค้าและเช็กสต็อกครับ'],
  [/สั่ง(ซื้อ|ของ)(ยังไง|อย่างไร|ได้ไหม)|วิธี(สั่ง|ซื้อ)|ซื้อ(ยังไง|อย่างไร|ได้ไหม)|ชำระเงิน|จ่ายเงิน|โอนเงิน|เก็บเงินปลายทาง/u,
    'หน้านี้ใช้ทดลองถามข้อมูลสินค้า การสั่งซื้อและจ่ายเงินจริงต้องทำผ่านช่องทางของร้านที่คุณซื้อครับ'],
  [/จัดส่ง|ส่งของ|ส่งไหม|กี่วันถึง|ค่าส่ง|ส่งฟรี|ส่งทางไหน|เลขพัสดุ|ติดตามพัสดุ/u,
    'เดโมนี้ไม่มีค่าส่งหรือกำหนดจัดส่งจริงครับ ถ้าซื้อผ่าน Shopee ให้ดูค่าส่งและวันถึงโดยประมาณในหน้าชำระเงิน หรือติดตามพัสดุจากหน้าคำสั่งซื้อ'],
  [/คืนสินค้า|คืนเงิน|เปลี่ยนสินค้า|รับประกัน/u,
    'เดโมนี้ไม่มีนโยบายคืนสินค้า คืนเงิน หรือรับประกันสำหรับการซื้อจริงครับ ให้ตรวจเงื่อนไขในช่องทางที่สั่งซื้อ'],
]
export const customerCompleted = (text, source = 'catalog') => ({status:'completed',text,source})


export function customerQuestion(input) {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message || message.length > 300) throw Error('พิมพ์คำถามไม่เกิน 300 ตัวอักษร')
  return message
}

export function customerFaq(message) {
  const query = normalize(message)
  const answer = faq.find(([pattern]) => pattern.test(query))
  if (answer) return customerCompleted(answer[1])
  if (!/[\p{L}\p{N}]/u.test(query) || /^(?:สวัสดี|หวัดดี|ขอบคุณ|hello|hi|thanks)(?:ครับ|ค่ะ|คะ)?[.! ]*$/u.test(query)) {
    return customerCompleted(catalogReply([]))
  }
}

export function matchCustomerProducts(message, rows) {
  const query = normalize(message)
  const words = query.split(/[^a-z0-9-]+/)
  const exact = rows.filter(row => words.includes(normalize(row.sku)))
  return exact.length ? exact : rows.filter(row => {
    const name = normalize(row.name)
    return query.includes(name) || (query.includes('kiss me') && name.includes('kiss me'))
      || (query.includes('หุ่นยนต์') && name.includes('หุ่นยนต์'))
      || (words.includes('sonic') && name.includes('sonic'))
  })
}
