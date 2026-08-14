const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const batchControls = document.getElementById('batchControls');
const batchVolumeSlider = document.getElementById('batchVolumeSlider');
const batchVolumeText = document.getElementById('batchVolumeText');
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
let currentPlayingSource = null;

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
    batchControls.style.display = 'none';
    
    updateProgress(0, 'ファイルを準備中...');

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

    updateProgress(100, `${convertedFiles.length}個のファイルの準備が完了しました！`);
    batchControls.style.display = 'flex';
    actionArea.style.display = 'block';
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

        renderFileItem(fileObj, audioContext);
    } catch (err) {
        console.error(err);
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<span class="file-info">⚠️ ${file.name} (デコード失敗)</span>`;
        fileListDiv.appendChild(item);
    }
}

function updateWavBlob(fileObj) {
    const wavData = bufferToWav(fileObj.audioBuffer, fileObj.volume);
    fileObj.blob = new Blob([wavData], { type: 'audio/wav' });
    if (fileObj.url) URL.revokeObjectURL(fileObj.url);
    fileObj.url = URL.createObjectURL(fileObj.blob);
}

function renderFileItem(fileObj, audioContext) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.id = `file-item-${fileObj.id}`;
    
    item.innerHTML = `
        <div class="file-info">
            <div style="font-weight: bold; margin-bottom: 4px;">🎵 ${fileObj.name}</div>
            <div style="font-size: 12px; color: #7f8c8d;">音量: <span id="vol-text-${fileObj.id}">100%</span></div>
        </div>
        <div class="file-controls">
            <input type="range" class="volume-slider" id="slider-${fileObj.id}" min="0" max="3" step="0.05" value="${fileObj.volume}">
            <button class="btn btn-sm" id="play-btn-${fileObj.id}">▶ デモ再生</button>
        </div>
    `;
    fileListDiv.appendChild(item);

    const slider = document.getElementById(`slider-${fileObj.id}`);
    const volText = document.getElementById(`vol-text-${fileObj.id}`);
    const playBtn = document.getElementById(`play-btn-${fileObj.id}`);

    slider.addEventListener('input', (e) => {
        fileObj.volume = parseFloat(e.target.value);
        volText.textContent = Math.round(fileObj.volume * 100) + '%';
        updateWavBlob(fileObj);
    });

    playBtn.addEventListener('click', () => {
        if (playBtn.textContent.includes('▶')) {
            stopCurrentAudio();
            playAudio(fileObj, audioContext, playBtn);
        } else {
            stopCurrentAudio();
        }
    });
}

// 試聴時にもしっかりと音量を反映（GainNodeを最大3倍まで有効化）
function playAudio(fileObj, audioContext, btnElement) {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = fileObj.audioBuffer;
    // スライダーの値をそのままゲインに反映（最大3倍までブースト）
    gainNode.gain.value = fileObj.volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(0);
    currentPlayingSource = source;
    btnElement.textContent = '⏹ 停止';

    source.onended = () => {
        btnElement.textContent = '▶ デモ再生';
        if (currentPlayingSource === source) {
            currentPlayingSource = null;
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
    document.querySelectorAll('[id^="play-btn-"]').forEach(btn => {
        btn.textContent = '▶ デモ再生';
    });
}

batchVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    batchVolumeText.textContent = Math.round(val * 100) + '%';

    convertedFiles.forEach(fileObj => {
        fileObj.volume = val;
        updateWavBlob(fileObj);

        const slider = document.getElementById(`slider-${fileObj.id}`);
        const volText = document.getElementById(`vol-text-${fileObj.id}`);
        if (slider) slider.value = val;
        if (volText) volText.textContent = Math.round(val * 100) + '%';
    });
});

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

// WAV変換と音量増幅ロジックの改善（スライダー範囲を最大300%に拡張）
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
    view.setUint16(34, bitDifference = bitDepth, true); // (修正: bitDepth)

    // 正確な書き込み用再設定
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);

    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
        // 音量を掛け算し、16bitの範囲内に収める（大きくブーストできるように調整）
        let s = result[i] * volume;
        // 限界値（クリッピング）で自然に丸める処理
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
