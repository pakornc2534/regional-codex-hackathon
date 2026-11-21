// One Node relay serves each shop. The Worker also sheds bursts before queueing.
export function createAiRateLimit(env = {}) {
  function limit(key, fallback) {
    if (env[key] === undefined) return fallback
    const value = Number(env[key])
    if (!Number.isSafeInteger(value) || value < 1) throw Error('ค่าจำกัดคำขอ AI ไม่ถูกต้อง: ' + key)
    return value
  }
  const perClient = limit('AI_REQUESTS_PER_IP_MINUTE', 8)
  const global = limit('AI_REQUESTS_GLOBAL_MINUTE', 40)
  const clients = new Map()
  let windowStart = -1
  let total = 0
  return (client, now = Date.now()) => {
    const minute = Math.floor(now / 60000)
    if (minute !== windowStart) {
      windowStart = minute
      clients.clear()
      total = 0
    }
    const count = clients.get(client) ?? 0
    if (total >= global || count >= perClient) {
      const retryAfter = 60 - Math.floor(now / 1000) % 60
      const scope = count >= perClient ? 'จากเครือข่ายนี้' : 'ของร้าน'
      throw Object.assign(Error('คำขอ AI ' + scope + ' ถึงขีดจำกัดแล้ว ลองอีกครั้งใน ' + retryAfter + ' วินาที'), {status:429, retryAfter})
    }
    clients.set(client, count + 1)
    total++
  }
}
