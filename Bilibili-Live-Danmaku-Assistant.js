// ==UserScript==
// @name         Bilibili-Live-Danmaku-Assistant (B站直播间弹幕增强脚本)
// @namespace    https://github.com/SakikoTogawa0214/Bilibili-Live-Danmaku-Assistant/tree/main
// @version      1.1
// @description  一个轻量、高效、完美融合原生的 B站 直播间弹幕增强 Tampermonkey (油猴) 脚本。
// @author       SakikoTogawa0214
// @match        https://live.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ================= 1. 样式注入 =================
    GM_addStyle(`
        /* 聊天栏 +1 和 复制 按钮组样式 */
        .chat-item.danmaku-item { position: relative; }
        .bili-action-group {
            display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            flex-direction: column; gap: 4px; z-index: 100;
        }
        .chat-item.danmaku-item:hover .bili-action-group { display: flex; }
        .bili-action-btn {
            background-color: #00D1F1; color: #fff; border: none; border-radius: 4px;
            padding: 2px 6px; font-size: 12px; cursor: pointer; line-height: 1.2;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: 0.2s; user-select: none;
        }
        .bili-action-btn:hover { background-color: #00b5d1; }
        .btn-copy { background-color: #ff6699; }
        .btn-copy:hover { background-color: #ff4785; }

        /* 独轮车入口按钮样式 */
        .unicycle-entry {
            display: inline-block; vertical-align: middle; cursor: pointer;
            margin-right: 12px; font-size: 14px; color: #9499A0; user-select: none;
            transition: color 0.2s; position: relative;
        }
        .unicycle-entry:hover { color: #00D1F1; }

        /* 独轮车面板样式 */
        .unicycle-panel {
            display: none; position: fixed; width: 280px;
            background: #fff; border: 1px solid #e3e5e7; border-radius: 8px;
            padding: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            z-index: 999999; cursor: default;
        }
        .unicycle-panel.show { display: block; }

        /* 设置区样式 */
        .unicycle-settings {
            display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;
            padding-bottom: 12px; border-bottom: 1px dashed #e3e5e7;
        }
        .uni-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #18191C; }
        .uni-interval input { width: 40px; padding: 2px; border: 1px solid #e3e5e7; border-radius: 4px; text-align: center; outline: none; }
        .uni-interval input:focus { border-color: #00D1F1; }
        .uni-mode-group label { cursor: pointer; margin-left: 8px; }
        .uni-toggle-label { font-weight: bold; color: #ff6699; cursor: pointer; }
        .uni-antispam-label { font-weight: bold; color: #00D1F1; cursor: pointer; }

        /* 顶部输入区 */
        .unicycle-input-box { display: flex; gap: 6px; margin-bottom: 10px; }
        .unicycle-input {
            flex: 1; border: 1px solid #e3e5e7; border-radius: 4px;
            padding: 4px 8px; font-size: 12px; outline: none; color: #18191C;
        }
        .unicycle-input:focus { border-color: #00D1F1; }
        .unicycle-add-btn {
            background: #00D1F1; color: #fff; border: none; border-radius: 4px;
            padding: 0 10px; font-size: 12px; cursor: pointer; transition: 0.2s;
        }
        .unicycle-add-btn:hover { background: #00b5d1; }

        /* 梗列表区 */
        .unicycle-list { max-height: 150px; overflow-y: auto; padding-right: 4px; }
        .unicycle-list::-webkit-scrollbar { width: 4px; }
        .unicycle-list::-webkit-scrollbar-thumb { background: #c0c4cc; border-radius: 2px; }
        .unicycle-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 4px; border-bottom: 1px solid #f1f2f3; transition: background-color 0.2s;
        }
        .unicycle-item.running-active {
            background-color: #ffe6ed; border-left: 3px solid #ff6699; padding-left: 5px;
        }
        .unicycle-text {
            flex: 1; font-size: 12px; color: #18191C; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis; margin-right: 8px;
        }
        .unicycle-action { display: flex; gap: 4px; }
        .unicycle-action button {
            cursor: pointer; border: none; background: #f1f2f3; color: #61666D;
            border-radius: 4px; padding: 3px 8px; font-size: 12px; transition: 0.2s;
        }
        .unicycle-action button:hover { background: #e3e5e7; }
        .unicycle-action .send-btn.running { background: #ff6699; color: #fff; }
        .unicycle-action .send-btn.running:hover { background: #ff4785; }
        .unicycle-action .del-btn:hover { color: #F56C6C; }
    `);

    // ================= 2. 状态管理 =================
    let config = JSON.parse(localStorage.getItem('bili_unicycle_config')) || {
        isAutoOn: false,
        isAntiSpamOn: false,
        mode: 'single',
        interval: 6
    };

    let runTimer = null;
    let runState = null;

    function saveConfig() { localStorage.setItem('bili_unicycle_config', JSON.stringify(config)); }
    function getMemes() { try { return JSON.parse(localStorage.getItem('bili_unicycle_memes')) || []; } catch (e) { return []; } }
    function saveMemes(memes) { localStorage.setItem('bili_unicycle_memes', JSON.stringify(memes)); }

    // ================= 3. 核心发送功能 =================
    function sendDanmaku(text) {
        const textarea = document.querySelector('textarea.chat-input') || document.querySelector('.chat-input');
        const sendBtn = document.querySelector('.bottom-actions button');
        if (textarea && sendBtn) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => { sendBtn.click(); }, 50);
        }
    }

    // ================= 4. 独轮车循环控制 =================
    function updateVisualIndicator() {
        const items = document.querySelectorAll('.unicycle-item');
        items.forEach((item, idx) => {
            const btn = item.querySelector('.send-btn');
            if (!runState) {
                item.classList.remove('running-active');
                btn.classList.remove('running');
                btn.innerText = config.isAutoOn ? '启动' : '发送';
            } else {
                if (idx === runState.currentIndex) {
                    item.classList.add('running-active');
                    btn.classList.add('running');
                } else {
                    item.classList.remove('running-active');
                    btn.classList.remove('running');
                }
                btn.innerText = '停止';
            }
        });
    }

    function stopUnicycle() {
        if (runTimer) clearInterval(runTimer);
        runTimer = null;
        runState = null;
        updateVisualIndicator();
    }

    function startUnicycle(index) {
        const memes = getMemes();
        if (!memes.length || index >= memes.length) return;

        stopUnicycle();
        runState = { type: config.mode, currentIndex: index };
        sendDanmaku(memes[runState.currentIndex]);
        updateVisualIndicator();

        const intervalMs = Math.max(1, config.interval) * 1000;
        runTimer = setInterval(() => {
            const currentMemes = getMemes();
            if (!currentMemes.length) { stopUnicycle(); return; }
            if (runState.type === 'list') {
                runState.currentIndex = (runState.currentIndex + 1) % currentMemes.length;
            }
            sendDanmaku(currentMemes[runState.currentIndex]);
            updateVisualIndicator();
        }, intervalMs);
    }

    // ================= 5. 防刷屏模块 =================
    const recentDanmakuCache = new Map();
    const SPAM_WINDOW_MS = 10000;

    function initAntiSpam() {
        const chatItemsContainer = document.querySelector('#chat-history-list .chat-items');
        if (!chatItemsContainer) { setTimeout(initAntiSpam, 1000); return; }

        const observer = new MutationObserver((mutations) => {
            if (!config.isAntiSpamOn) return;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('danmaku-item')) {
                        const text = node.getAttribute('data-danmaku');
                        if (text) {
                            const now = Date.now();
                            const lastSeenTime = recentDanmakuCache.get(text);
                            if (lastSeenTime && (now - lastSeenTime < SPAM_WINDOW_MS)) {
                                node.style.display = 'none';
                            } else {
                                recentDanmakuCache.set(text, now);
                            }
                        }
                    }
                });
            });
        });
        observer.observe(chatItemsContainer, { childList: true });
        setInterval(() => {
            const now = Date.now();
            for (let [text, time] of recentDanmakuCache.entries()) {
                if (now - time > SPAM_WINDOW_MS) recentDanmakuCache.delete(text);
            }
        }, SPAM_WINDOW_MS);
    }

    // ================= 6. 独轮车面板 =================
    function renderUnicycleList(listContainer) {
        const memes = getMemes();
        listContainer.innerHTML = '';
        if(memes.length === 0) {
            listContainer.innerHTML = '<div style="font-size:12px; color:#9499A0; text-align:center; padding: 10px 0;">空空如也，快存几个烂梗吧！</div>';
            return;
        }

        memes.forEach((meme, index) => {
            const item = document.createElement('div');
            item.className = 'unicycle-item';

            const textBox = document.createElement('div');
            textBox.className = 'unicycle-text';
            textBox.title = meme;
            textBox.innerText = meme;

            const actionBox = document.createElement('div');
            actionBox.className = 'unicycle-action';

            const sendBtn = document.createElement('button');
            sendBtn.className = 'send-btn';
            sendBtn.onclick = () => {
                if (runState) stopUnicycle();
                else {
                    if (config.isAutoOn) startUnicycle(index);
                    else sendDanmaku(meme);
                }
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'del-btn';
            delBtn.innerText = '✕';
            delBtn.onclick = () => {
                stopUnicycle();
                memes.splice(index, 1);
                saveMemes(memes);
                renderUnicycleList(listContainer);
            };

            actionBox.appendChild(sendBtn);
            actionBox.appendChild(delBtn);
            item.appendChild(textBox);
            item.appendChild(actionBox);
            listContainer.appendChild(item);
        });
        updateVisualIndicator();
    }

    function initUnicycle() {
        const rightPart = document.querySelector('.control-panel-icon-row .icon-right-part');
        const likeBtn = document.querySelector('.like-btn');
        if (!rightPart || !likeBtn) { setTimeout(initUnicycle, 1000); return; }
        if (document.querySelector('#bili-unicycle-entry')) return;

        const entryWrapper = document.createElement('div');
        entryWrapper.id = 'bili-unicycle-entry';
        entryWrapper.className = 'unicycle-entry';
        entryWrapper.innerText = '🦼 独轮车';
        rightPart.insertBefore(entryWrapper, likeBtn);

        const panel = document.createElement('div');
        panel.id = 'bili-unicycle-panel';
        panel.className = 'unicycle-panel';

        const settingsBox = document.createElement('div');
        settingsBox.className = 'unicycle-settings';
        settingsBox.innerHTML = `
            <div class="uni-row">
                <label class="uni-toggle-label">
                    <input type="checkbox" id="uni-toggle-cb" ${config.isAutoOn ? 'checked' : ''}> 开启独轮车
                </label>
                <div class="uni-mode-group">
                    <label><input type="radio" name="uni-mode" value="single" ${config.mode === 'single' ? 'checked' : ''}> 单条循环</label>
                    <label><input type="radio" name="uni-mode" value="list" ${config.mode === 'list' ? 'checked' : ''}> 列表循环</label>
                </div>
            </div>
            <div class="uni-row" style="margin-top:4px;">
                <span>发送间隔：</span>
                <div class="uni-interval">
                    <input type="number" id="uni-interval-input" min="1" max="999" value="${config.interval}"> 秒
                </div>
            </div>
            <div class="uni-row" style="margin-top:6px; padding-top:6px; border-top:1px solid #f1f2f3;">
                <label class="uni-antispam-label">
                    <input type="checkbox" id="uni-antispam-cb" ${config.isAntiSpamOn ? 'checked' : ''}> 🚫 开启弹幕防刷屏（10s内重复弹幕会被过滤）
                </label>
            </div>
        `;

        const inputBox = document.createElement('div');
        inputBox.className = 'unicycle-input-box';
        const input = document.createElement('input');
        input.className = 'unicycle-input';
        input.placeholder = '输入烂梗... (回车快捷保存)';
        input.maxLength = 40;
        const addBtn = document.createElement('button');
        addBtn.className = 'unicycle-add-btn';
        addBtn.innerText = '存入';

        const listContainer = document.createElement('div');
        listContainer.className = 'unicycle-list';

        inputBox.appendChild(input);
        inputBox.appendChild(addBtn);
        panel.appendChild(settingsBox);
        panel.appendChild(inputBox);
        panel.appendChild(listContainer);
        document.body.appendChild(panel);

        renderUnicycleList(listContainer);

        panel.querySelector('#uni-toggle-cb').onchange = (e) => {
            config.isAutoOn = e.target.checked; saveConfig();
            if (!config.isAutoOn) stopUnicycle();
            updateVisualIndicator();
        };
        panel.querySelector('#uni-antispam-cb').onchange = (e) => {
            config.isAntiSpamOn = e.target.checked; saveConfig();
            if(!config.isAntiSpamOn) recentDanmakuCache.clear();
        };
        panel.querySelectorAll('input[name="uni-mode"]').forEach(radio => {
            radio.onchange = (e) => { config.mode = e.target.value; saveConfig(); };
        });
        panel.querySelector('#uni-interval-input').onchange = (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            e.target.value = val; config.interval = val; saveConfig();
        };

        entryWrapper.onclick = (e) => {
            e.stopPropagation();
            if (panel.classList.contains('show')) {
                panel.classList.remove('show');
            } else {
                const rect = entryWrapper.getBoundingClientRect();
                panel.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                let leftPos = rect.right - 280;
                if (leftPos < 10) leftPos = 10;
                panel.style.left = leftPos + 'px';
                panel.style.right = 'auto';
                panel.classList.add('show');
            }
        };
        panel.addEventListener('click', (e) => { e.stopPropagation(); });
        document.addEventListener('click', (e) => {
            if (!entryWrapper.contains(e.target) && !panel.contains(e.target)) {
                panel.classList.remove('show');
            }
        });

        addBtn.onclick = () => {
            const val = input.value.trim();
            if (!val) return;
            const memes = getMemes();
            if (memes.includes(val)) { input.value = ''; return; }
            memes.unshift(val); saveMemes(memes);
            input.value = ''; renderUnicycleList(listContainer);
        };
        input.onkeypress = (e) => { if (e.key === 'Enter') addBtn.click(); };
    }

    // ================= 7. 聊天栏悬浮操作组 =================
    function initActionGroup() {
        const chatList = document.querySelector('#chat-history-list');
        if (!chatList) { setTimeout(initActionGroup, 1000); return; }

        chatList.addEventListener('mouseover', (e) => {
            const chatItem = e.target.closest('.chat-item.danmaku-item');
            if (chatItem && !chatItem.querySelector('.bili-action-group')) {
                const group = document.createElement('div');
                group.className = 'bili-action-group';

                const btnPlus1 = document.createElement('button');
                btnPlus1.className = 'bili-action-btn btn-plus1';
                btnPlus1.innerText = '+1';

                const btnCopy = document.createElement('button');
                btnCopy.className = 'bili-action-btn btn-copy';
                btnCopy.innerText = '复制';

                group.appendChild(btnPlus1);
                group.appendChild(btnCopy);
                chatItem.appendChild(group);
            }
        });

        chatList.addEventListener('click', (e) => {
            if (e.target.classList.contains('bili-action-btn')) {
                e.stopPropagation(); e.preventDefault();
                const chatItem = e.target.closest('.chat-item.danmaku-item');
                if (chatItem) {
                    const text = chatItem.getAttribute('data-danmaku');
                    if (text) {
                        if (e.target.classList.contains('btn-plus1')) {
                            sendDanmaku(text);
                        } else if (e.target.classList.contains('btn-copy')) {
                            navigator.clipboard.writeText(text).then(() => {
                                const originalText = e.target.innerText;
                                e.target.innerText = '成功!';
                                setTimeout(() => { e.target.innerText = originalText; }, 1000);
                            });
                        }
                    }
                }
            }
        }, true);
    }

    // ================= 8. 右键菜单终极防卡死版 =================
    function initPlayerContextMenu() {
        const observer = new MutationObserver(() => {
            const lis = document.querySelectorAll('li');
            for (let i = 0; i < lis.length; i++) {
                const li = lis[i];

                if (li.textContent && li.textContent.trim() === '复制弹幕') {
                    const ul = li.parentElement;
                    if (!ul || ul.querySelector('.ex-context-plus1')) continue;

                    const plus1Li = li.cloneNode(true);
                    plus1Li.className += ' ex-context-plus1';
                    plus1Li.textContent = '🚀 +1 (发送)';
                    plus1Li.style.color = '#00D1F1';
                    plus1Li.style.fontWeight = 'bold';

                    plus1Li.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        // 在点击的瞬间去动态找弹幕文本
                        const topLevelLi = ul.parentElement;
                        const textSpan = topLevelLi ? topLevelLi.querySelector('span') : null;
                        const currentText = textSpan ? textSpan.textContent.trim() : null;

                        if (currentText) {
                            sendDanmaku(currentText);
                        }

                        // 调用 B 站原生的“关闭”按钮来清理框架状态
                        const allLis = document.querySelectorAll('li');
                        for (let j = 0; j < allLis.length; j++) {
                            if (allLis[j].textContent && allLis[j].textContent.trim() === '关闭') {
                                allLis[j].click(); // 模拟点击原生关闭
                                break;
                            }
                        }
                    };

                    ul.insertBefore(plus1Li, li.nextSibling);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ================= 启动 =================
    initActionGroup();
    initUnicycle();
    initAntiSpam();
    initPlayerContextMenu();

})();
