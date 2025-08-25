window.onload = function() {
    const csInterface = new CSInterface();
    const serverUrl = "http://127.0.0.1:7788";
    let thisAppName = "Desconocido";
    let thisAppIdentifier = "unknown";
    let socket = null;
    const statusIndicator = document.getElementById('status-indicator');
    const logText = document.getElementById('log-text');
    const btnLink = document.getElementById('btn-check');
    const btnLaunch = document.getElementById('btn-launch');
    const btnSettings = document.getElementById('btn-settings');
    const storage = {
        getDowpPath: () => localStorage.getItem('dowpPath'),
        setDowpPath: (path) => localStorage.setItem('dowpPath', path)
    };
    function connectToServer() {
        if (socket && socket.connected) return;
        logText.textContent = "Conectando con DowP...";
        socket = io(serverUrl, {
            transports: ['websocket'],
            reconnectionAttempts: 5
        });
        socket.on('connect', () => {
        socket.emit('register', { appIdentifier: thisAppIdentifier });
        });
        socket.on('connect_error', (err) => {
            statusIndicator.className = 'disconnected'; 
            logText.textContent = "Error: DowP no está abierto o está bloqueado.";
        });
        socket.on('disconnect', () => {
            statusIndicator.className = 'disconnected'; 
            logText.textContent = "Desconectado de DowP.";
        });
        socket.on('active_target_update', (data) => {
            const activeTarget = data.activeTarget;
            if (!activeTarget) {
                statusIndicator.className = 'linked-elsewhere';
                logText.textContent = "Conectado. Haz clic en 🔗 para enlazar.";
            } else if (activeTarget === thisAppIdentifier) {
                statusIndicator.className = 'connected';
                logText.textContent = `✓ Enlazado con ${thisAppName}.`;
            } else {
                statusIndicator.className = 'linked-elsewhere';
                const otherAppName = activeTarget.charAt(0).toUpperCase() + activeTarget.slice(1);
                logText.textContent = `Enlazado con ${otherAppName}.`;
            }
        });
        socket.on('new_file', (data) => {
            if (data.filePackage) {
                importFileToProject(data.filePackage);
            }
        });
    }
    function linkToThisApp() {
        if (socket && socket.connected) {
            socket.emit('set_active_target', { targetApp: thisAppIdentifier });
        } else {
            logText.textContent = "No se puede enlazar. No hay conexión con DowP.";
        }
    }
    function importFileToProject(filePackage) {
        const filesToImport = [];
        if (filePackage.video) filesToImport.push(filePackage.video);
        if (filePackage.thumbnail) filesToImport.push(filePackage.thumbnail);
        if (filePackage.subtitle) filesToImport.push(filePackage.subtitle);
        if (filesToImport.length === 0) {
            logText.textContent = "Error: No se encontraron archivos para importar.";
            return;
        }
        logText.textContent = `Importando ${filesToImport.length} archivo(s)...`;
        const fileListJSON = JSON.stringify(filesToImport);
        csInterface.evalScript(`importFiles(${fileListJSON})`, (result) => {
            if (result === "success") {
                logText.textContent = "¡Importado con éxito!";
            } else {
                logText.textContent = `Error al importar: ${result}`;
            }
        });
    }
    function setDowPPath() {
        logText.textContent = "Selecciona el script lanzador (run_dowp.bat o .sh)...";
        csInterface.evalScript('selectDowPExecutable()', (result) => {
            if (result && result !== "cancel") {
                storage.setDowpPath(result);
                logText.textContent = `Ruta guardada.`;
                connectToServer();
            } else {
                logText.textContent = "Configuración cancelada.";
            }
        });
    }
    function launchDowP() {
    const path = storage.getDowpPath();
    if (path) {
        statusIndicator.className = 'loading';
        logText.textContent = "Iniciando DowP...";
        const safePath = path.replace(/\\/g, '\\\\');
        csInterface.evalScript(`executeDowP("${safePath}", "${thisAppIdentifier}")`);
        setTimeout(connectToServer, 2000); 
    } else {
        logText.textContent = "Primero configura la ruta de DowP con el icono ⚙️.";
    }
}
    function initializeApp() {
        csInterface.evalScript('getHostAppName()', (result) => {
            if (result && result !== "unknown") {
                thisAppName = result.replace("Adobe ", "");
                thisAppIdentifier = thisAppName.toLowerCase().replace(" pro", "").replace(" ", "");
            }
            if (storage.getDowpPath()) {
                connectToServer();
                setInterval(() => {
                    if (!socket || !socket.connected) {
                        connectToServer();
                    } else {
                        socket.emit('get_active_target');
                    }
                }, 5000);
            } else {
                logText.textContent = `Hola, haz clic en ⚙️ para configurar DowP.`;
            }
        });
    }
    btnLink.onclick = linkToThisApp;
    btnLaunch.onclick = launchDowP;
    btnSettings.onclick = setDowPPath;
    initializeApp();

};
