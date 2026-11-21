import { llm } from '@livekit/agents'
import { marketToolDefinition, searchPublicMarket } from './live-manager-web-search.mjs'

export function createWebResearchTool(ctx, identity, signal, readStore, getSelectedSku) {
  let searches = 0
  return llm.tool({
    ...marketToolDefinition,
    onDuplicate: 'reject',
    execute: async (args, { ctx: run, abortSignal }) => {
      const questions = run.session.history.items.filter(item => item.type === 'message' && item.role === 'user')
        .slice(-5).map(item => item.textContent ?? '')
      const result = await searchPublicMarket(args, {
        readStore, getSelectedSku, questions, env: process.env,
        signal: AbortSignal.any([signal, abortSignal].filter(Boolean)),
        reserveSearch: () => searches++ < 3
      })
      if (result.sources) {
        await ctx.room.localParticipant?.sendText(JSON.stringify({ sources: result.sources, searchedAt: result.searchedAt }), {
          topic: 'raan.sources', destinationIdentities: [identity]
        }).catch(() => undefined)
      }
      return result
    }
  })
}
