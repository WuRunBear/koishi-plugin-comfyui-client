基于flymyd/koishi-plugin-comfyui-client二次开发的插件

- 去掉llm增强提示词的功能，我觉得这个功能可以在工作流中实现
- 新增多工作流功能

# koishi-plugin-comfyui-workflow

[![npm](https://img.shields.io/npm/v/koishi-plugin-comfyui-client?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-comfyui-client)
[![GitHub](https://img.shields.io/github/stars/WuRunBear/koishi-plugin-comfyui-client?style=flat-square)](https://github.com/WuRunBear/koishi-plugin-comfyui-client)

一个为 [Koishi](https://koishi.chat/) 设计的 [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 客户端插件。它允许你通过 Koishi 机器人执行任何 ComfyUI 工作流，实现文生图等功能。

## ✨ 功能特性

- **高度可定制**: 支持通过 JSON 加载任意 ComfyUI 工作流。
- **文生图指令**: 提供 `comfy`、`cf` 指令，方便用户通过文本生成图片。
- **查看工作流指令**: 提供 `comfyls`、`cfls` 指令，方便用户通过文本生成图片。
- **动态连接**: 自动处理与 ComfyUI 服务器的 WebSocket 连接和 HTTP 请求。

## 💿 安装

在 Koishi 插件市场搜索 `comfyui-workflow` 并安装。

## ⚙️ 配置项

在 Koishi 的插件配置页面填入以下选项：

|配置项|类型|默认值|描述|
|--|--|--|--|
|`serverEndpoint`|`string`|`127.0.0.1:8188`|ComfyUI 服务器地址，格式为 `域名/IP:端口`。|
|`isSecureConnection`|`boolean`|`false`|是否使用 `https` 和 `wss` 进行安全连接。|
|`defaultWorkflow`|`string`|default|默认工作流名称|

---

### 如何获取 `workflowJSON` 和 `picOutputNodeID`

为了让插件知道如何执行你的工作流，你需要从 ComfyUI 导出它。

1. **在 ComfyUI 中构建你的工作流**。
   - 确保你的工作流中有一个接收正面提示词的 `CLIPTextEncode` 节点。
   - 将该节点的 `text` 输入框内容设置为一个独特的占位符：`114514.1919810`。插件会自动将用户的输入替换到这里。
   - 记下最终生成图像的 `SaveImage` 节点的 ID。你可以在节点标题上看到这个数字。
2. **导出工作流**。
   - 点击 ComfyUI 界面右侧的 `Save (API Format)` 按钮。
   - 这会导出一个 JSON 文件。
3. **填入配置**。
   - 用文本编辑器打开刚刚下载的 JSON 文件，**复制所有内容**。
   - 将复制的内容粘贴到插件配置的 `workflowJSON` 文本框中。
   - 将在步骤 1 中记下的 `SaveImage` 节点 ID (例如 `9`) 填入 `picOutputNodeID` 字段。

## 🚀 使用方法

配置完成后，你可以通过以下指令使用插件：

```
comfy <你的提示词>
```

```
comfy --wf [工作流名称] <你的提示词>
```

**示例:**

```
comfy a cute cat sitting on a sofa
```

## 📄 许可协议

本项目使用 [MIT](./LICENSE) 许可协议。
