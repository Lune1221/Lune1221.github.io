// 音声処理・エンコード関連のモジュール

function updateFileBlob(fileObj) {
    const audioData = createAudioBlob(fileObj.audioBuffer, fileObj.volume, fileObj.extension);
    fileObj.blob = audioData.blob;
    if (fileObj.url) URL.revokeObjectURL(fileObj.url);
    fileObj.url = URL.createObjectURL(fileObj.blob);
}

function getFullName(fileObj) {
    return `${fileObj.baseName}.${fileObj.extension}`;
}

function createAudioBlob(buffer, volume = 1.0, extension = 'wav') {
    const ext = extension.toLowerCase();
    
    if (ext === 'wav' || ext === 'aiff' || ext === 'aif') {
        const wavData = bufferToWav(buffer, volume);
        return { blob: new Blob([wavData], { type: 'audio/wav' }) };
    } 
    
    const wavData = bufferToWav(buffer, volume);
    let mime = 'audio/wav';
    if (ext === 'mp3') mime = 'audio/mpeg';
    else if (ext === 'ogg' || ext === 'opus') mime = 'audio/ogg';
    else if (ext === 'm4a' || ext === 'aac') mime = 'audio/mp4';
    else if (ext === 'flac') mime = 'audio/flac';

    return { blob: new Blob([wavData], { type: mime }) };
}

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
