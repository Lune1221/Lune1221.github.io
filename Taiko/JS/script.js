const canvas = document.getElementById('plateCanvas');
const ctx = canvas.getContext('2d');
const plateView = document.getElementById('plateView');

const bgSelect = document.getElementById('bgSelect');
const presetSelect = document.getElementById('presetSelect');

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

loadAssets();

function onAssetLoad() {
    drawPlate();
}

function loadAssets() {
    imgBg.src = bgSelect.value;
    imgText.src = presetSelect.value;
}

function drawPlate() {
    if (imgBg.complete && imgBg.naturalWidth !== 0) {
        canvas.width = imgBg.naturalWidth;
        canvas.height = imgBg.naturalHeight;
    } else {
        canvas.width = 240;
        canvas.height = 520;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imgBg.complete && imgBg.naturalWidth !== 0) {
        ctx.drawImage(imgBg, 0, 0, canvas.width, canvas.height);
    }
    
    const sMultiplier = parseFloat(sizeSlider.value) / 100;
    const offsetX = parseInt(xSlider.value);
    const offsetY = parseInt(ySlider.value);

    sizeValue.textContent = sizeSlider.value + "%";
    xValue.textContent = (offsetX >= 0 ? "+" : "") + offsetX;
    yValue.textContent = (offsetY >= 0 ? "+" : "") + offsetY;

    if (imgText.complete && imgText.naturalWidth !== 0) {
        // 基本のサイズ計算
        let w = canvas.width * sMultiplier;
        let h = canvas.height * sMultiplier;

        if (!presetSelect.value.includes('TATSUJIN.png') && !presetSelect.value.includes('Original.png')) {
            w = w * 0.85; 
        }
        
        const x = ((canvas.width - w) / 2) + offsetX;
        const y = ((canvas.height - h) / 2) + offsetY; 
        
        ctx.drawImage(imgText, x, y, w, h);
    }
    
    plateView.src = canvas.toDataURL('image/png');
}

bgSelect.addEventListener('change', loadAssets);
presetSelect.addEventListener('change', loadAssets);

sizeSlider.addEventListener('input', drawPlate);
xSlider.addEventListener('input', drawPlate);
ySlider.addEventListener('input', drawPlate);
