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
    .option('seed', '--se [seed] 随机种')
    .option('workflow', '--wf <workflow> 指定工作流名称')
    .action(async (_, userPrompt) => {
      let message = _.session.event.message
      let imgQu: any[] = []
      if (message.quote) {
        imgQu = h.select(message.quote.elements, 'img')
        userPrompt = userPrompt.replaceAll(h.unescape(message.quote.content), ' ')
      }

      // 支持多图：构建 images 列表
      const images: { src: string; filename: string }[] = []
      if (imgQu.length) {
        for (let i = 0; i < imgQu.length; i++) {
          const attrs = imgQu[i]?.attrs || {}
          const src = attrs.src || ''
          const file = attrs.file || `image${i + 1}.png`
          if (src) {
            images.push({
              src,
              filename: `${Date.now()}_${file}`,
            })
          }
        }
      }

      const targetWorkflow = _.options.workflow || ctx.config.defaultWorkflow

      try {
        const { json: promptJson, outputNodeIDArr } = loadWorkflow(ctx, targetWorkflow)
        const finalUserPrompt = sanitizeUserPrompt(userPrompt)
        const comfyNode = new ComfyUINode(ctx, COMFYUI_SERVER, IS_SECURE_CONNECTION)

        // 构建占位符参数（动态 image1、image2…）
        const promptParams: Record<string, any> = {
          prompt: finalUserPrompt,
          ..._.options,
        }

        if (images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            const image = images[i]
            const arraybuffer = await ctx.http.get(image.src, { responseType: 'arraybuffer' })
            const uploadResult = await comfyNode.uploadImage(new Blob([arraybuffer]), image.filename, ctx.config.comfyuiSubfolder)

            if (!uploadResult.success) {
              console.log('图片上传失败:', uploadResult)
              return `图片上传失败 ${uploadResult.error}`
            }
            const uploadedName = (uploadResult.data?.name || uploadResult.data?.filename) || image.filename
            const uploadedPath = uploadResult.data?.subfolder ? `${uploadResult.data.subfolder}/${uploadedName}` : uploadedName
            promptParams[`image${i + 1}`] = uploadedPath
          }
          // 兼容旧工作流：如果存在 image1，也填充 image
          if (promptParams['image1']) {
            promptParams['image'] = promptParams['image1']
          }
        } else {
          const inputList = await comfyNode.getInputList()
          // 默认取第一个输入作为 image1，同时兼容旧的 image 键
          promptParams['image1'] = inputList.data[0]
          promptParams['image'] = promptParams['image1']
        }

        let _promptJson = JSON.parse(
          applyPlaceholders(promptJson, promptParams),
        )

        _promptJson = comfyNode.updateSeed(_promptJson, _.options.seed)

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
                // const base64 = `data:image/png;base64,${item.buffer.toString('base64')}`
                finalResult.push({ filename: item.filename, buffer: item.buffer, html: h.image(item.buffer, 'image/png') })
              })
              result.outputs[outputNodeID].videos.map((item) => {
                // const base64 = `data:video/mp4;base64,${item.buffer.toString('base64')}`
                finalResult.push({ filename: item.filename, buffer: item.buffer, html: h.video(item.buffer, 'video/mp4', { controls: true }) })
              })
              result.outputs[outputNodeID].texts.map((item) => {
                finalResult.push({ text: item.text, html: h('p', item.text) })
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