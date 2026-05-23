import { Context } from 'koishi'
import { listComfyServers } from '../services/sharedComfyNode'

export function registerServerListCommand(ctx: Context) {
  ctx
    .command('comfysv 查看服务器列表')
    .alias('cfsv')
    .action(async (_) => {
      const servers = listComfyServers(ctx)
      const defaultServer = String((ctx.config as any)?.defaultServer || '').trim()
      const defaultName = defaultServer || servers[0]?.name || ''
      const finalResult: any[] = []

      if (!servers.length) {
        return <p>未配置服务器列表</p>
      }

      for (const server of servers) {
        const protocol = server.isSecureConnection ? 'https' : 'http'
        const isDefault = defaultName && server.name === defaultName
        finalResult.push({
          html: (
            <p>
              {isDefault ? '[默认] ' : ''}
              {server.name} - {protocol}://{server.endpoint}
            </p>
          ),
        })
      }

      return finalResult.map((item) => item.html)
    })
}
