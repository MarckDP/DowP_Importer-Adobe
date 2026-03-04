# DowP Importer (Adobe)

Una extensión para After Effects y Premiere Pro que se integra con DowP para descargar y/o recodificar video y audio e importarlo directamente en un proyecto de Ae o Pr. También hecha con IA xd.

<div align="center">
  <img width="258" height="99" alt="image" src="https://github.com/user-attachments/assets/54475155-0fc2-47cd-93fc-8e1b4f90e891" />
</div>

Esta extensión depende totalmente de mi otro script, [**DowP**](https://github.com/MarckDP/DowP_Downloader).

Con esta extensión puedes importar directamente al proyecto y/o a la línea de tiempo los archivos que **DowP** descargue/recodifique. Toda la configuración general de descarga y recodificación se hace en DowP; la extensión solo toma los archivos finales para importarlos. Básicamente está hecha para ahorrarte tiempo.

## Características

Cuenta con 6 botones y una luz que muestra el estado:

- **Iniciar DowP** "🚀": Para abrir DowP desde la extensión sin tener que salir de **Pr** o **Ae**.

- **Enlazar y Estados** "🔗": Para enlazar DowP al programa donde quieres importar los archivos. Este botón cambia constantemente de estado:
   - "⌛": Buscando o esperando conexión con **DowP**
   - "🔒": La extensión está conectada a otro programa
   - "⛓️‍💥": La extensión se desconectó de **DowP**
   - "✅": La extensión se conectó correctamente a DowP con el programa que estés usando

- **Enviar selección a DowP** "📤": Para enviar los archivos que tengas seleccionados en el panel de proyecto o en la línea de tiempo de **Pr** o **Ae** directamente a DowP para procesarlos o recodificarlos.

- **Añadir a la línea de tiempo** "🎬": Para activar o desactivar la opción de importar archivos de video o audio directamente a la línea de tiempo en la posición donde esté el cabezal de reproducción.

- **Añadir miniatura a la linea de tiempo** "🖼️": Depende totalemnte de la anterior y sirve para decidir si importar o no las miniaturas descargadas a la línea de tiempo.

- **Configurar** "⚙️": Para buscar y vincular el archivo **"DowP.exe"** que se conecta al botón "🚀" para abrir DowP desde la extensión. Siempre hay que realizar este paso en ambos programas **(Ae y Pr)**.

## Instalación

### Pasos de instalación

- **Instalador Automático (Recomendado):**
   Descarga el instalador completo desde el repositorio de [**DowP**](https://github.com/MarckDP/DowP). Este instalador configura automáticamente tanto el programa como la extensión.

- **Instalación Manual:**
1. Si prefieres no usar el instalador, descarga la carpeta `"com.dowp.importer"` de este repositorio y realiza lo siguiente:
   - Coloca la carpeta en la ruta: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions`
   - Ejecuta el archivo `"Activar Debug.reg"` incluido para habilitar el modo DEBUG de Adobe.

2. **Activar en Adobe:**
   - En After Effects o Premiere Pro, ve a **Ventana → Extensiones → DowP Importer**.
   - La extensión es responsiva y se adapta a cualquier tamaño de panel.

3. **Vincular con DowP:**
   - Haz clic en el botón **⚙️**.
   - Selecciona el archivo **"DowP.exe"** en la ubicación donde lo tengas guardado.
   - *Nota: En Premiere Pro, es posible que la ventana del explorador de archivos se abra detrás del programa; búscala en la barra de tareas.*

---

**Mi canal de YouTube** (tutoriales de Premiere cada siglo): https://www.youtube.com/@MarckDBM
