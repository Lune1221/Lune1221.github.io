
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const inputExtSelect = document.getElementById('inputExtSelect');
const globalExtSelect = document.getElementById('globalExtSelect');
const batchVolumeSlider = document.getElementById('batchVolumeSlider');
const batchVolumeNumber = document.getElementById('batchVolumeNumber');
const fileListDiv = document.getElementById('fileList');
const actionArea = document.getElementById('actionArea');

let convertedFiles = [];
let audioContext = null;

// ファイル処理：ここを厳格化
async function handleFiles(files) {
    if (files.length === 0) return;
    
    const inputExt = inputExtSelect.value;
    const targetExt = globalExtSelect.value;
    
    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    statusDiv.textContent = 'ファイルを読み込み中...';
    progressContainer.style.display = 'block';

    let allEntries = [];
    
    // 全ファイルの中から、指定された拡張子のものだけを抽出
    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            let zipEntries = await getEntriesFromZip(file);
            // ZIP内部のファイルも拡張子チェック
            let filtered = zipEntries.filter(e => {
                if (inputExt === 'all') return true;
                return e.file.name.toLowerCase().endsWith('.' + inputExt);
            });
            allEntries.push(...filtered);
        } else {
            // 単一ファイルの場合のチェック
            if (inputExt === 'all' || file.name.toLowerCase().endsWith('.' + inputExt)) {
                allEntries.push({ file: file, customName: null });
            }
        }
    }

    if (allEntries.length === 0) {
        statusDiv.textContent = `変換元の形式 "${inputExt}" に一致するファイルが見つかりませんでした。`;
        return;
    }

    statusDiv.textContent = `${allEntries.length} 個のファイルを処理中...`;

    for (let i = 0; i < allEntries.length; i++) {
        await processAudioFile(allEntries[i].file, audioContext, allEntries[i].customName, i, targetExt);
        progressBar.style.width = ((i + 1) / allEntries.length * 100) + '%';
        progressBar.textContent = Math.round((i + 1) / allEntries.length * 100) + '%';
    }
    
    statusDiv.textContent = '完了！';
    actionArea.style.display = 'block';
    renderFileList();
}

async function processAudioFile(file, ctx, customName, id, ext) {
    try {
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        let fileObj = { 
            id, 
            baseName: (customName || file.name).replace(/\.[^/.]+$/, ""), 
            extension: ext, 
            audioBuffer: buffer, 
            volume: parseFloat(batchVolumeSlider.value) 
        };
        updateFileBlob(fileObj);
        convertedFiles.push(fileObj);
    } catch (e) {
        console.error("変換エラー:", e);
    }
}

// 他のヘルパー関数（renderFileList, getEntriesFromZip等は既存のものを使用）
// 既存のJSファイル構造を維持してください
