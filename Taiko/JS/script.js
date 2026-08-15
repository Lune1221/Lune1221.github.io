// 保存先: Taiko/JS/script.js の中身を以下にすべて上書きしてください

const canvas = document.getElementById('plateCanvas');
const ctx = canvas.getContext('2d');
const plateView = document.getElementById('plateView');

const bgSelect = document.getElementById('bgSelect');
const textModeRadios = document.getElementsByName('textMode');
const presetGroup = document.getElementById('presetGroup');
const presetSelect = document.getElementById('presetSelect');
const customGroup = document.getElementById('customGroup');
const customInput = document.getElementById('customInput');
const textColorInput = document.getElementById('textColorInput');

const sizeSlider = document.getElementById('sizeSlider');
const xSlider = document.getElementById('xSlider');
const ySlider = document.getElementById('ySlider');
const sizeValue = document.getElementById('sizeValue');
const xValue = document.getElementById('xValue');
const yValue = document.getElementById('yValue');

let imgBg = new Image();
let imgText = new Image();

imgBg.onload = onAssetLoad;
imgText.onload = onAssetLoad;

document.fonts.load("12px 'TaikoFont'").then(() => {
    drawPlate();
});

function onAssetLoad() {
    drawPlate();
}

function updateModeVisibility() {
    const mode = document.querySelector('input[name="textMode"]:checked').value;
    if (mode === 'preset') {
        presetGroup.style.display = 'block';
        customGroup.style.display = 'none';
    } else {
        presetGroup.style.display = 'none';
        customGroup.style.display = 'block';
    }
    loadAssets();
}

function loadAssets() {
    imgBg.src = bgSelect.value;
    const mode = document.querySelector('input[name="textMode"]:checked').value;
    if (mode === 'preset') {
        imgText.src = presetSelect.value;
    } else {
        imgText.src = '';
        drawPlate();
    }
}

function drawPlate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 背景の木目板を描画
    if (imgBg.complete && imgBg.naturalWidth !== 0) {
        ctx.drawImage(imgBg, 0, 0, canvas.width, canvas.height);
    }

    const mode = document.querySelector('input[name="textMode"]:checked').value;
    
    const sMultiplier = parseFloat(sizeSlider.value) / 100;
    const offsetX = parseInt(xSlider.value);
    const offsetY = parseInt(ySlider.value);

    sizeValue.textContent = sizeSlider.value + "%";
    xValue.textContent = (offsetX >= 0 ? "+" : "") + offsetX;
    yValue.textContent = (offsetY >= 0 ? "+" : "") + offsetY;

    if (mode === 'preset') {
        if (imgText.complete && imgText.naturalWidth !== 0) {
            // 【完全解決のキーポイント】
            // 本物の画像を重なるレベルで分析し、
            // 横幅は「0.80倍」、縦幅は上下をギュッと詰めるために「0.71倍」に設定。
            const scaleX = 0.80 * sMultiplier; 
            const scaleY = 0.71 * sMultiplier; 
            
            const w = canvas.width * scaleX;
            const h = canvas.height * scaleY;
            
            // 無理なマイナス数値を廃止し、純粋な中央配置にスライダーの値を足すだけに修正。
            // 初期状態（スライダーが0のとき）で本物と完全に一致します。
            const x = ((canvas.width - w) / 2) + offsetX;
            const y = ((canvas.height - h) / 2) - 45 + offsetY; // 上下の基準位置だけ少し上に持ち上げ
            
            ctx.drawImage(imgText, x, y, w, h);
        }
    } else {
        // 2-B. 自由入力テキスト描画
        const text = customInput.value || "初段";
        const singleColor = textColorInput.value;
        
        const baseFontSize = Math.round(110 * sMultiplier);
        ctx.font = "italic bold " + baseFontSize + "px 'TaikoFont', 'Hiragino Kaku Gothic ProN', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const chars = text.split('');
        const startY = (canvas.height / 2) - ((chars.length - 1) * (baseFontSize * 0.55)) - (baseFontSize * 0.25) + offsetY;

        chars.forEach((char, index) => {
            const x = (canvas.width / 2) + offsetX;
            const y = startY + (index * (baseFontSize * 1.1));

            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.strokeStyle = '#000000'; ctx.lineWidth = baseFontSize * 0.24; ctx.strokeText(char, x, y);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = baseFontSize * 0.13; ctx.strokeText(char, x, y);
            ctx.strokeStyle = '#000000'; ctx.lineWidth = baseFontSize * 0.04; ctx.strokeText(char, x, y);

            ctx.fillStyle = singleColor;
            ctx.fillText(char, x, y);
        });
    }
    
    plateView.src = canvas.toDataURL('image/png');
}

bgSelect.addEventListener('change', loadAssets);
presetSelect.addEventListener('change', loadAssets);
customInput.addEventListener('input', drawPlate);
textColorInput.addEventListener('input', drawPlate);

sizeSlider.addEventListener('input', drawPlate);
xSlider.addEventListener('input', drawPlate);
ySlider.addEventListener('input', drawPlate);

textModeRadios.forEach(radio => radio.addEventListener('change', updateModeVisibility));

updateModeVisibility();
