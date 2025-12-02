/**
 * ============================================================================
 * SPECTROMETER WORKFLOW CONTROLLER
 * ============================================================================
 * Main JavaScript controller managing the entire 5-step spectrum analysis workflow.
 * Handles UI interactions, image manipulation, calibration, and result export.
 */

class SpectrometerWorkflow {
    /**
     * Constructor - Initialize workflow state variables
     */
    constructor() {
        this.currentStep = 1;
        this.maxSteps = 5;
        this.isVideoActive = true;
        this.currentRotation = 0;
        this.loadedImage = null;
        this.croppedImage = null;
        this.cropBbox = null;
        this.calibrationPoints = [];
        this.analysisResults = null;
        this.init();
    }

    /**
     * init() - Initialize workflow
     */
    init() {
        this.setupEventListeners();
        this.goToStep(1);
    }

    /**
     * ========================================================================
     * EVENT LISTENER SETUP - Binds all UI controls to handler functions
     * ========================================================================
     */
    setupEventListeners() {
        // === STEP 1: LOAD IMAGE/CAMERA ===
        const videoFeed = document.getElementById('video-feed');
        const imageCanvas = document.getElementById('image-canvas');
        const viewport = document.getElementById('viewport');
        const toggleCamBtn = document.getElementById('toggle-cam-btn');
        const fileUpload = document.getElementById('file-upload');
        const rotationSlider = document.getElementById('rotation-slider');
        const rotationDisplay = document.getElementById('rotation-display');
        const rotationIndicator = document.getElementById('rotation-indicator');
        const rotateLeftBtn = document.getElementById('rotate-left-btn');
        const rotateRightBtn = document.getElementById('rotate-right-btn');
        const quickAngleBtns = document.querySelectorAll('.btn-quick-angle');
        const nextStepBtn = document.getElementById('next-step-btn');

        // Camera Toggle - Switch between live video and uploaded image
        if (toggleCamBtn) {
            toggleCamBtn.addEventListener('click', () => {
                this.isVideoActive = !this.isVideoActive;
                if (this.isVideoActive) {
                    videoFeed.style.display = 'block';
                    imageCanvas.style.display = 'none';
                    toggleCamBtn.classList.add('active');
                    videoFeed.src = "/video_feed";
                } else {
                    this.captureVideoFrame(videoFeed, imageCanvas);
                    videoFeed.style.display = 'none';
                    imageCanvas.style.display = 'block';
                    toggleCamBtn.classList.remove('active');
                    videoFeed.src = "";
                }
            });
        }

        // File Upload - Load image from user's computer
        if (fileUpload) {
            fileUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            this.loadedImage = img;
                            this.isVideoActive = false;
                            if (toggleCamBtn) toggleCamBtn.classList.remove('active');
                            videoFeed.style.display = 'none';
                            imageCanvas.style.display = 'block';
                            videoFeed.src = "";
                            this.drawImageToCanvas(img, imageCanvas);
                            this.updateRotationDisplay(0, viewport, rotationSlider, rotationDisplay, rotationIndicator, quickAngleBtns);
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Rotation Slider - Change angle 0-360 degrees
        if (rotationSlider) {
            rotationSlider.addEventListener('input', (e) => {
                this.updateRotationDisplay(e.target.value, viewport, rotationSlider, rotationDisplay, rotationIndicator, quickAngleBtns);
            });
        }

        // Rotate Left Button - Decrease by 10 degrees
        if (rotateLeftBtn) {
            rotateLeftBtn.addEventListener('click', () => {
                this.updateRotationDisplay(this.currentRotation - 10, viewport, rotationSlider, rotationDisplay, rotationIndicator, quickAngleBtns);
            });
        }

        // Rotate Right Button - Increase by 10 degrees
        if (rotateRightBtn) {
            rotateRightBtn.addEventListener('click', () => {
                this.updateRotationDisplay(this.currentRotation + 10, viewport, rotationSlider, rotationDisplay, rotationIndicator, quickAngleBtns);
            });
        }

        // Quick Angle Buttons - Jump to 0, 90, 180, 270 degrees
        quickAngleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const angle = btn.dataset.angle;
                const value = angle === 'reset' ? 0 : angle;
                this.updateRotationDisplay(value, viewport, rotationSlider, rotationDisplay, rotationIndicator, quickAngleBtns);
            });
        });

        // Next Step Button - Go to Crop Step
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => this.goToStep(2));
        }

        // === STEP 2: CROP IMAGE ===
        const autoCropBtn = document.getElementById('auto-crop-btn');
        const prevCropBtn = document.getElementById('prev-crop-btn');
        const nextCropBtn = document.getElementById('next-crop-btn');

        if (autoCropBtn) autoCropBtn.addEventListener('click', () => this.autoCrop());
        if (prevCropBtn) prevCropBtn.addEventListener('click', () => this.goToStep(1));
        if (nextCropBtn) nextCropBtn.addEventListener('click', () => this.goToStep(3));

        // === STEP 3: 2D TO 1D PROFILE ===
        const prevProfileBtn = document.getElementById('prev-profile-btn');
        const nextProfileBtn = document.getElementById('next-profile-btn');

        if (prevProfileBtn) prevProfileBtn.addEventListener('click', () => this.goToStep(2));
        if (nextProfileBtn) nextProfileBtn.addEventListener('click', () => this.goToStep(4));

        // === STEP 4: CALIBRATION ===
        const presetBtns = document.querySelectorAll('.btn-preset');
        const addCalibBtn = document.getElementById('add-calib-btn');
        const prevCalibBtn = document.getElementById('prev-calib-btn');
        const nextCalibBtn = document.getElementById('next-calib-btn');

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const wavelength = btn.dataset.wavelength;
                this.addCalibrationPoint(wavelength);
            });
        });

        if (addCalibBtn) addCalibBtn.addEventListener('click', () => this.addCalibrationPoint());
        if (prevCalibBtn) prevCalibBtn.addEventListener('click', () => this.goToStep(3));
        if (nextCalibBtn) nextCalibBtn.addEventListener('click', () => this.goToStep(5));

        // === STEP 5: ANALYSIS RESULTS ===
        const analyzeBtn = document.getElementById('analyze-btn');
        const resetAllBtn = document.getElementById('reset-all-btn');
        const prevAnalysisBtn = document.getElementById('prev-analysis-btn');
        const exportJsonBtn = document.getElementById('export-json-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');

        if (analyzeBtn) analyzeBtn.addEventListener('click', () => this.runAnalysis());
        if (resetAllBtn) resetAllBtn.addEventListener('click', () => this.resetWorkflow());
        if (prevAnalysisBtn) prevAnalysisBtn.addEventListener('click', () => this.goToStep(4));
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => this.exportResults('json'));
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => this.exportResults('csv'));

        // Make workflow step indicators clickable
        document.querySelectorAll('.step').forEach((step, idx) => {
            step.addEventListener('click', () => this.goToStep(idx + 1));
        });
    }

    /**
     * ========================================================================
     * STEP 1: IMAGE LOADING & ROTATION
     * ========================================================================
     */

    /**
     * updateRotationDisplay() - Update all rotation UI when angle changes
     */
    updateRotationDisplay(angle, viewport, rotationSlider, rotationDisplay, rotationIndicator, quickAngleBtns) {
        // Normalize angle to 0-360 using modulo
        this.currentRotation = parseInt(angle) % 360;
        // Update slider to match angle
        if (rotationSlider) rotationSlider.value = this.currentRotation;
        // Update text displays
        if (rotationDisplay) rotationDisplay.textContent = `${this.currentRotation}°`;
        if (rotationIndicator) rotationIndicator.textContent = `${this.currentRotation}°`;
        // Apply CSS rotation transform to viewport
        if (viewport) viewport.style.transform = `rotate(${this.currentRotation}deg)`;
        
        // Highlight matching quick angle button
        if (quickAngleBtns) {
            quickAngleBtns.forEach(btn => {
                const btnAngle = btn.dataset.angle;
                if (btnAngle !== 'reset' && parseInt(btnAngle) === this.currentRotation) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    /**
     * drawImageToCanvas() - Draw Image element to canvas with scaling
     */
    drawImageToCanvas(img, canvas) {
        // Get canvas container dimensions
        const rect = canvas.parentElement.getBoundingClientRect();
        // Calculate scale to fit without stretching
        const scale = Math.min(rect.width / img.width, rect.height / img.height, 1);
        
        // Set canvas to image dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        // Draw image at full size
        ctx.drawImage(img, 0, 0);
    }

    /**
     * captureVideoFrame() - Capture current video frame to canvas
     */
    captureVideoFrame(videoFeed, imageCanvas) {
        // Get video dimensions
        const width = videoFeed.naturalWidth || 640;
        const height = videoFeed.naturalHeight || 480;
        
        // Set canvas to match video
        imageCanvas.width = width;
        imageCanvas.height = height;
        const ctx = imageCanvas.getContext('2d');
        
        // Draw current video frame
        try {
            ctx.drawImage(videoFeed, 0, 0, width, height);
        } catch (e) {
            console.warn('Could not capture frame:', e);
        }
    }

    /**
     * ========================================================================
     * WORKFLOW NAVIGATION
     * ========================================================================
     */

    /**
     * goToStep() - Navigate to specific workflow step (1-5)
     */
    goToStep(stepNumber) {
        // Validate step number
        if (stepNumber < 1 || stepNumber > this.maxSteps) return;
        
        // Hide all step panels
        for (let i = 1; i <= this.maxSteps; i++) {
            const panel = document.getElementById(`step-${i}-panel`);
            if (panel) panel.classList.add('hidden');
        }
        
        // Show target step panel
        const currentPanel = document.getElementById(`step-${stepNumber}-panel`);
        if (currentPanel) currentPanel.classList.remove('hidden');
        
        // Update workflow indicator highlights
        document.querySelectorAll('.step').forEach((step, idx) => {
            if (idx + 1 === stepNumber) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        
        // Update internal state
        this.currentStep = stepNumber;
        
        // Execute step-specific initialization
        if (stepNumber === 2) {
            this.setupCropCanvas();
        } else if (stepNumber === 3) {
            this.generateProfilePlot();
        } else if (stepNumber === 4) {
            this.refreshCalibrationUI();
        }
        
        // Scroll panel into view smoothly
        setTimeout(() => {
            currentPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    /**
     * ========================================================================
     * STEP 2: CROP IMAGE
     * ========================================================================
     */

    /**
     * setupCropCanvas() - Initialize crop canvas and selection overlay
     */
    setupCropCanvas() {
        const cropCanvas = document.getElementById('crop-canvas');
        const imageCanvas = document.getElementById('image-canvas');
        const videoFeed = document.getElementById('video-feed');
        
        if (!cropCanvas) return;
        
        // Get source image/video
        const source = this.isVideoActive ? videoFeed : imageCanvas;
        const w = source.naturalWidth || source.width || 640;
        const h = source.naturalHeight || source.height || 480;
        
        // Set crop canvas dimensions
        cropCanvas.width = w;
        cropCanvas.height = h;
        const ctx = cropCanvas.getContext('2d');
        
        // Draw source to crop canvas
        try {
            ctx.drawImage(source, 0, 0, w, h);
        } catch (e) {
            console.warn('Could not draw to crop canvas:', e);
        }
        
        // Setup crop selection handlers
        this.setupCropSelection(cropCanvas);
    }

    /**
     * setupCropSelection() - Setup mouse events for crop selection overlay
     */
    setupCropSelection(canvas) {
        let isDrawing = false;
        let startX, startY;
        const overlay = document.getElementById('crop-selection-overlay');
        
        // Mouse down: Start crop selection
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        });
        
        // Mouse move: Update overlay and values during drag
        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            // Calculate crop rectangle
            const x = Math.min(startX, currentX);
            const y = Math.min(startY, currentY);
            const w = Math.abs(currentX - startX);
            const h = Math.abs(currentY - startY);
            
            // Update visual overlay - cyan glowing rectangle
            if (overlay) {
                overlay.style.left = x + 'px';
                overlay.style.top = y + 'px';
                overlay.style.width = w + 'px';
                overlay.style.height = h + 'px';
                overlay.style.display = w > 0 && h > 0 ? 'block' : 'none';
            }
            
            // Update crop coordinate inputs
            this.updateCropValues(x, y, w, h);
        });
        
        // Mouse up: End crop selection
        canvas.addEventListener('mouseup', () => {
            isDrawing = false;
        });
    }

    /**
     * updateCropValues() - Update crop input fields and internal state
     */
    updateCropValues(x, y, w, h) {
        const cropX = document.getElementById('crop-x');
        const cropY = document.getElementById('crop-y');
        const cropW = document.getElementById('crop-w');
        const cropH = document.getElementById('crop-h');
        
        // Update input fields (rounded to integers)
        if (cropX) cropX.value = Math.round(x);
        if (cropY) cropY.value = Math.round(y);
        if (cropW) cropW.value = Math.round(w);
        if (cropH) cropH.value = Math.round(h);
        
        // Store in internal state
        this.cropBbox = { x, y, w, h, width: w, height: h };
    }

    /**
     * autoCrop() - Use backend CV to auto-detect rainbow band
     */
    autoCrop() {
        const imageCanvas = document.getElementById('image-canvas');
        const videoFeed = document.getElementById('video-feed');
        
        const source = this.isVideoActive ? videoFeed : imageCanvas;
        const imageData = this.getRotatedImageData(source);
        
        // Send to backend for auto-crop detection
        fetch('/auto_crop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                const bbox = data.bbox;
                this.updateCropValues(bbox.x, bbox.y, bbox.w, bbox.h);
                alert('Auto-crop successful! ' + data.message);
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(err => alert('Error: ' + err));
    }

    /**
     * ========================================================================
     * STEP 3: 2D TO 1D INTENSITY PROFILE
     * ========================================================================
     */

    /**
     * generateProfilePlot() - Convert 2D image to 1D intensity profile
     */
    generateProfilePlot() {
        const imageCanvas = document.getElementById('image-canvas');
        const videoFeed = document.getElementById('video-feed');
        
        const source = this.isVideoActive ? videoFeed : imageCanvas;
        const imageData = this.getRotatedImageData(source);
        
        const cropData = this.cropBbox || { x: 0, y: 0, width: source.width, height: source.height };
        
        // Send to backend for analysis
        fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageData,
                crop: cropData
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                this.analysisResults = data;
                
                // Display profile plot
                const profilePlot = document.getElementById('profile-plot');
                if (profilePlot && data.profile_plot) {
                    profilePlot.src = `data:image/png;base64,${data.profile_plot}`;
                    profilePlot.style.display = 'block';
                    const placeholder = document.querySelector('#step-3-panel .placeholder');
                    if (placeholder) placeholder.style.display = 'none';
                }
            }
        })
        .catch(err => console.error('Error:', err));
    }

    /**
     * ========================================================================
     * STEP 4: WAVELENGTH CALIBRATION
     * ========================================================================
     */

    /**
     * addCalibrationPoint() - Add wavelength calibration point
     */
    addCalibrationPoint(wavelength) {
        const pixel = prompt('Enter the pixel position for this spectral line:', '');
        if (pixel === null) return;
        
        const w = wavelength || prompt('Enter wavelength in nm:', '');
        if (!w) return;
        
        this.calibrationPoints.push({
            pixel: parseInt(pixel),
            wavelength: parseFloat(w)
        });
        
        this.refreshCalibrationUI();
    }

    /**
     * refreshCalibrationUI() - Update calibration panel display
     */
    refreshCalibrationUI() {
        const list = document.getElementById('calibration-list');
        const status = document.getElementById('calibration-status');
        
        if (!list) return;
        
        list.innerHTML = '';
        
        // Display each calibration point
        this.calibrationPoints.forEach((point, idx) => {
            const div = document.createElement('div');
            div.className = 'calib-point';
            div.innerHTML = `
                <div class="calib-point-info">Pixel ${point.pixel} → ${point.wavelength}nm</div>
                <button class="btn-remove-calib" onclick="window.workflow.removeCalibPoint(${idx})">Remove</button>
            `;
            list.appendChild(div);
        });
        
        // If 2+ points, run calibration
        if (this.calibrationPoints.length >= 2) {
            if (status) status.classList.remove('hidden');
            this.calibrateWavelengths();
        } else {
            if (status) status.classList.add('hidden');
        }
    }

    /**
     * removeCalibPoint() - Remove calibration point at index
     */
    removeCalibPoint(idx) {
        this.calibrationPoints.splice(idx, 1);
        this.refreshCalibrationUI();
    }

    /**
     * calibrateWavelengths() - Send calibration to backend
     */
    calibrateWavelengths() {
        if (this.calibrationPoints.length < 2) return;

        const points = this.calibrationPoints;
        // Get spectrum orientation from dropdown
        const orientationSelect = document.getElementById('spectrum-orientation');
        const orientation = orientationSelect ? orientationSelect.value : 'horizontal';

        // Send calibration points and orientation to backend for linear regression
        fetch('/calibrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points, orientation })
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('Calibration successful:', data);
            }
        });
    }

    /**
     * ========================================================================
     * STEP 5: RUN FULL ANALYSIS
     * ========================================================================
     */

    /**
     * runAnalysis() - Execute full spectrum analysis pipeline
     */
    runAnalysis() {
        const imageCanvas = document.getElementById('image-canvas');
        const videoFeed = document.getElementById('video-feed');
        const analyzeBtn = document.getElementById('analyze-btn');
        
        // Disable button while processing
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Analyzing...';
        }
        
        const source = this.isVideoActive ? videoFeed : imageCanvas;
        const imageData = this.getRotatedImageData(source);
        const cropData = this.cropBbox || { x: 0, y: 0, width: source.width, height: source.height };
        
        // Send to backend for full analysis
        fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData, crop: cropData })
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                this.analysisResults = data;
                this.displayResults(data);
            } else {
                alert('Analysis failed: ' + data.message);
            }
        })
        .catch(err => alert('Error: ' + err))
        .finally(() => {
            // Re-enable button
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = 'Analyze Spectrum';
            }
        });
    }

    /**
     * displayResults() - Display analysis results: plots and spectral lines
     */
    displayResults(data) {
        // Display intensity profile plot
        if (data.profile_plot) {
            const img = document.getElementById('profile-result-plot');
            if (img) {
                img.src = `data:image/png;base64,${data.profile_plot}`;
                img.style.display = 'block';
                const placeholder = img.parentElement?.querySelector('.placeholder');
                if (placeholder) placeholder.style.display = 'none';
            }
        }
        
        // Display spectrum plot (if calibrated)
        if (data.spectrum_plot) {
            const img = document.getElementById('spectrum-result-plot');
            if (img) {
                img.src = `data:image/png;base64,${data.spectrum_plot}`;
                img.style.display = 'block';
                const placeholder = img.parentElement?.querySelector('.placeholder');
                if (placeholder) placeholder.style.display = 'none';
            }
        }
        
        // Display spectral lines detected
        const linesList = document.getElementById('spectral-lines-list');
        if (!linesList) return;
        
        linesList.innerHTML = '';
        
        if (data.spectral_lines && data.spectral_lines.lines) {
            data.spectral_lines.lines.forEach(line => {
                const div = document.createElement('div');
                div.className = 'spectral-line';
                div.innerHTML = `
                    <div class="spectral-line-wavelength">${line.wavelength.toFixed(1)} nm</div>
                    <div class="spectral-line-color">${line.color_name}</div>
                    <div class="spectral-line-intensity">Intensity: ${(line.intensity_norm * 100).toFixed(1)}%</div>
                `;
                linesList.appendChild(div);
            });
        } else {
            linesList.innerHTML = '<div class="placeholder">No spectral lines detected</div>';
        }
    }

    /**
     * ========================================================================
     * UTILITY FUNCTIONS
     * ========================================================================
     */

    /**
     * getRotatedImageData() - Get image as base64 PNG with rotation applied
     */
    getRotatedImageData(source) {
        const offCanvas = document.createElement('canvas');
        const ctx = offCanvas.getContext('2d');
        
        const w = source.naturalWidth || source.width || 640;
        const h = source.naturalHeight || source.height || 480;
        
        // Convert rotation angle to radians
        const rad = this.currentRotation * Math.PI / 180;
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        
        // Calculate rotated bounding box dimensions
        offCanvas.width = Math.ceil(w * absCos + h * absSin);
        offCanvas.height = Math.ceil(w * absSin + h * absCos);
        
        // Translate to center, rotate, and draw image
        ctx.translate(offCanvas.width / 2, offCanvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(source, -w / 2, -h / 2, w, h);
        
        // Return as base64 PNG
        return offCanvas.toDataURL('image/jpeg', 0.95);
    }

    /**
     * resetWorkflow() - Reset entire workflow to initial state
     */
    resetWorkflow() {
        if (confirm('Reset the entire workflow?')) {
            // Clear all state
            this.currentStep = 1;
            this.loadedImage = null;
            this.cropBbox = null;
            this.calibrationPoints = [];
            this.analysisResults = null;
            this.currentRotation = 0;
            
            fetch('/reset_calibration', { method: 'POST' });
            
            // Reset rotation UI
            const rotationSlider = document.getElementById('rotation-slider');
            const rotationDisplay = document.getElementById('rotation-display');
            const rotationIndicator = document.getElementById('rotation-indicator');
            const viewport = document.getElementById('viewport');
            
            if (rotationSlider) rotationSlider.value = 0;
            if (rotationDisplay) rotationDisplay.textContent = '0°';
            if (rotationIndicator) rotationIndicator.textContent = '0°';
            if (viewport) viewport.style.transform = 'rotate(0deg)';
            
            // Clear calibration UI
            const calibList = document.getElementById('calibration-list');
            const calibStatus = document.getElementById('calibration-status');
            if (calibList) calibList.innerHTML = '';
            if (calibStatus) calibStatus.classList.add('hidden');
            
            this.goToStep(1);
        }
    }

    /**
     * exportResults(format) - Export analysis results as JSON or CSV
     */
    exportResults(format) {
        if (!this.analysisResults) {
            alert('No results to export yet');
            return;
        }
        
        if (format === 'json') {
            // === JSON EXPORT ===
            const data = {
                timestamp: new Date().toISOString(),
                calibrated: this.analysisResults.calibrated,
                peaks_found: this.analysisResults.peaks_found,
                calibration_points: this.calibrationPoints,
                spectral_lines: this.analysisResults.spectral_lines
            };
            
            // Convert to formatted JSON string
            const json = JSON.stringify(data, null, 2);
            // Create blob and download
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spectrum_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
        } else if (format === 'csv') {
            // === CSV EXPORT ===
            // CSV header row: wavelength, color, intensity, pixel
            let csv = 'Wavelength (nm),Color,Intensity (%),Pixel Position\n';
            
            // Add each spectral line as CSV row
            if (this.analysisResults.spectral_lines && this.analysisResults.spectral_lines.lines) {
                this.analysisResults.spectral_lines.lines.forEach(line => {
                    const wavelength = line.wavelength.toFixed(2);
                    const color = line.color_name;
                    const intensity = (line.intensity_norm * 100).toFixed(2);
                    const pixel = line.pixel || 'N/A';
                    csv += `${wavelength},${color},${intensity},${pixel}\n`;
                });
            }
            
            // Add summary section
            csv += '\n\nSummary\n';
            csv += `Timestamp,${new Date().toISOString()}\n`;
            csv += `Peaks Found,${this.analysisResults.peaks_found}\n`;
            csv += `Calibrated,${this.analysisResults.calibrated ? 'Yes' : 'No'}\n`;
            
            // Add calibration points section
            if (this.calibrationPoints.length > 0) {
                csv += '\n\nCalibration Points\n';
                csv += 'Pixel,Wavelength (nm)\n';
                this.calibrationPoints.forEach(point => {
                    csv += `${point.pixel},${point.wavelength}\n`;
                });
            }
            
            // Create blob and download
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spectrum_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
}

/**
 * Initialize workflow when page loads
 */
window.addEventListener('DOMContentLoaded', () => {
    window.workflow = new SpectrometerWorkflow();
});
