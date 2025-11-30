import { Context, Schema } from 'koishi'
import { ensureWorkflowFiles } from './workflows/loader'
import { registerComfyCommand } from './commands/comfy'
import { registerWorkflowListCommand } from './commands/workflowList'

export const name = 'comfyui-client'

export interface Config {
  serverEndpoint: string
  isSecureConnection: boolean
  defaultWorkflow: string,
  comfyuiSubfolder: string,
}

export const Config: Schema<Config> = Schema.object({
  serverEndpoint: Schema.string().default('127.0.0.1:8188').description('ComfyUI服务器，格式：域名/IP:端口'),
  isSecureConnection: Schema.boolean().default(false).description('是否使用HTTPS连接'),
  defaultWorkflow: Schema.string().default('default').description('默认工作流名称'),
  comfyuiSubfolder: Schema.string().default('temp').description('ComfyUI上传的子文件夹'),
})

export async function apply(ctx: Context) {
  await ensureWorkflowFiles(ctx)
  registerComfyCommand(ctx)
  registerWorkflowListCommand(ctx)
}