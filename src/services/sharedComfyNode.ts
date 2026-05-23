import type { Context } from 'koishi'
import { ComfyUINode } from './ComfyUINode'

let shared: ComfyUINode | null = null
let sharedKey: string | null = null

export function getSharedComfyUINode(ctx: Context) {
  const key = `${ctx.config.serverEndpoint}|${ctx.config.isSecureConnection}`
  if (!shared || sharedKey !== key) {
    if (shared) void shared.shutdown()
    shared = new ComfyUINode(ctx, ctx.config.serverEndpoint, ctx.config.isSecureConnection)
    sharedKey = key
  }
  return shared
}

export async function shutdownSharedComfyUINode() {
  if (!shared) return
  await shared.shutdown()
  shared = null
  sharedKey = null
}
