# DowP Importer (Adobe)

Una extensión para After Effects y Premiere Pro que se integra con DowP para descargar y/o recodificar video y audio e importarlo directamente en un proyecto de Ae o Pr. También hecha con IA xd.

<div align="center">
  <img width="209" height="107" alt="DowP Importer Logo" src="https://github.com/user-attachments/assets/3364f21d-bcb4-4c96-b554-4776a816c336" /> 
</div>

Esta extensión depende totalmente de mi otro script, **DowP**. Pueden descargar su [**Versión**](https://github.com/MarckDP/DowP_Downloader) que no se conecta a la extensión o leer el [**Manual de Instalación y Uso**](https://github.com/MarckDP/DowP_Importer-Adobe/blob/main/Manual%20del%20DowP.md) del DowP.

Con esta extensión puedes importar directamente al proyecto y/o a la línea de tiempo los archivos que **DowP** descargue/recodifique. Toda la configuración general de descarga y recodificación se hace en DowP; la extensión solo toma los archivos finales para importarlos. Básicamente está hecha para ahorrarte tiempo.

## Características

Cuenta con solo 4 botones y una luz que muestra el estado:

- **Iniciar DowP** "🚀": Para abrir DowP desde la extensión sin tener que salir de **Pr** o **Ae**.

- **Enlazar y Estados** "🔗": Para enlazar DowP al programa donde quieres importar los archivos. Este botón cambia constantemente de estado:
   - "⌛": Buscando o esperando conexión con **DowP**
   - "🔒": La extensión está conectada a otro programa
   - "⛓️‍💥": La extensión se desconectó de **DowP**
   - "✅": La extensión se conectó correctamente a DowP con el programa que estés usando

- **Añadir a la línea de tiempo** "🎬": Para activar o desactivar la opción de importar archivos de video o audio directamente a la línea de tiempo en la posición donde esté el cabezal de reproducción.

- **Configurar** "⚙️": Para buscar y vincular el archivo **"run_dowp.bat"** que se conecta al botón "🚀" para abrir DowP desde la extensión. Siempre hay que realizar este paso en ambos programas **(Ae y Pr)**.

## Instalación

Ya tengo un video donde hablo sobre su instalación: https://youtu.be/vQj8J0Gr_1I

### Requisitos previos
1. **Python**: Necesitas tener Python instalado SÍ O SÍ y en el PATH. Esto lo haces desde el mismo instalador de Python marcando las dos casillas que aparecen abajo. Si no lo hiciste, desinstala y vuelve a instalar xd.

### Pasos de instalación

1. **Primera ejecución**: Para usar la extensión TIENES que abrir `main.pyw` o el `main.py` SOLO LA PRIMERA VEZ en la carpeta de "DowP". El DowP ya tiene lo necesario para iniciar como app de forma individual y usarla sin Pr o Ae:
   - Doble clic a `"run_dowp.bat"` → Trata de abrir al app sin consola, si no logra, la abrirá con la consola.
   *Tip: Puedes hacer un acceso directo de cualquiera de los dos archivos: `"run_dowp.bat"`, `"main.py"` ó `"main.pyw"`.*

2. **Instalar extensión**: 
   - Coloca la carpeta `"com.dowp.importer"` en: 
     ```
     C:\Program Files\Common Files\Adobe\CEP\extensions
     ```
   - Es probable que necesites activar el modo DEBUG de Adobe. Para eso usa el archivo `"Activar Debug.reg"` incluido.

3. **Activar en Adobe**: 
   - En Ae o Pr ve a **Ventana → Extensiones** 
   - Encontrarás "DowP Importer", actívalo y colócalo donde quieras
   - Es una extensión pequeña que se adapta tanto horizontalmente como verticalmente

4. **Vincular con DowP**: 
   - Clic en el botón ⚙️ 
   - *Nota: En Pr la ventana del explorador se abrirá detrás del programa, búscala en la barra de tareas*
   - Busca la carpeta DowP_1.2 donde la hayas guardado
   - Selecciona `"run_dowp.bat"`
   - **¡Y YA!** Eso es todo para tenerlo funcionando.

## Solución de problemas

Si tienes errores, asegúrate de que:
- Python esté instalado correctamente
- Hayas abierto `main.pyw` o `main.py` antes de usar la extensión
- Tengas el modo DEBUG activado

Si sigues teniendo problemas... pues no sé jasjjas, comenta en algún video o algo.

---

**Mi canal de YouTube** (tutoriales de Premiere cada siglo): https://www.youtube.com/@MarckDBM

Para cuando esto salga ya debería tener un video tutorial de cómo usar. En caso de no tenerlo, reportar el canal por terrorismo 🤣
