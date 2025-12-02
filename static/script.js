// DOM Elements
const canvas = document.getElementById('image-canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('file-upload');
const analyzeBtn = document.getElementById('analyze-btn');
const calibrateBtn = document.getElementById('calibrate-btn');
const intensityChartCtx = document.getElementById('intensity-chart').getContext('2d');
const rgbChartCtx = document.getElementById('rgb-chart').getContext('2d');

// State
let currentImage = null; // Image object
let cropStart = null;
let cropRect = null; // {x, y, w, h}
let isDragging = false;
let scaleX = 1, scaleY = 1;
let offsetX = 0, offsetY = 0;
let analysisData = null;
let selectedPeaks = []; // Array of {pixel, wavelength}
let charts = {};
let currentRotation = 0; // 0, 90, 180, 270

// --- Event Listeners ---

fileInput.addEventListener('change', handleFileUpload);
document.getElementById('rotate-left').addEventListener('click', () => rotateImage('left'));
document.getElementById('rotate-right').addEventListener('click', () => rotateImage('right'));
document.getElementById('reset-btn').addEventListener('click', resetApp);
document.getElementById('analyze-btn').addEventListener('click', analyzeImage);
document.getElementById('calibrate-btn').addEventListener('click', startCalibration);

// Canvas Events for Cropping
canvas.addEventListener('mousedown', startCrop);
canvas.addEventListener('mousemove', drawCrop);
canvas.addEventListener('mouseup', endCrop);

// Modal Events
document.getElementById('cancel-calib').addEventListener('click', () => {
    document.getElementById('calibration-modal').classList.add('hidden');
    selectedPeaks = [];
    updateGraphAnnotations();
});
document.getElementById('confirm-calib').addEventListener('click', submitCalibration);

// --- Functions ---

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            loadImage(data.url);
        })
        .catch(err => console.error(err));
}

function loadImage(url) {
    const img = new Image();
    img.onload = () => {
        currentImage = img;
        cropRect = null;
        currentRotation = 0;
        renderCanvas();
    };
    img.src = url;
}

function rotateImage(direction) {
    if (!currentImage) return;

    // Update local rotation state
    if (direction === 'left') {
        currentRotation = (currentRotation - 90 + 360) % 360;
    } else {
        currentRotation = (currentRotation + 90) % 360;
    }

    // Send to backend
    fetch('/api/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
    })
        .then(res => res.json())
        .then(data => {
            cropRect = null; // Reset crop on rotation
            renderCanvas();
            // If we have an image, re-analyze to update graphs for rotated image
            if (currentImage) analyzeImage();
        });
}

function renderCanvas() {
    if (!currentImage) return;

    // Fit image to canvas container
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Determine effective dimensions based on rotation
    const isVertical = currentRotation === 90 || currentRotation === 270;
    const imgW = isVertical ? currentImage.height : currentImage.width;
    const imgH = isVertical ? currentImage.width : currentImage.height;

    // Calculate aspect ratio
    const imgRatio = imgW / imgH;
    const canvasRatio = canvas.width / canvas.height;

    let drawW, drawH;
    if (imgRatio > canvasRatio) {
        drawW = canvas.width;
        drawH = drawW / imgRatio;
    } else {
        drawH = canvas.height;
        drawW = drawH * imgRatio;
    }

    offsetX = (canvas.width - drawW) / 2;
    offsetY = (canvas.height - drawH) / 2;

    scaleX = imgW / drawW;
    scaleY = imgH / drawH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Translate to center of drawing area
    ctx.translate(offsetX + drawW / 2, offsetY + drawH / 2);

    // Rotate
    ctx.rotate(currentRotation * Math.PI / 180);

    if (isVertical) {
        ctx.drawImage(currentImage, -drawH / 2, -drawW / 2, drawH, drawW);
    } else {
        ctx.drawImage(currentImage, -drawW / 2, -drawH / 2, drawW, drawH);
    }

    ctx.restore();

    // Draw crop rect if exists
    if (cropRect) {
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            cropRect.x / scaleX + offsetX,
            cropRect.y / scaleY + offsetY,
            cropRect.w / scaleX,
            cropRect.h / scaleY
        );
        ctx.fillStyle = 'rgba(0, 242, 255, 0.2)';
        ctx.fillRect(
            cropRect.x / scaleX + offsetX,
            cropRect.y / scaleY + offsetY,
            cropRect.w / scaleX,
            cropRect.h / scaleY
        );
    }
}

// --- Cropping Logic ---

function startCrop(e) {
    if (!currentImage) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cropStart = { x, y };
    isDragging = true;
}

function drawCrop(e) {
    if (!isDragging || !currentImage) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    renderCanvas(); // Clear previous rect

    const w = x - cropStart.x;
    const h = y - cropStart.y;

    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropStart.x, cropStart.y, w, h);
}

function endCrop(e) {
    if (!isDragging || !currentImage) return;
    isDragging = false;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate actual image coordinates
    const x1 = Math.min(cropStart.x, x) - offsetX;
    const y1 = Math.min(cropStart.y, y) - offsetY;
    const w = Math.abs(x - cropStart.x);
    const h = Math.abs(y - cropStart.y);

    // Convert to image pixels
    cropRect = {
        x: Math.max(0, Math.round(x1 * scaleX)),
        y: Math.max(0, Math.round(y1 * scaleY)),
        w: Math.round(w * scaleX),
        h: Math.round(h * scaleY)
    };

    // Bounds check
    if (cropRect.w > 0 && cropRect.h > 0) {
        console.log("Crop:", cropRect);
        renderCanvas(); // Redraw with final cyan rect
    } else {
        cropRect = null;
    }
}

