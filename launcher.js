/* 微信模拟器 launcher
 * 负责两件事：
 * 1. 按 SillyTavern 官方第三方扩展方式，把 settings.html 注入扩展设置面板；
 * 2. 再启动原 index.js，保证原有微信逻辑不需要重写。
 */
import { getContext } from '../../../st-context.js';
import { init as initWechat } from './index.js';

let mounted = false;

async function mountSettings() {
    if (mounted) return;
    const context = getContext();
    const container = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
    if (!container) {
        console.warn('[微信模拟器] 找不到 SillyTavern 扩展设置容器，将仅启动悬浮球。');
        return;
    }

    if (!document.getElementById('wxsim_settings')) {
        try {
            const html = await context.renderExtensionTemplateAsync('third-party/wechat-simulator', 'settings');
            container.insertAdjacentHTML('beforeend', html);
        } catch (error) {
            console.error('[微信模拟器] 无法加载 settings.html', error);
            return;
        }
    }

    mounted = true;
}

export async function init() {
    await mountSettings();
    await initWechat();

    const openButton = document.getElementById('wxsim_open_from_panel');
    if (openButton) {
        openButton.addEventListener('click', () => {
            const ball = document.getElementById('wxsim_float');
            if (ball) ball.click();
        });
    }

    const settingsButton = document.getElementById('wxsim_panel_settings');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            const settings = document.getElementById('wxsim_settings_advanced');
            settings?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }
}
