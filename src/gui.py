import tkinter as tk
from tkinter import filedialog, simpledialog, messagebox
from PIL import Image, ImageTk
import numpy as np
import cv2
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

from core import (load_image, crop_image, compute_intensity_profile, compute_rgb_profiles,
                  detect_peaks, linear_calibration, apply_calibration)

class SpectrometerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Spectrometer")
        self.root.geometry("1400x900")

        # State variables
        self.original_image = None
        self.current_image = None
        self.intensity_profile = None
        self.rgb_profiles = None
        self.show_rgb = False
        self.peaks = None
        self.calibration_slope = 1.0
        self.calibration_intercept = 0.0
        self.is_calibrated = False
        
        # Video state
        self.cap = None
        self.is_video_active = False
        self.video_loop_id = None
        
        # Cropping state
        self.rect_start_x = None
        self.rect_start_y = None
        self.rect_id = None
        self.crop_coords = None
        
        # Rotation state
        self.rotation_angle = 0
        
        # Calibration mode state
        self.calibration_mode = False
        self.selected_peak_indices = []
        self.click_callback_id = None

        self._setup_ui()

    def _setup_ui(self):
        # Top Control Panel
        control_frame = tk.Frame(self.root)
        control_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        tk.Button(control_frame, text="Load Image", command=self.load_image_action).pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="Toggle Camera", command=self.toggle_camera_action).pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="↺ Rotate Left", command=self.rotate_left_action).pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="↻ Rotate Right", command=self.rotate_right_action).pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="Analyze", command=self.analyze_action).pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="Calibrate", command=self.calibrate_action).pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="Reset", command=self.reset_action).pack(side=tk.LEFT, padx=5)

        # Main Content Area
        paned_window = tk.PanedWindow(self.root, orient=tk.VERTICAL)
        paned_window.pack(fill=tk.BOTH, expand=True)

        # Image Canvas
        self.image_frame = tk.Frame(paned_window, bg="gray")
        paned_window.add(self.image_frame, height=300)
        
        self.canvas = tk.Canvas(self.image_frame, bg="black", cursor="cross")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<ButtonPress-1>", self.on_mouse_down)
        self.canvas.bind("<B1-Motion>", self.on_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_mouse_up)

        # Graph Area
        self.graph_main_frame = tk.Frame(paned_window, bg="white")
        paned_window.add(self.graph_main_frame)
        
        # Left: Standard intensity plot
        self.figure1 = Figure(figsize=(6, 4), dpi=100)
        self.ax1 = self.figure1.add_subplot(111)
        self.ax1.set_title("Intensity Profile - Click peaks to calibrate")
        self.ax1.set_xlabel("Pixel Position")
        self.ax1.set_ylabel("Intensity")
        
        self.chart1 = FigureCanvasTkAgg(self.figure1, self.graph_main_frame)
        self.chart1.get_tk_widget().pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Right: RGB channel plot
        self.figure2 = Figure(figsize=(6, 4), dpi=100)
        self.ax2 = self.figure2.add_subplot(111)
        self.ax2.set_title("RGB Channel Analysis")
        self.ax2.set_xlabel("Pixel Position")
        self.ax2.set_ylabel("Normalized Intensity")
        
        self.chart2 = FigureCanvasTkAgg(self.figure2, self.graph_main_frame)
        self.chart2.get_tk_widget().pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def load_image_action(self):
        self.stop_camera()
        file_path = filedialog.askopenfilename(filetypes=[("Images", "*.png;*.jpg;*.jpeg;*.bmp")])
        if not file_path:
            return

        try:
            self.original_image = load_image(file_path)
            self.rotation_angle = 0
            self.current_image = self.original_image.copy()
            self.display_image(self.current_image)
            self.reset_state()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load image: {e}")

    def rotate_left_action(self):
        if self.original_image is None:
            return
        self.rotation_angle = (self.rotation_angle - 90) % 360
        self.apply_rotation()

    def rotate_right_action(self):
        if self.original_image is None:
            return
        self.rotation_angle = (self.rotation_angle + 90) % 360
        self.apply_rotation()

    def apply_rotation(self):
        if self.original_image is None:
            return
        
        if self.rotation_angle == 90:
            rotated = np.rot90(self.original_image, k=-1)
        elif self.rotation_angle == 180:
            rotated = np.rot90(self.original_image, k=2)
        elif self.rotation_angle == 270:
            rotated = np.rot90(self.original_image, k=1)
        else:
            rotated = self.original_image
        
        self.current_image = rotated
        self.display_image(rotated)
        self.crop_coords = None

    def display_image(self, img_array):
        pil_image = Image.fromarray(img_array)
        
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        
        if canvas_width > 1 and canvas_height > 1:
            img_w, img_h = pil_image.size
            ratio = min(canvas_width/img_w, canvas_height/img_h)
            new_w = int(img_w * ratio)
            new_h = int(img_h * ratio)
            pil_image = pil_image.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
        self.tk_image = ImageTk.PhotoImage(pil_image)
        self.canvas.delete("all")
        self.canvas.create_image(canvas_width//2, canvas_height//2, image=self.tk_image, anchor=tk.CENTER)
        
        self.scale_factor_x = pil_image.size[0] / img_array.shape[1]
        self.scale_factor_y = pil_image.size[1] / img_array.shape[0]
        self.offset_x = (canvas_width - pil_image.size[0]) // 2
        self.offset_y = (canvas_height - pil_image.size[1]) // 2

    def on_mouse_down(self, event):
        self.rect_start_x = event.x
        self.rect_start_y = event.y
        if self.rect_id:
            self.canvas.delete(self.rect_id)
            self.rect_id = None

    def on_mouse_drag(self, event):
        if self.rect_start_x:
            if self.rect_id:
                self.canvas.delete(self.rect_id)
            self.rect_id = self.canvas.create_rectangle(
                self.rect_start_x, self.rect_start_y, event.x, event.y,
                outline="red", width=2
            )

    def on_mouse_up(self, event):
        if self.current_image is None:
            return

        if self.rect_start_x:
            x1, y1 = self.rect_start_x, self.rect_start_y
            x2, y2 = event.x, event.y
            
            x = min(x1, x2)
            y = min(y1, y2)
            w = abs(x2 - x1)
            h = abs(y2 - y1)
            
            if hasattr(self, 'scale_factor_x'):
                orig_x = int((x - self.offset_x) / self.scale_factor_x)
                orig_y = int((y - self.offset_y) / self.scale_factor_y)
                orig_w = int(w / self.scale_factor_x)
                orig_h = int(h / self.scale_factor_y)
                
                img_h, img_w, _ = self.current_image.shape
                orig_x = max(0, min(orig_x, img_w))
                orig_y = max(0, min(orig_y, img_h))
                orig_w = min(orig_w, img_w - orig_x)
                orig_h = min(orig_h, img_h - orig_y)

                if orig_w > 0 and orig_h > 0:
                    self.crop_coords = (orig_x, orig_y, orig_w, orig_h)
                    print(f"Crop selection: {self.crop_coords}")

    def analyze_action(self):
        if self.current_image is None:
            return
        
        img_to_process = self.current_image
        if self.crop_coords:
            x, y, w, h = self.crop_coords
            img_to_process = crop_image(self.current_image, x, y, w, h)
        
        self.intensity_profile = compute_intensity_profile(img_to_process)
        self.peaks, _ = detect_peaks(self.intensity_profile, height=np.max(self.intensity_profile)*0.1, distance=20)
        
        try:
            self.rgb_profiles = compute_rgb_profiles(img_to_process, smoothing=1.0)
        except Exception as e:
            print(f"RGB profile error: {e}")
            self.rgb_profiles = None
        
        self.plot_data()

    def plot_data(self):
        if self.intensity_profile is None:
            return
            
        self.ax1.clear()
        
        x_data = np.arange(len(self.intensity_profile))
        x_label = "Pixel Position"
        
        if self.is_calibrated:
            x_data = apply_calibration(x_data, self.calibration_slope, self.calibration_intercept)
            x_label = "Wavelength (nm)"
            
        self.ax1.plot(x_data, self.intensity_profile, color='blue', linewidth=2, label='Total Intensity')
        
        # Plot all peaks
        if self.peaks is not None and len(self.peaks) > 0:
            peak_x = self.peaks
            if self.is_calibrated:
                peak_x = apply_calibration(peak_x, self.calibration_slope, self.calibration_intercept)
            
            # Default peaks (red x)
            self.ax1.plot(peak_x, self.intensity_profile[self.peaks], "x", color='red', markersize=10, label='Peaks')
            
            # Highlight selected peaks for calibration (green circles)
            if len(self.selected_peak_indices) > 0:
                selected_peaks = [self.peaks[i] for i in self.selected_peak_indices]
                selected_peak_x = np.array(selected_peaks)
                if self.is_calibrated:
                    selected_peak_x = apply_calibration(selected_peak_x, self.calibration_slope, self.calibration_intercept)
                self.ax1.plot(selected_peak_x, self.intensity_profile[selected_peaks], "o", 
                            color='green', markersize=15, fillstyle='none', linewidth=3, 
                            label=f'Selected ({len(self.selected_peak_indices)}/2)')
            
            # Annotate peaks
            for i, px in enumerate(peak_x):
                self.ax1.annotate(f"{px:.1f}", (px, self.intensity_profile[self.peaks][i]), 
                                 textcoords="offset points", xytext=(0,10), ha='center', fontsize=8)

        title = "Spectrum Analysis - Total Intensity"
        if self.calibration_mode:
            title += f" [CALIBRATION MODE: Select {2-len(self.selected_peak_indices)} more peak(s)]"
        self.ax1.set_xlabel(x_label)
        self.ax1.set_ylabel("Intensity")
        self.ax1.set_title(title)
        self.ax1.legend()
        self.ax1.grid(True, alpha=0.3)
        self.chart1.draw()
        
        # Plot RGB Channels
        self.ax2.clear()
        
        if self.rgb_profiles is not None:
            x_data_rgb = np.arange(len(self.rgb_profiles['total']))
            if self.is_calibrated:
                x_data_rgb = apply_calibration(x_data_rgb, self.calibration_slope, self.calibration_intercept)
            
            self.ax2.set_facecolor('#1a1a1a')
            self.figure2.patch.set_facecolor('#2b2b2b')
            
            self.ax2.plot(x_data_rgb, self.rgb_profiles['total'], color='white', linewidth=2, label='Total Intensity', alpha=0.8)
            self.ax2.plot(x_data_rgb, self.rgb_profiles['red'], color='#ff6b6b', linewidth=2, label='Red')
            self.ax2.plot(x_data_rgb, self.rgb_profiles['green'], color='#4ecdc4', linewidth=2, label='Green')
            self.ax2.plot(x_data_rgb, self.rgb_profiles['blue'], color='#45b7d1', linewidth=2, label='Blue')
            
            self.ax2.set_xlabel(x_label, color='white')
            self.ax2.set_ylabel("Normalized Intensity", color='white')
            self.ax2.set_title("RGB Channel Analysis", color='white')
            self.ax2.tick_params(colors='white')
            self.ax2.legend(facecolor='#2b2b2b', edgecolor='white', labelcolor='white')
            self.ax2.grid(True, alpha=0.2, color='white')
        else:
            self.ax2.text(0.5, 0.5, 'RGB data not available', ha='center', va='center', transform=self.ax2.transAxes)
        
        self.chart2.draw()

    def calibrate_action(self):
        """Start interactive calibration - click 2 peaks on the graph"""
        if self.peaks is None or len(self.peaks) < 2:
            messagebox.showwarning("Calibration", "Need at least 2 peaks detected. Click Analyze first.")
            return
        
        if self.calibration_mode:
            self.cancel_calibration()
        else:
            self.calibration_mode = True
            self.selected_peak_indices = []
            self.click_callback_id = self.figure1.canvas.mpl_connect('button_press_event', self.on_peak_click)
            self.plot_data()
            messagebox.showinfo("Calibration Mode", 
                              "Click on TWO peaks on the LEFT graph to select them.\n\n"
                              "After selecting 2 peaks, you'll enter their wavelengths (nm).")
    
    def on_peak_click(self, event):
        """Handle clicks on graph during calibration mode"""
        if not self.calibration_mode or event.inaxes != self.ax1:
            return
        
        click_x = event.xdata
        if click_x is None:
            return
        
        # Convert to pixel if calibrated
        if self.is_calibrated:
            click_pixel = (click_x - self.calibration_intercept) / self.calibration_slope
        else:
            click_pixel = click_x
        
        # Find closest peak
        distances = np.abs(self.peaks - click_pixel)
        closest_peak_idx = np.argmin(distances)
        
        if closest_peak_idx in self.selected_peak_indices:
            messagebox.showwarning("Peak Already Selected", "This peak is already selected.")
            return
        
        self.selected_peak_indices.append(closest_peak_idx)
        self.plot_data()
        
        if len(self.selected_peak_indices) == 2:
            self.finish_calibration()
    
    def finish_calibration(self):
        """Complete calibration after 2 peaks selected"""
        if self.click_callback_id:
            self.figure1.canvas.mpl_disconnect(self.click_callback_id)
            self.click_callback_id = None
        
        self.calibration_mode = False
        
        p1_idx = self.selected_peak_indices[0]
        p2_idx = self.selected_peak_indices[1]
        p1 = self.peaks[p1_idx]
        p2 = self.peaks[p2_idx]
        
        w1 = simpledialog.askfloat("Calibration - Peak 1", f"Enter wavelength (nm) for peak at pixel {p1:.0f}:")
        if w1 is None:
            self.selected_peak_indices = []
            self.plot_data()
            return
        
        w2 = simpledialog.askfloat("Calibration - Peak 2", f"Enter wavelength (nm) for peak at pixel {p2:.0f}:")
        if w2 is None:
            self.selected_peak_indices = []
            self.plot_data()
            return
        
        try:
            self.calibration_slope, self.calibration_intercept = linear_calibration(p1, w1, p2, w2)
            self.is_calibrated = True
            self.selected_peak_indices = []
            self.plot_data()
            messagebox.showinfo("Calibration Complete", 
                              f"✓ Calibrated!\n\n"
f"Peak 1: {p1:.0f} px → {w1:.1f} nm\n"
                              f"Peak 2: {p2:.0f} px → {w2:.1f} nm\n\n"
                              f"Slope: {self.calibration_slope:.4f} nm/px")
        except Exception as e:
            self.selected_peak_indices = []
            messagebox.showerror("Calibration Error", str(e))
            self.plot_data()
    
    def cancel_calibration(self):
        """Cancel calibration mode"""
        if self.click_callback_id:
            self.figure1.canvas.mpl_disconnect(self.click_callback_id)
            self.click_callback_id = None
        
        self.calibration_mode = False
        self.selected_peak_indices = []
        self.plot_data()

    def reset_action(self):
        self.cancel_calibration()
        self.reset_state()
        self.ax1.clear()
        self.ax2.clear()
        self.chart1.draw()
        self.chart2.draw()
        self.canvas.delete("all")
        if self.original_image is not None:
            self.rotation_angle = 0
            self.current_image = self.original_image.copy()
            self.display_image(self.current_image)

    def reset_state(self):
        self.crop_coords = None
        self.intensity_profile = None
        self.rgb_profiles = None
        self.peaks = None
        self.is_calibrated = False
        self.calibration_slope = 1.0
        self.calibration_intercept = 0.0
        self.selected_peak_indices = []

    def toggle_camera_action(self):
        if self.is_video_active:
            self.stop_camera()
        else:
            self.start_camera()

    def start_camera(self):
        try:
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                raise ValueError("Could not open video device")
            
            self.is_video_active = True
            self.rotation_angle = 0
            self.update_video_frame()
        except Exception as e:
            messagebox.showerror("Camera Error", str(e))

    def stop_camera(self):
        self.is_video_active = False
        if self.video_loop_id:
            self.root.after_cancel(self.video_loop_id)
            self.video_loop_id = None
            
        if self.cap:
            self.cap.release()
            self.cap = None
            
        if self.current_image is not None:
            self.original_image = self.current_image.copy()
            self.reset_state()

    def update_video_frame(self):
        if not self.is_video_active or self.cap is None:
            return
            
        ret, frame = self.cap.read()
        if ret:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            self.original_image = frame_rgb
            self.current_image = frame_rgb.copy()
            self.display_image(self.current_image)
            
        self.video_loop_id = self.root.after(33, self.update_video_frame)

    def __del__(self):
        if self.cap:
            self.cap.release()
