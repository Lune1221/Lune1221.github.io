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
const downloadAllBtn = document.getElementById('downloadAllBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');

const passwordModal = document.getElementById('passwordModal');
const zipPasswordInput = document.getElementById('zipPasswordInput');
const submitPasswordBtn = document.getElementById('submitPasswordBtn');
const modalFileName = document.getElementById('modalFileName');

let convertedFiles = [];
let passwordResolver = null;
let audioContext = null;
let currentPlayingSource = null;
let currentPlayingButton = null;

// ドラッグ＆ドロップイベント
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.style.borderColor = '#3498db'; });
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.style.borderColor = '#bdc3c7'; });
});

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function updateProgress(percent, text) {
    progressContainer.style.display = 'block';
    const p = Math.round(percent);
    progressBar.style.width = p + '%';
    progressBar.textContent = p + '%';
    if (text) statusDiv.textContent = text;
}

async function handleFiles(files) {
    if (files.length === 0) return;
    stopCurrentAudio();

    const inputExt = inputExtSelect.value;
    const targetExt = globalExtSelect.value;

    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    
    updateProgress(0, 'ファイルを処理中...');

    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') await audioContext.resume();

    let allEntries = [];
    for (const file of files) {
        // 変換元の拡張子フィルタリング
        if (inputExt !== 'all' && !file.name.toLowerCase().endsWith('.' + inputExt)) continue;
        
        if (file.name.toLowerCase().endsWith('.zip')) {
            let zipEntries = await getEntriesFromZip(file);
            let filtered = zipEntries.filter(e => inputExt === 'all' || e.file.name.toLowerCase().endsWith('.' + inputExt));
            allEntries.push(...filtered);
        } else {
            allEntries.push({ file: file, customName: null });
        }
    }

    if (allEntries.length === 0) {
        statusDiv.textContent = '対象のファイルが見つかりませんでした。';
        progressContainer.style.display = 'none';
        return;
    }

    for (let i = 0; i < allEntries.length; i++) {
        await processAudioFile(allEntries[i].file, audioContext, allEntries[i].customName, i, targetExt);
    }

    updateProgress(100, '処理が完了しました！');
    actionArea.style.display = 'block';
    renderFileList();
}

async function processAudioFile(file, ctx, customName, id, ext) {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    let fileObj = { 
        id, 
        baseName: (customName || file.name).split('.')[0], 
        extension: ext, 
        audioBuffer: buffer, 
        volume: parseFloat(batchVolumeSlider.value) 
    };
    updateFileBlob(fileObj);
    convertedFiles.push(fileObj);
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

// 簡易ダウンロード・再生用ヘルパー
window.downloadFile = (id) => {
    const file = convertedFiles.find(f => f.id === id);
    const a = document.createElement('a');
    a.href = file.url;
    a.download = `${file.baseName}.${file.extension}`;
    a.click();
};

window.playAudioDirectly = (id) => {
    const file = convertedFiles.find(f => f.id === id);
    const source = audioContext.createBufferSource();
    source.buffer = file.audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
};

// ZIP解凍処理
async function getEntriesFromZip(file) {
    let zip = new JSZip();
    let zipContent = await zip.loadAsync(file);
    let entries = [];
    for (let [name, entry] of Object.entries(zipContent.files)) {
        if (!entry.dir) {
            let data = await entry.async('arraybuffer');
            entries.push({ file: new File([data], name), customName: name });
        }
    }
    return entries;
}
