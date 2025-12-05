基于flymyd/koishi-plugin-comfyui-client二次开发的插件

- 去掉llm增强提示词的功能，我觉得这个功能可以在工作流中实现
- 新增多工作流功能

# koishi-plugin-comfyui-workflow

[![npm](https://img.shields.io/npm/v/koishi-plugin-comfyui-workflow?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-comfyui-workflow)
[![GitHub](https://img.shields.io/github/stars/WuRunBear/koishi-plugin-comfyui-client?style=flat-square)](https://github.com/WuRunBear/koishi-plugin-comfyui-client)

一个为 [Koishi](https://koishi.chat/) 设计的 [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 客户端插件。它允许你通过 Koishi 机器人执行任何 ComfyUI 工作流，实现文生图等功能。

## ✨ 功能特性

- **高度可定制**: 支持通过 JSON 加载任意 ComfyUI 工作流。
- **文生图指令**: 提供 `comfy`、`cf` 指令，方便用户生成图片，引用图片时会自动上传。
- **工作流管理指令**: 提供 `comfyls`、`cfls` 查看工作流；`comfyls.init`、`cfls.init` 初始化默认工作流文件；`cfls.new` 创建新工作流并更新索引。
- **动态连接**: 自动处理与 ComfyUI 服务器的 WebSocket 连接和 HTTP 请求。

## 💿 安装

在 Koishi 插件市场搜索 `comfyui-workflow` 并安装。

## ⚙️ 配置项

在 Koishi 的插件配置页面填入以下选项：

|配置项|类型|默认值|描述|
|--|--|--|--|
|`serverEndpoint`|`string`|`127.0.0.1:8188`|ComfyUI 服务器地址，格式为 `域名/IP:端口`。|
|`isSecureConnection`|`boolean`|`false`|是否使用 `https` 和 `wss` 进行安全连接。|
|`defaultWorkflow`|`string`|`default`|默认工作流名称|
|`comfyuiSubfolder`|`string`|`temp`|上传引用图像的子文件夹（ComfyUI 输入目录）。|

---

# 如何配置和管理工作流

二次开发后，插件支持多工作流管理，你需要按照以下步骤准备和配置工作流：

## 1. 准备工作流文件

1. **在 ComfyUI 中构建工作流**
   - 确保工作流包含接收正面提示词的处理节点（例如 `CLIPTextEncode` 或字符串处理节点）
   - 将提示词输入框内容设置为 `{{prompt}}` 占位符（插件会自动替换为用户输入）
   - 可根据需要添加 `{{width}}`、`{{height}}`、`{{sampler}}`、`{{scheduler}}`、`{{image}}`动态参数占位符
   ```json
      "11": {
         "inputs": {
            "image": "{{image}}"
         },
         "class_type": "LoadImage",
         "_meta": {
            "title": "加载图像"
         }
      },
      "27": {
         "inputs": {
            "text": "{{prompt}}",
            "clip": [
            "4",
            1
            ]
         },
         "class_type": "CLIPTextEncode",
         "_meta": {
            "title": "CLIP文本编码器"
         }
      },
      "29": {
         "inputs": {
            "width": "{{width}}",
            "height": "{{height}}",
            "batch_size": 1
         },
         "class_type": "EmptyLatentImage",
         "_meta": {
            "title": "空Latent"
         }
      },
      "3": {
         "inputs": {
            "seed": 942500763821827,
            "steps": 30,
            "cfg": 4,
            "sampler_name": "{{sampler}}",
            "scheduler": "{{scheduler}}",
            "denoise": 1,
            "model": [
            "4",
            0
            ],
            "positive": [
            "27",
            0
            ],
            "negative": [
            "28",
            0
            ],
            "latent_image": [
            "29",
            0
            ]
         },
         "class_type": "KSampler",
         "_meta": {
            "title": "K采样器"
         }
      },
   ```
   - 记下所有生成图像的 `SaveImage` 节点 ID（在节点标题上可见）
2. **导出工作流**
   - 点击 ComfyUI 右侧的 `Save (API Format)` 按钮
   - 将导出的 JSON 文件保存到本地（建议命名为有意义的名称，如 `anime-style.json`）

## 2. 配置工作流索引

1. **工作流存放位置**
   - 插件会自动在 Koishi 数据目录创建 `data/koishi-plugin-comfyui-client/workflows` 文件夹，或运行 `comfyls.init` 初始化默认索引与示例工作流
   - 将导出的工作流 JSON 文件放入该文件夹（或替换示例文件），也可在 Koishi 的资源管理器操作
2. **编辑索引文件**
   - 打开 `workflows` 文件夹中的 `index.json` 文件
   - 按照以下格式添加工作流信息：
   ```json
   {
     "工作流名称": {
       "file": "工作流文件名.json",
       "outputNodeIDArr": ["输出节点ID1", "输出节点ID2"],
       "description": "工作流描述"
     },
     "default": {
       "file": "sample-workflow.json",
       "outputNodeIDArr": ["71", "72"],
       "description": "默认文生图工作流"
     }
   }
   ```
   - `outputNodeIDArr` 填写步骤1中记下的所有 `SaveImage` 节点ID
   - 可通过 `default` 字段指定默认使用的工作流
   - 也可运行 `cfls.new` 交互式创建新工作流并自动写入索引

## 3. 插件配置

在 Koishi 插件配置页面，只需设置以下基础参数：

- `serverEndpoint`: ComfyUI 服务器地址（格式：`域名/IP:端口`）
- `isSecureConnection`: 是否使用 HTTPS/WSS 安全连接
- `defaultWorkflow`: 默认工作流名称（需与 index.json 中的键名一致）
- `comfyuiSubfolder`: 上传引用图像的子文件夹（默认 `temp`，对应 ComfyUI 输入目录）

完成以上配置后，即可通过 `comfy` 指令调用指定工作流生成图像；使用 `comfyls` 查看可用工作流，`comfyls.init` 初始化默认工作流文件。

## 🚀 使用方法

配置完成后，你可以通过以下指令使用插件：

```
comfy <你的提示词>
```

```
comfy --wf [工作流名称] <你的提示词>
```

首次使用建议先初始化工作流文件：

```
comfyls.init
```

查看可用工作流：

```
comfyls
```

创建新工作流：

```
comfyls.new --desc [工作流描述] --out [输出节点，逗号隔开] <name> [content] 
```

or

```
comfyls.new --desc [工作流描述] <name>
```

**示例:**

```
comfy a cute cat sitting on a sofa
```

## 📄 许可协议

本项目使用 [MIT](./LICENSE) 许可协议。
