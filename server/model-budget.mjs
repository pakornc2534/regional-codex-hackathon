import {mkdirSync, readFileSync} from 'node:fs'
import {resolve, join} from 'node:path'
import {bangkokDate} from './domain/simulator.mjs'
import {writeAtomicJson} from './persistence.mjs'

export class ModelAccessError extends Error {
  constructor(message, status = 503) {
    super(message)
    this.status = status
  }
}

// All manager and customer jobs run in one Node service per persistent shop.
// The synchronous read/rename reserves capacity before another job can start.
export function createModelBudget(env = process.env, now = () => new Date()) {
  const directory = resolve(env.DATA_DIR || '.data')
  const file = join(directory, 'ai-meter.json')

  function check() {
    if (env.DEMO_AI_ENABLED === 'false') throw new ModelAccessError('ร้านปิดการใช้ AI ชั่วคราว')
    const cap = Number(env.AI_DAILY_CAP ?? 120)
    if (!Number.isSafeInteger(cap) || cap < 0 || env.AI_DAILY_CAP?.trim() === '') {
      throw new ModelAccessError('ตั้งค่าเพดานการใช้ AI ไม่ถูกต้อง')
    }
    const date = bangkokDate(now())
    let calls = 0
    try {
      const record = JSON.parse(readFileSync(file, 'utf8'))
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record?.date) || !Number.isSafeInteger(record.calls) || record.calls < 0) {
        throw Error('Invalid meter')
      }
      if (record.date === date) calls = record.calls
    } catch (error) {
      if (error.code !== 'ENOENT') throw new ModelAccessError('อ่านยอดการใช้ AI ไม่สำเร็จ')
    }
    if (calls >= cap) throw new ModelAccessError('ถึงเพดานการใช้ AI ของวันนี้แล้ว ลองใหม่หลังเที่ยงคืนตามเวลาไทย', 429)
    return {date, calls}
  }

  function reserve() {
    const {date, calls} = check()
    try {
      mkdirSync(directory, {recursive:true, mode:0o700})
      writeAtomicJson(file, {date, calls:calls + 1})
    } catch {
      throw new ModelAccessError('บันทึกยอดการใช้ AI ไม่สำเร็จ')
    }
  }
  return {check, reserve}
}
