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
let isProcessing = false;

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

// --- イベント登録 ---
if (dropZone) {
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => e.preventDefault());
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

async function handleFiles(files) {
    if (isProcessing) {
        console.error("現在別の処理が実行中です。完了までお待ちください。");
        return;
    }
    if (files.length === 0) return;

    isProcessing = true;
    console.log(`ファイル選択検知: ${files.length}個のアイテム`);

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const targetExt = globalExtSelect.value;
    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    statusDiv.textContent = 'ファイルを処理中...';
    progressContainer.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();

        // mp3, ogg, wav のみ許可
        if (!lowerName.endsWith('.mp3') && !lowerName.endsWith('.ogg') && !lowerName.endsWith('.wav')) {
            console.error(`スキップ (${file.name}): mp3, ogg, wav 以外の形式には対応していません。`);
            continue;
        }

        try {
            console.log(`処理中: ${file.name}`);
            // デコードがフリーズ対策としてタイムアウト（10秒）付きで実行
            await Promise.race([
                processAudioFile(file, audioContext, i, targetExt),
                new Promise((_, reject) => setTimeout(() => reject(new Error("デコードがタイムアウトしました")), 10000))
            ]);
        } catch (e) {
            console.error(`処理失敗 (${file.name}): ${e.message}`);
        }

        const percent = ((i + 1) / files.length) * 100;
        progressBar.style.width = percent + '%';
        progressBar.textContent = Math.round(percent) + '%';
    }

    isProcessing = false;
    statusDiv.textContent = '処理が完了しました！';
    console.log('すべてのファイルの処理が完了しました。');
    actionArea.style.display = 'block';
    renderFileList();
}

async function processAudioFile(file, ctx, id, ext) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    
    let fileObj = { 
        id, 
        baseName: file.name.replace(/\.[^/.]+$/, ""), 
        extension: ext, 
        audioBuffer: buffer, 
        volume: parseFloat(batchVolumeSlider.value),
        blob: null,
        url: null
    };
    
    updateFileBlob(fileObj);
    convertedFiles.push(fileObj);
    console.log(`デコード成功: ${fileObj.baseName}.${ext}`);
}

function renderFileList() {
    fileListDiv.innerHTML = '';
    convertedFiles.forEach(fileObj => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-info"><b>${fileObj.baseName}.${fileObj.extension}</b></div>
            <div class="file-controls">
                <button class="btn btn-sm" onclick="playAudioDirectly(${fileObj.id})">再生</button>
                <button class="btn btn-sm btn-success" onclick="downloadFile(${fileObj.id})">保存</button>
            </div>
        `;
        fileListDiv.appendChild(item);
    });
}

window.downloadFile = (id) => {
    const file = convertedFiles.find(f => f.id === id);
    if (!file || !file.url) {
        console.error(`ダウンロード失敗: ID ${id} のファイルが見つかりません`);
        return;
    }
    const a = document.createElement('a');
    a.href = file.url;
    a.download = `${file.baseName}.${file.extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

window.playAudioDirectly = (id) => {
    const file = convertedFiles.find(f => f.id === id);
    if (!file || !audioContext) return;
    const source = audioContext.createBufferSource();
    source.buffer = file.audioBuffer;
    const gainNode = audioContext.createGain();
    gainNode.gain.value = file.volume;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
};

console.log("=== [DEBUG] app.js 読み込み完了 ===");
