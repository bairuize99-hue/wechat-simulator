# 微信模拟器 / WeChat Simulator for SillyTavern

一个可直接放入 SillyTavern 的第三方前端扩展原型。目标是把“正文中的微信聊天”和“独立微信窗口”解耦：微信记录单独存储，但可以选择与正文记忆互通。

## 当前版本 0.1.0

已落地：

- 悬浮球打开/关闭微信窗口，支持拖拽。
- 独立聊天会话池，数据保存到当前 SillyTavern chat 的 `chat_metadata`。
- 私聊、双人群聊、联系人列表。
- `{{user}} / {{char}}` 初始身份，以及 NPC 自动加入联系人。
- “我是谁 / 对方是谁”切换和一键交换身份。
- 正文 `[微信] A → B: 内容` 自动解析；可选宽松 `A → B: 内容` 解析。
- 自定义正则：3 个捕获组分别对应发送者、接收者、内容。
- 发送文字、表情、表情包、图片 URL、定位卡、红包、转账、语音输入。
- 微信电话/视频通话的拟真 UI。
- “请求回复”批量生成，一次生成 1~12 条，而不是一条一回复。
- API：继承酒馆 `generateRaw` / OpenAI-Compatible / Ollama。
- “计入正文”开关；默认微信消息不自动成为主聊天消息。
- 可选双向记忆注入到 SillyTavern extension prompt。
- 主聊天 `MESSAGE_RECEIVED / GENERATION_ENDED / MESSAGE_UPDATED / CHAT_CHANGED` 事件同步。

## 安装

把整个 `wechat_simulator` 文件夹放入：

`SillyTavern/public/scripts/extensions/third-party/`

或者你的版本支持的用户扩展目录，然后刷新酒馆。

## 推荐正文格式

```text
[微信] C → D: 你到了吗？
[微信] D → C: 刚到。
```

如果一次消息里有多条，也会逐条捕捉。

## 关于“完整微信”

当前是可运行骨架，不是假装已经完成所有微信后端能力。图片目前支持图片 URL，语音输入依赖浏览器 Web Speech API，电话/视频是本地拟真界面。

下一阶段可以继续增加：

1. 图片上传到本地/酒馆资源；
2. 语音消息 TTS + 音频气泡；
3. 真正的通话状态和 AI 对话事件；
4. 朋友圈；
5. 群聊多人 AI 批量回复；
6. 联系人头像从角色卡/角色头像自动映射；
7. 更严格的正文解析器和消息锚点；
8. 独立世界书/角色卡选择；
9. “只读正文，不写入微信”的双向同步规则；
10. 导出/导入微信聊天记录 JSON；
11. API profile 管理；
12. 更接近手机微信的 UI。

## 兼容性说明

SillyTavern 的第三方扩展是通过 `manifest.json + index.js + css + settings.html` 形式加载的。本扩展只使用前端扩展接口和事件监听，不修改 SillyTavern 核心文件。

建议使用较新的 SillyTavern 版本。不同分支对 `generateRaw`、事件名称和扩展加载目录的接口可能存在差异。