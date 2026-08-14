window.addEventListener('error', (e) => {
    console.error(`JSエラー発生: ${e.message} (${e.filename}:${e.lineno})`);
});
console.log("app.jsの読み込みを開始しました");

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

// --- 簡易コンソール機能の実装 ---
function toggleConsole() {
    const box = document.getElementById('consoleBox');
    if (box) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
}

function clearConsole() {
    const logs = document.getElementById('consoleLogs');
    if (logs) logs.innerHTML = '';
}

const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    appendLog(args.join(' '), '#00ff00');
};

console.error = function(...args) {
    originalError.apply(console, args);
    appendLog('❌ ' + args.join(' '), '#ff5555');
};

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
// -----------------------------

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.style.borderColor = '#3498db'; });
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.style.borderColor = '#bdc3c7'; });
});

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
    if (files.length === 0) return;
    console.log(`ファイル選択検知: ${files.length}個のアイテム`);

    const targetExt = globalExtSelect.value;
    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    
    if (!audioContext) {
        console.log("AudioContextを新規作成します");
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        console.log("AudioContextをレジュームします");
        await audioContext.resume();
    }

    statusDiv.textContent = 'ファイルを読み込み中...';
    progressContainer.style.display = 'block';

    let allEntries = [];
    for (const file of files) {
        console.log(`ファイル名確認: ${file.name}, size: ${file.size}`);
        if (file.name.toLowerCase().endsWith('.zip')) {
            let zipEntries = await getEntriesFromZip(file);
            allEntries.push(...zipEntries);
        } else {
            allEntries.push({ file: file, customName: null });
        }
    }

    if (allEntries.length === 0) {
        console.error('有効なファイルが見つかりませんでした。');
        statusDiv.textContent = '有効なファイルが見つかりませんでした。';
        progressContainer.style.display = 'none';
        return;
    }

    console.log(`合計 ${allEntries.length}個のエントリ。処理を開始します。`);

    for (let i = 0; i < allEntries.length; i++) {
        console.log(`processAudioFile 呼び出し前: インデックス ${i}`);
        await processAudioFile(allEntries[i].file, audioContext, allEntries[i].customName, i, targetExt);
        console.log(`processAudioFile 完了: インデックス ${i}`);
        const percent = ((i + 1) / allEntries.length) * 100;
        progressBar.style.width = percent + '%';
        progressBar.textContent = Math.round(percent) + '%';
    }

    statusDiv.textContent = '処理が完了しました！';
    console.log('すべてのファイルの処理が完了しました。');
    actionArea.style.display = 'block';
    renderFileList();
}

async function processAudioFile(file, ctx, customName, id, ext) {
    try {
        console.log(`[process] arrayBuffer取得中: ${file.name}`);
        const arrayBuffer = await file.arrayBuffer();
        console.log(`[process] デコード中 (decodeAudioData): ${file.name}`);
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        console.log(`[process] デコード成功、ファイルオブジェクト構築中`);
        
        let fileObj = { 
            id, 
            baseName: (customName || file.name).replace(/\.[^/.]+$/, ""), 
            extension: ext, 
            audioBuffer: buffer, 
            volume: parseFloat(batchVolumeSlider.value),
            blob: null,
            url: null
        };
        updateFileBlob(fileObj);
        convertedFiles.push(fileObj);
        console.log(`デコード成功完了: ${fileObj.baseName}.${ext}`);
    } catch (e) {
        console.error(`デコード失敗 (${file.name}):`, e.message || e);
    }
}

globalExtSelect.addEventListener('change', () => {
    const newExt = globalExtSelect.value;
    console.log(`一括拡張子が変更されました: ${newExt}`);
    if (convertedFiles.length === 0) return;

    convertedFiles.forEach(fileObj => {
        fileObj.extension = newExt;
        updateFileBlob(fileObj);
    });

    renderFileList();
});

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
        console.error(`ダウンロード失敗: ID ${id} のファイルが見つからないかURLが無効です`);
        return;
    }
    console.log(`ダウンロード実行: ${file.baseName}.${file.extension}`);
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
    console.log(`再生開始: ${file.baseName}`);
    const source = audioContext.createBufferSource();
    source.buffer = file.audioBuffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = file.volume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
};

async function getEntriesFromZip(file) {
    try {
        let zip = new JSZip();
        let zipContent = await zip.loadAsync(file);
        let entries = [];
        for (let [name, entry] of Object.entries(zipContent.files)) {
            if (!entry.dir && !name.startsWith('__MACOSX/') && !name.includes('.DS_Store')) {
                let data = await entry.async('arraybuffer');
                entries.push({ file: new File([data], name), customName: name });
            }
        }
        return entries;
    } catch (e) {
        console.error(`ZIPの展開に失敗しました (${file.name}):`, e);
        return [];
    }
}

downloadAllBtn.addEventListener('click', () => {
    console.log('一括個別ダウンロードを開始します');
    convertedFiles.forEach((file, index) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = file.url;
            a.download = `${file.baseName}.${file.extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, index * 300);
    });
});

downloadZipBtn.addEventListener('click', async () => {
    console.log('ZIPファイルの作成を開始します...');
    statusDiv.textContent = 'ZIPファイルを作成中...';
    downloadZipBtn.disabled = true;

    try {
        const zip = new JSZip();
        convertedFiles.forEach(file => {
            zip.file(`${file.baseName}.${file.extension}`, file.blob);
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(content);

        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = 'converted_audio_files.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        statusDiv.textContent = 'ZIPのダウンロードが完了しました！';
        console.log('ZIPの作成・ダウンロードが完了しました');
    } catch (e) {
        console.error('ZIP作成エラー:', e);
        statusDiv.textContent = 'ZIPの作成に失敗しました';
    } finally {
        downloadZipBtn.disabled = false;
    }
});
