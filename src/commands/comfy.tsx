import { Context, h } from 'koishi'
import { loadWorkflow } from '../workflows/loader'
import { sanitizeUserPrompt, applyPlaceholders } from '../utils/prompt'
import { ComfyUINode } from '../services/ComfyUINode'

export function registerComfyCommand(ctx: Context) {
  const COMFYUI_SERVER = ctx.config.serverEndpoint
  const IS_SECURE_CONNECTION = ctx.config.isSecureConnection

  ctx
    .command('comfy [userPrompt:text] ComfyUI绘图')
    .alias('cf')
    .option('width', '--wi [width] 图片宽', { fallback: 768 })
    .option('height', '--he [height] 图片高', { fallback: 1344 })
    .option('sampler', '--sa [sampler] 采样器', { fallback: 'euler_ancestral' })
    .option('scheduler', '--sc [scheduler] 调度器', { fallback: 'karras' })
    .option('seed', '--se [seed] 随机种', { fallback: '1003957085091878' })
    .option('workflow', '--wf <workflow> 指定工作流名称')
    .action(async (_, userPrompt) => {
      let message = _.session.event.message
      let imgQu: any[] = []
      if (message.quote) {
        imgQu = h.select(message.quote.elements, 'img')
        userPrompt = userPrompt.replaceAll(h.unescape(message.quote.content), ' ')
      }

      const img = { src: '', filename: '' }
      if (imgQu.length) {
        img.src = imgQu[0].attrs.src
        img.filename = `${Date.now()}_${imgQu[0].attrs.file}`
      }

      const targetWorkflow = _.options.workflow || ctx.config.defaultWorkflow
      const { width, height, sampler, scheduler, seed } = _.options

      try {
        const { json: promptJson, outputNodeIDArr } = loadWorkflow(ctx, targetWorkflow, ctx.config.defaultWorkflow)
        const finalUserPrompt = sanitizeUserPrompt(userPrompt)
        const comfyNode = new ComfyUINode(ctx, COMFYUI_SERVER, IS_SECURE_CONNECTION)

        const promptParams = {
          prompt: finalUserPrompt,
          width,
          height,
          sampler,
          scheduler,
          image: img.filename,
        }
        if (img.src) {
          const arraybuffer = await ctx.http.get(img.src, { responseType: 'arraybuffer' })
          const uploadResult = await comfyNode.uploadImage(new Blob([arraybuffer]), img.filename, ctx.config.comfyuiSubfolder)
          if (!uploadResult.success) {
            return `图片上传失败 ${uploadResult.error}`
          }
          promptParams.image = uploadResult.data?.filename || promptParams.image
        } else {
          const inputList = await comfyNode.getInputList()
          promptParams.image = inputList.data[0]
        }

        let _promptJson = JSON.parse(
          applyPlaceholders(promptJson, promptParams),
        )

        _promptJson = comfyNode.updateSeed(_promptJson, seed)

        const quote = h('quote', { id: _.session.messageId })
        let workingMessageIds = ['']

        const result: any = await comfyNode.executePromptWorkflow(_promptJson, async () => {
          workingMessageIds = await _.session.send(h('p', quote, '任务已提交，正在生成...'))
        })

        if (result.success) {
          const finalResult: any[] = []
          outputNodeIDArr.forEach((outputNodeID) => {
            if (result.outputs[outputNodeID]) {
              result.outputs[outputNodeID].images.map((item) => {
                const base64 = `data:image/png;base64,${item.buffer.toString('base64')}`
                finalResult.push({ filename: item.filename, buffer: item.buffer, base64, html: <img src={base64} /> })
              })
              result.outputs[outputNodeID].texts.map((item) => {
                finalResult.push({ text: item.text, html: <p>{item.text}</p> })
              })
            }
          })
          return finalResult.map((item) => item.html)
        } else {
          console.error('工作流执行失败:', result.error)
          return `工作流执行失败 ${result.error.error.message} \n 参数：${JSON.stringify(_.options)} prompt: ${userPrompt}`
        }
      } catch (error: any) {
        console.error('执行工作流时发生错误:', error)
        return `执行工作流时发生错误: ${error.message} \n 参数：${JSON.stringify(_.options)} prompt: ${userPrompt}`
      }
    })
}