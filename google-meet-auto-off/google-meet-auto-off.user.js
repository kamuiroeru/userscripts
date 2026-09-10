// ==UserScript==
// @name         Google Meet Auto Mic & Camera Off
// @namespace    https://github.com/kamuiroeru/userscripts
// @version      0.1.0
// @description  Google Meet を開いたときに、マイクとカメラを自動でオフにします。
// @author       KamuiRoeru
// @match        https://meet.google.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/kamuiroeru/userscripts/main/google-meet-auto-off/google-meet-auto-off.user.js
// @updateURL    https://raw.githubusercontent.com/kamuiroeru/userscripts/main/google-meet-auto-off/google-meet-auto-off.user.js
// ==/UserScript==

(function() {
    'use strict';
    // ----------------------------------------------------------------
    // 設定・定数
    // ----------------------------------------------------------------
    const CONFIG = {
        scanInterval: 800,       // チェック間隔 (ms)
        maxTime: 30000,          // 最大監視時間 (30秒)
        selectors: {
            // マイクを「オフにする」ボタン (ターゲット)
            micTurnOff: `
                div[role="button"][aria-label*="マイクをオフにする"],
                div[role="button"][aria-label*="Turn off microphone"],
                div[role="button"][data-is-muted="false"][aria-label*="マイク"],
                div[role="button"][data-is-muted="false"][aria-label*="mic"]
            `,
            // マイクを「オンにする」ボタン (ゴール)
            micTurnOn:  `
                div[role="button"][aria-label*="マイクをオンにする"],
                div[role="button"][aria-label*="Turn on microphone"],
                div[role="button"][data-is-muted="true"][aria-label*="マイク"],
                div[role="button"][data-is-muted="true"][aria-label*="mic"]
            `,
            
            // カメラを「オフにする」ボタン (ターゲット)
            camTurnOff: `
                div[role="button"][aria-label*="カメラをオフにする"],
                div[role="button"][aria-label*="Turn off camera"],
                div[role="button"][data-is-muted="false"][aria-label*="カメラ"],
                div[role="button"][data-is-muted="false"][aria-label*="camera"]
            `,
            // カメラを「オンにする」ボタン (ゴール)
            camTurnOn:  `
                div[role="button"][aria-label*="カメラをオンにする"],
                div[role="button"][aria-label*="Turn on camera"],
                div[role="button"][data-is-muted="true"][aria-label*="カメラ"],
                div[role="button"][data-is-muted="true"][aria-label*="camera"]
            `,

            // 会議中判定用: 「通話から退出」ボタン
            leaveCall: `
                button[aria-label*="通話から退出"],
                button[aria-label*="Leave call"]
            `
        }
    };

    // ----------------------------------------------------------------
    // ステータスパネル (Visual Logger) の作成
    // ----------------------------------------------------------------
    const statusPanel = document.createElement('div');
    statusPanel.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 4px;
        z-index: 999999;
        font-family: monospace;
        font-size: 12px;
        min-width: 250px;
        pointer-events: none;
        border: 1px solid #555;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;

    // タイトル部分
    const titleDiv = document.createElement('div');
    titleDiv.style.color = '#0f0';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.textContent = 'Meet Auto Mute v1.7';
    statusPanel.appendChild(titleDiv);

    // ステータステキスト部分
    const statusTextDiv = document.createElement('div');
    statusTextDiv.id = 'gm-status-text';
    statusTextDiv.textContent = '起動中...';
    statusPanel.appendChild(statusTextDiv);
    
    // ボディに追加
    if (document.body) {
        document.body.appendChild(statusPanel);
    } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(statusPanel));
    }

    function updateStatus(msg, type = 'info') {
        const el = document.getElementById('gm-status-text');
        if (el) {
            el.textContent = msg; 
            if (type === 'success') el.style.color = '#4caf50'; // 緑
            if (type === 'error') el.style.color = '#f44336';   // 赤
            if (type === 'info') el.style.color = '#ffffff';    // 白
            if (type === 'warn') el.style.color = '#ff9800';    // オレンジ
        }
    }

    // ----------------------------------------------------------------
    // メインロジック
    // ----------------------------------------------------------------
    let elapsed = 0;
    let successCount = 0;

    const mainLoop = setInterval(() => {
        elapsed += CONFIG.scanInterval;

        // 0. 会議中判定（ブレイクアウトルーム移動時対策）
        // 「通話から退出」ボタンがある場合は、すでに入室済みとみなして停止
        const leaveBtn = document.querySelector(CONFIG.selectors.leaveCall);
        if (leaveBtn) {
            updateStatus('会議中(入室済)を検知: 停止します', 'warn');
            clearInterval(mainLoop);
            setTimeout(() => {
                if (statusPanel) statusPanel.style.display = 'none';
            }, 2000); // 2秒後にパネルを消す
            return;
        }

        // 1. 要素の検索
        const micBtnOffTarget = document.querySelector(CONFIG.selectors.micTurnOff); 
        const micBtnOnGoal    = document.querySelector(CONFIG.selectors.micTurnOn);  

        const camBtnOffTarget = document.querySelector(CONFIG.selectors.camTurnOff); 
        const camBtnOnGoal    = document.querySelector(CONFIG.selectors.camTurnOn);  

        // まだUIがロードされていない場合
        if (!micBtnOffTarget && !micBtnOnGoal && !camBtnOffTarget && !camBtnOnGoal) {
            updateStatus(`UI読込待機中... (${(elapsed/1000).toFixed(1)}s)`);
            if (elapsed > CONFIG.maxTime) {
                updateStatus('タイムアウト: ボタンが見つかりません', 'error');
                clearInterval(mainLoop);
            }
            return;
        }

        // 2. アクション実行
        let actionLog = [];

        // マイク処理
        if (micBtnOffTarget) {
            micBtnOffTarget.click();
            actionLog.push("マイクOFF");
        }

        // カメラ処理
        if (camBtnOffTarget) {
            camBtnOffTarget.click();
            actionLog.push("カメラOFF");
        }

        // 3. 状態判定
        const isMicSafe = !!micBtnOnGoal;
        const isCamSafe = !!camBtnOnGoal;

        if (actionLog.length > 0) {
            updateStatus(actionLog.join(' & ') + " 実行");
        } else if (isMicSafe && isCamSafe) {
            successCount++;
            updateStatus(`全OFF完了確認 (${successCount}/3)`, 'success');

            if (successCount >= 3) {
                clearInterval(mainLoop);
                setTimeout(() => {
                    if (statusPanel) statusPanel.style.display = 'none';
                }, 3000);
            }
        } else {
            // ボタンはあるがターゲットが見つからない場合
            let status = [];
            if (isMicSafe) status.push("マイクOK");
            if (isCamSafe) status.push("カメラOK");
            updateStatus(status.length > 0 ? status.join(', ') + "..." : '状態確認中...', 'info');
        }

        if (elapsed > CONFIG.maxTime) {
            clearInterval(mainLoop);
            updateStatus('タイムアウト: 処理を中断します', 'error');
        }

    }, CONFIG.scanInterval);

})();

