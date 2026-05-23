基于flymyd/koishi-plugin-comfyui-client二次开发的插件

以下内容由ai生成

# koishi-plugin-comfyui-workflow

[![npm](https://img.shields.io/npm/v/koishi-plugin-comfyui-workflow?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-comfyui-workflow)
[![GitHub](https://img.shields.io/github/stars/WuRunBear/koishi-plugin-comfyui-client?style=flat-square)](https://github.com/WuRunBear/koishi-plugin-comfyui-client)

一个为 [Koishi](https://koishi.chat/) 设计的 [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 客户端插件：通过聊天指令执行任意 ComfyUI 工作流，并将图片/视频/文本结果返回到聊天平台。

## ✨ 功能特性

- 支持多工作流：在 Koishi 数据目录维护 `index.json`，按名称选择不同工作流模板
- 文/图生图：`comfy` / `cf` 指令，支持引用图片自动上传
- 多图输入：引用的多张图片会依次映射为 `{{image1}}`、`{{image2}}`……
- 交互式上传：`cf --wt` 连续缓存多张图片，后续指令自动使用缓存
- 缓存管理：`cf --cl` 清除当前会话的图片缓存
- 自动通信：内部处理 HTTP 请求与 WebSocket 监听，提交任务并等待执行结束

## ✅ 运行前提

- 已启动 ComfyUI，确保以下地址在 Koishi 运行环境可访问：
  - HTTP：`http(s)://<serverEndpoint>/`
  - WebSocket：`ws(s)://<serverEndpoint>/ws`
- 如果 ComfyUI 与 Koishi 不在同一台机器，注意防火墙与端口映射（默认 8188）

## 💿 安装

- 市场安装：Koishi 插件市场搜索 `comfyui-workflow` 并安装
- 手动安装（可选）：

```bash
pnpm add koishi-plugin-comfyui-workflow
```

## ⚙️ 配置项

在 Koishi 的插件配置页面填写：

| 配置项                  | 类型        | 默认值              | 描述                              |
| -------------------- | --------- | ---------------- | ------------------------------- |
| `serverEndpoint`     | `string`  | `127.0.0.1:8188` | ComfyUI 服务器地址，格式：`域名/IP:端口`     |
| `isSecureConnection` | `boolean` | `false`          | 是否使用 `https` 与 `wss`            |
| `defaultWorkflow`    | `string`  | `default`        | 默认工作流名称（对应 `index.json` 里的键名）   |
| `comfyuiSubfolder`   | `string`  | `temp`           | 上传图片的子目录（ComfyUI input 下的子文件夹名） |

说明：

- 工作流文件会落在 Koishi 数据目录：`data/koishi-plugin-comfyui-client/workflows/`
  - 这里的目录名沿用了历史命名（不是包名），属于正常现象

## 🚀 快速开始

1. 初始化工作流目录与默认文件：

```
comfyls.init
```

1. 查看可用工作流：

```
comfyls
```

1. 直接执行默认工作流：

```
comfy 一只坐在沙发上的可爱猫猫
```

1. 指定工作流执行：

```
cf --wf <工作流名称> 赛博朋克城市夜景
```

## 🧩 指令说明

### comfy / cf

```
comfy [提示词]
cf [提示词]
```

常用参数：

- `--wf <workflow>`：指定工作流名称（不传则使用 `defaultWorkflow`）
- `--wi [width]`：图片宽（默认 768）
- `--he [height]`：图片高（默认 1344）
- `--sa [sampler]`：采样器（默认 euler\_ancestral）
- `--sc [scheduler]`：调度器（默认 karras）
- `--se [seed]`：随机种子（不传则自动随机）
- `--wt`：进入交互式上传图片模式（见下文）
- `--cl`：清除当前会话的图片缓存

### comfyls / cfls

```
comfyls
```

列出当前 `index.json` 中配置的工作流名称与描述。

### comfyls.init / cfls.init

```
comfyls.init
```

初始化 `data/koishi-plugin-comfyui-client/workflows/`，并写入默认 `index.json` 与示例工作流。

### comfyls.new / cfls.new

```
comfyls.new --desc <描述> --out <节点ID1,节点ID2> <name> [content]
```

- `<name>`：工作流名称（会创建同名 `<name>.json` 并写入索引）
- `--out`：输出节点 ID，逗号分隔（可选；也可以后续手动编辑 `index.json`）
- `[content]`：可选，传入 JSON 字符串作为初始内容；不传则创建空对象 `{}`（方便占位）

## 🗂️ 工作流管理

### 1) 放置工作流文件

1. 在 ComfyUI 中搭建工作流
2. 右侧点击 `Save (API Format)` 导出 JSON
3. 将导出的文件放到 Koishi 数据目录：
   - `data/koishi-plugin-comfyui-client/workflows/`

### 2) 配置 index.json

`index.json` 结构示例：

```json
{
  "default": {
    "file": "sample-workflow.json",
    "outputNodeIDArr": ["71", "72"],
    "description": "默认文生图工作流"
  },
  "anime": {
    "file": "anime-style.json",
    "outputNodeIDArr": ["15"],
    "description": "二次元风格"
  }
}
```

- `file`：工作流文件名（相对 `workflows/` 目录）
- `outputNodeIDArr`：要返回结果的节点 ID 列表
  - 图片：通常填写 `SaveImage` 节点 ID
  - 视频/动图：通常填写 `SaveAnimated*` 等产生 animated 输出的节点 ID
  - 文本：填写会在 outputs 中产生 `text` 字段的节点 ID
- `description`：展示用描述

## 🧷 占位符与参数

插件会把工作流文件当作“文本模板”，把 `{{...}}` 替换后再提交给 ComfyUI。

### 常用占位符

- `{{prompt}}`：用户输入的提示词
- `{{width}}` / `{{height}}`：由 `--wi/--he` 提供
- `{{sampler}}` / `{{scheduler}}`：由 `--sa/--sc` 提供
- `{{seed}}`：由 `--se` 提供（不传则自动随机）
- `{{image1}}`、`{{image2}}`……：多图输入（缓存图 + 引用图，会按顺序拼接）
- `{{image}}`：兼容别名
  - 若存在 `image1`，则 `image` 等价于 `image1`
  - 若完全没有任何图片输入，插件会从 ComfyUI input 列表中取一个默认文件填入（避免工作流缺图报错）

### 自定义占位符（高级）

插件会把命令解析到的参数合并进模板替换，你可以尝试直接传入额外参数：

```
cf --cfg 6 --steps 30 一只可爱猫猫
```

然后在工作流中使用 `{{cfg}}`、`{{steps}}`。

注意：

- 不同 Koishi 版本/配置对“未声明参数”的处理可能存在差异；如果发现参数没有生效，建议把它改成工作流内固定值，或在插件侧增加显式参数支持
- 如果 ComfyUI 节点对类型要求严格（例如必须是数字），但你用字符串占位导致类型不匹配：
  - 优先尝试让 ComfyUI 节点接受字符串（不少节点会自动转换）
  - 不行再把占位符改成不加引号的形式（此时工作流文件可能不再是合法 JSON，但作为模板可以工作）

## 🖼️ 多图输入与交互式上传

### 引用消息上传（一次性）

引用一条包含多张图片的消息，然后发送绘图指令；引用的图片会依次映射：

```
cf --wf default 生成同风格角色
```

工作流中用 `{{image1}}`、`{{image2}}`……取对应图片。

### 交互式上传（可缓存）

1. 进入交互模式：

```
cf --wt
```

1. 连续发送多张图片（可一次多张）
2. 发送“结束”退出
3. 再发送绘图指令：

```
cf 一位少女，半身像
```

### 清除缓存

```
cf --cl
```

## 🧰 常见问题

### 连接失败 / 无法拉取结果

- 检查 `serverEndpoint` 是否能从 Koishi 机器访问（远程 ComfyUI 时最常见）
- `isSecureConnection=true` 时，对应 ComfyUI 必须能通过 `https/wss` 访问

### 图片上传失败

- 检查 ComfyUI 是否启用了上传接口
- 检查 `comfyuiSubfolder` 对应的 input 子目录是否可写

## ℹ️ 关于本仓库

本项目基于 `flymyd/koishi-plugin-comfyui-client` 二次开发：

- 去掉了 LLM 增强提示词相关功能（更推荐在工作流侧实现）
- 新增多工作流管理能力

## 📄 许可协议

本项目使用 [MIT](./LICENSE) 许可协议。
