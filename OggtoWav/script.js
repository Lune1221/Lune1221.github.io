const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusDiv = document.getElementById('status');
const downloadArea = document.getElementById('downloadArea');

// ドラッグ＆ドロップのイベント設定
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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// メインの変換処理
async function handleFile(file) {
    if (!file.name.endsWith('.ogg') && file.type !== 'audio/ogg' && !file.type.includes('ogg')) {
        statusDiv.textContent = 'エラー: Oggファイルを選択してください。';
        return;
    }

    downloadArea.innerHTML = '';
    statusDiv.textContent = 'ファイルを読み込み中...';

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        statusDiv.textContent = '音声データに変換中...';
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        statusDiv.textContent = 'WAV形式にエンコード中...';
        const wavData = bufferToWav(audioBuffer);
        const blob = new Blob([wavData], { type: 'audio/wav' });

        // ダウンロードリンクの作成
        const url = URL.createObjectURL(blob);
        const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
        const fileName = `${originalName}.wav`;

        statusDiv.textContent = '変換が完了しました！';
        
        downloadArea.innerHTML = `
            <a href="${url}" download="${fileName}" class="btn">WAVファイルをダウンロード</a>
        `;

    } catch (error) {
        console.error(error);
        statusDiv.textContent = 'エラー: このOggファイルはデコードできませんでした。';
    }
}

// AudioBufferをWAV形式のArrayBufferに変換する関数
function bufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
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

    // RIFFチャンク
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');

    // fmtサブチャンク
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, format, true); // AudioFormat
    view.setUint16(22, numOfChan, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true); // ByteRate
    view.setUint16(32, numOfChan * (bitDepth / 8), true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample

    // dataサブチャンク
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // 波形データの書き込み (16bit PCM)
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
