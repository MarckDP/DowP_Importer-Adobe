# DowP Importer (Adobe)

Una extensión para After Effects y Premiere Pro que se integra con DowP para descargar y/o recodificar video y audio e importarlo directamente en un proyecto de Ae o Pr. También hecha con IA xd.

<div align="center">
  <img width="258" height="99" alt="image" src="https://github.com/user-attachments/assets/54475155-0fc2-47cd-93fc-8e1b4f90e891" />
</div>

Esta extensión depende totalmente de mi otro script, **DowP**. Pueden descargar su [**Versión**](https://github.com/MarckDP/DowP_Downloader) o leer el [**Manual de Instalación y Uso**](https://github.com/MarckDP/DowP_Importer-Adobe/blob/main/Manual%20del%20DowP.md) del DowP.

Con esta extensión puedes importar directamente al proyecto y/o a la línea de tiempo los archivos que **DowP** descargue/recodifique. Toda la configuración general de descarga y recodificación se hace en DowP; la extensión solo toma los archivos finales para importarlos. Básicamente está hecha para ahorrarte tiempo.

## Características

Cuenta con solo 5 botones y una luz que muestra el estado:

- **Iniciar DowP** "🚀": Para abrir DowP desde la extensión sin tener que salir de **Pr** o **Ae**.

- **Enlazar y Estados** "🔗": Para enlazar DowP al programa donde quieres importar los archivos. Este botón cambia constantemente de estado:
   - "⌛": Buscando o esperando conexión con **DowP**
   - "🔒": La extensión está conectada a otro programa
   - "⛓️‍💥": La extensión se desconectó de **DowP**
   - "✅": La extensión se conectó correctamente a DowP con el programa que estés usando

- **Añadir a la línea de tiempo** "🎬": Para activar o desactivar la opción de importar archivos de video o audio directamente a la línea de tiempo en la posición donde esté el cabezal de reproducción.

- **Añadir miniatura a la linea de tiempo** "🖼️": Depende totalemnte de la anterior y sirve para decidir si importar o no las miniaturas descargadas a la línea de tiempo.

- **Configurar** "⚙️": Para buscar y vincular el archivo **"DowP.exe"** que se conecta al botón "🚀" para abrir DowP desde la extensión. Siempre hay que realizar este paso en ambos programas **(Ae y Pr)**.

## Instalación
Actualemnte solo necesitan un instalador de archivos **"ZXP"**, pero si lo prefieren ya tengo un video donde hablo sobre su instalación antigua: https://youtu.be/vQj8J0Gr_1I

### Pasos de instalación

1. Descarguen el [DowP](https://github.com/MarckDP/DowP_Downloader) y ubiquenlo donde quieran, les recomiendo colocarlo en alguna carpeta vacía.

2. **Instalar extensión**:
Con algun instalador de ZXP como el [ZXP/UXP Installer](https://aescripts.com/learn/zxp-installer/) o [ZXPInstaller](https://zxpinstaller.com/) instalen el "DowP_Importer_x.x.x.zxp" y ya. Pero si prefieren pueden hacerlo con el método manual:

**Manualmente:**
   - Coloca la carpeta `"com.dowp.importer"` en: 
   
     ```
     C:\Program Files\Common Files\Adobe\CEP\extensions
     ```
   - Es probable que necesites activar el modo DEBUG de Adobe. Para eso usa el archivo `"Activar Debug.reg"` incluido.

4. **Activar en Adobe**: 
   - En Ae o Pr ve a **Ventana → Extensiones** 
   - Encontrarás "DowP Importer", actívalo y colócalo donde quieras
   - Es una extensión pequeña que se adapta tanto horizontalmente como verticalmente

5. **Vincular con DowP**: 
   - Clic en el botón ⚙️ 
   - *Nota: En Pr la ventana del explorador se abrirá detrás del programa, búscala en la barra de tareas*
   - Busca el .exe del DowP donde lo hayas guardado
   - Selecciona DowP.exe
   - **¡Y YA!** Eso es todo para tenerlo funcionando.

---

**Mi canal de YouTube** (tutoriales de Premiere cada siglo): https://www.youtube.com/@MarckDBM
