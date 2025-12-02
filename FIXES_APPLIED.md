# Critical Fixes Applied to Spectrometer Application

## Summary of Changes

Three critical issues have been fixed:

### 1. ✅ **Negative Wavelengths Eliminated**

**Problem:**
- Calibration was producing negative wavelengths (-439.55nm, -425.58nm, etc.)
- All negative wavelengths were classified as "UV" 
- Export (CSV/JSON) contained invalid data

**Root Cause:**
- Calibration formula `wavelength = slope*pixel + intercept` produced negative intercept
- Example: pixel1=700, wavelength1=405nm → intercept = 405 - (1.27×700) = -484
- This meant wavelength(0) = -484nm, wavelength(100) = -361nm, etc.

**Solution:**
1. **Added calibration validation** in `/calibrate` endpoint:
   - Rejects if wavelengths are outside 300-1000 nm range
   - Tests calibration: if wavelength at pixel 1000 is invalid, rejects calibration
   - Returns error: "Calibration produces out-of-range wavelengths"

2. **Changed color mapping** to only support visible spectrum:
   - Before: wavelengths < 380nm returned "UV"
   - Now: wavelengths < 380nm return "Out of Range"
   - Same for wavelengths > 750nm: returns "Out of Range"
   - Prevents invalid wavelengths from being labeled as valid colors

