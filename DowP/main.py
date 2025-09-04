import sys
import os
import subprocess
import multiprocessing
import tempfile  
import atexit    
from tkinter import messagebox 
class SingleInstance:
    def __init__(self):
        self.lockfile = os.path.join(tempfile.gettempdir(), 'dowp.lock')
        if os.path.exists(self.lockfile):
            try:
                with open(self.lockfile, 'r') as f:
                    pid = int(f.read())
                if self._is_pid_running(pid):
                    messagebox.showwarning("DowP ya está abierto",
                                           f"Ya hay una instancia de DowP en ejecución (Proceso ID: {pid}).\n\n"
                                           "Por favor, busca la ventana existente.")
                    sys.exit(1)
                else:
                    print("INFO: Se encontró un archivo de cerrojo obsoleto. Eliminándolo.")
                    os.remove(self.lockfile)
            except Exception as e:
                print(f"ADVERTENCIA: No se pudo verificar el archivo de cerrojo. Eliminándolo. ({e})")
                try:
                    os.remove(self.lockfile)
                except OSError:
                    pass
        with open(self.lockfile, 'w') as f:
            f.write(str(os.getpid()))
        atexit.register(self.cleanup)
    def _is_pid_running(self, pid):
        """Comprueba si un proceso con un PID dado está corriendo."""
        if sys.platform == "win32":
            try:
                output = subprocess.check_output(['tasklist', '/fi', f'PID eq {pid}'], 
                                                 stderr=subprocess.STDOUT, text=True, creationflags=0x08000000)
                return str(pid) in output
            except subprocess.CalledProcessError:
                return False
        else: 
            try:
                os.kill(pid, 0)
            except OSError:
                return False
            else:
                return True
    def cleanup(self):
        """Borra el archivo de cerrojo al cerrar."""
        try:
            if os.path.exists(self.lockfile):
                os.remove(self.lockfile)
        except Exception as e:
            print(f"ADVERTENCIA: No se pudo limpiar el archivo de cerrojo: {e}")
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BIN_DIR = os.path.join(PROJECT_ROOT, "bin")
REQUIREMENTS_FILE = os.path.join(PROJECT_ROOT, "requirements.txt")
def install_dependencies():
    """Verifica e instala las dependencias, mostrando una ventana de progreso simple."""
    try:
        import customtkinter
        import flask_socketio
        import gevent
        return True
    except ImportError:
        try:
            from tkinter import Tk, Label
            progress_root = Tk()
            progress_root.title("DowP - Instalando Dependencias")
            win_width = 350
            win_height = 100
            screen_width = progress_root.winfo_screenwidth()
            screen_height = progress_root.winfo_screenheight()
            pos_x = (screen_width // 2) - (win_width // 2)
            pos_y = (screen_height // 2) - (win_height // 2)
            progress_root.geometry(f"{win_width}x{win_height}+{pos_x}+{pos_y}")
            progress_root.resizable(False, False)
            Label(progress_root, text="Primera ejecución: instalando componentes necesarios...\nEsto puede tardar un momento.", padx=20, pady=20).pack()
            progress_root.update()
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", REQUIREMENTS_FILE])
            progress_root.destroy()
            return True
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            messagebox.showerror("Error Crítico de Instalación",
                                 f"No se pudieron instalar las dependencias desde '{REQUIREMENTS_FILE}'.\n\n"
                                 "Asegúrate de que el archivo exista y tengas conexión a internet.\n\n"
                                 f"Error: {e}")
            if 'progress_root' in locals() and progress_root.winfo_exists():
                progress_root.destroy()
            return False
if __name__ == "__main__":
    SingleInstance()
    multiprocessing.freeze_support()
    if PROJECT_ROOT not in sys.path:
        sys.path.insert(0, PROJECT_ROOT)
    if not install_dependencies():
        sys.exit(1)
    if os.path.isdir(BIN_DIR) and BIN_DIR not in os.environ['PATH']:
        os.environ['PATH'] = BIN_DIR + os.pathsep + os.environ['PATH']
    print("Iniciando la aplicación...")
    launch_target = sys.argv[1] if len(sys.argv) > 1 else None
    from src.gui.main_window import MainWindow
    app = MainWindow(launch_target=launch_target)
    app.mainloop()