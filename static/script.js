// --- DOM Elements ---
// Single View
const singleView = document.getElementById('single-view');
const canvasSingle = document.getElementById('image-canvas');
const ctxSingle = canvasSingle.getContext('2d');
const fileInputSingle = document.getElementById('file-upload');
const analyzeBtnSingle = document.getElementById('analyze-btn');
const calibrateBtnSingle = document.getElementById('calibrate-btn');
const intensityChartCtx = document.getElementById('intensity-chart').getContext('2d');
const rgbChartCtx = document.getElementById('rgb-chart').getContext('2d');

// Comparison View
const compareView = document.getElementById('compare-view');
const canvasComp = document.getElementById('comp-image-canvas');
const ctxComp = canvasComp.getContext('2d');
const fileInputComp = document.getElementById('comp-file-upload');
const analyzeBtnComp = document.getElementById('comp-analyze-btn');
const calibrateBtnComp = document.getElementById('comp-calibrate-btn');
const compChartCtx = document.getElementById('comp-chart').getContext('2d');
const compTargetLabel = document.getElementById('comp-target-label');

// Live Camera View
const liveView = document.getElementById('live-view');
const canvasLive = document.getElementById('live-canvas');
const ctxLive = canvasLive.getContext('2d');
const videoLive = document.getElementById('live-video');
const cameraSelect = document.getElementById('camera-select');
const analyzeBtnLive = document.getElementById('live-analyze-btn');
const calibrateBtnLive = document.getElementById('live-calibrate-btn');
const liveIntensityChartCtx = document.getElementById('live-intensity-chart').getContext('2d');
const liveRgbChartCtx = document.getElementById('live-rgb-chart').getContext('2d');

// Navigation
const navSingle = document.getElementById('nav-single');
const navCompare = document.getElementById('nav-compare');
const navLive = document.getElementById('nav-live');
const subTabs = document.querySelectorAll('.sub-tab-btn');

// --- State ---
const targets = {
    'single': {
        image: null, cropRect: null, rotation: 0, analysisData: null, selectedPeaks: [],
        ctx: ctxSingle, canvas: canvasSingle
    },
    'comp_a': {
        image: null, cropRect: null, rotation: 0, analysisData: null, selectedPeaks: [],
        ctx: ctxComp, canvas: canvasComp
    },
    'comp_b': {
        image: null, cropRect: null, rotation: 0, analysisData: null, selectedPeaks: [],
        ctx: ctxComp, canvas: canvasComp
    },
    'live': {
        image: null, cropRect: null, rotation: 0, analysisData: null, selectedPeaks: [],
        ctx: ctxLive, canvas: canvasLive
    }
};

let activeView = 'single'; // 'single', 'compare', 'live'
let activeCompTarget = 'comp_a'; // 'comp_a' or 'comp_b'

// Shared Interaction State
let isDragging = false;
let cropStart = null;
let scaleX = 1, scaleY = 1;
let offsetX = 0, offsetY = 0;

let charts = {}; // intensity, rgb, comp, live_intensity, live_rgb
let cameraStream = null;
let isCameraRunning = false;
let animationFrameId = null;

// --- Event Listeners ---

// Navigation
navSingle.addEventListener('click', () => switchView('single'));
navCompare.addEventListener('click', () => switchView('compare'));
navLive.addEventListener('click', () => switchView('live'));

// Sub Tabs
subTabs.forEach(btn => {
    btn.addEventListener('click', () => switchCompTarget(btn.dataset.target));
});

// Single View Controls
fileInputSingle.addEventListener('change', (e) => handleFileUpload(e, 'single'));
document.getElementById('rotate-left').addEventListener('click', () => rotateImage('single', 'left'));
document.getElementById('rotate-right').addEventListener('click', () => rotateImage('single', 'right'));
document.getElementById('reset-btn').addEventListener('click', () => resetTarget('single'));
analyzeBtnSingle.addEventListener('click', () => analyzeImage('single'));
calibrateBtnSingle.addEventListener('click', () => startCalibration('single'));

// Comparison View Controls
fileInputComp.addEventListener('change', (e) => handleFileUpload(e, activeCompTarget));
document.getElementById('comp-rotate-left').addEventListener('click', () => rotateImage(activeCompTarget, 'left'));
document.getElementById('comp-rotate-right').addEventListener('click', () => rotateImage(activeCompTarget, 'right'));
document.getElementById('comp-reset-btn').addEventListener('click', () => resetTarget(activeCompTarget));
analyzeBtnComp.addEventListener('click', () => analyzeImage(activeCompTarget));
calibrateBtnComp.addEventListener('click', () => startCalibration(activeCompTarget));

