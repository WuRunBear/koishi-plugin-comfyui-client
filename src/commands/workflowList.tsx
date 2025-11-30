import { Context } from 'koishi'
import { loadWorkflowIndex, ensureWorkflowFiles } from '../workflows/loader'

export function registerWorkflowListCommand(ctx: Context) {
  ctx
    .command('comfyls 查看工作流')
    .alias('cfls')
    .action(async (_) => {
      const indexArr = loadWorkflowIndex(ctx)
      const finalResult: any[] = []
      for (const [name, obj] of Object.entries(indexArr)) {
        finalResult.push({ html: <p>{name} {obj?.description}</p> })
      }
      return finalResult.map((item) => item.html)
    })

  ctx
    .command('comfyls.init 初始化工作流文件')
    .alias('cfls.init')
    .action(async (_) => {
      await ensureWorkflowFiles(ctx)
      return <p>工作流文件已初始化</p>
    })
}