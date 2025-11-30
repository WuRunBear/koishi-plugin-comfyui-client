import type { Context } from 'koishi'
import fs from 'fs'
import path from 'path'
import indexJson from '../../workflows/index.json'
import sampleWorkflowJson from '../../workflows/sample-workflow.json'

export type WorkflowInfo = {
  file: string
  outputNodeIDArr: string[] | string
  description?: string
}

export type WorkflowIndex = Record<string, WorkflowInfo>

function resolvePaths(ctx: Context) {
  const root = path.join(ctx.baseDir, 'data', 'koishi-plugin-comfyui-client')
  const workflowsPath = path.join(root, 'workflows')
  const indexPath = path.join(workflowsPath, 'index.json')
  const sampleWorkflowPath = path.join(workflowsPath, 'sample-workflow.json')
  return { root, workflowsPath, indexPath, sampleWorkflowPath }
}

export async function ensureWorkflowFiles(ctx: Context) {
  const { workflowsPath, indexPath, sampleWorkflowPath } = resolvePaths(ctx)
  await fs.promises.mkdir(workflowsPath, { recursive: true })

  if (!fs.existsSync(indexPath)) {
    await fs.promises.writeFile(indexPath, JSON.stringify(indexJson, null, 4))
    await fs.promises.writeFile(sampleWorkflowPath, JSON.stringify(sampleWorkflowJson, null, 4))
  }
}

export function loadWorkflowIndex(ctx: Context): WorkflowIndex {
  const { indexPath } = resolvePaths(ctx)
  try {
    if (!fs.existsSync(indexPath)) {
      throw new Error(`工作流索引文件不存在: ${indexPath}`)
    }
    const content = fs.readFileSync(indexPath, 'utf-8')
    return JSON.parse(content) as WorkflowIndex
  } catch (error) {
    console.error('加载工作流索引失败:', error)
    return {}
  }
}

export function loadWorkflow(ctx: Context, name: string) {
  const { workflowsPath } = resolvePaths(ctx)
  const index = loadWorkflowIndex(ctx)
  const workflowInfo = index[name]

  if (!workflowInfo) {
    throw new Error(`未找到工作流: ${name}`)
  }

  const workflowPath = path.resolve(workflowsPath, workflowInfo.file)
  if (!fs.existsSync(workflowPath)) {
    throw new Error(`工作流文件不存在: ${workflowPath}`)
  }

  const json = fs.readFileSync(workflowPath, 'utf-8')
  const outputNodeIDArr = Array.isArray(workflowInfo.outputNodeIDArr)
    ? workflowInfo.outputNodeIDArr
    : [workflowInfo.outputNodeIDArr]

  return { json, outputNodeIDArr }
}