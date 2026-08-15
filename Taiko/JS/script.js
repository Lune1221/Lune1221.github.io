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
    // 【重要：歪みバグの根本修正】
    // 背景画像が読み込まれていたら、キャンバスの縦横サイズを「画像の本物のピクセル数」に強制変更します。
    // これにより、HTML側でどんなサイズが指定されていても、型枠の比率が画像と100%完全一致します。
    if (imgBg.complete && imgBg.naturalWidth !== 0) {
        canvas.width = imgBg.naturalWidth;
        canvas.height = imgBg.naturalHeight;
    } else {
        // 画像がまだ無い場合の安全用の初期サイズ
        canvas.width = 240;
        canvas.height = 520;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 背景の木目板を描画（等倍・無変形）
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
        // 2-A. 公式文字パーツ描画（等倍ベース・スライダー連動）
        if (imgText.complete && imgText.naturalWidth !== 0) {
            // 背景と同じサイズで切り抜かれているため、同じサイズ（等倍）をベースに拡縮します
            const w = canvas.width * sMultiplier;
            const h = canvas.height * sMultiplier;
            
            // スライダーが初期値（+0）の時は、完全にド真ん中に配置されます
            const x = ((canvas.width - w) / 2) + offsetX;
            const y = ((canvas.height - h) / 2) + offsetY; 
            
            ctx.drawImage(imgText, x, y, w, h);
        }
    } else {
        // 2-B. 自由入力テキスト描画
        const text = customInput.value || "初段";
        const singleColor = textColorInput.value;
        
        // キャンバスの元サイズに合わせてフォントサイズを動的に計算
        const baseFontSize = Math.round((canvas.width * 0.45) * sMultiplier);
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
    
    // 生成結果を長押し用画像タグへ反映
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