// Live View Controls
cameraSelect.addEventListener('change', startCamera);
document.getElementById('live-rotate-left').addEventListener('click', () => rotateImage('live', 'left'));
document.getElementById('live-rotate-right').addEventListener('click', () => rotateImage('live', 'right'));
analyzeBtnLive.addEventListener('click', captureAndAnalyze);
calibrateBtnLive.addEventListener('click', () => startCalibration('live'));

// Canvas Events
[canvasSingle, canvasComp, canvasLive].forEach(c => {
    c.addEventListener('mousedown', (e) => startCrop(e, c));
    c.addEventListener('mousemove', (e) => drawCrop(e, c));
    c.addEventListener('mouseup', (e) => endCrop(e, c));
});

// Modal Events
document.getElementById('cancel-calib').addEventListener('click', () => {
    document.getElementById('calibration-modal').classList.add('hidden');
    const targetId = getActiveTargetId();
    targets[targetId].selectedPeaks = [];
    updateGraphAnnotations(targetId);
});
document.getElementById('confirm-calib').addEventListener('click', submitCalibration);


// --- Functions ---

function getActiveTargetId() {
    if (activeView === 'single') return 'single';
    if (activeView === 'compare') return activeCompTarget;
    if (activeView === 'live') return 'live';
    return 'single';
}

function switchView(view) {
    activeView = view;

    // Hide all
    singleView.classList.add('hidden');
    compareView.classList.add('hidden');
    liveView.classList.add('hidden');
    navSingle.classList.remove('active');
    navCompare.classList.remove('active');
    navLive.classList.remove('active');

    // Stop camera if leaving live view
    if (view !== 'live') stopCamera();

    if (view === 'single') {
        singleView.classList.remove('hidden');
        navSingle.classList.add('active');
        renderCanvas('single');
        renderSingleGraphs();
    } else if (view === 'compare') {
        compareView.classList.remove('hidden');
        navCompare.classList.add('active');
        renderCanvas(activeCompTarget);
        renderCompGraph();
    } else if (view === 'live') {
        liveView.classList.remove('hidden');
        navLive.classList.add('active');
        initCamera();
        renderLiveGraphs();
    }
}

function switchCompTarget(targetId) {
    activeCompTarget = targetId;
    subTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
    compTargetLabel.textContent = targetId === 'comp_a' ? "(Image 1)" : "(Image 2)";
    renderCanvas(targetId);
    calibrateBtnComp.disabled = !targets[targetId].analysisData;
}

// --- Camera Logic ---

async function initCamera() {
    // Request permission first to get labels
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop initial stream
    } catch (err) {
        console.error("Error requesting camera permission:", err);
        alert("Please allow camera access to use this feature.");
        return;
    }

    if (cameraSelect.options.length <= 1) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            // Clear existing options except first
            cameraSelect.innerHTML = '<option value="">Select Camera...</option>';

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
        } catch (err) {
            console.error("Error enumerating devices:", err);
        }
    }

    // Auto start first camera if none selected
    if (!isCameraRunning && cameraSelect.options.length > 1) {
        cameraSelect.selectedIndex = 1;
        startCamera();
    }
}

async function startCamera() {
    stopCamera();
    const deviceId = cameraSelect.value;
    if (!deviceId) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } }
        });
        videoLive.srcObject = stream;
        cameraStream = stream;
        isCameraRunning = true;

        // Start render loop
        renderLoop();
    } catch (err) {
        console.error("Error starting camera:", err);
        alert("Could not start camera. Please check permissions.");
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    isCameraRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
}

function renderLoop() {
    if (!isCameraRunning || activeView !== 'live') return;

    // Draw video frame to canvas
    // We treat the video frame as the "image" for the live target
    targets['live'].image = videoLive;
    renderCanvas('live');

    animationFrameId = requestAnimationFrame(renderLoop);
}

function captureAndAnalyze() {
    if (!isCameraRunning) return;

    // Capture current frame as blob
    // We need to draw the CURRENT state of the canvas (rotated/cropped?)
    // Actually, backend expects an image file.
    // Let's draw the raw video frame to a temp canvas to get the full image, 
    // then send that. The backend handles rotation/cropping based on params.

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoLive.videoWidth;
    tempCanvas.height = videoLive.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoLive, 0, 0);

    tempCanvas.toBlob(blob => {
        const formData = new FormData();
        formData.append('file', blob, 'capture.png');
        formData.append('target', 'live');

        fetch('/api/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                // Now analyze
                analyzeImage('live');
            });
    }, 'image/png');
}

