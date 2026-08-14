const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const toolbar = document.getElementById('toolbar');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
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

// ドラッグ＆ドロップ設定
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#3498db';
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#bdc3c7';
    });
});

dropZone.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function updateProgress(percent, text) {
    progressContainer.style.display = 'block';
    const p = Math.round(percent);
    progressBar.style.width = p + '%';
    progressBar.textContent = p + '%';
    if (text) {
        statusDiv.textContent = text;
    }
}

async function handleFiles(files) {
    if (files.length === 0) return;

    stopCurrentAudio();

    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    actionArea.style.display = 'none';
    toolbar.style.display = 'none';
    
    updateProgress(0, 'ファイルを準備中...');

    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } else if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    let allOggEntries = [];

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            let zipEntries = await getOggEntriesFromZip(file);
            allOggEntries.push(...zipEntries);
        } else if (file.name.toLowerCase().endsWith('.ogg') || file.type.includes('ogg')) {
            allOggEntries.push({ file: file, customName: null });
        }
    }

    if (allOggEntries.length === 0) {
        statusDiv.textContent = '変換できるOggファイルが見つかりませんでした。';
        progressContainer.style.display = 'none';
        return;
    }

    let completedCount = 0;
    for (const entry of allOggEntries) {
        let percent = (completedCount / allOggEntries.length) * 100;
        updateProgress(percent, `${entry.file.name} を読み込み中... (${completedCount + 1}/${allOggEntries.length})`);

        await processOggFile(entry.file, audioContext, entry.customName, completedCount);
        completedCount++;
    }

    // 初期状態としてファイル名昇順で並び替え
    sortFiles();

    updateProgress(100, `${convertedFiles.length}個のファイルの準備が完了しました！`);
    toolbar.style.display = 'flex';
    actionArea.style.display = 'block';
    renderFileList();
}

async function processOggFile(file, audioContext, customName, id) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const baseName = customName || file.name.substring(0, file.name.lastIndexOf('.'));
        const fileName = `${baseName}.wav`;

        let fileObj = {
            id: id,
            name: fileName,
            audioBuffer: audioBuffer,
            volume: 1.0,
            blob: null,
            url: null
        };

        updateWavBlob(fileObj);
        convertedFiles.push(fileObj);
    } catch (err) {
        console.error(err);
    }
}

function updateWavBlob(fileObj) {
    const wavData = bufferToWav(fileObj.audioBuffer, fileObj.volume);
    fileObj.blob = new Blob([wavData], { type: 'audio/wav' });
    if (fileObj.url) URL.revokeObjectURL(fileObj.url);
    fileObj.url = URL.createObjectURL(fileObj.blob);
}

// ファイルリストを描画（検索・ソート結果を反映）
function renderFileList() {
    fileListDiv.innerHTML = '';
    const keyword = searchInput.value.toLowerCase();

    // フィルタリング
    const filteredFiles = convertedFiles.filter(fileObj => 
        fileObj.name.toLowerCase().includes(keyword)
    );

    if (filteredFiles.length === 0) {
        fileListDiv.innerHTML = '<div style="padding: 15px; text-align: center; color: #7f8c8d;">一致するファイルがありません</div>';
        return;
    }

    filteredFiles.forEach(fileObj => {
        const percentVal = Math.round(fileObj.volume * 100);
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = `file-item-${fileObj.id}`;
        
        item.innerHTML = `
            <div class="file-info" title="${fileObj.name}">
                <div style="font-weight: bold; margin-bottom: 2px;">🎵 ${fileObj.name}</div>
                <div style="font-size: 11px; color: #7f8c8d;">音量: <span id="vol-text-${fileObj.id}">${percentVal}%</span></div>
            </div>
            <div class="file-controls">
                <input type="range" class="volume-slider" id="slider-${fileObj.id}" min="0" max="10" step="0.05" value="${fileObj.volume}">
                <input type="number" id="num-${fileObj.id}" class="volume-input-number" min="0" max="1000" value="${percentVal}">%
                <button class="btn btn-sm" id="play-btn-${fileObj.id}">▶ 再生</button>
                <button class="btn btn-sm btn-success" id="dl-btn-${fileObj.id}">💾 保存</button>
            </div>
        `;
        fileListDiv.appendChild(item);

        const slider = document.getElementById(`slider-${fileObj.id}`);
        const numberInput = document.getElementById(`num-${fileObj.id}`);
        const volText = document.getElementById(`vol-text-${fileObj.id}`);
        const playBtn = document.getElementById(`play-btn-${fileObj.id}`);
        const dlBtn = document.getElementById(`dl-btn-${fileObj.id}`);

        // スライダー操作
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            fileObj.volume = val;
            const p = Math.round(val * 100);
            volText.textContent = p + '%';
            numberInput.value = p;
            updateWavBlob(fileObj);
        });

        // 数値入力操作
        numberInput.addEventListener('input', (e) => {
            let p = parseInt(e.target.value);
            if (isNaN(p)) p = 0;
            if (p > 1000) p = 1000;
            const val = p / 100;
            fileObj.volume = val;
            volText.textContent = p + '%';
            slider.value = Math.min(val, 10); // スライダーの上限は10(1000%)に合わせる
            updateWavBlob(fileObj);
        });

        // デモ再生
        playBtn.addEventListener('click', async () => {
            if (!audioContext) return;
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (currentPlayingSource && currentPlayingButton === playBtn) {
                stopCurrentAudio();
            } else {
                stopCurrentAudio();
                playAudio(fileObj, playBtn);
            }
        });

        // 個別保存
        dlBtn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = fileObj.url;
            a.download = fileObj.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    });
}

