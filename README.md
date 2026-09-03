# 微信模拟器 / WeChat Simulator for SillyTavern

v0.2.0 — 面向 SillyTavern 的独立微信子系统。

## 已实现

- 悬浮球、拖拽、红点未读计数
- 私聊、联系人、双人/多人群聊基础结构
- `{{user}}` / `{{char}}` 身份与 NPC 动态联系人
- “我是谁 / 对方是谁”切换与 ⇄ 身份交换
- 正文 `[微信] A → B: 内容` 自动捕捉
- 可选宽松 `A → B: 内容` 与自定义 3 捕获组正则
- 正文消息去重，避免事件重复触发造成重复微信消息
- 图片 URL、定位、红包、转账、表情包、语音输入、电话/视频拟真 UI
- “计入正文”记忆开关
- 微信独立记录通过 `setExtensionPrompt` 注入主提示词，可设置深度
- 主酒馆 `generateRaw`、OpenAI-Compatible、Ollama
- 请求回复一次生成 1–12 条消息
- 当前聊天 `chat_metadata` 独立存储
- JSON 导入/导出
- 监听 `MESSAGE_RECEIVED`、`MESSAGE_UPDATED`、`GENERATION_ENDED`、`CHAT_CHANGED`、`CHAT_COMPLETION_PROMPT_READY`

## 安装

把整个 `wechat-simulator` 文件夹放到：

`SillyTavern/public/scripts/extensions/third-party/`

刷新 SillyTavern。

## 推荐正文格式

```text
[微信] C → D: 你到了吗？
[微信] D → C: 刚到。
```

插件会建立 C ↔ D 独立会话，并自动把 C、D 加入联系人。

## 记忆规则

- 正文捕获的消息默认标记为“计入正文”。
- 插件手动发送时可关闭“计入正文”。
- AI 生成的微信消息默认不计入正文。
- 开启“将未计入正文的微信记录注入主提示词”后，独立微信历史会进入 SillyTavern extension prompt，不会变成主聊天消息。

## 当前边界

电话/视频目前是本地拟真界面，不是真实 WebRTC；语音输入依赖浏览器 Speech Recognition；图片目前以 URL 形式保存。朋友圈、真实媒体上传、TTS 语音消息、群聊多角色智能调度将在后续版本继续开发。
