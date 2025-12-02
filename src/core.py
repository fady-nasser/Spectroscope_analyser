"""
================================================================================
OPTICAL SPECTROMETER CORE ALGORITHMS
================================================================================
Core signal processing and computer vision functions for spectrum analysis.
Implements the 7-step spectrometer workflow:
1. Load image/camera feed
2. Crop rainbow band region
3. Convert 2D image to 1D intensity profile
4. Detect spectral line peaks
5. Set wavelength calibration
6. Map pixel positions to wavelengths
7. Visualize results
"""

# === IMPORTS ===
import cv2  # OpenCV - computer vision library for image processing
import numpy as np  # NumPy - numerical computing
from scipy.signal import find_peaks  # SciPy signal processing - peak detection
from scipy.ndimage import gaussian_filter1d  # SciPy image processing - smoothing

# ================================================================================
# IMAGE LOADING
# ================================================================================

def load_image(file_path):
    """
    Load an image file from disk into NumPy array
    Converts from OpenCV's BGR format to standard RGB format
    
    Args:
        file_path (str): Path to image file
    
    Returns:
        ndarray: Image as (H, W, 3) RGB array
    
    Raises:
        ValueError: If file cannot be loaded
    """
    # Load image from disk using OpenCV
    # Returns BGR (Blue-Green-Red) format by default
    image = cv2.imread(file_path)
    
    # Check if image loaded successfully
    if image is None:
        raise ValueError(f"Could not load image from {file_path}")
    
    # Convert BGR to RGB (standard color order)
    # OpenCV uses BGR for historical reasons; RGB is standard
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return image_rgb


# ================================================================================
# IMAGE CROPPING
# ================================================================================

def crop_image(image, x, y, w, h):
    """
    Extract a rectangular region from image
    Uses NumPy array slicing: [row_start:row_end, col_start:col_end]
    Note: rows correspond to Y, columns to X
    
    Args:
        image (ndarray): Input image (H, W) or (H, W, 3)
        x (int): Left edge of crop region (column index)
        y (int): Top edge of crop region (row index)
        w (int): Width of crop region (number of columns)
        h (int): Height of crop region (number of rows)
    
    Returns:
        ndarray: Cropped image region
    """
    # Crop using NumPy slicing: [rows, columns]
    # Rows: from y to y+h
    # Columns: from x to x+w
    return image[y:y+h, x:x+w]


# ================================================================================
# STEP 3: 2D TO 1D CONVERSION
# ================================================================================