// 並び替え処理
function sortFiles() {
    const sortType = sortSelect.value;
    convertedFiles.sort((a, b) => {
        if (sortType === 'name-asc') {
            return a.name.localeCompare(b.name, 'ja', { numeric: true });
        } else {
            return b.name.localeCompare(a.name, 'ja', { numeric: true });
        }
    });
}

sortSelect.addEventListener('change', () => {
    sortFiles();
    renderFileList();
});

searchInput.addEventListener('input', () => {
    renderFileList();
});

// 一括音量変更の連動
function applyBatchVolume(val) {
    const p = Math.round(val * 100);
    batchVolumeSlider.value = Math.min(val, 10);
    batchVolumeNumber.value = p;

    convertedFiles.forEach(fileObj => {
        fileObj.volume = val;
        updateWavBlob(fileObj);
    });
    renderFileList();
}

batchVolumeSlider.addEventListener('input', (e) => {
    applyBatchVolume(parseFloat(e.target.value));
});

batchVolumeNumber.addEventListener('input', (e) => {
    let p = parseInt(e.target.value);
    if (isNaN(p)) p = 0;
    if (p > 1000) p = 1000;
    applyBatchVolume(p / 100);
});

// 試聴用
function playAudio(fileObj, btnElement) {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = fileObj.audioBuffer;
    gainNode.gain.value = fileObj.volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(0);
    currentPlayingSource = source;
    currentPlayingButton = btnElement;
    btnElement.textContent = '⏹ 停止';

    source.onended = () => {
        if (currentPlayingSource === source) {
            btnElement.textContent = '▶ 再生';
            currentPlayingSource = null;
            currentPlayingButton = null;
        }
    };
}

function stopCurrentAudio() {
    if (currentPlayingSource) {
        try {
            currentPlayingSource.stop();
        } catch(e) {}
        currentPlayingSource = null;
    }
    if (currentPlayingButton) {
        currentPlayingButton.textContent = '▶ 再生';
        currentPlayingButton = null;
    }
}

async function getOggEntriesFromZip(file) {
    statusDiv.textContent = `${file.name} を展開中...`;
    let zip = new JSZip();
    let entries = [];

    try {
        let zipContent = await zip.loadAsync(file);
        
        for (let [relativePath, zipEntry] of Object.entries(zipContent.files)) {
            if (zipEntry.dir) continue;
            
            let fileData;
            try {
                fileData = await zipEntry.async('arraybuffer');
            } catch (err) {
                if (err.message.includes('encrypted') || err.message.includes('password')) {
                    modalFileName.textContent = file.name;
                    passwordModal.style.display = 'flex';
                    
                    let password = await new Promise((resolve) => {
                        passwordResolver = resolve;
                    });
                    passwordModal.style.display = 'none';

                    try {
                        let decryptedZip = new JSZip();
                        let loaded = await decryptedZip.loadAsync(file, { password: password });
                        let targetEntry = loaded.files[relativePath];
                        fileData = await targetEntry.async('arraybuffer');
                    } catch (pwErr) {
                        alert('パスワードが間違っているか、解凍できませんでした。');
                        continue;
                    }
                } else {
                    continue;
                }
            }

            if (relativePath.toLowerCase().endsWith('.ogg')) {
                let fakeFile = new File([fileData], relativePath);
                let baseName = relativePath.substring(relativePath.lastIndexOf('/') + 1, relativePath.lastIndexOf('.'));
                entries.push({ file: fakeFile, customName: baseName });
            }
        }
    } catch (e) {
        console.error(e);
        statusDiv.textContent = `ZIPファイルの読み込みに失敗しました: ${file.name}`;
    }
    return entries;
}

submitPasswordBtn.addEventListener('click', () => {
    if (passwordResolver) {
        passwordResolver(zipPasswordInput.value);
        zipPasswordInput.value = '';
    }
});

downloadAllBtn.addEventListener('click', () => {
    convertedFiles.forEach((file, index) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = file.url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, index * 300);
    });
});

downloadZipBtn.addEventListener('click', async () => {
    statusDiv.textContent = 'ZIPファイルを作成中...';
    downloadZipBtn.disabled = true;

    const zip = new JSZip();
    convertedFiles.forEach(file => {
        zip.file(file.name, file.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(content);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'converted_wav_files.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    statusDiv.textContent = 'ZIPのダウンロードが完了しました！';
    downloadZipBtn.disabled = false;
});

// WAV変換・増幅ロジック（最大1000%対応）
function bufferToWav(buffer, volume = 1.0) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    let result;
    if (numOfChan === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }

    const dataLength = result.length * (bitDepth / 8);
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);

    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
        let s = result[i] * volume;
        if (s > 1.0) s = 1.0;
        if (s < -1.0) s = -1.0;
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return arrayBuffer;
}

function interleave(inputL, inputR) {
    let length = inputL.length + inputR.length;
    let result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