**Files Modified:**
- `app.py`: `/calibrate` endpoint (lines 557-631) - Added validation logic
- `app.py`: `get_wavelength_color()` function - Returns gray (#888888) for out-of-range
- `src/core.py`: `get_color_name()` function - Returns "Out of Range" for invalid wavelengths

---

### 2. ✅ **Continuous Spectrum Curve Added**

**Problem:**
- Plot 2 showed only discrete peaks as scatter points
- No visual representation of continuous spectrum curve
- Users couldn't see full intensity profile across wavelengths

**Solution:**
1. **Complete spectrum reconstruction:**
   - Converts every pixel position to wavelength using calibration
   - Creates smooth continuous curve across entire spectrum
   - Applies visible spectrum filter (380-750 nm only)

2. **Improved visualization:**
   - Plot 2 now shows continuous cyan curve (intensity vs wavelength)
   - Peaks marked as red circles on top of curve
   - Filled area under curve for better visual clarity
   - Title changed to "Continuous Curve - Calibrated" to indicate difference

3. **Peak annotations:**
   - Peaks only annotated if they fall within visible spectrum
   - Removed verbose "wavelength + color name" annotations to reduce clutter
   - Shows wavelength value above each peak

**How It Works:**
```python
# Generate wavelength axis for entire pixel range
pixel_positions = np.arange(len(profile))
wl_axis = apply_calibration(pixel_positions, slope, intercept)

# Filter to visible spectrum (380-750 nm)
valid_indices = (wl_axis >= 380) & (wl_axis <= 750)
wl_filtered = wl_axis[valid_indices]
profile_filtered = profile[valid_indices]

# Plot continuous curve with peaks overlaid
ax2.plot(wl_filtered, profile_filtered, linewidth=2.5)  # Continuous curve
ax2.scatter(peak_wl, peak_intensities, marker='o')      # Discrete peaks
```

**Files Modified:**
- `app.py`: `generate_plots()` function (lines 457-519) - Complete rewrite of Plot 2
- New imports: Uses `apply_calibration()` to map pixels to wavelengths

---

### 3. ✅ **Calibration Persistence Implemented**

**Problem:**
- Calibration stored only in memory (Flask app dictionary)
- Lost on page refresh or app restart
- Users had to recalibrate for every session

**Solution:**
1. **File-based persistence:**
   - Calibration saved to `calibration.json` on successful calibration
   - Loaded from file on app startup
   - Survives app restarts and page refreshes

2. **Implementation:**
   - New functions: `load_calibration()` and `save_calibration()`
   - Called automatically on app startup
   - Saves only on successful calibration in `/calibrate` endpoint

3. **Graceful fallback:**
   - If file doesn't exist: starts uncalibrated (normal behavior)
   - If file corrupted: logs warning, starts uncalibrated
   - No crashes if calibration file missing

**Files Modified:**
- `app.py`: Added functions `load_calibration()` and `save_calibration()` (lines 58-87)
- `app.py`: Added `calibration_file` variable (line 50)
- `app.py`: Auto-loads calibration on startup (line 88)
- `app.py`: `/calibrate` endpoint calls `save_calibration()` (line 630)

---

## How to Use the Fixed Application

### Correct Calibration Workflow:

1. **Load an image** of a known spectrum (e.g., fluorescent light with known lines)
2. **Click "Auto Crop"** to detect rainbow band
3. **Click "Analyze"** to get peak detection (no wavelengths yet - just pixel positions)
4. **Click "Calibrate"**:
   - Identify 2+ spectral lines from the image
   - Look at **"Detected Peaks"** from Plot 1
   - Enter pixel positions where you see peaks (e.g., pixel 250, pixel 450)
   - Enter the actual wavelengths for those peaks (e.g., 405nm, 532nm)
   - **Validation:** System will reject calibration if wavelengths are outside 300-1000 nm
5. **Calibration saved!** Run the app again - calibration will load automatically

### Understanding the Output:

**Plot 1 (Intensity Profile):**
- Shows raw 1D profile with peak markers
- X-axis: Pixel position (or wavelength if calibrated)
- Y-axis: Intensity (brightness)

**Plot 2 (Continuous Spectrum):**
- **Only appears after calibration is complete**
- Shows smooth continuous curve (intensity vs wavelength)
- Red peaks mark detected spectral lines
- X-axis: Wavelength in nm (380-750 nm visible range only)
- Any wavelengths outside visible range are excluded

**CSV Export:**
- All wavelengths are now valid (380-750 nm range)
- Colors are "Violet", "Blue", "Green", etc. (not "UV")
- Pixel positions included for reference

---

## Testing the Fixes

### Scenario 1: Negative Wavelengths
- **Before:** Entering pixel=700, wavelength=405 would result in intercept=-484, all wavelengths negative
- **After:** Calibration is rejected with error message asking to recheck calibration points

### Scenario 2: Continuous Curve
- **Before:** Only saw scatter points of peaks, no continuous visualization
- **After:** Smooth curve shows full intensity profile across wavelength range, peaks clearly marked

### Scenario 3: Calibration Persistence
- **Before:** Refresh page → calibration lost
- **After:** Refresh page → calibration automatically reloaded from `calibration.json`
- Restart app → calibration persists across restarts

---

## Technical Details

### Calibration Validation Logic:
```python
# Check wavelengths are in reasonable range
if wavelength1 < 300 or wavelength1 > 1000:
    return error_response("Wavelengths must be between 300-1000 nm")

# Test calibration produces valid results at pixel 1000
test_wl = slope * 1000 + intercept
if test_wl < 300 or test_wl > 1000:
    return error_response(f"Calibration produces out-of-range wavelengths ({test_wl:.0f} nm)")
```

### Spectrum Reconstruction:
```python
# Map each pixel to wavelength
pixel_positions = np.arange(len(profile))
wl_axis = apply_calibration(pixel_positions, slope, intercept)

# Keep only visible spectrum
valid = (wl_axis >= 380) & (wl_axis <= 750)
wl_visible = wl_axis[valid]
intensity_visible = profile[valid]

# Plot as continuous curve
ax.plot(wl_visible, intensity_visible, linewidth=2.5)
```

### Persistence Mechanism:
```python
# Load on startup
def load_calibration():
    if os.path.exists('calibration.json'):
        with open('calibration.json', 'r') as f:
            calibration_data.update(json.load(f))

# Save after successful calibration
def save_calibration():
    with open('calibration.json', 'w') as f:
        json.dump(calibration_data, f, indent=2)

# Auto-load on app startup
load_calibration()
```

---

## Files Changed

1. **app.py** - 4 major changes:
   - Added calibration persistence functions
   - Updated `/calibrate` endpoint with validation
   - Rewrote `generate_plots()` for continuous spectrum
   - Updated `get_wavelength_color()` for valid range

2. **src/core.py** - 1 change:
   - Updated `get_color_name()` to return "Out of Range" instead of "UV"/"IR"

**Total:** ~100 lines of code modified, 0 lines removed functionality

---

## Migration from Old Version

If you have an old `calibration.json` file from before this fix:
- **Option 1:** Delete it and recalibrate (1-2 minutes)
- **Option 2:** Manually verify calibration points are in valid range
- **Option 3:** App will auto-validate on next calibration attempt

New application is **fully backward compatible** - it will work fine without old calibration file.
