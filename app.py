import os
import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename
import sys

# Ensure we can import from src
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from core import load_image, crop_image, compute_intensity_profile, compute_rgb_profiles, detect_peaks, linear_calibration, apply_calibration

app = Flask(__name__)
app.secret_key = 'supersecretkey'  # Required for session
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Global state (simple version for single user local app)
# In a real multi-user web app, this should be in a database or session-based storage
class AppState:
    def __init__(self):
        self.current_image_path = None
        self.rotation_angle = 0
        self.calibration = {'slope': 1.0, 'intercept': 0.0, 'is_calibrated': False}

state = AppState()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        state.current_image_path = filepath
        state.rotation_angle = 0
        state.calibration = {'slope': 1.0, 'intercept': 0.0, 'is_calibrated': False}
        
        return jsonify({'url': filepath, 'filename': filename})

@app.route('/api/rotate', methods=['POST'])
def rotate_image():
    direction = request.json.get('direction')
    if direction == 'left':
        state.rotation_angle = (state.rotation_angle - 90) % 360
    elif direction == 'right':
        state.rotation_angle = (state.rotation_angle + 90) % 360
    
    return jsonify({'angle': state.rotation_angle})

@app.route('/api/analyze', methods=['POST'])
def analyze():
    if not state.current_image_path:
        return jsonify({'error': 'No image loaded'}), 400
    
    try:
        # Load image
        img = load_image(state.current_image_path)
        
        # Apply rotation
        if state.rotation_angle == 90:
            img = np.rot90(img, k=-1)
        elif state.rotation_angle == 180:
            img = np.rot90(img, k=2)
        elif state.rotation_angle == 270:
            img = np.rot90(img, k=1)
            
        # Apply crop if provided
        crop_data = request.json.get('crop')
        if crop_data:
            x = int(crop_data['x'])
            y = int(crop_data['y'])
            w = int(crop_data['w'])
            h = int(crop_data['h'])
            img = crop_image(img, x, y, w, h)
            
        # Compute profiles
        rgb_profiles = compute_rgb_profiles(img, smoothing=0.0)
        
        # Detect peaks on total intensity
        peaks, _ = detect_peaks(rgb_profiles['total'], height=np.max(rgb_profiles['total'])*0.1, distance=20)
        
        # Prepare data for frontend
        x_axis = np.arange(len(rgb_profiles['total'])).tolist()
        
        # Apply calibration if exists
        if state.calibration['is_calibrated']:
            slope = state.calibration['slope']
            intercept = state.calibration['intercept']
            x_axis = [slope * x + intercept for x in x_axis]
            peaks_x = [slope * p + intercept for p in peaks]
        else:
            peaks_x = peaks.tolist()
            
        return jsonify({
            'x_axis': x_axis,
            'total': rgb_profiles['total'].tolist(),
            'red': rgb_profiles['red'].tolist(),
            'green': rgb_profiles['green'].tolist(),
            'blue': rgb_profiles['blue'].tolist(),
            'peaks': peaks.tolist(), # Return pixel indices for interaction
            'peaks_x': peaks_x,      # Return calibrated values for display
            'is_calibrated': state.calibration['is_calibrated']
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/calibrate', methods=['POST'])
def calibrate():
    data = request.json
    p1 = data.get('p1')
    w1 = data.get('w1')
    p2 = data.get('p2')
    w2 = data.get('w2')
    
    if None in [p1, w1, p2, w2]:
        return jsonify({'error': 'Missing calibration data'}), 400
        
    try:
        slope, intercept = linear_calibration(p1, w1, p2, w2)
        state.calibration = {
            'slope': slope,
            'intercept': intercept,
            'is_calibrated': True
        }
        return jsonify(state.calibration)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