// --- Image & Canvas ---

function handleFileUpload(e, targetId) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', targetId);

    fetch('/api/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            loadImage(data.url, targetId);
        })
        .catch(err => console.error(err));
    e.target.value = '';
}

function loadImage(url, targetId) {
    const img = new Image();
    img.onload = () => {
        const t = targets[targetId];
        t.image = img;
        t.cropRect = null;
        t.rotation = 0;
        t.analysisData = null;
        t.selectedPeaks = [];

        renderCanvas(targetId);
        if (targetId === 'single') renderSingleGraphs();
        else if (targetId === 'live') renderLiveGraphs();
        else renderCompGraph();

        updateStatus(targetId);
    };
    img.src = url;
}

function rotateImage(targetId, direction) {
    const t = targets[targetId];
    // For live, image is video element, but rotation logic is same

    if (direction === 'left') {
        t.rotation = (t.rotation - 90 + 360) % 360;
    } else {
        t.rotation = (t.rotation + 90) % 360;
    }

    fetch('/api/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, target: targetId })
    })
        .then(res => res.json())
        .then(data => {
            t.cropRect = null;
            renderCanvas(targetId);
            if (t.analysisData && targetId !== 'live') analyzeImage(targetId);
        });
}

function renderCanvas(targetId) {
    const t = targets[targetId];
    const canvas = t.canvas;
    const ctx = t.ctx;
    const img = t.image;

    if (!img) {
        // If live and camera not running, clear
        if (targetId === 'live' && !isCameraRunning) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // For video, check if ready
    if (img.tagName === 'VIDEO' && img.readyState < 2) return;

    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const isVertical = t.rotation === 90 || t.rotation === 270;
    const imgW = (img.tagName === 'VIDEO') ? (isVertical ? img.videoHeight : img.videoWidth) : (isVertical ? img.height : img.width);
    const imgH = (img.tagName === 'VIDEO') ? (isVertical ? img.videoWidth : img.videoHeight) : (isVertical ? img.width : img.height);

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
    ctx.translate(offsetX + drawW / 2, offsetY + drawH / 2);
    ctx.rotate(t.rotation * Math.PI / 180);

    if (isVertical) {
        ctx.drawImage(img, -drawH / 2, -drawW / 2, drawH, drawW);
    } else {
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();

    if (t.cropRect) {
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            t.cropRect.x / scaleX + offsetX,
            t.cropRect.y / scaleY + offsetY,
            t.cropRect.w / scaleX,
            t.cropRect.h / scaleY
        );
        ctx.fillStyle = 'rgba(0, 242, 255, 0.2)';
        ctx.fillRect(
            t.cropRect.x / scaleX + offsetX,
            t.cropRect.y / scaleY + offsetY,
            t.cropRect.w / scaleX,
            t.cropRect.h / scaleY
        );
    }
}

// --- Cropping ---

function startCrop(e, canvas) {
    const targetId = getActiveTargetId();
    // For live, we allow cropping even if image is video
    if (!targets[targetId].image && targetId !== 'live') return;
    if (targetId === 'live' && !isCameraRunning) return;

    const rect = canvas.getBoundingClientRect();
    cropStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    isDragging = true;
}

function drawCrop(e, canvas) {
    const targetId = getActiveTargetId();
    if (!isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // For live, renderLoop handles clearing, but we need to draw rect on top
    // Actually renderCanvas clears.
    // If live, renderLoop calls renderCanvas constantly.
    // We should update cropRect dynamically or draw temp rect.
    // Let's just draw temp rect here.

    if (targetId !== 'live') renderCanvas(targetId);

    const w = x - cropStart.x;
    const h = y - cropStart.y;

    const ctx = targets[targetId].ctx;
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropStart.x, cropStart.y, w, h);
}

function endCrop(e, canvas) {
    const targetId = getActiveTargetId();
    if (!isDragging) return;
    isDragging = false;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const x1 = Math.min(cropStart.x, x) - offsetX;
    const y1 = Math.min(cropStart.y, y) - offsetY;
    const w = Math.abs(x - cropStart.x);
    const h = Math.abs(y - cropStart.y);

    const t = targets[targetId];
    t.cropRect = {
        x: Math.max(0, Math.round(x1 * scaleX)),
        y: Math.max(0, Math.round(y1 * scaleY)),
        w: Math.round(w * scaleX),
        h: Math.round(h * scaleY)
    };

    if (t.cropRect.w <= 0 || t.cropRect.h <= 0) {
        t.cropRect = null;
    }

    if (targetId !== 'live') renderCanvas(targetId);
}

// --- Analysis ---

function analyzeImage(targetId) {
    const t = targets[targetId];
    // For live, image is video, but we analyze the CAPTURED image which is on server
    // So we just send analyze request.

    const payload = { target: targetId };
    if (t.cropRect) payload.crop = t.cropRect;

    fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            t.analysisData = data;

            if (targetId === 'single') {
                renderSingleGraphs();
                calibrateBtnSingle.disabled = false;
            } else if (targetId === 'live') {
                renderLiveGraphs();
                calibrateBtnLive.disabled = false;
            } else {
                renderCompGraph();
                calibrateBtnComp.disabled = false;
            }
            updateStatus(targetId);
        })
        .catch(err => console.error(err));
}

