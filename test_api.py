import requests
import base64
import io
import numpy as np
from PIL import Image
import time

def test_app():
    base_url = "http://127.0.0.1:5000"
    
    # 1. Test Main Page
    try:
        response = requests.get(base_url + "/")
        if response.status_code == 200:
            print("[PASS] Main page loaded")
        else:
            print(f"[FAIL] Main page returned {response.status_code}")
    except Exception as e:
        print(f"[FAIL] Could not connect to server: {e}")
        return

    # 2. Test Analyze Endpoint
    # Create a dummy image (gradient)
    width, height = 100, 100
    gradient = np.linspace(0, 255, width).astype(np.uint8)
    image_data = np.tile(gradient, (height, 1))
    img = Image.fromarray(image_data)
    
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{img_b64}"
    
    payload = {
        "image": data_url,
        "crop": None
    }
    
    try:
        response = requests.post(base_url + "/analyze", json=payload)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success' and data.get('plot'):
                print("[PASS] Analysis endpoint returned success and plot")
            else:
                print(f"[FAIL] Analysis returned error: {data}")
        else:
            print(f"[FAIL] Analysis endpoint returned {response.status_code}")
    except Exception as e:
        print(f"[FAIL] Analysis request failed: {e}")

if __name__ == "__main__":
    # Wait for server to start
    time.sleep(2)
    test_app()
