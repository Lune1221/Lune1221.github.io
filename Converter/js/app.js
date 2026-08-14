console.log("=== [DEBUG] app.js 読み込み開始 ===");

window.addEventListener('error', (e) => {
    console.error(`JSグローバルエラー: ${e.message} at ${e.filename}:${e.lineno}`);
});

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const globalExtSelect = document.getElementById('globalExtSelect');
const batchVolumeSlider = document.getElementById('batchVolumeSlider');
const batchVolumeNumber = document.getElementById('batchVolumeNumber');
const fileListDiv = document.getElementById('fileList');
const actionArea = document.getElementById('actionArea');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');

let convertedFiles = [];
let audioContext = null;

// --- コンソール機能 ---
function toggleConsole() {
    const box = document.getElementById('consoleBox');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function appendLog(text, color) {
    const logsDiv = document.getElementById('consoleLogs');
    if (!logsDiv) return;
    const p = document.createElement('div');
    p.style.color = color;
    p.style.margin = '2px 0';
    p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    logsDiv.appendChild(p);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) { originalLog.apply(console, args); appendLog(args.join(' '), '#00ff00'); };
console.error = function(...args) { originalError.apply(console, args); appendLog('❌ ' + args.join(' '), '#ff5555'); };

console.log("=== [DEBUG] イベントリスナー設定開始 ===");

// --- イベント登録 ---
if (dropZone) {
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        console.log("=== [DEBUG] DROP検知 ===");
        handleFiles(e.dataTransfer.files);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => e.preventDefault());
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        console.log("=== [DEBUG] CHANGE検知 ===");
        handleFiles(e.target.files);
    });
}

async function handleFiles(files) {
    console.log(`=== [DEBUG] handleFiles開始: ${files.length}個 ===`);
    if (files.length === 0) return;

    if (!audioContext) {
        console.log("AudioContextを作成します");
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const targetExt = globalExtSelect.value;
    convertedFiles = [];
    fileListDiv.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        console.log(`ファイル処理開始: ${files[i].name}`);
        try {
            await processAudioFile(files[i], audioContext, null, i, targetExt);
        } catch (e) {
            console.error(`ループ内エラー: ${e.message}`);
        }
    }
    console.log("=== [DEBUG] handleFiles終了 ===");
    renderFileList();
    actionArea.style.display = 'block';
}

async function processAudioFile(file, ctx, customName, id, ext) {
    console.log(`デコード開始: ${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    console.log(`デコード成功: ${file.name}`);
    
    let fileObj = { 
        id, 
        baseName: file.name.replace(/\.[^/.]+$/, ""), 
        extension: ext, 
        audioBuffer: buffer, 
        volume: parseFloat(batchVolumeSlider.value)
    };
    
    // audio.jsの関数を呼ぶ
    updateFileBlob(fileObj);
    convertedFiles.push(fileObj);
    console.log(`追加完了: ${fileObj.baseName}.${ext}`);
}

function renderFileList() {
    fileListDiv.innerHTML = '';
    convertedFiles.forEach(fileObj => {
        const item = document.createElement('div');
        item.innerHTML = `<b>${fileObj.baseName}.${fileObj.extension}</b> 
            <button onclick="downloadFile(${fileObj.id})">保存</button>`;
        fileListDiv.appendChild(item);
    });
}

window.downloadFile = (id) => {
    const file = convertedFiles.find(f => f.id === id);
    if (!file || !file.url) { console.error("URLなし"); return; }
    const a = document.createElement('a');
    a.href = file.url;
    a.download = `${file.baseName}.${file.extension}`;
    a.click();
};

console.log("=== [DEBUG] app.js 読み込み完了 ===");