// --- Analysis ---

function analyzeImage() {
    if (!currentImage) return;

    const payload = {};
    if (cropRect) payload.crop = cropRect;

    fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            analysisData = data;
            renderGraphs(data);
            calibrateBtn.disabled = false;
            document.querySelector('.status-text').textContent = data.is_calibrated ? "Calibrated" : "Uncalibrated";
        })
        .catch(err => console.error(err));
}

function renderGraphs(data) {
    // Destroy existing charts
    if (charts.intensity) charts.intensity.destroy();
    if (charts.rgb) charts.rgb.destroy();

    // Intensity Chart
    charts.intensity = new Chart(intensityChartCtx, {
        type: 'line',
        data: {
            labels: data.x_axis,
            datasets: [{
                label: 'Total Intensity',
                data: data.total,
                borderColor: '#00f2ff',
                backgroundColor: 'rgba(0, 242, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Intensity: ${ctx.raw.toFixed(1)}`
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#888' }, grid: { color: '#333' } },
                y: { ticks: { color: '#888' }, grid: { color: '#333' } }
            },
            onClick: handleGraphClick
        }
    });

    // RGB Chart
    charts.rgb = new Chart(rgbChartCtx, {
        type: 'line',
        data: {
            labels: data.x_axis,
            datasets: [
                { label: 'Red', data: data.red, borderColor: '#ff4757', borderWidth: 1, pointRadius: 0 },
                { label: 'Green', data: data.green, borderColor: '#2ed573', borderWidth: 1, pointRadius: 0 },
                { label: 'Blue', data: data.blue, borderColor: '#1e90ff', borderWidth: 1, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });

    updateGraphAnnotations();
}

// --- Calibration ---

function startCalibration() {
    if (!analysisData) return;
    alert("Click on TWO peaks in the top graph to select them for calibration.");
    selectedPeaks = [];
}

function handleGraphClick(e, elements, chart) {
    if (!analysisData || selectedPeaks.length >= 2) return;

    // Find nearest peak
    const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);
    if (points.length) {
        const index = points[0].index;
        const pixel = analysisData.peaks[index] || index; // Use peak index if available or raw index

        // Simple logic: Find closest actual peak from detected peaks
        // The graph x-axis might be calibrated, so we use index to map back to peaks
        // Let's find the closest peak in analysisData.peaks to the clicked index

        const clickedIndex = index;
        const closestPeak = analysisData.peaks.reduce((prev, curr) => {
            return (Math.abs(curr - clickedIndex) < Math.abs(prev - clickedIndex) ? curr : prev);
        });

        // Check distance threshold (e.g. within 20 pixels)
        if (Math.abs(closestPeak - clickedIndex) > 50) return; // Too far from a peak

        // Add to selection
        if (!selectedPeaks.includes(closestPeak)) {
            selectedPeaks.push(closestPeak);
            updateGraphAnnotations();

            if (selectedPeaks.length === 2) {
                showCalibrationModal();
            }
        }
    }
}

function updateGraphAnnotations() {
    if (!charts.intensity) return;

    // We can use Chart.js annotation plugin or just draw points
    // For simplicity, we'll add a dataset for peaks

    const peakData = analysisData.total.map((val, idx) => {
        if (selectedPeaks.includes(analysisData.peaks.find(p => p === idx))) return val;
        if (analysisData.peaks.includes(idx)) return val; // Show all peaks?
        return null;
    });

    // Let's just highlight selected peaks
    const selectedPoints = analysisData.total.map((val, idx) => selectedPeaks.includes(idx) ? val : null);

    // Update datasets
    charts.intensity.data.datasets[1] = {
        label: 'Selected Peaks',
        data: selectedPoints,
        backgroundColor: '#00f2ff',
        borderColor: '#fff',
        pointRadius: 6,
        pointHoverRadius: 8,
        type: 'scatter'
    };

    charts.intensity.update();
}

function showCalibrationModal() {
    document.getElementById('p1-pixel').textContent = selectedPeaks[0];
    document.getElementById('p2-pixel').textContent = selectedPeaks[1];
    document.getElementById('calibration-modal').classList.remove('hidden');
}

function submitCalibration() {
    const w1 = parseFloat(document.getElementById('p1-wavelength').value);
    const w2 = parseFloat(document.getElementById('p2-wavelength').value);

    if (!w1 || !w2) return;

    fetch('/api/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            p1: selectedPeaks[0], w1: w1,
            p2: selectedPeaks[1], w2: w2
        })
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById('calibration-modal').classList.add('hidden');
            selectedPeaks = [];
            analyzeImage(); // Re-analyze to update graph axis
        });
}

function resetApp() {
    currentImage = null;
    cropRect = null;
    analysisData = null;
    selectedPeaks = [];
    currentRotation = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (charts.intensity) charts.intensity.destroy();
    if (charts.rgb) charts.rgb.destroy();
    fileInput.value = '';
}
