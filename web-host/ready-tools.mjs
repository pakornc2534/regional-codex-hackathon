import { z } from 'zod'
import { executeShopTool, parseShopView, shopToolDefinitions } from '../server/live-manager-definitions.mjs'
import { readLiveManagerTool } from '../server/domain/live-manager-tools.mjs'
import { marketToolDefinition, searchPublicMarket } from '../server/live-manager-web-search.mjs'
import { authorizeReadySession, consumeReadySearch } from './ready-session.mjs'
import { bounded } from './codec.mjs'

const definitions = new Map([...shopToolDefinitions, marketToolDefinition].map(tool => [tool.name, tool]))

export const readyToolSchemas = Array.from(definitions.values(), ({ name, description, parameters }) => {
  // Realtime accepts the object schema; the JSON Schema dialect declaration is unnecessary.
  const { $schema, ...schema } = z.toJSONSchema(parameters, { io: 'input' })
  return { type: 'function', name, description, parameters: schema }
})

const requestSchema = z.object({
  session: z.string().min(1).max(8192),
  name: z.string().max(100),
  arguments: z.record(z.string(), z.unknown()),
  questions: z.array(z.string().max(4000)).max(5).optional(),
  view: z.unknown().optional()
}).strict()

function response(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

export async function handleReadyTool(req, env, snapshot) {
  if (req.method !== 'POST') return response({ error: 'ใช้ POST สำหรับคำถามผู้จัดการ' }, 405)
  if (req.headers.get('origin') !== new URL(req.url).origin) return response({ error: 'คำขอต้องมาจากหน้าเดโม' }, 403)
  let body
  try {
    const bytes = await bounded(req.body, 32 * 1024)
    body = requestSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch { return response({ error: 'รูปแบบคำขอเครื่องมือไม่ถูกต้อง' }, 400) }
  const session = await authorizeReadySession(env, body.session)
  if (!session) return response({ error: 'สายผู้จัดการหมดอายุแล้ว' }, 401)
  if (snapshot?.shop?.mode !== 'simulated' || snapshot.runId !== session.runId || snapshot.managerPaused) {
    return response({ error: 'ข้อมูลร้านจำลองเปลี่ยนหรือผู้จัดการพักการทำงาน กรุณาเริ่มสายใหม่' }, 409)
  }
  const tool = definitions.get(body.name)
  if (!tool) return response({ error: 'ไม่พบเครื่องมือผู้จัดการนี้' }, 400)
  const args = tool.parameters.safeParse(body.arguments)
  if (!args.success) return response({ error: 'พารามิเตอร์เครื่องมือไม่ถูกต้อง' }, 400)

  const readStore = input => readLiveManagerTool(snapshot, input, snapshot.owner)
  const readView = () => parseShopView(body.view)
  const questions = body.questions ?? []
  if (body.name === marketToolDefinition.name) {
    const result = await searchPublicMarket(args.data, {
      readStore, getSelectedSku: () => readView().selectedVariantId, questions, env, signal: req.signal,
      reserveSearch: () => consumeReadySearch(env, body.session)
    })
    return response({ result, ...(result.sources && { sources: result.sources, searchedAt: result.searchedAt }) })
  }

  const result = await executeShopTool(body.name, args.data, { readStore, readView, question: questions.at(-1) })
  if (snapshot.hosted && !result.error) {
    result.snapshotSavedAt = new Date(snapshot.hosted.lastDataUpdate).toISOString()
    result.snapshotStale = snapshot.hosted.stale
  }
  return response({ result })
}
