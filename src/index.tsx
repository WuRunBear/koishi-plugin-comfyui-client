import { Context, Schema } from 'koishi'
import { ensureWorkflowFiles } from './workflows/loader'
import { registerComfyCommand } from './commands/comfy'
import { registerWorkflowListCommand } from './commands/workflowList'
import { registerServerListCommand } from './commands/serverList'
import { shutdownSharedComfyUINode } from './services/sharedComfyNode'

export const name = 'comfyui-client'

export interface ComfyServerConfig {
  name: string
  endpoint: string
  isSecureConnection: boolean
}

export interface Config {
  servers: ComfyServerConfig[]
  defaultServer: string
  serverEndpoint: string
  isSecureConnection: boolean
  defaultWorkflow: string,
  comfyuiSubfolder: string,
}

export const Config: Schema<Config> = Schema.object({
  servers: Schema.array(
    Schema.object({
      name: Schema.string().description('服务器名称'),
      endpoint: Schema.string().description('ComfyUI服务器，格式：域名/IP:端口'),
      isSecureConnection: Schema.boolean().default(false).description('是否使用HTTPS连接'),
    }),
  ).default([]).description('ComfyUI服务器列表'),
  defaultServer: Schema.string().default('').description('默认服务器名称（留空则使用 servers 第一个；未配置 servers 时回退旧配置）'),
  serverEndpoint: Schema.string().default('127.0.0.1:8188').description('ComfyUI服务器，格式：域名/IP:端口'),
  isSecureConnection: Schema.boolean().default(false).description('是否使用HTTPS连接'),
  defaultWorkflow: Schema.string().default('default').description('默认工作流名称'),
  comfyuiSubfolder: Schema.string().default('temp').description('ComfyUI上传的子文件夹'),
})

export async function apply(ctx: Context) {
  await ensureWorkflowFiles(ctx)
  registerComfyCommand(ctx)
  registerWorkflowListCommand(ctx)
  registerServerListCommand(ctx)
  ctx.on('dispose', async () => {
    await shutdownSharedComfyUINode()
  })
}
