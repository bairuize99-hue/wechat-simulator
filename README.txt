微信模拟器 v0.2.1 修复补丁

问题：原版本虽然有 settings.html，但 manifest 中的 settings 字段不是 SillyTavern 官方第三方扩展加载设置面板的标准方式，因此安装后可能只有悬浮球，看不到“插件入口”。

本补丁采用 SillyTavern 官方文档推荐的 renderExtensionTemplateAsync()：
1. 新增 launcher.js 作为真正的扩展入口。
2. launcher.js 将 settings.html 注入 #extensions_settings2。
3. 设置面板顶部增加“打开微信”按钮。
4. 点击“打开微信”直接打开已有微信窗口，因此悬浮球和插件入口同时存在。
5. 原 index.js 不需要修改。

安装：用本补丁中的 manifest.json、settings.html 覆盖仓库对应文件，并把 launcher.js 放进仓库根目录。
然后在 SillyTavern 中重新加载/更新扩展。

入口：酒馆顶部“扩展” -> 微信模拟器 -> 打开微信。
悬浮球仍然保留。
