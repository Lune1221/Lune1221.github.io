const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusDiv = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
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

// 進捗バーを更新する補助関数
function updateProgress(percent, text) {
    progressContainer.style.display = 'block';
    const p = Math.round(percent);
    progressBar.style.width = p + '%';
    progressBar.textContent = p + '%';
    if (text) {
        statusDiv.textContent = text;
    }
}

// ファイルの振り分け処理
async function handleFiles(files) {
    if (files.length === 0) return;

    convertedFiles = [];
    fileListDiv.innerHTML = '';
    fileListDiv.style.display = 'block';
    actionArea.style.display = 'none';
    
    updateProgress(0, 'ファイルを準備中...');

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 処理対象のファイルをリスト化（ZIPの中身も事前抽出のためにカウント）
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

    // 1つずつ変換しつつ進捗を更新
    let completedCount = 0;
    for (const entry of allOggEntries) {
        let percent = (completedCount / allOggEntries.length) * 100;
        updateProgress(percent, `${entry.file.name} を変換中... (${completedCount + 1}/${allOggEntries.length})`);

        await convertAndStoreOgg(entry.file, audioContext, entry.customName);
        completedCount++;
    }

    updateProgress(100, `${convertedFiles.length}個のファイルの変換が完了しました！`);
    actionArea.style.display = 'block';
}

// 個別Oggファイルの変換・保存
async function convertAndStoreOgg(file, audioContext, customName = null) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wavData = bufferToWav(audioBuffer);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const baseName = customName || file.name.substring(0, file.name.lastIndexOf('.'));
        const fileName = `${baseName}.wav`;

        convertedFiles.push({ name: fileName, blob: blob, url: url });

        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<span>🎵 ${fileName}</span> <span style="color: #2ecc71;">成功</span>`;
        fileListDiv.appendChild(item);
    } catch (err) {
        console.error(err);
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<span>⚠️ ${file.name}</span> <span style="color: #e74c3c;">失敗</span>`;
        fileListDiv.appendChild(item);
    }
}

// ZIPファイルからOggエントリを抽出する（パスワード対応）
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

// すべて個別にダウンロード
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

// ZIPにまとめてダウンロード
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

// WAV変換ロジック
function bufferToWav(buffer) {
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
        let s = Math.max(-1, Math.min(1, result[i]));
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
