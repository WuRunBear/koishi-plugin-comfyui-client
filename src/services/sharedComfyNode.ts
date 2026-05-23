import type { Context } from 'koishi'
import { ComfyUINode } from './ComfyUINode'

interface ComfyServerTarget {
  name: string
  endpoint: string
  isSecureConnection: boolean
  key: string
}

const sharedPool = new Map<string, ComfyUINode>()

function normalizeServerList(ctx: Context) {
  const raw = (ctx.config as any)?.servers
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item: any) => ({
        name: String(item?.name || item?.endpoint || '').trim(),
        endpoint: String(item?.endpoint || '').trim(),
        isSecureConnection: Boolean(item?.isSecureConnection),
      }))
      .filter((item) => item.name && item.endpoint)
  }

  const endpoint = String((ctx.config as any)?.serverEndpoint || '127.0.0.1:8188').trim()
  const isSecureConnection = Boolean((ctx.config as any)?.isSecureConnection)
  return [{ name: 'default', endpoint, isSecureConnection }]
}

function resolveServerTarget(ctx: Context, serverName?: string): ComfyServerTarget {
  const servers = normalizeServerList(ctx)
  const preferred = String(serverName || '').trim()
  const configuredDefault = String((ctx.config as any)?.defaultServer || '').trim()
  const defaultName = configuredDefault || servers[0]?.name
  const selectedName = preferred || defaultName

  const selected =
    servers.find((s) => s.name === selectedName) ??
    servers.find((s) => s.name === defaultName) ??
    servers[0]

  if (!selected) {
    const endpoint = String((ctx.config as any)?.serverEndpoint || '127.0.0.1:8188').trim()
    const isSecureConnection = Boolean((ctx.config as any)?.isSecureConnection)
    return { name: selectedName || 'default', endpoint, isSecureConnection, key: `${endpoint}|${isSecureConnection}` }
  }

  const key = `${selected.endpoint}|${selected.isSecureConnection}`
  return { ...selected, key }
}

export function listComfyServers(ctx: Context) {
  return normalizeServerList(ctx).map((s) => ({
    name: s.name,
    endpoint: s.endpoint,
    isSecureConnection: s.isSecureConnection,
  }))
}

export function getComfyServerKey(ctx: Context, serverName?: string) {
  return resolveServerTarget(ctx, serverName).key
}

export function getSharedComfyUINode(ctx: Context, serverName?: string) {
  const target = resolveServerTarget(ctx, serverName)
  const existing = sharedPool.get(target.key)
  if (existing) return existing

  const node = new ComfyUINode(ctx, target.endpoint, target.isSecureConnection)
  sharedPool.set(target.key, node)
  return node
}

export async function shutdownSharedComfyUINode() {
  const nodes = Array.from(sharedPool.values())
  sharedPool.clear()
  await Promise.all(nodes.map((node) => node.shutdown()))
}
