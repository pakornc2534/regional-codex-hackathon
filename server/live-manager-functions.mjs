import { llm } from '@livekit/agents'
import { z } from 'zod'
import { workspaceNames } from '../shared/shop-workspaces.mjs'
import { growthInputs } from './domain/live-manager-tools.mjs'
import { ownerProductSubject } from './live-manager-product-question.mjs'

const text = z.string().trim().min(1).max(100)
const page = {
  offset: z.number().int().min(0).optional().describe('ตำแหน่งเริ่มหน้าถัดไปจากผลลัพธ์'),
  limit: z.number().int().min(1).max(25).optional()
}
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const period = {
  from: date.optional().describe('วันเริ่มต้นตามนาฬิการ้าน YYYY-MM-DD ระบุคู่กับ to'),
  to: date.optional().describe('วันสิ้นสุดรวมในช่วง')
}
const channel = z.enum(['all','online','pos']).optional()
const quantity = z.number().int().min(0).optional()
const list = { id: text.optional(), query: text.optional(), ...page }
const byVariant = { variantId: text.optional() }
const byState = { status: text.optional() }
const orderStatus = z.enum(['picking','packing','ready','collected','transit','delivered','taken','cancelled','returned'])
const orderFilters = { ...list, ...byVariant, ...period, channel, status: orderStatus.optional() }
const planMode = z.enum(['ads','flash','marketing','investment'])
const assumptions = z.object(Object.fromEntries([...growthInputs].map(key =>
  [key, (key === 'supplyId' ? text : z.number().finite()).nullable().optional()]
))).strict()
const currentView = z.object({
  page: z.string().refine(name => Object.hasOwn(workspaceNames, name)),
  selectedVariantId: text.optional(),
  conversationId: text.optional(),
  plan: assumptions.extend({ variantId: text, mode: planMode }).optional()
}).strict()

export function createViewReader(room, identity) {
  return async () => {
    const raw = await room.localParticipant.performRpc({
      destinationIdentity: identity, method: 'raan.current-view', payload: '{}', responseTimeout: 3500
    })
    const view = currentView.parse(JSON.parse(raw))
    return { ...view, pageTitle: workspaceNames[view.page] }
  }
}