function renderSingleGraphs() {
    renderGraphSet('single', intensityChartCtx, rgbChartCtx);
}

function renderLiveGraphs() {
    renderGraphSet('live', liveIntensityChartCtx, liveRgbChartCtx);
}

function renderGraphSet(targetId, iCtx, rCtx) {
    const chartKeyI = targetId === 'single' ? 'intensity' : 'live_intensity';
    const chartKeyR = targetId === 'single' ? 'rgb' : 'live_rgb';

    if (charts[chartKeyI]) charts[chartKeyI].destroy();
    if (charts[chartKeyR]) charts[chartKeyR].destroy();

    const data = targets[targetId].analysisData;
    if (!data) return;

    // Intensity
    charts[chartKeyI] = new Chart(iCtx, {
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
                tooltip: { callbacks: { label: (ctx) => `Intensity: ${ctx.raw.toFixed(1)}` } }
            },
            scales: {
                x: { ticks: { color: '#888' }, grid: { color: '#333' } },
                y: { ticks: { color: '#888' }, grid: { color: '#333' } }
            },
            onClick: (e, el, c) => handleGraphClick(e, el, c, targetId)
        }
    });

    // RGB
    charts[chartKeyR] = new Chart(rCtx, {
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
            scales: { x: { display: false }, y: { display: false } }
        }
    });

    updateGraphAnnotations(targetId);
}

