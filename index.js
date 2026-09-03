
/*
 * 微信模拟器 / WeChat Simulator for SillyTavern
 * v0.1.0
 *
 * Pure client extension. No core modification required.
 */
import { getContext } from '../../../st-context.js';
import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const EXT = 'wechat_simulator';
const DEFAULTS = {
    enabled: true,
    apiMode: 'main',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    batch: 3,
    parseMode: 'marked',
    regex: '',
    injectMemory: false,
    autoRoster: true,
};

const EMOJIS = ['😀','😂','🥹','😍','😎','😭','😡','😳','🤔','😴','🥰','😏','🙄','🤍','❤️','👍','👀','🎉','✨','🌸','🍬','🐱','🐶','🫠','🫶'];
const STICKERS = ['(｡•̀ᴗ-)✧','(╥﹏╥)','(๑•́ ₃ •̀๑)','(づ｡◕‿‿◕｡)づ','(￣▽￣)ノ','(っ´ω`)ﾉ(╥ω╥)','(´• ω •`)ﾉ','(ง •̀_•́)ง'];

let state = {
    open: false,
    currentSession: null,
    me: '{{user}}',
    target: '{{char}}',
    composing: '',
    unread: 0,
    settingsBound: false,
};

function ensureSettings() {
    extension_settings[EXT] = { ...DEFAULTS, ...(extension_settings[EXT] || {}) };
    return extension_settings[EXT];
}
function saveSettings() {
    saveSettingsDebounced();
}
function ctx() {
    try { return getContext(); } catch { return {}; }
}
function metadata() {
    const c = ctx();
    if (!c.chatMetadata) return null;
    if (!c.chatMetadata[EXT]) c.chatMetadata[EXT] = createData();
    return c.chatMetadata[EXT];
}
function createData() {
    return {
        contacts: {
            '{{user}}': { name: '{{user}}', avatar: '', kind:'user' },
            '{{char}}': { name: '{{char}}', avatar: '', kind:'char' },
        },
        sessions: {},
        order: [],
        active: null,
    };
}
function ensureData() {
    const d = metadata();
    if (!d) return null;
    d.contacts ||= {};
    d.sessions ||= {};
    d.order ||= [];
    if (!d.contacts['{{user}}']) d.contacts['{{user}']={name:'{{user}}',avatar:'',kind:'user'};
    if (!d.contacts['{{char}}']) d.contacts['{{char}']={name:'{{char}}',avatar:'',kind:'char'};
    return d;
}
function sessionId(a,b,group=false) {
    if (group) return 'group:' + [a,b].sort().join('|');
    return 'dm:' + [a,b].sort().join('|');
}
function ensureSession(a,b,group=false) {
    const d=ensureData(); if(!d) return null;
    const id=sessionId(a,b,group);
    if(!d.sessions[id]) {
        d.sessions[id]={id, title: group ? `${a} · ${b}` : b, group, participants: group?[a,b]:[a,b], messages:[]};
        d.order.push(id);
    } else {
        d.sessions[id].participants ||= [a,b];
        if(group) d.sessions[id].group=true;
    }
    d.active=id;
    saveMetadata();
    return d.sessions[id];
}
function saveMetadata() {
    const c=ctx();
    try { c.saveMetadataDebounced?.(); } catch {}
}
function uid() { return 'wx_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
function addContact(name, extra={}) {
    if(!name) return;
    const d=ensureData(); if(!d) return;
    name=String(name).trim();
    if(!name) return;
    d.contacts[name] ||= {name, avatar:'', kind:'npc'};
    Object.assign(d.contacts[name], extra);
}
function addMessage(session, sender, receiver, text, type='text', extra={}) {
    const d=ensureData(); if(!d) return null;
    const s=d.sessions[session] || ensureSession(sender,receiver,false);
    const m={id:uid(), sender, receiver, text:String(text??''), type, time:Date.now(), countInMain:!!extra.countInMain, extra};
    s.messages.push(m);
    addContact(sender); addContact(receiver);
    saveMetadata();
    return m;
}
function escapeHtml(s) {
    return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function avatarFor(name) {
    const d=ensureData();
    const c=d?.contacts?.[name];
    if(c?.avatar) return c.avatar;
    const cx=ctx();
    try {
        if(name==='{{user}}' && cx.persona) return cx.persona.avatar || '';
        const idx=(cx.characters||[]).findIndex(x=>x?.name===name);
        if(idx>=0) return cx.characters[idx].avatar || '';
    } catch {}
    return '';
}
function avatarHtml(name, small=false) {
    const url=avatarFor(name);
    if(url) return `<img class="wx-avatar ${small?'small':''}" src="${escapeHtml(url)}" alt="">`;
    return `<div class="wx-avatar ${small?'small':''} wx-avatar-fallback">${escapeHtml(String(name).slice(0,1)||'?')}</div>`;
}
function formatTime(ts) {
    const d=new Date(ts);
    const now=new Date();
    if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
}

function buildUI() {
    if(document.getElementById('wxsim_root')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="wxsim_root" class="wxsim-root">
        <button id="wxsim_float" class="wxsim-float" title="打开微信模拟器"><span>微</span><b id="wxsim_badge"></b></button>
        <section id="wxsim_window" class="wxsim-window" aria-hidden="true">
          <header class="wxsim-header">
            <div class="wxsim-brand"><span class="wxsim-brand-dot"></span><strong>微信</strong><small id="wxsim_session_title">微信模拟器</small></div>
            <div class="wxsim-header-actions">
              <button id="wxsim_settings_btn" title="设置">⚙</button>
              <button id="wxsim_min_btn" title="最小化">—</button>
              <button id="wxsim_close_btn" title="关闭">×</button>
            </div>
          </header>
          <div class="wxsim-body">
            <aside class="wxsim-sidebar">
              <div class="wxsim-tabs">
                <button data-tab="chat" class="active">聊天</button>
                <button data-tab="contacts">通讯录</button>
              </div>
              <div id="wxsim_side_list"></div>
            </aside>
            <main class="wxsim-main">
              <div class="wxsim-chat-head">
                <div>
                  <strong id="wxsim_title">选择聊天</strong>
                  <span id="wxsim_subtitle"></span>
                </div>
                <div class="wxsim-role-tools">
                  <select id="wxsim_me"></select>
                  <button id="wxsim_swap" title="交换我的身份与对方">⇄</button>
                  <select id="wxsim_target"></select>
                  <button id="wxsim_group" title="创建/切换双人群聊">群</button>
                </div>
              </div>
              <div id="wxsim_messages" class="wxsim-messages"></div>
              <div id="wxsim_more_menu" class="wxsim-more-menu">
                <button data-type="image">图片</button><button data-type="location">定位</button><button data-type="redpacket">红包</button><button data-type="transfer">转账</button><button data-type="sticker">表情包</button>
              </div>
              <div class="wxsim-compose">
                <div class="wxsim-compose-tools">
                  <button id="wxsim_voice" title="语音输入">🎙</button>
                  <button id="wxsim_emoji" title="表情">☺</button>
                  <button id="wxsim_more" title="更多">＋</button>
                  <button id="wxsim_call" title="微信电话">☎</button>
                  <button id="wxsim_video" title="视频通话">▣</button>
                </div>
                <div id="wxsim_emoji_panel" class="wxsim-pop-panel"></div>
                <textarea id="wxsim_input" placeholder="输入消息……"></textarea>
                <div class="wxsim-compose-bottom">
                  <label class="wxsim-memory-toggle"><input id="wxsim_count_memory" type="checkbox">计入正文</label>
                  <button id="wxsim_send" class="wxsim-send">发送</button>
                  <button id="wxsim_generate" class="wxsim-generate">请求回复</button>
                </div>
              </div>
            </main>
          </div>
        </section>
        <div id="wxsim_call_overlay" class="wxsim-call-overlay" hidden></div>
      </div>
    `);
    bindUI();
    renderAll();
}
function bindUI() {
    const $=id=>document.getElementById(id);
    $('wxsim_float').onclick=()=>toggleWindow();
    $('wxsim_min_btn').onclick=()=>toggleWindow(false);
    $('wxsim_close_btn').onclick=()=>toggleWindow(false);
    $('wxsim_settings_btn').onclick=()=>openSettings();
    $('wxsim_send').onclick=sendComposed;
    $('wxsim_generate').onclick=generateReplies;
    $('wxsim_swap').onclick=swapRoles;
    $('wxsim_group').onclick=()=>createGroup();
    $('wxsim_more').onclick=()=> $('wxsim_more_menu').classList.toggle('show');
    $('wxsim_emoji').onclick=()=> $('wxsim_emoji_panel').classList.toggle('show');
    $('wxsim_voice').onclick=startVoiceInput;
    $('wxsim_call').onclick=()=>showCall('voice');
    $('wxsim_video').onclick=()=>showCall('video');
    $('wxsim_input').addEventListener('keydown',e=>{
        if(e.key==='Enter' && !e.shiftKey){e.preventDefault();sendComposed();}
    });
    $('wxsim_emoji_panel').innerHTML=EMOJIS.map(x=>`<button>${x}</button>`).join('');
    $('wxsim_emoji_panel').querySelectorAll('button').forEach(b=>b.onclick=()=>{
        $('wxsim_input').value += b.textContent; $('wxsim_input').focus();
    });
    $('wxsim_more_menu').querySelectorAll('button').forEach(b=>b.onclick=()=>handleSpecial(b.dataset.type));
    $('wxsim_me').onchange=()=>{state.me=$('wxsim_me').value; ensureActiveFromRoles(); renderMessages();};
    $('wxsim_target').onchange=()=>{state.target=$('wxsim_target').value; ensureActiveFromRoles(); renderMessages();};
    document.querySelectorAll('#wxsim_root .wxsim-tabs button').forEach(b=>b.onclick=()=>{
        document.querySelectorAll('#wxsim_root .wxsim-tabs button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active'); renderSidebar(b.dataset.tab);
    });
}
function toggleWindow(force) {
    state.open=force ?? !state.open;
    const w=document.getElementById('wxsim_window');
    if(w){w.classList.toggle('open',state.open);w.setAttribute('aria-hidden',String(!state.open));}
    if(state.open){state.unread=0;updateBadge();renderAll();}
}
function updateBadge() {
    const b=document.getElementById('wxsim_badge'); if(!b) return;
    b.textContent=state.unread>99?'99+':String(state.unread||'');
    b.classList.toggle('show',state.unread>0);
}
function renderAll() {
    ensureData();
    populateRoleSelects();
    renderSidebar('chat');
    renderMessages();
}
function populateRoleSelects() {
    const d=ensureData(); if(!d) return;
    const names=Object.keys(d.contacts);
    if(!names.includes(state.me)) state.me=names.includes('{{user}}')?'{{user}}':names[0];
    if(!names.includes(state.target) || state.target===state.me) state.target=names.find(n=>n!==state.me)||names[0];
    for(const id of ['wxsim_me','wxsim_target']){
        const el=document.getElementById(id); if(!el) continue;
        const val=id==='wxsim_me'?state.me:state.target;
        el.innerHTML=names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
        el.value=val;
    }
}
function renderSidebar(tab='chat') {
    const el=document.getElementById('wxsim_side_list'); if(!el) return;
    const d=ensureData(); if(!d) return;
    if(tab==='contacts'){
        el.innerHTML=Object.keys(d.contacts).map(n=>`
          <button class="wxsim-side-item contact" data-name="${escapeHtml(n)}">${avatarHtml(n,true)}<span><b>${escapeHtml(n)}</b><small>${escapeHtml(d.contacts[n].kind||'联系人')}</small></span></button>`).join('');
        el.querySelectorAll('[data-name]').forEach(b=>b.onclick=()=>{
            state.target=b.dataset.name;
            if(state.target===state.me) state.me=Object.keys(d.contacts).find(x=>x!==state.target)||'{{user}}';
            ensureActiveFromRoles(); populateRoleSelects(); renderMessages();
        });
        return;
    }
    const ids=d.order.slice().reverse();
    el.innerHTML=ids.map(id=>{
        const s=d.sessions[id]; const last=s.messages?.[s.messages.length-1];
        const label=s.title||s.participants?.join(' · ')||id;
        return `<button class="wxsim-side-item ${d.active===id?'active':''}" data-id="${escapeHtml(id)}">
          ${avatarHtml((s.participants||[])[1]||s.participants?.[0]||'?',true)}
          <span><b>${escapeHtml(label)}</b><small>${escapeHtml(last?.text||'暂无消息')}</small></span>
        </button>`;
    }).join('') || '<div class="wxsim-empty">还没有微信会话</div>';
    el.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{
        d.active=b.dataset.id;
        const s=d.sessions[d.active];
        if(s?.participants?.length>=2){state.me=s.participants[0];state.target=s.participants[1];}
        populateRoleSelects(); renderSidebar('chat'); renderMessages(); saveMetadata();
    });
}
function ensureActiveFromRoles() {
    const d=ensureData(); if(!d) return;
    const s=ensureSession(state.me,state.target,false);
    d.active=s.id;
}
function renderMessages() {
    const el=document.getElementById('wxsim_messages'); if(!el) return;
    const d=ensureData(); if(!d) return;
    let s=d.sessions[d.active];
    if(!s){s=ensureSession(state.me,state.target,false);}
    document.getElementById('wxsim_title').textContent=s.title||state.target;
    document.getElementById('wxsim_session_title').textContent=s.group?'群聊':'聊天';
    document.getElementById('wxsim_subtitle').textContent=s.group?` ${s.participants.join('、')}`:` ${state.me} → ${state.target}`;
    el.innerHTML=(s.messages||[]).map(m=>{
        const mine=m.sender===state.me;
        let body='';
        if(m.type==='image') body=`<div class="wx-bubble-media"><img src="${escapeHtml(m.text)}" alt="图片"></div>`;
        else if(m.type==='location') body=`<div class="wx-location-card"><div class="wx-map">⌖</div><div><b>${escapeHtml(m.extra?.label||'位置')}</b><small>${escapeHtml(m.text)}</small></div></div>`;
        else if(m.type==='redpacket') body=`<div class="wx-redpacket">🧧 <span>${escapeHtml(m.text||'恭喜发财，大吉大利')}</span></div>`;
        else if(m.type==='transfer') body=`<div class="wx-transfer">¥ <span>${escapeHtml(m.text||'0.00')}<small>转账</small></span></div>`;
        else if(m.type==='sticker') body=`<div class="wx-sticker">${escapeHtml(m.text)}</div>`;
        else if(m.type==='voice') body=`<div class="wx-voice" style="--voice:${Math.min(10,Math.max(2,Number(m.extra?.seconds)||3))}em">🔊 <span>${escapeHtml(m.text||'语音')}</span></div>`;
        else if(m.type==='call') body=`<div class="wx-system-pill">${escapeHtml(m.text)}</div>`;
        else body=`<div class="wx-text">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div>`;
        return `<div class="wx-msg-row ${mine?'mine':'theirs'}" data-mid="${m.id}">
          ${mine?'':avatarHtml(m.sender)}
          <div class="wx-msg-col"><div class="wx-msg-name">${s.group&&!mine?escapeHtml(m.sender):''}</div>${body}<time>${formatTime(m.time)}</time></div>
          ${mine?avatarHtml(m.sender):''}
        </div>`;
    }).join('') || `<div class="wx-chat-empty"><div class="wx-chat-icon">微</div><p>开始和 ${escapeHtml(state.target)} 聊天</p></div>`;
    requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight;});
}
function sendComposed() {
    const input=document.getElementById('wxsim_input'); const text=input?.value.trim(); if(!text)return;
    const count=document.getElementById('wxsim_count_memory')?.checked||false;
    const s=ensureSession(state.me,state.target,false);
    addMessage(s.id,state.me,state.target,text,'text',{countInMain:count});
    input.value=''; renderSidebar('chat'); renderMessages();
}
function swapRoles() {
    const x=state.me; state.me=state.target; state.target=x;
    ensureActiveFromRoles(); populateRoleSelects(); renderMessages(); renderSidebar('chat');
}
function createGroup() {
    const d=ensureData(); if(!d) return;
    const names=Object.keys(d.contacts).filter(n=>n!==state.me);
    if(names.length<2){toast('至少需要两个联系人才能创建双人群聊。');return;}
    const a=prompt('输入群聊参与者姓名，用逗号分隔：', names.slice(0,2).join(','));
    if(!a)return;
    const ps=a.split(/[,，、]/).map(x=>x.trim()).filter(Boolean);
    ps.unshift(state.me);
    [...new Set(ps)].forEach(addContact);
    const id='group:'+ps.sort().join('|');
    d.sessions[id] ||= {id,title:ps.join('、'),group:true,participants:ps,messages:[]};
    if(!d.order.includes(id))d.order.push(id);
    d.active=id; state.target=ps.find(x=>x!==state.me)||ps[0];
    saveMetadata(); renderAll();
}
function handleSpecial(type) {
    document.getElementById('wxsim_more_menu')?.classList.remove('show');
    if(type==='image'){
        const url=prompt('图片 URL（也可粘贴可访问的图片地址）：');
        if(url){const s=ensureActiveSession();addMessage(s.id,state.me,state.target,url,'image');renderMessages();}
    } else if(type==='location'){
        const label=prompt('位置名称：','当前位置'); if(label){const detail=prompt('位置描述：','附近');const s=ensureActiveSession();addMessage(s.id,state.me,state.target,detail||'', 'location',{label});renderMessages();}
    } else if(type==='redpacket'){
        const amount=prompt('红包金额：','8.88'); if(amount){const s=ensureActiveSession();addMessage(s.id,state.me,state.target,`¥${amount} · 恭喜发财，大吉大利`,'redpacket');renderMessages();}
    } else if(type==='transfer'){
        const amount=prompt('转账金额：','10.00'); if(amount){const s=ensureActiveSession();addMessage(s.id,state.me,state.target,amount,'transfer');renderMessages();}
    } else if(type==='sticker'){
        const x=prompt('表情包文字/描述：',STICKERS[Math.floor(Math.random()*STICKERS.length)]); if(x){const s=ensureActiveSession();addMessage(s.id,state.me,state.target,x,'sticker');renderMessages();}
    }
}
function ensureActiveSession() {
    const d=ensureData(); return d.sessions[d.active] || ensureSession(state.me,state.target,false);
}
function startVoiceInput() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){toast('当前浏览器不支持 Web Speech 语音输入。');return;}
    const r=new SR(); r.lang='zh-CN';r.interimResults=true;r.continuous=false;
    r.onresult=e=>{let t='';for(const x of e.results)t+=x[0].transcript;document.getElementById('wxsim_input').value=t;};
    r.onerror=()=>toast('语音输入失败或权限被拒绝。');r.start();
}
function showCall(kind) {
    const o=document.getElementById('wxsim_call_overlay'); if(!o)return;
    const s=ensureActiveSession();
    o.hidden=false;
    o.innerHTML=`<div class="wx-call-card ${kind}">
      <div class="wx-call-avatar">${avatarHtml(state.target)}</div>
      <h2>${escapeHtml(state.target)}</h2><p>${kind==='video'?'视频通话':'微信电话'}</p>
      <div class="wx-call-status">正在呼叫…</div>
      <div class="wx-call-actions"><button id="wx_call_end">挂断</button><button id="wx_call_fake">接通</button></div>
    </div>`;
    document.getElementById('wx_call_end').onclick=()=>{o.hidden=true;addMessage(s.id,state.me,state.target,kind==='video'?'已结束视频通话':'已结束通话','call');renderMessages();};
    document.getElementById('wx_call_fake').onclick=()=>{
        o.querySelector('.wx-call-status').textContent='通话中 00:01';
        setTimeout(()=>{if(!o.hidden)o.querySelector('.wx-call-status').textContent='通话中';},1000);
    };
}
async function generateReplies() {
    const d=ensureData(); if(!d)return;
    const s=ensureActiveSession();
    const btn=document.getElementById('wxsim_generate'); if(btn) {btn.disabled=true;btn.textContent='生成中…';}
    try{
        const n=Math.min(12,Math.max(1,Number(ensureSettings().batch)||3));
        const prompt=buildGenerationPrompt(s,n);
        const raw=await callAI(prompt);
        const replies=parseAIReplies(raw,s);
        if(!replies.length) throw new Error('模型没有返回可识别的回复。');
        replies.forEach(r=>addMessage(s.id,r.sender,r.receiver,r.text,r.type||'text',{generated:true,countInMain:false}));
        renderSidebar('chat');renderMessages();
    }catch(e){console.error('[微信模拟器]',e);toast(`生成失败：${e.message||e}`);}
    finally{if(btn){btn.disabled=false;btn.textContent='请求回复';}}
}
function buildGenerationPrompt(s,n) {
    const participants=s.participants||[state.me,state.target];
    const history=s.messages.slice(-30).map(m=>`${m.sender} -> ${m.receiver}: ${m.text}`).join('\n');
    return `你现在是“微信聊天模拟器”的后台对话引擎。
参与者：${participants.join('、')}
当前发送者视角：${state.me}
当前聊天对象：${state.target}
根据角色设定、故事上下文和最近微信记录，继续自然聊天。
一次生成 ${n} 条即可，不要解释，不要旁白，不要替用户决定发送者身份。
必须只输出 JSON 数组，格式：
[{"sender":"角色名","receiver":"角色名","text":"消息内容","type":"text"}]
type 可选 text/sticker/location/redpacket/transfer/voice。
最近记录：
${history||'(无)'}
`;
}
async function callAI(prompt) {
    const s=ensureSettings();
    if(s.apiMode==='main'){
        const c=ctx();
        if(typeof c.generateRaw!=='function') throw new Error('当前版本未暴露 generateRaw；请改用独立 OpenAI-Compatible API。');
        const out=await c.generateRaw({prompt,responseLength:1000,trimNames:false});
        return typeof out==='string'?out:JSON.stringify(out);
    }
    let base=s.baseUrl.trim().replace(/\/+$/,'');
    if(s.apiMode==='ollama'){
        if(!/\/api$/.test(base)) base += '/api';
        const res=await fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:s.model||'llama3.2',messages:[{role:'user',content:prompt}],stream:false,options:{temperature:Number(s.temperature)}})});
        if(!res.ok)throw new Error(`${res.status} ${await res.text()}`);
        const j=await res.json(); return j.message?.content||'';
    }
    if(!/\/v1$/.test(base)) base += '/v1';
    const headers={'Content-Type':'application/json'};if(s.apiKey)headers.Authorization=`Bearer ${s.apiKey}`;
    const res=await fetch(base+'/chat/completions',{method:'POST',headers,body:JSON.stringify({model:s.model,messages:[{role:'system',content:'You output only valid JSON.'},{role:'user',content:prompt}],temperature:Number(s.temperature),max_tokens:1200})});
    if(!res.ok)throw new Error(`${res.status} ${await res.text()}`);
    const j=await res.json(); return j.choices?.[0]?.message?.content||'';
}
function parseAIReplies(raw,s) {
    let x=String(raw||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    try{
        const j=JSON.parse(x);
        if(Array.isArray(j)) return j.filter(r=>r?.text).map(r=>({sender:r.sender||state.target,receiver:r.receiver||state.me,text:r.text,type:r.type||'text'}));
    }catch{}
    const arr=[]; const re=/([^:\n]{1,30})\s*[:：]\s*(.+)/g; let m;
    while((m=re.exec(x)) && arr.length<12) arr.push({sender:m[1].trim(),receiver:m[1].trim()===state.me?state.target:state.me,text:m[2].trim(),type:'text'});
    return arr;
}
function toast(msg) {
    let el=document.getElementById('wxsim_toast'); if(!el){document.body.insertAdjacentHTML('beforeend','<div id="wxsim_toast"></div>');el=document.getElementById('wxsim_toast');}
    el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600);
}
function openSettings() {
    const el=document.querySelector('#extensions_settings #wxsim_settings')||document.querySelector('#wxsim_settings');
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});return;}
    toast('请在酒馆扩展面板中打开“微信模拟器”设置。');
}

/* ---------- Main-chat parser ---------- */
function compileParser() {
    const s=ensureSettings();
    if(s.regex){
        try{return new RegExp(s.regex,'gm');}catch(e){console.warn('[微信模拟器] 自定义正则无效',e);}
    }
    return null;
}
function parseWechat(text) {
    const out=[];
    const custom=compileParser();
    const push=(sender,receiver,body)=>{
        sender=String(sender).trim();receiver=String(receiver).trim();body=String(body).trim();
        if(!sender||!receiver||!body)return;
        if(body.length>4000)return;
        out.push({sender,receiver,text:body});
    };
    if(custom){
        let m;while((m=custom.exec(text))){if(m[1]&&m[2]&&m[3])push(m[1],m[2],m[3]);}
    }
    const marked=/\[微信(?:聊天|消息)?\]\s*([^\n:：]+?)\s*(?:→|->|＞)\s*([^\n:：]+?)\s*[:：]\s*(.+)/g;
    let m;while((m=marked.exec(text)))push(m[1],m[2],m[3]);
    if(ensureSettings().parseMode==='broad'){
        const broad=/^\s*([^\n:：]{1,30})\s*(?:→|->|＞)\s*([^\n:：]{1,30})\s*[:：]\s*(.+)$/gm;
        while((m=broad.exec(text)))push(m[1],m[2],m[3]);
    }
    const uniq=[];const seen=new Set();
    for(const x of out){const k=x.sender+'|'+x.receiver+'|'+x.text;if(!seen.has(k)){seen.add(k);uniq.push(x);}}
    return uniq;
}
function syncMainMessage(message) {
    if(!ensureSettings().enabled)return;
    const text=typeof message==='string'?message:(message?.mes||message?.message||'');
    if(!text)return;
    const parsed=parseWechat(text); if(!parsed.length)return;
    const d=ensureData();if(!d)return;
    let added=0;
    for(const p of parsed){
        addContact(p.sender);addContact(p.receiver);
        let s=ensureSession(p.sender,p.receiver,false);
        const duplicate=s.messages.some(m=>m.text===p.text&&m.sender===p.sender&&m.receiver===p.receiver);
        if(!duplicate){addMessage(s.id,p.sender,p.receiver,p.text,'text',{source:'main',countInMain:true});added++;}
        d.active=s.id;
    }
    if(added && !state.open){state.unread+=added;updateBadge();}
    renderAll();
}
function injectMemoryIfNeeded() {
    const s=ensureSettings(); if(!s.injectMemory)return;
    const d=ensureData(); if(!d)return;
    const lines=[];
    Object.values(d.sessions).forEach(x=>x.messages.slice(-20).forEach(m=>{
        if(!m.countInMain && m.extra?.generated!==undefined || !m.countInMain){
            lines.push(`[微信] ${m.sender} -> ${m.receiver}: ${m.text}`);
        }
    }));
    if(!lines.length)return;
    const c=ctx();
    try{
        if(typeof c.setExtensionPrompt==='function'){
            c.setExtensionPrompt(EXT,`以下是独立微信聊天记录，仅作为剧情记忆，不要把它当作当前用户消息：\n${lines.slice(-60).join('\n')}`,1,1);
        }
    }catch(e){console.warn('[微信模拟器] 注入失败',e);}
}

/* ---------- Settings binding ---------- */
function bindSettings() {
    if(state.settingsBound)return;
    const root=document.getElementById('wxsim_settings'); if(!root)return;
    const s=ensureSettings();
    const fields={
      wxsim_enabled:'enabled',wxsim_api_mode:'apiMode',wxsim_base_url:'baseUrl',wxsim_api_key:'apiKey',
      wxsim_model:'model',wxsim_temperature:'temperature',wxsim_batch:'batch',wxsim_parse_mode:'parseMode',
      wxsim_regex:'regex',wxsim_inject_memory:'injectMemory',wxsim_auto_roster:'autoRoster'
    };
    for(const [id,key] of Object.entries(fields)){
        const el=document.getElementById(id);if(!el)continue;
        if(el.type==='checkbox')el.checked=!!s[key];else el.value=s[key]??'';
        el.addEventListener('input',()=>{s[key]=el.type==='checkbox'?el.checked:(el.type==='number'?Number(el.value):el.value);saveSettings();});
        el.addEventListener('change',()=>{s[key]=el.type==='checkbox'?el.checked:(el.type==='number'?Number(el.value):el.value);saveSettings();});
    }
    const mode=document.getElementById('wxsim_api_mode');
    const custom=document.getElementById('wxsim_custom_api');
    const refresh=()=>custom.style.display=mode.value==='main'?'none':'block';
    mode.addEventListener('change',refresh);refresh();
    document.getElementById('wxsim_test_api').onclick=async()=>{
        const st=document.getElementById('wxsim_api_status');st.textContent='测试中…';
        try{const r=await callAI('只回复：OK');st.textContent=r?'连接成功':'返回为空';}
        catch(e){st.textContent='失败：'+(e.message||e);}
    };
    state.settingsBound=true;
}

/* ---------- Drag / responsive ---------- */
function enableDrag() {
    const ball=document.getElementById('wxsim_float'); if(!ball)return;
    let down=false,sx=0,sy=0,ox=0,oy=0;
    ball.addEventListener('pointerdown',e=>{
        down=true;sx=e.clientX;sy=e.clientY;const r=ball.getBoundingClientRect();ox=r.left;oy=r.top;ball.setPointerCapture(e.pointerId);
    });
    ball.addEventListener('pointermove',e=>{if(!down)return;const x=Math.max(6,Math.min(innerWidth-ball.offsetWidth-6,ox+e.clientX-sx));const y=Math.max(6,Math.min(innerHeight-ball.offsetHeight-6,oy+e.clientY-sy));ball.style.left=x+'px';ball.style.top=y+'px';ball.style.right='auto';ball.style.bottom='auto';});
    ball.addEventListener('pointerup',()=>{down=false;});
}

function init() {
    ensureSettings();
    buildUI();
    enableDrag();
    bindSettings();
    const c=ctx();
    const es=window.SillyTavern?.eventSource;
    const et=window.SillyTavern?.eventTypes;
    if(es&&et){
        if(et.MESSAGE_RECEIVED) es.on(et.MESSAGE_RECEIVED,(id)=>{try{syncMainMessage(c.chat?.[id]);}catch{}});
        if(et.GENERATION_ENDED) es.on(et.GENERATION_ENDED,()=>{try{syncMainMessage(c.chat?.[c.chat.length-1]);injectMemoryIfNeeded();}catch{}});
        if(et.MESSAGE_UPDATED) es.on(et.MESSAGE_UPDATED,(id)=>{try{syncMainMessage(c.chat?.[id]);}catch{}});
        if(et.CHAT_CHANGED) es.on(et.CHAT_CHANGED,()=>{state.unread=0;updateBadge();setTimeout(()=>{ensureData();renderAll();injectMemoryIfNeeded();},100);});
    }
    setTimeout(()=>bindSettings(),500);
    console.log('[微信模拟器] initialized v0.1.0');
}
export { init };