def compute_intensity_profile(image, method='sum', smoothing=1.0):
    """
    Convert 2D rainbow image to 1D intensity profile
    
    CORE ALGORITHM:
    1. Convert image to grayscale (combine RGB channels)
    2. Sum or average pixel intensities along vertical (Y) axis
    3. Result: 1D array where index=horizontal position, value=total brightness
    4. Apply Gaussian smoothing to reduce noise
    
    Example:
        Input: 480x640 RGB image (rainbow spectrum)
        Output: 1D array of length 640 (intensity per column)
    
    Args:
        image (ndarray): Input image (H, W) or (H, W, 3)
        method (str): 'sum' to add pixels, 'mean' to average
        smoothing (float): Gaussian smoothing sigma (0 = no smoothing)
    
    Returns:
        ndarray: 1D intensity profile (normalized to 0-100)
    """
    # === STEP 1: CONVERT TO GRAYSCALE ===
    if len(image.shape) == 3:  # If image has 3 dimensions (color)
        # Check if RGB (3 channels) or RGBA (4 channels)
        if image.shape[2] == 3:
            # Convert RGB to grayscale using standard luminosity formula
            # Weights: R=0.299, G=0.587, B=0.114 (human eye sensitivity)
            gray = cv2.cvtColor(image.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        else:
            # If RGBA or other format, just average channels
            gray = np.mean(image, axis=2).astype(np.uint8)
    else:
        # Already grayscale (1D or 2D with no color info)
        gray = image.astype(np.uint8)

    # === STEP 2: COMBINE VERTICALLY ===
    # Sum or average along vertical axis (axis=0, rows)
    # Result: 1D array where each element is sum/mean of column
    if method == 'sum':
        # Add all pixel values down each column
        profile = np.sum(gray, axis=0).astype(np.float64)
    else:  # method == 'mean'
        # Average all pixel values down each column
        profile = np.mean(gray, axis=0).astype(np.float64)
    
    # === STEP 3: NORMALIZE ===
    # Scale to 0-100 range for easier analysis
    if np.max(profile) > 0:
        profile = profile / np.max(profile) * 100
    
    # === STEP 4: SMOOTH ===
    # Apply Gaussian blur to reduce noise from sensor artifacts
    # Larger sigma = more smoothing but less detail
    if smoothing > 0:
        profile = gaussian_filter1d(profile, sigma=smoothing)
    
    return profile


def compute_rgb_profiles(image, smoothing=1.0):
    """
    Compute separate intensity profiles for Red, Green, and Blue channels
    Also returns the total intensity profile (grayscale)
    
    Args:
        image (ndarray): Input image (H, W, 3) in RGB format
        smoothing (float): Gaussian smoothing sigma (0 = no smoothing)
    
    Returns:
        dict: {
            'total': 1D array of total intensity (grayscale),
            'red': 1D array of red channel intensity,
            'green': 1D array of green channel intensity,
            'blue': 1D array of blue channel intensity
        }
    """
    # Check if image is RGB
    if len(image.shape) != 3 or image.shape[2] != 3:
        raise ValueError("Image must be RGB (H, W, 3)")
    
    # Extract individual color channels
    red_channel = image[:, :, 0]
    green_channel = image[:, :, 1]
    blue_channel = image[:, :, 2]
    
    # Sum vertically for each channel
    red_profile = np.sum(red_channel, axis=0).astype(np.float64)
    green_profile = np.sum(green_channel, axis=0).astype(np.float64)
    blue_profile = np.sum(blue_channel, axis=0).astype(np.float64)
    
    # Compute total (grayscale) profile
    total_profile = compute_intensity_profile(image, method='sum', smoothing=0)
    
    # Normalize each channel to 0-1 range
    if np.max(red_profile) > 0:
        red_profile = red_profile / np.max(red_profile)
    if np.max(green_profile) > 0:
        green_profile = green_profile / np.max(green_profile)
    if np.max(blue_profile) > 0:
        blue_profile = blue_profile / np.max(blue_profile)
    if np.max(total_profile) > 0:
        total_profile = total_profile / np.max(total_profile)
    
    # Apply smoothing
    if smoothing > 0:
        red_profile = gaussian_filter1d(red_profile, sigma=smoothing)
        green_profile = gaussian_filter1d(green_profile, sigma=smoothing)
        blue_profile = gaussian_filter1d(blue_profile, sigma=smoothing)
        total_profile = gaussian_filter1d(total_profile, sigma=smoothing)
    
    return {
        'total': total_profile,
        'red': red_profile,
        'green': green_profile,
        'blue': blue_profile
    }


# ================================================================================
# STEP 4: PEAK DETECTION
# ================================================================================

def detect_peaks(profile, height=None, distance=None, prominence=None, rel_height=0.5):
    """
    Find local maxima (peaks) in the 1D intensity profile
    Each peak represents a possible spectral line (laser emission or element signature)
    
    ALGORITHM:
    1. Find local maxima (points higher than neighbors)
    2. Filter by minimum height (ignore noise)
    3. Filter by minimum distance (prevent double-counting close peaks)
    4. Return peak positions and properties
    
    Args:
        profile (ndarray): 1D intensity array
        height (float): Minimum peak height (intensity threshold)
                       If None: auto-detected as 10% of max
        distance (int): Minimum pixels between peaks
                       If None: auto-detected based on profile length
        prominence (float): Minimum peak prominence (how much peak stands out)
        rel_height (float): Fraction of peak height for width calculation
    
    Returns:
        tuple: (peaks, properties)
            - peaks: array of peak indices (pixel positions)
            - properties: dict with peak properties (heights, widths, etc)
    
    Example:
        profile = [10, 20, 30, 25, 15, 40, 35, 20, 10]
        peaks, props = detect_peaks(profile, height=15)
        # peaks = [2, 5]  (indices of local maxima above 15)
    """
    # Check if profile is empty
    if len(profile) == 0:
        return np.array([], dtype=int), {}
    
    # === AUTO-DETECT HEIGHT ===
    if height is None:
        # Use 10% of maximum intensity as threshold
        # This filters out small noise spikes
        height = np.max(profile) * 0.1
    
    # === AUTO-DETECT DISTANCE ===
    if distance is None:
        # Typical spectra have peaks spaced ~50 pixels apart
        # So minimum distance = profile_length / 50
        # Minimum 5 pixels to avoid neighboring pixels being counted as separate peaks
        distance = max(5, len(profile) // 50)
    
    # === FIND PEAKS USING SCIPY ===
    # SciPy's find_peaks uses continuous wavelet transform
    # More robust than simple gradient-based approaches
    peaks, properties = find_peaks(
        profile,  # Input signal
        height=height,  # Minimum peak height
        distance=distance,  # Minimum spacing between peaks
        prominence=prominence,  # Peak prominence (vertical distance from local baseline)
        rel_height=rel_height  # Height fraction for peak width calculation
    )
    
    return peaks, properties


# ================================================================================
# STEP 2: AUTO-CROP DETECTION
# ================================================================================

def auto_find_rainbow_band(image, vertical_tolerance=10):
    """
    Automatically detect rainbow band region (crop area)
    
    ALGORITHM:
    1. Convert to grayscale
    2. Sum brightness across horizontal axis (each row)
    3. Find row with maximum brightness (brightest part of spectrum)
    4. Expand window around brightest row based on brightness threshold
    5. Return bounding box
    
    Why this works:
    - Rainbow spectra are typically horizontal bands of bright light
    - Background is dark (low brightness)
    - Finding brightness peaks finds the spectrum region
    
    Args:
        image (ndarray): Input image (H, W) or (H, W, 3)
        vertical_tolerance (int): Unused parameter (kept for API compatibility)
    
    Returns:
        dict: {'x': int, 'y': int, 'w': int, 'h': int} bounding box of band
              or None if no band detected
    """
    # === CONVERT TO GRAYSCALE ===
    if len(image.shape) == 3:  # Color image
        if image.shape[2] == 3:
            # RGB to grayscale
            gray = cv2.cvtColor(image.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        else:
            # Average channels
            gray = np.mean(image, axis=2).astype(np.uint8)
    else:
        # Already grayscale
        gray = image.astype(np.uint8)
    
    # === FIND BRIGHTNESS PER ROW ===
    # Sum brightness across all columns for each row
    # Result: 1D array where element i = total brightness of row i
    brightness_per_row = np.sum(gray, axis=1)
    
    # === FIND BRIGHTEST ROW ===
    # Row with highest total brightness likely contains spectrum
    brightest_row = np.argmax(brightness_per_row)
    max_brightness = brightness_per_row[brightest_row]
    
    # === FIND ALL BRIGHT ROWS ===
    # Include all rows with brightness > 30% of maximum
    # This creates a window around the brightest row
    threshold = max_brightness * 0.3
    bright_rows = np.where(brightness_per_row > threshold)[0]
    
    # If no bright rows found, no spectrum detected
    if len(bright_rows) == 0:
        return None
    
    # === CREATE BOUNDING BOX ===
    # Top of band: first bright row
    # Bottom of band: last bright row
    # Left: 0 (start of image width)
    # Right: full image width
    y_start = bright_rows[0]  # Top edge of band
    y_end = bright_rows[-1]  # Bottom edge of band
    height = y_end - y_start + 1  # Height = bottom - top + 1
    
    return {
        'x': 0,  # Left edge (full width)
        'y': y_start,  # Top edge
        'w': image.shape[1],  # Width (full image width)
        'h': height  # Height (band height)
    }


# ================================================================================
# STEP 5 & 6: WAVELENGTH CALIBRATION
# ================================================================================

def linear_calibration(pixel1, wavelength1, pixel2, wavelength2):
    """
    Compute wavelength-to-pixel mapping using two calibration points
    
    ALGORITHM:
    Linear interpolation: wavelength = m*pixel + c
    
    Solving for m and c:
    - Point 1: wavelength1 = m*pixel1 + c
    - Point 2: wavelength2 = m*pixel2 + c
    
    Slope: m = (wavelength2 - wavelength1) / (pixel2 - pixel1)
    Intercept: c = wavelength1 - m*pixel1
    
    CALIBRATION POINTS (Common Laser Lines):
    - 405 nm: Violet laser (cheap, common)
    - 532 nm: Green laser (DPSS lasers, very common)
    - 650 nm: Red laser (laser pointer, LED)
    - 808 nm: Infrared diode laser
    
    Example:
        # Calibration with green (532nm) and red (650nm) lasers
        pixel_green = 150  # Green appears at pixel 150 in image
        pixel_red = 400  # Red appears at pixel 400 in image
        slope, intercept = linear_calibration(150, 532, 400, 650)
        # Now: wavelength(300) = slope*300 + intercept = 591 nm (yellow)
    
    Args:
        pixel1 (float): Pixel position of first calibration point
        wavelength1 (float): Wavelength in nm of first calibration point
        pixel2 (float): Pixel position of second calibration point
        wavelength2 (float): Wavelength in nm of second calibration point
    
    Returns:
        tuple: (slope, intercept) for wavelength = slope*pixel + intercept
    
    Raises:
        ValueError: If pixels are identical (would cause division by zero)
    """
    # Check for invalid inputs
    if pixel1 == pixel2:
        raise ValueError("Pixels must be different for calibration")
    
    # === COMPUTE SLOPE ===
    # m = rise/run = (wavelength2 - wavelength1) / (pixel2 - pixel1)
    slope = (wavelength2 - wavelength1) / (pixel2 - pixel1)
    
    # === COMPUTE INTERCEPT ===
    # c = wavelength - m*pixel (using first calibration point)
    intercept = wavelength1 - slope * pixel1
    
    return slope, intercept


def apply_calibration(pixels, slope, intercept):
    """
    Convert pixel indices to wavelengths using calibration coefficients
    
    FORMULA:
    wavelength = slope * pixel + intercept
    
    Args:
        pixels (int, float, or array): Pixel position(s) to convert
        slope (float): Calibration slope (nm/pixel)
        intercept (float): Calibration intercept (nm offset at pixel 0)
    
    Returns:
        float or ndarray: Wavelength(s) in nanometers
    
    Example:
        slope = 0.3  # Each pixel represents 0.3 nm
        intercept = 300  # Pixel 0 maps to 300 nm
        wavelength = apply_calibration(100, slope, intercept)
        # wavelength = 0.3*100 + 300 = 330 nm
    """
    # Convert input to NumPy array (handles scalars and arrays uniformly)
    pixels_arr = np.asarray(pixels)
    
    # Apply linear calibration formula
    return slope * pixels_arr + intercept


# ================================================================================
# STEP 7: SPECTRAL LINE IDENTIFICATION
# ================================================================================

def identify_spectral_lines(peaks, intensities, wavelengths, prominence_threshold=0.1):
    """
    Identify and rank spectral lines by prominence/intensity
    
    ALGORITHM:
    1. Sort peaks by intensity (descending)
    2. Filter out weak peaks (below prominence threshold)
    3. Assign color names to each peak based on wavelength
    4. Return sorted list with all properties
    
    PROMINENCE THRESHOLD:
    - 0.1 (10%) = Include peaks ≥ 10% of brightest peak
    - Filters noise and weak lines, focuses on strong lines
    
    Args:
        peaks (ndarray): Array of peak pixel indices
        intensities (ndarray): Array of peak intensity values
        wavelengths (ndarray): Array of peak wavelengths
        prominence_threshold (float): Minimum intensity as fraction of max
                                     (0.0 to 1.0, default 0.1 = 10%)
    
    Returns:
        dict: {
            'lines': [
                {
                    'pixel': int,  # Pixel position
                    'wavelength': float,  # Wavelength in nm
                    'intensity': float,  # Raw intensity value
                    'intensity_norm': float,  # Normalized intensity (0-1)
                    'color_name': str  # Color name (Red, Green, Blue, etc)
                },
                ...
            ],
            'count': int  # Number of lines identified
        }
    """
    # Check if any peaks exist
    if len(peaks) == 0:
        return {'lines': []}
    
    # === SORT BY INTENSITY ===
    # argsort returns indices that would sort the array
    # [::-1] reverses to get descending order (largest first)
    sorted_indices = np.argsort(intensities)[::-1]
    
    lines = []  # List to hold spectral line data
    max_intensity = np.max(intensities)  # Brightest peak intensity
    
    # === BUILD SPECTRAL LINE LIST ===
    for idx in sorted_indices:
        intensity = intensities[idx]
        # Check if peak is prominent enough
        if intensity / max_intensity >= prominence_threshold:
            lines.append({
                'pixel': int(peaks[idx]),  # Pixel position (integer)
                'wavelength': float(wavelengths[idx]),  # Wavelength in nm
                'intensity': float(intensity),  # Raw intensity value
                'intensity_norm': float(intensity / max_intensity),  # Normalize to 0-1
                'color_name': get_color_name(wavelengths[idx])  # Human-readable color
            })
    
    return {
        'lines': lines,  # List of spectral lines sorted by intensity
        'count': len(lines)  # Total number of identified lines
    }


# ================================================================================
# COLOR IDENTIFICATION
# ================================================================================

def get_color_name(wavelength):
    """
    Map wavelength to human-readable color name
    Uses visible light spectrum ranges only (380-750 nm)
    Outside this range returns descriptive labels
    
    VISIBLE SPECTRUM (380-750 nm):
    - 380-450 nm: Violet to Blue (higher energy, shorter wavelengths)
    - 450-495 nm: Blue to Blue-Green
    - 495-570 nm: Green (middle of visible spectrum)
    - 570-590 nm: Yellow-Green to Yellow
    - 590-620 nm: Orange
    - 620-750 nm: Red to Deep Red (lower energy, longer wavelengths)
    
    Args:
        wavelength (float): Wavelength in nanometers
    
    Returns:
        str: Color name (Violet, Blue, Green, Yellow, Orange, Red, Out of Range)
    
    Example:
        get_color_name(405)  # Returns "Violet" (common laser line)
        get_color_name(532)  # Returns "Green" (common laser line)
        get_color_name(650)  # Returns "Red" (common laser line)
    """
    # Use wavelength thresholds to determine color
    # Only map visible spectrum (380-750 nm)
    if wavelength < 380:
        return "Out of Range"  # Below visible spectrum
    elif wavelength < 450:
        return "Violet"  # Deep blue-purple
    elif wavelength < 495:
        return "Blue"  # True blue color
    elif wavelength < 570:
        return "Green"  # Yellow-green to green
    elif wavelength < 590:
        return "Yellow"  # Yellow color
    elif wavelength < 620:
        return "Orange"  # Orange color
    elif wavelength < 750:
        return "Red"  # Red color
    else:
        return "Out of Range"  # Beyond visible spectrum
