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
    const indexPath = path.join(workflowsPath, "index.json");
    const sampleWorkflowPath = path.join(workflowsPath, "sample-workflow.json");

    console.log(root, workflowsPath, indexPath, sampleWorkflowPath, "root, workflowsPath, indexPath, sampleWorkflowPath")

    await fs.promises.mkdir(workflowsPath, { recursive: true })
    if (!fs.existsSync(indexPath)) {
        console.log("索引文件不存在")
        await fs.promises.writeFile(indexPath, JSON.stringify(indexJson, null, 4))
        await fs.promises.writeFile(sampleWorkflowPath, JSON.stringify(sampleWorkflowJson, null, 4))
    } else {
        console.log("索引文件存在")
    }

    const COMFYUI_SERVER = ctx.config.serverEndpoint;
    const IS_SECURE_CONNECTION = ctx.config.isSecureConnection;

    // 加载工作流索引
    const loadWorkflowIndex = () => {
        try {
            if (!fs.existsSync(indexPath)) {
                throw new Error(`工作流索引文件不存在: ${indexPath}`);
            }
            return JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {[s: string]:{file: string,outputNodeIDArr: string[],description: string}};
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
            outputNodeIDArr: Array.isArray(workflowInfo.outputNodeIDArr)?workflowInfo.outputNodeIDArr:[workflowInfo.outputNodeIDArr]
        };
    };

    // 修改指令支持工作流参数
    ctx.command('comfy [userPrompt:text] ComfyUI绘图')
        .alias('cf')
        .option('width', '--wi [width] 图片宽', { fallback: 768 })
        .option('height', '--he [height] 图片高', { fallback: 1344 })
        .option('sampler', '--sa [sampler] 采样器', { fallback: "euler_ancestral" })
        .option('scheduler', '--sc [scheduler] 调度器', { fallback: "karras" })
        .option('seed', '--se [seed] 随机种', { fallback: "1003957085091878" })
        .option('workflow', '--wf <workflow> 指定工作流名称')
        .action(async (_, userPrompt) => {
            // 处理工作流名称参数（支持选项和位置参数）
            const targetWorkflow = _.options.workflow || ctx.config.defaultWorkflow;
            const { width, height, sampler, scheduler, seed } = _.options;

            try {
                // 加载指定工作流
                const { json: promptJson, outputNodeIDArr } = loadWorkflow(targetWorkflow);

                // LLM提示词增强逻辑保持不变
                let finalUserPrompt = userPrompt.replaceAll("\n", " ");

                // 执行工作流
                const comfyNode = new ComfyUINode(ctx, COMFYUI_SERVER, IS_SECURE_CONNECTION);

                let _promptJson = JSON.parse(
                    JSON.stringify(promptJson)
                        .replaceAll("{{prompt}}", userPrompt)
                        .replaceAll("{{width}}", width)
                        .replaceAll("{{height}}", height)
                        .replaceAll("{{sampler}}", sampler)
                        .replaceAll("{{scheduler}}", scheduler)
                );

                _promptJson = comfyNode.updateSeed(_promptJson, seed);

                const result: any = await comfyNode.executePromptWorkflow(_promptJson, finalUserPrompt);

                if (result.success) {
                    // 使用当前工作流的输出节点ID
                    const finalResult = [];
                    outputNodeIDArr.forEach(outputNodeID => {
                        if (result.outputs[outputNodeID]) {
                            result.outputs[outputNodeID].images.map(item => {
                                const base64 = `data:image/png;base64,${item.buffer.toString('base64')}`;
                                finalResult.push({
                                    filename: item.filename,
                                    buffer: item.buffer,
                                    base64,
                                    html: <img src={base64} />,
                                })
                            })
                            result.outputs[outputNodeID].texts.map(item => {
                                finalResult.push({
                                    text: item.text,
                                    html: <p>{item.text}</p>,
                                })
                            })
                        }
                    });
                    return finalResult.map(item => item.html)
                } else {
                    console.error('工作流执行失败:', result.error);
                    return `工作流执行失败 ${result.error.error.message} \n 参数：${JSON.stringify(_.options)} prompt: ${userPrompt}`;
                }
            } catch (error) {
                console.error('执行工作流时发生错误:', error);
                return `执行工作流时发生错误: ${error.message} \n 参数：${JSON.stringify(_.options)} prompt: ${userPrompt}`;
            }
        })
    ctx.command('comfyls 查看工作流')
        .alias('cfls')
        .action(async (_) => {
            const indexArr = loadWorkflowIndex()
            console.log('查看工作流:', indexArr);
            const finalResult = []
            for (const [name, obj] of Object.entries(indexArr)) {
                finalResult.push({
                    html: <p>{name} {obj?.description}</p>
                })
            }
            return finalResult.map(item => item.html)
        })
}