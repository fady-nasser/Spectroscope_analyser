import tkinter as tk
from gui import SpectrometerGUI

def main():
    root = tk.Tk()
    app = SpectrometerGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
