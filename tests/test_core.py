import unittest
import numpy as np
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from core import compute_intensity_profile, detect_peaks, linear_calibration, apply_calibration

class TestSpectrometerCore(unittest.TestCase):
    def test_intensity_profile(self):
        # Create a dummy image (100x100), black background
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        
        # Draw a vertical line at x=50 (simulate a spectral line)
        image[:, 50, :] = 255
        
        profile = compute_intensity_profile(image)
        
        self.assertEqual(len(profile), 100)
        self.assertTrue(profile[50] > 0)
        self.assertTrue(profile[0] == 0)
        
    def test_peak_detection(self):
        # Create a synthetic profile
        profile = np.zeros(100)
        profile[20] = 100
        profile[80] = 100
        
        peaks, _ = detect_peaks(profile, height=50)
        
        self.assertEqual(len(peaks), 2)
        self.assertIn(20, peaks)
        self.assertIn(80, peaks)
        
    def test_calibration(self):
        # Pixel 10 -> 400nm, Pixel 90 -> 800nm
        slope, intercept = linear_calibration(10, 400, 90, 800)
        
        # Check slope: (800-400)/(90-10) = 400/80 = 5
        self.assertEqual(slope, 5.0)
        
        # Check intercept: 400 = 5*10 + c -> c = 350
        self.assertEqual(intercept, 350.0)
        
        # Test application
        wl = apply_calibration(50, slope, intercept)
        # 5*50 + 350 = 250 + 350 = 600
        self.assertEqual(wl, 600.0)

if __name__ == '__main__':
    unittest.main()
