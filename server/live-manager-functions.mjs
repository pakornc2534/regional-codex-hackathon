import { llm } from '@livekit/agents'
import { parseShopView, shopToolDefinitions, executeShopTool } from './live-manager-definitions.mjs'

export function createViewReader(room, identity) {
  return async () => {
    const raw = await room.localParticipant.performRpc({
      destinationIdentity: identity, method: 'raan.current-view', payload: '{}', responseTimeout: 3500
    })
    return parseShopView(JSON.parse(raw))
  }
}

export function createShopTools(readStore, readView) {
  return shopToolDefinitions.map(definition => llm.tool({
    ...definition,
    execute(args, options) {
      const turn = options?.ctx?.session.history.items.findLast(item => item.type === 'message' && item.role === 'user')
      return executeShopTool(definition.name, args, { readStore, readView, question: turn?.textContent })
    }
  }))
}