function renderCompGraph() {
    if (charts.comp) charts.comp.destroy();

    const dataA = targets['comp_a'].analysisData;
    const dataB = targets['comp_b'].analysisData;

    const datasets = [];

    if (dataA) {
        datasets.push({
            label: 'Image 1',
            data: dataA.total.map((y, i) => ({ x: dataA.x_axis[i], y: y })),
            borderColor: '#00f2ff',
            borderWidth: 2,
            pointRadius: 0,
            showLine: true
        });
    }

    if (dataB) {
        datasets.push({
            label: 'Image 2',
            data: dataB.total.map((y, i) => ({ x: dataB.x_axis[i], y: y })),
            borderColor: '#ff4757',
            borderWidth: 2,
            pointRadius: 0,
            showLine: true
        });
    }

    // Add peak datasets
    ['comp_a', 'comp_b'].forEach(tid => {
        const t = targets[tid];
        if (t.analysisData && t.selectedPeaks.length > 0) {
            const selectedPoints = t.selectedPeaks.map(pixel => {
                const y = t.analysisData.total[pixel];
                const x = t.analysisData.x_axis[pixel];
                return { x, y };
            });

            datasets.push({
                label: `Peaks (${tid === 'comp_a' ? 'Image 1' : 'Image 2'})`,
                data: selectedPoints,
                backgroundColor: tid === 'comp_a' ? '#00f2ff' : '#ff4757',
                borderColor: '#fff',
                pointRadius: 6,
                type: 'scatter'
            });
        }
    });

    charts.comp = new Chart(compChartCtx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y.toFixed(1)}` } }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    ticks: { color: '#888' },
                    grid: { color: '#333' },
                    title: { display: true, text: 'Wavelength (nm) / Pixel', color: '#888' }
                },
                y: { ticks: { color: '#888' }, grid: { color: '#333' } }
            },
            onClick: (e, el, c) => handleGraphClick(e, el, c, activeCompTarget)
        }
    });
}

function startCalibration(targetId) {
    if (!targets[targetId].analysisData) return;
    alert(`Click on TWO peaks in the graph to calibrate.`);
    targets[targetId].selectedPeaks = [];
}

function handleGraphClick(e, elements, chart, targetId) {
    if (activeView === 'compare' && targetId !== activeCompTarget) return;

    const t = targets[targetId];
    if (!t.analysisData || t.selectedPeaks.length >= 2) return;

    const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, true);
    if (points.length) {
        const datasetIndex = points[0].datasetIndex;
        const index = points[0].index;

        let xValue;
        if (chart.config.type === 'scatter') {
            xValue = chart.data.datasets[datasetIndex].data[index].x;
        } else {
            xValue = t.analysisData.x_axis[index];
        }

        const peaksX = t.analysisData.peaks_x;
        const closestPeakX = peaksX.reduce((prev, curr) => {
            return (Math.abs(curr - xValue) < Math.abs(prev - xValue) ? curr : prev);
        });

        if (Math.abs(closestPeakX - xValue) > (t.analysisData.is_calibrated ? 10 : 50)) return;

        const peakIdx = peaksX.indexOf(closestPeakX);
        const pixelPeak = t.analysisData.peaks[peakIdx];

        if (!t.selectedPeaks.includes(pixelPeak)) {
            t.selectedPeaks.push(pixelPeak);
            updateGraphAnnotations(targetId);

            if (t.selectedPeaks.length === 2) {
                showCalibrationModal();
            }
        }
    }
}

function updateGraphAnnotations(targetId) {
    const t = targets[targetId];
    let chart;
    if (targetId === 'single') chart = charts.intensity;
    else if (targetId === 'live') chart = charts.live_intensity;
    else chart = charts.comp;

    if (!chart || !t.analysisData) return;

    const selectedPoints = t.selectedPeaks.map(pixel => {
        const y = t.analysisData.total[pixel];
        const x = t.analysisData.x_axis[pixel];
        return (chart.config.type === 'scatter') ? { x, y } : y;
    });

    const dataset = {
        label: `Peaks`,
        data: (chart.config.type === 'scatter') ? selectedPoints :
            t.analysisData.total.map((val, idx) => t.selectedPeaks.includes(idx) ? val : null),
        borderColor: '#fff',
        pointRadius: 6,
        type: 'scatter'
    };

    if (targetId === 'comp_a' || targetId === 'comp_b') {
        if (activeView === 'compare') renderCompGraph();
        return;
    }

    if (chart.data.datasets.length > 1) {
        chart.data.datasets[1] = dataset;
    } else {
        chart.data.datasets.push(dataset);
    }

    chart.update();
}

function showCalibrationModal() {
    const targetId = getActiveTargetId();
    const t = targets[targetId];
    document.getElementById('p1-pixel').textContent = t.selectedPeaks[0];
    document.getElementById('p2-pixel').textContent = t.selectedPeaks[1];
    document.getElementById('calibration-modal').classList.remove('hidden');
}

function submitCalibration() {
    const w1 = parseFloat(document.getElementById('p1-wavelength').value);
    const w2 = parseFloat(document.getElementById('p2-wavelength').value);

    if (!w1 || !w2) return;

    const targetId = getActiveTargetId();
    const t = targets[targetId];

    fetch('/api/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target: targetId,
            p1: t.selectedPeaks[0], w1: w1,
            p2: t.selectedPeaks[1], w2: w2
        })
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById('calibration-modal').classList.add('hidden');
            t.selectedPeaks = [];
            analyzeImage(targetId);
        });
}

function updateStatus(targetId) {
    const t = targets[targetId];
    const status = t.analysisData ? (t.analysisData.is_calibrated ? "Calibrated" : "Uncalibrated") : "No Data";

    if (targetId === 'single') {
        document.querySelector('#single-view .status-text').textContent = status;
    } else if (targetId === 'live') {
        document.querySelector('#live-status .status-text').textContent = status;
    } else {
        document.querySelector(`#status-${targetId} .val`).textContent = status;
    }
}

function resetTarget(targetId) {
    const t = targets[targetId];
    t.image = null;
    t.cropRect = null;
    t.rotation = 0;
    t.analysisData = null;
    t.selectedPeaks = [];

    renderCanvas(targetId);
    if (targetId === 'single') {
        renderSingleGraphs();
        updateStatus('single');
        fileInputSingle.value = '';
    } else if (targetId === 'live') {
        renderLiveGraphs();
        updateStatus('live');
        // Don't stop camera on reset, just clear data
    } else {
        renderCompGraph();
        updateStatus(targetId);
        fileInputComp.value = '';
    }
}
