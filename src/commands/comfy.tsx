import { Context, h } from 'koishi'
import { loadWorkflow } from '../workflows/loader'
import { sanitizeUserPrompt, applyPlaceholders } from '../utils/prompt'
import { ComfyUINode } from '../services/ComfyUINode'

const userImages = new Map<string, { uploadedPath: string }[]>()

async function uploadImageFromUrl(
  ctx: Context,
  comfyNode: ComfyUINode,
  src: string,
  filename: string,
) {
  try {
    const arraybuffer = await ctx.http.get(src, { responseType: 'arraybuffer' })
    const uploadResult = await comfyNode.uploadImage(
      new Blob([arraybuffer]),
      filename,
      ctx.config.comfyuiSubfolder,
    )
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error }
    }
    const uploadedName =
      uploadResult.data?.name || uploadResult.data?.filename || filename
    const uploadedPath = uploadResult.data?.subfolder
      ? `${uploadResult.data.subfolder}/${uploadedName}`
      : uploadedName
    return { success: true, uploadedPath }
  } catch (error) {
    return { success: false, error }
  }
}

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
    .option('watch', '--wt 交互式上传图片')
    .option('clean', '--cl 清除图片缓存')
    .action(async (_, userPrompt) => {
      // 清除缓存
      if (_.options.clean) {
        userImages.delete(_.session.cid)
        return '图片缓存已清除。'
      }

      const message = _.session.event.message
      let imgQu: any[] = []
      if (message.quote) {
        imgQu = h.select(message.quote.elements, 'img')
      }

      // 交互式上传模式
      if (_.options.watch) {
        if (imgQu.length > 0) {
          const comfyNode = new ComfyUINode(
            ctx,
            COMFYUI_SERVER,
            IS_SECURE_CONNECTION,
          )
          let count = 0
          const list: { uploadedPath: string }[] = []

          for (let i = 0; i < imgQu.length; i++) {
            const attrs = imgQu[i]?.attrs || {}
            const src = attrs.src || ''
            const file = attrs.file || `image${i + 1}.png`
            if (!src) continue
            const filename = `${Date.now()}_${file}`
            const result = await uploadImageFromUrl(
              ctx,
              comfyNode,
              src,
              filename,
            )
            if (result.success && result.uploadedPath) {
              list.push({ uploadedPath: result.uploadedPath })
              count++
            } else if (result.error) {
              await _.session.send(
                `上传失败: ${
                  (result.error as any).message || String(result.error)
                }`,
              )
            }
          }

          userImages.set(_.session.cid, list)
          if (count > 0) {
            const total = list.length
            await _.session.send(
              `成功接收 ${count} 张引用图片，当前共缓存 ${total} 张。`,
            )
          } else {
            await _.session.send('未检测到有效的引用图片。')
          }
          return
        }

        await _.session.send('进入交互式上传模式。请发送图片，支持多张发送，发送“结束”退出。')
        userImages.set(_.session.cid, [])
        const comfyNode = new ComfyUINode(ctx, COMFYUI_SERVER, IS_SECURE_CONNECTION)

        while (true) {
          const content = await _.session.prompt()
          if (!content) {
            await _.session.send('输入超时，退出交互模式。')
            break
          }
          if (content === '结束') {
            await _.session.send(`退出交互模式。共缓存 ${userImages.get(_.session.cid)?.length || 0} 张图片。`)
            break
          }

          const elements = h.parse(content)
          const imgs = h.select(elements, 'img')
          if (imgs.length === 0) continue

          let count = 0
          for (const img of imgs) {
            const src = img.attrs.src
            if (!src) continue
            const filename = `${Date.now()}_${count}.png`
            const result = await uploadImageFromUrl(
              ctx,
              comfyNode,
              src,
              filename,
            )
            if (result.success && result.uploadedPath) {
              const list = userImages.get(_.session.cid) || []
              list.push({ uploadedPath: result.uploadedPath })
              userImages.set(_.session.cid, list)
              count++
            } else if (result.error) {
              await _.session.send(
                `上传失败: ${
                  (result.error as any).message || String(result.error)
                }`,
              )
            }
          }
          if (count > 0) {
            const total = userImages.get(_.session.cid)?.length || 0
            await _.session.send(`成功接收 ${count} 张图片，当前共缓存 ${total} 张。`)
          }
        }
        return
      }

      if (message.quote && userPrompt) {
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

        let imageIndex = 1
        const cachedImages = userImages.get(_.session.cid) || []

        // 1. 填充缓存图片
        for (const img of cachedImages) {
          promptParams[`image${imageIndex}`] = img.uploadedPath
          imageIndex++
        }

        // 2. 上传并填充引用图片
        if (images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            const image = images[i]
            const result = await uploadImageFromUrl(
              ctx,
              comfyNode,
              image.src,
              image.filename,
            )
            if (!result.success || !result.uploadedPath) {
              console.log('图片上传失败:', result.error)
              return `图片上传失败 ${
                (result.error as any)?.message || String(result.error)
              }`
            }
            promptParams[`image${imageIndex}`] = result.uploadedPath
            imageIndex++
          }
        }

        // 兼容 image (如果 image1 存在)
        if (promptParams['image1']) {
          promptParams['image'] = promptParams['image1']
        } else {
          // 如果没有任何图片 (imageIndex === 1)，使用默认输入
          const inputList = await comfyNode.getInputList()
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
