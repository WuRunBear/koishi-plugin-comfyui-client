import { Context } from 'koishi'
import { loadWorkflowIndex, ensureWorkflowFiles, createEmptyWorkflow } from '../workflows/loader'

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

  // 创建工作流命令
  ctx
    .command('comfyls.new <name:string> [content:text] 创建工作流')
    .alias('cfls.new')
    .option('description', '--desc [description:string] 工作流描述')
    .option('outputNode', '--out [outputNode:string] 输出节点，逗号隔开')
    .action(async (_, name, content) => {
      try {
        const fileName = await createEmptyWorkflow(ctx, name, _.options.description, _.options.outputNode?.split(','), content)
        return <p>成功创建空工作流 "{name}"，文件：{fileName}</p>
      } catch (error: any) {
        console.error('创建工作流失败:', error)
        return <p>创建工作流失败：{error.message}</p>
      }
    })
}