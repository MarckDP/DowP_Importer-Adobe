# DowP Importer (Adobe)
Una Extensión para After Effects y Premiere Pro que se combina con el DowP para descargar y/o recodificar video y audio e importarlo directamente en un proyecto de Ae o Pr. Tambien hecha con IA xd.

<div align="center">
  <img width="209" height="107" alt="image" src="https://github.com/user-attachments/assets/3364f21d-bcb4-4c96-b554-4776a816c336" /> 
</div>


Esta extensión depende totalemnte de mi otro script, **[DowP](https://github.com/MarckDP/DowP_Downloader)** que esta un poco modificada para poder conectarse a esta extencion mediante un servidor interno.
Con esta extensión, se puede importar directamente al proyecto y/o a la liena de tiempo los archivos que **DowP** descargue/recodifique, toda la configuracion general de la descarga y recodificacion de archivos se tiene que hacer en DowP, la extensión solo toma los archivos finales para importarlos. En si esta hecha para ahorrar un poco de tiempo.

## Caracteristicas.
Cuanta con solo 4 botones y una luz que muestra el estado:
- **Iniciar DowP** "🚀" : Para abrir el DowP desde la extencion sin tener que salir del Pr** o **Ae**.
- **Enlazar y Estados** "🔗" : Para enlazar el DowP al programa en el que se desee importar los archivos. Este boton Cambia constantemente de estado:
   - "⌛" : Buscando o esperando una conexion con el **DowP**
   - "🔒" : La extensión esta conectada a otro programa.
   - "⛓️‍💥" : La extencion se desconecto del **DowP**
   - "✅" : La extencion conectó correctamente al DowP con el programa que se esté suando para importar los archivos.
- **Añadir a la liena de tiempo** "🎬" : Para activar o desactivar la opcion de importar los archivos de video o audio directamente a la linea de tiempo en la posicion en la que esté el cabezal de reproducción.
- **Configurar** "⚙️" : Para buscar y bincular el archvio **"_run_dowp.bat_"** que es el que se conceta al boton de "🚀" para poder abrir el dowp desde al extensión. Siempre se tiene que realizar este paso en ambos programas **(Ae y Pr)**.
## Instalación
Leerán bien, no serán como la vrg...

1. Necesitan tener Python instalado si o si y en el PATH (Esto lo hacen desde el mismo instalador de Python, marcando la dos casilla que aparece en la parte de abajo), si no lo hicieron, desinstalen y vuelvan a instalar xd.

2. Para usar la extensión si o si tienen que abrir el main.py solo la primera vez. En la carpeta del "DowP_1.2" ya tienen lo necesario para iniciar la app de forma INDIVIDUAL y usarla sin Pr o Ae, solo tienen que darle doble clic al archivo "run_dowp.bat" o al "main.py"; el .bat  iniciará la app sin la ventana del CMD y el otro si inicia con una ventana de comandos xd (Si quieren pueden hacer un acceso directo de cualquiera de los dos archivos).

    - La carpeta "com.dowp.importer" deben colocarla en "C:\Program Files\Common Files\Adobe\CEP\extensions" para que tanto Ae como Pr la detecten como una extensión. También es probable que necesiten activar el modo DEBUG de adobe, para eso les dejo el archivo de     "Activar Debug.reg".

3. Dentro de Ae o Pr tienen que ir a las opciones de "Ventana/Extensiones" y ahí encontraran al "DowP Importer", lo activan y lo colocan donde quieran, es una extensión pequeña y puede adaptarse verticalmente.

4. Para vincular el "DowP Importer" con el DowP tienen que darle clic al botón con el ícono de ⚙️ (si están en Pr la ventana del explorador se abrirá detrás del Premiere, tienen que verlo en la barra de tareas para no perderlo) luego buscan la carpeta del DowP_1.2 donde la hayan guardado y seleccionan el "run_dowp.bat". Y YA! eso es todo para tenerlo funcionando. Si por algún motivo les aparece un error, tengan en cuenta que tienen que haber instalado bien el Python y haber abierto el main.py antes de usar la extensión. 

Si llegan a tener problemas, ps… nose jasjjas comenten en algún video o algo, les recomiendo que activen el modo DEBUG para que la extensión funcione correctamente, para eso les dejo el archivo de registro de "Activar Debug" y si ya no lo quieren por algún motivo esta el de "Desactivar Debug" xdxdxd.

Recuerden que tengo un canal donde hago tutoriales para Premiere cada siglo: https://www.youtube.com/@MarckDBM
Para cuando esto salga ya debería tener un video tutorial de como usar, en caso de no tenerlo, reportar el canal por terrorismo: 
