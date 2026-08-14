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

let convertedFiles = [];
let audioContext = null;

// ドラッグ＆ドロップイベント
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

    const targetExt = globalExtSelect.value;
    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') await audioContext.resume();

    statusDiv.textContent = 'ファイルを読み込み中...';
    progressContainer.style.display = 'block';

    let allEntries = [];
    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            let zipEntries = await getEntriesFromZip(file);
            allEntries.push(...zipEntries);
        } else {
            allEntries.push({ file: file, customName: null });
        }
    }

    if (allEntries.length === 0) {
        statusDiv.textContent = '有効なファイルが見つかりませんでした。';
        progressContainer.style.display = 'none';
        return;
    }

    for (let i = 0; i < allEntries.length; i++) {
        await processAudioFile(allEntries[i].file, audioContext, allEntries[i].customName, i, targetExt);
        const percent = ((i + 1) / allEntries.length) * 100;
        progressBar.style.width = percent + '%';
        progressBar.textContent = Math.round(percent) + '%';
    }

    statusDiv.textContent = '処理が完了しました！';
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
        console.error("音声のデコードに失敗しました:", e);
    }
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

// ZIP解凍処理
async function getEntriesFromZip(file) {
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
}
