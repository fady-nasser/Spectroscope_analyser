# 🌈 Spectrometer Pro

A professional web-based optical spectrometer analyzer for processing and analyzing spectral images. Extract wavelength data from rainbow spectra, detect emission/absorption lines, and perform multi-spectrum comparisons.

![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/flask-2.0+-green.svg)
![OpenCV](https://img.shields.io/badge/opencv-4.0+-red.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

### Core Functionality
- **📷 Image Analysis**: Upload and analyze spectral images (rainbows, emission spectra, etc.)
- **🎯 Smart Cropping**: Interactive crop tool to isolate spectral regions
- **🔄 Image Rotation**: 90° rotation controls for proper spectrum orientation
- **📊 Intensity Profiling**: Convert 2D spectrum to 1D intensity profiles
- **🔍 Peak Detection**: Automatic detection of spectral lines with adjustable sensitivity
- **📏 Wavelength Calibration**: Two-point calibration system for accurate wavelength mapping

### Advanced Features
- **⚖️ Comparison Mode**: Side-by-side analysis of two spectra (A vs B)
- **📸 Live Camera Support**: Real-time spectrum analysis from webcam/USB camera
- **🎨 Color Mapping**: Automatic color identification (Violet, Blue, Green, Yellow, Orange, Red)
- **📈 Interactive Charts**: Dual visualization - intensity profile & wavelength spectrum
- **💾 Data Export**: Export results as CSV or JSON with complete peak metadata

### Analysis Modes

#### 1. Single Analysis
Process individual spectrum images with full analysis pipeline

#### 2. Comparison Mode
- Load two spectra (A and B)
- Independent calibration for each spectrum
- Side-by-side intensity comparison
- Differential analysis

#### 3. Live Camera (Experimental)
- Real-time spectrum capture
- On-the-fly analysis
- Webcam/USB camera support

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Modern web browser (Chrome, Firefox, Edge)

### Installation

1. **Clone the repository**
```powershell
git clone https://github.com/fady-nasser/Spectroscope_analyser.git
cd Spectroscope_analyser
```

2. **Create virtual environment (recommended)**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. **Install dependencies**
```powershell
pip install -r requirements.txt
```

### Running the Application

**Web Interface (Recommended)**
```powershell
python app.py
```
Then open your browser to: `http://localhost:5000`

**Desktop GUI (Alternative)**
```powershell
python src/main.py
```

## 📖 User Guide

### Basic Workflow

#### Step 1: Load Image
- Click **"Load"** button or drag & drop an image
- Supported formats: JPG, PNG, BMP
- Maximum file size: 16MB

#### Step 2: Crop Spectrum
- Click and drag on the image to select the rainbow band
- Adjust crop region to isolate the spectrum
- Use rotation buttons (↺ ↻) if needed

#### Step 3: Analyze
- Click **"ANALYZE SPECTRUM"** button
- View intensity profile in Plot 1
- Detected peaks shown as markers

#### Step 4: Calibrate Wavelengths
1. Select first peak from dropdown
2. Enter known wavelength (e.g., 656nm for H-alpha)
3. Select second peak (at different position)
4. Enter its wavelength (e.g., 486nm for H-beta)
5. Click **"Calibrate"**

#### Step 5: View Results
- **Plot 1**: Intensity vs. Pixel position (uncalibrated)
- **Plot 2**: Intensity vs. Wavelength (calibrated)
- Peak table shows:
  - Position (pixels)
  - Wavelength (nm)
  - Intensity
  - Color name
  - Relative intensity (%)

#### Step 6: Export Data
- **CSV**: Spreadsheet-compatible format
- **JSON**: Machine-readable structured data

### Calibration Tips

For accurate wavelength mapping:
- Use at least two peaks with **known wavelengths**
- Space peaks far apart (>100 pixels) for better accuracy
- Common reference lines:
  - **Hydrogen**: 656nm (red), 486nm (cyan), 434nm (violet), 410nm (violet)
  - **Helium**: 588nm (yellow), 501nm (green), 447nm (blue)
  - **Neon**: 640nm (red), 585nm (yellow), 540nm (green)
  - **Mercury**: 578nm (yellow), 546nm (green), 436nm (blue), 405nm (violet)

### Comparison Mode

1. Click **"Comparison Mode"** tab
2. Load spectrum A (left panel)
3. Load spectrum B (right panel)
4. Analyze each independently
5. Calibrate both (can use different calibrations)
6. View overlaid comparison in bottom charts

## 🏗️ Project Structure

```
Spectroscope_analyser/
├── app.py                  # Flask web application (main entry point)
├── requirements.txt        # Python dependencies
├── README.md              # This file
├── FIXES_APPLIED.md       # Technical changelog
│
├── src/
│   ├── main.py            # Desktop GUI entry point
│   ├── gui.py             # Tkinter desktop interface
│   └── core.py            # Core algorithms (image processing, peak detection)
│
├── templates/
│   └── index.html         # Web UI template
│
├── static/
│   ├── style.css          # Web interface styling
│   ├── script.js          # UI interaction logic
│   ├── workflow.js        # Analysis workflow controller
│   └── uploads/           # Temporary image storage
│
└── tests/
    ├── test_core.py       # Unit tests for core algorithms
    └── test_api.py        # API endpoint tests
```

## 🔬 Technical Details

### Core Algorithms

#### 1. Image Processing
- **Loading**: OpenCV BGR → RGB conversion
- **Cropping**: NumPy array slicing
- **Rotation**: 90° increments using `np.rot90()`

#### 2. Intensity Profiling
```python
# Convert 2D spectrum image to 1D intensity array
intensity = np.mean(cropped_image, axis=0)  # Average along Y-axis
```

#### 3. Peak Detection
- Uses `scipy.signal.find_peaks()` with adaptive parameters
- **Prominence**: Minimum peak height above surroundings
- **Distance**: Minimum separation between peaks (pixels)
- **Width**: Peak width constraints
- Gaussian smoothing for noise reduction

#### 4. Wavelength Calibration
Linear mapping using two known points:
```
wavelength = slope × pixel + intercept

slope = (λ₂ - λ₁) / (p₂ - p₁)
intercept = λ₁ - slope × p₁
```

Validation: Ensures all wavelengths fall within 300-1000 nm range

#### 5. Color Identification
Wavelength-to-color mapping (visible spectrum):
- **380-450 nm**: Violet
- **450-495 nm**: Blue
- **495-570 nm**: Green
- **570-590 nm**: Yellow
- **590-620 nm**: Orange
- **620-750 nm**: Red
- **< 380 nm or > 750 nm**: Out of Range

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve web interface |
| `/api/upload` | POST | Upload spectrum image |
| `/api/rotate` | POST | Rotate image 90° |
| `/api/analyze` | POST | Analyze spectrum, detect peaks |
| `/api/calibrate` | POST | Apply wavelength calibration |
| `/api/export/csv` | GET | Download CSV data |
| `/api/export/json` | GET | Download JSON data |
| `/api/camera/start` | POST | Start live camera feed |
| `/api/camera/frame` | GET | Get current camera frame |
| `/api/camera/stop` | POST | Stop camera feed |

### Dependencies

- **Flask**: Web framework
- **OpenCV (cv2)**: Image processing
- **NumPy**: Numerical computing
- **SciPy**: Signal processing (peak detection)
- **Matplotlib**: Plotting (desktop GUI only)
- **Pillow**: Image format support

## 🧪 Testing

Run unit tests:
```powershell
# Test core algorithms
python -m pytest tests/test_core.py -v

# Test API endpoints
python -m pytest tests/test_api.py -v

# Run all tests
python -m pytest tests/ -v
```

## 🐛 Troubleshooting

### Issue: Negative wavelengths appearing
**Solution**: Ensure calibration uses two peaks with correct wavelength values. The system now validates calibration to prevent out-of-range wavelengths.

### Issue: No peaks detected
**Solution**: 
- Adjust prominence slider (lower for weak peaks)
- Ensure crop region contains only the spectrum
- Check image brightness/contrast

### Issue: Camera not working
**Solution**:
- Grant camera permissions to browser
- Check if camera is already in use
- Try different camera index (0, 1, 2...)

### Issue: Plots not showing
**Solution**:
- Check browser console for JavaScript errors
- Ensure Chart.js loaded correctly
- Clear browser cache

## 📊 Example Use Cases

1. **Educational Spectroscopy**: Identify emission lines from gas discharge tubes
2. **Astronomy**: Analyze stellar spectra for element composition
3. **Chemistry**: Identify elements in flame tests
4. **Physics Labs**: Calibrate spectrometers, measure spectral resolution
5. **Quality Control**: Verify LED/light source emission profiles

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Fady Nasser**
- GitHub: [@fady-nasser](https://github.com/fady-nasser)

## 🙏 Acknowledgments

- OpenCV community for image processing tools
- SciPy developers for signal processing algorithms
- Flask framework for web development
- Chart.js for interactive visualizations

## 📚 References

- [Spectroscopy Basics](https://en.wikipedia.org/wiki/Spectroscopy)
- [Emission Spectrum](https://en.wikipedia.org/wiki/Emission_spectrum)
- [Wavelength Calibration](https://en.wikipedia.org/wiki/Wavelength_calibration)
- [Peak Detection Algorithms](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html)

## 🔮 Future Enhancements

- [ ] Machine learning for automatic element identification
- [ ] 3D waterfall plots for time-series spectra
- [ ] Database storage for spectrum library
- [ ] Mobile-responsive touch controls
- [ ] Advanced filters (Savitzky-Golay, Fourier)
- [ ] Absorbance mode (for absorption spectroscopy)
- [ ] Multi-peak fitting (Gaussian/Lorentzian)
- [ ] Raman spectroscopy support

---

**Made with ❤️ for the spectroscopy community**
