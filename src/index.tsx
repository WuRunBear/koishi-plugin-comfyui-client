import { Context, Schema } from 'koishi'
import { ComfyUINode } from './ComfyUINode';
import fs from 'fs';
import path from 'path';
import indexJson from "../workflows/index.json"
import sampleWorkflowJson from "../workflows/sample-workflow.json"

export const name = 'comfyui-client'

export interface Config {
    serverEndpoint: string;
    isSecureConnection: boolean;
    // 新增工作流配置
    defaultWorkflow: string;      // 默认工作流名称
}

export const Config: Schema<Config> = Schema.object({
    serverEndpoint: Schema.string().default('127.0.0.1:8188').description("ComfyUI服务器，格式：域名/IP:端口"),
    isSecureConnection: Schema.boolean().default(false).description("是否使用HTTPS连接"),
    // 工作流相关配置
    defaultWorkflow: Schema.string().default('default').description("默认工作流名称"),
})

export async function apply(ctx: Context) {
    const root = path.join(ctx.baseDir, 'data', 'koishi-plugin-comfyui-client')
    const workflowsPath = path.join(root, "workflows")
    const indexPath = path.join(root, "index.json");
    const sampleWorkflowPath = path.join(root, "sample-workflow.json");

    await fs.promises.mkdir(workflowsPath, { recursive: true })
    if (!fs.existsSync(indexPath)) {
        await fs.promises.writeFile(indexPath, JSON.stringify(indexJson))
        await fs.promises.writeFile(sampleWorkflowPath, JSON.stringify(sampleWorkflowJson))
    }

    const COMFYUI_SERVER = ctx.config.serverEndpoint;
    const IS_SECURE_CONNECTION = ctx.config.isSecureConnection;

    // 加载工作流索引
    const loadWorkflowIndex = () => {
        try {
            if (!fs.existsSync(indexPath)) {
                throw new Error(`工作流索引文件不存在: ${indexPath}`);
            }
            return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        } catch (error) {
            console.error('加载工作流索引失败:', error);
            return {};
        }
    };

    // 加载指定工作流
    const loadWorkflow = (name: string) => {
        const index = loadWorkflowIndex();
        const workflowInfo = index[name] || index[ctx.config.defaultWorkflow];

        if (!workflowInfo) {
            throw new Error(`未找到工作流: ${name}`);
        }

        const workflowPath = path.resolve(
            workflowsPath,
            workflowInfo.file
        );

        if (!fs.existsSync(workflowPath)) {
            throw new Error(`工作流文件不存在: ${workflowPath}`);
        }

        return {
            json: JSON.parse(fs.readFileSync(workflowPath, 'utf-8')),
            outputNodeID: workflowInfo.outputNodeID
        };
    };

    // 修改指令支持工作流参数
    ctx.command('comfy [workflowName:string] [userPrompt:text] ComfyUI绘图')
        .alias('cf')
        .option('width', '-w [width] 图片宽', { fallback: 768 })
        .option('height', '-h [height] 图片高', { fallback: 1344 })
        .option('sampler', '-sa [sampler] 采样器', { fallback: "euler_ancestral" })
        .option('scheduler', '-sc [scheduler] 调度器', { fallback: "karras" })
        .option('seed', '-se [seed] 随机种', { fallback: "1003957085091878" })
        .option('workflow', '-wf [workflow] 指定工作流名称')
        .action(async (_, workflowName, userPrompt) => {
            // 处理工作流名称参数（支持选项和位置参数）
            const targetWorkflow = _.options.workflow || workflowName || ctx.config.defaultWorkflow;
            const { width, height, sampler, scheduler, seed } = _.options;

            try {
                // 加载指定工作流
                const { json: promptJson, outputNodeID } = loadWorkflow(targetWorkflow);

                // LLM提示词增强逻辑保持不变
                let finalUserPrompt = userPrompt;

                // 执行工作流
                const comfyNode = new ComfyUINode(ctx, COMFYUI_SERVER, IS_SECURE_CONNECTION);

                let _promptJson = JSON.parse(
                    JSON.stringify(promptJson)
                        .replace("{{prompt}}", userPrompt)
                        .replace("{{width}}", width)
                        .replace("{{height}}", height)
                        .replace("{{sampler}}", sampler)
                        .replace("{{scheduler}}", scheduler)
                );

                _promptJson = comfyNode.updateSeed(_promptJson, seed);

                const result: any = await comfyNode.executePromptWorkflow(_promptJson, finalUserPrompt);

                if (result.success) {
                    // 使用当前工作流的输出节点ID
                    const finalResult = result.outputs[outputNodeID].images.map(item => ({
                        filename: item.filename,
                        buffer: item.buffer
                    }));
                    const imageBuffer = finalResult[0].buffer;
                    const base64Image = imageBuffer.toString('base64');
                    const dataUri = `data:image/png;base64,${base64Image}`;
                    return <img src={dataUri} />
                } else {
                    console.error('工作流执行失败:', result.error);
                    return '执行失败';
                }
            } catch (error) {
                console.error('执行工作流时发生错误:', error);
                return `执行失败: ${error.message}`;
            }
        })
}