export function createShopTools(readStore, readView) {
  function reader(kind, description, parameters = {}) {
    return llm.tool({
      name: 'read_' + kind, description, parameters: z.object(parameters).strict(),
      execute: async (args, options) => {
        try {
          if (kind === 'catalog' && args.query) {
            const turn = options?.ctx?.session.history.items.findLast(item => item.type === 'message' && item.role === 'user')
            const query = ownerProductSubject(args.query, turn?.textContent)
            const result = await readStore({ ...args, kind, query })
            if (!result.data.matching) {
              return { ...result, searchedFor: query, catalogFinding: 'ตรวจแค็ตตาล็อกร้านแล้ว ไม่พบรายการที่ตรงกับ “' + query + '” ตามเงื่อนไขที่ค้น' }
            }
            return { ...result, searchedFor: query }
          }
          return await readStore({ ...args, kind })
        }
        catch (error) { return { error: error.message || 'อ่านข้อมูลร้านไม่สำเร็จ' } }
      }
    })
  }

  return [
    llm.tool({
      name: 'read_current_view',
      description: 'ดูหน้าที่เปิด สินค้าบนแท่น ห้องลูกค้าที่เลือก และสมมติฐานแผนบนหน้าจอ ใช้ read_inbox กับ conversationId หรือ read_growth กับแผนหากต้องการรายละเอียด',
      parameters: z.object({}).strict(),
      execute: async () => {
        try {
          const view = await readView()
          if (!view.selectedVariantId) return { ...view, selectedProduct: null }
          const catalog = await readStore({ kind: 'products', query: view.selectedVariantId })
          const selectedProduct = catalog.data.find(row => row.id === view.selectedVariantId) ?? null
          return { ...view, selectedProduct, observedAt: catalog.observedAt }
        } catch { return { error: 'ยังอ่านหน้าหรือสินค้าที่เลือกไม่ได้ กรุณาระบุชื่อหรือ SKU' } }
      }
    }),
    reader('catalog', 'ค้นแค็ตตาล็อกทั้งร้านด้วยคำเรียกไทย อังกฤษ รุ่น ชื่อสินค้า หมวดหรือ SKU ดูสินค้าในช่วงราคา/จำนวนเหลือ ถามว่าขายอะไรให้เว้น query ผลลัพธ์มีหมวดและสินค้าที่ร้านขายจริงแม้คำค้นไม่ตรง', {
      query: text.optional(), minPrice: z.number().nonnegative().optional(), maxPrice: z.number().nonnegative().optional(),
      minAvailable: quantity, maxAvailable: quantity, ...page
    }),
    reader('summary', 'ภาพรวมร้าน ยอดขายแยกออนไลน์และหน้าร้านตามช่วงเวลา ยอด 7 วัน คิวงาน กำลังแพ็ก และเวลาจำลอง', period),
    reader('sales', 'รายงานผลการขายรายวันและสินค้าไหนขายดี จัดอันดับตามข้อมูลที่ชำระแล้ว เลือกช่วงวันและช่องทาง', { ...period, channel, ...byVariant, ...page }),
    reader('finance', 'เงินเข้า เงินรอรับ ยอดขายกับวันที่รับเงินจริง เงินตั้งต้น และข้อจำกัดข้อมูลกำไร', { ...period, channel }),
    reader('health', 'สุขภาพบัญชี แหล่งที่มา เวลาตรวจ เกินกำหนด สต็อกซิงก์พลาด และต้นทุนที่ยังไม่ทราบ'),
    reader('inventory', 'สต็อกกลาง เทียบของจริง ของจอง ของพร้อมขายและสถานะซิงก์ออนไลน์ของแต่ละรุ่น', { query: text.optional(), ...byVariant, status: text.optional().describe('low_stock, out_of_stock หรือสถานะซิงก์'), ...page }),
    reader('movements', 'ประวัติสต็อกเปลี่ยนจากเท่าไรเป็นเท่าไรและสาเหตุ เลือกรุ่นจากแค็ตตาล็อก', { query: text.optional(), ...byVariant, ...byState, ...period, ...page }),
    reader('orders', 'รายการและรายละเอียดออเดอร์ สินค้า ยอดเงิน และกำหนดเตรียมส่ง ค้นด้วยเลขออเดอร์หรือขั้นตอน', orderFilters),
    reader('fulfillment', 'งานส่งของ คิวหยิบ โต๊ะแพ็ก รอขนส่ง ขนส่งรับแล้ว ของระหว่างทาง ดูเส้นเวลาและเลขติดตามด้วยเลขออเดอร์', { ...orderFilters, status: z.union([orderStatus, z.literal('overdue')]).optional() }),
    reader('returns', 'ของคืน กำลังกลับ รอตรวจ ผลตรวจและผลต่อสต็อก', { ...list, ...byVariant, ...byState }),
    reader('supplies', 'วัสดุแพ็ก จำนวนคงเหลือ จอง พร้อมใช้ ระยะเวลาที่พอและวันควรสั่งเพิ่ม', list),
    reader('campaigns', 'สถานะแคมเปญ งบต่อวัน ค่าโฆษณา ยอดขายที่มาจากโฆษณาและสินค้าที่ร่วม', { ...list, ...byVariant, ...byState }),
    reader('growth', 'ทดลองคำนวณแผนยิงแอด แฟลชเซล การตลาดหรือลงทุนจากเครื่องคิดเลขของร้าน ใช้ variantId จากแค็ตตาล็อก และสมมติฐานที่เจ้าของระบุเท่านั้น อัตราส่วน 0 ถึง 1', {
      variantId: text, mode: planMode, inputs: assumptions.optional()
    }),
    reader('plans', 'ดูแผนที่ร้านบันทึกไว้และรายละเอียดผลประเมิน', { id: text.optional(), ...byVariant, mode: planMode.optional(), ...page }),
    reader('cases', 'รายการเคสร้านที่รอจัดการ เลือก id ไปอ่านหลักฐานและตัวเลือกใน read_case_detail', { ...list, ...byVariant, ...byState }),
    reader('case_detail', 'รายละเอียดเคส หลักฐาน ข้อเสนอ ตัวเลือกและสถานะอนุมัติ', { id: text, ...page }),
    reader('inbox', 'กล่องข้อความร้านจำลอง ดูหัวข้อและคนดูแลห้อง หรือใช้ id ของห้องเพื่ออ่านข้อความในห้องนั้น', { ...list, status: z.enum(['agent','human']).optional() }),
    reader('policies', 'กฎที่เจ้าของอนุญาตให้ผู้จัดการทำงานเองและขอบเขตของกฎ', { ...list, ...byVariant, status: z.enum(['enabled','disabled']).optional() }),
    reader('memories', 'ข้อมูลและข้อจำกัดที่เจ้าของบันทึกเป็นความจำร้าน', list),
    reader('briefs', 'บรีฟประจำวัน 07.00 น. และสถานะการส่งในร้านจำลอง', { id: text.optional(), ...byState, ...period, ...page }),
    reader('news', 'ข่าวที่ร้านจำลองบันทึกไว้และวันที่ตรวจ หากถามข้อมูลปัจจุบันให้ค้นเว็บเพิ่ม', list),
    reader('competitors', 'ข้อมูลเปรียบเทียบคู่แข่งที่บันทึกในร้านจำลอง ใช้ search_public_market เพิ่มเมื่อวิเคราะห์คู่แข่งภายนอกวันนี้', list),
    reader('settings', 'ข้อมูลร้าน โหมดจำลอง การตั้งค่าการทำงาน เวลาของร้าน ข้อมูลตั้งต้นและแหล่งข้อมูล'),
    reader('dot', 'ยอดซื้อพุ่ง เกณฑ์แจ้งเตือน และรายการที่ควรทำตอนเช้าตามหน้าแจ้งเตือน Dot ของร้าน'),
    reader('activity', 'ดูประวัติการทำงานของร้านและผลการดำเนินการที่ตรวจแล้วตามเวลา ผู้ทำ หรือเคส', { ...list, ...byState, ...period }),
    reader('scene', 'แผนผังร้าน 3D และหน้าที่ของแต่ละจุด สินค้าบนแท่นให้ใช้ read_current_view เพิ่ม')
  ]
}
