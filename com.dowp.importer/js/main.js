window.onload = function() {
    const csInterface = new CSInterface();
    const CURRENT_EXTENSION_VERSION = "1.1.8";
    const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/MarckDP/DowP_Importer-Adobe/refs/heads/main/update.json";
    const serverUrl = "http://127.0.0.1:7788";
    let thisAppName = "Desconocido";
    let thisAppIdentifier = "unknown";
    let socket = null;
    let toggleLinked = false;

    let isSocketRegistered = false;
    let isConnectingAttempt = false;

    let lastTimelineState = null;
    let checkingTimeline = false;
    let lastTimelineCheck = 0;
    const TIMELINE_CHECK_INTERVAL = 1500; // Debounce: verificar cada 1.5 segundos máximo
    
    // Para After Effects: ignorar cambios momentáneos de focus al panel de proyecto
    let lastSuccessfulTimelineCheck = null;
    let timelineCheckFailureCount = 0;

    let currentState = 'unconfigured';
    let isLaunching = false;
    let launchTimeout = null;
    let unlinkingTimeout = null;

    let messageQueue = [];
    let currentMessageType = 'info';
    let messageTimeout = null;
    let isShowingPersistentMessage = false;

    let isUpdateNoticeActive = false;
    let updateManifestData = null;
    let updateNoticeTimeout = null;

    const statusIndicator = document.getElementById('status-indicator');
    const logText = document.getElementById('log-text');
    const btnLink = document.getElementById('btn-check');
    const btnLaunch = document.getElementById('btn-launch');
    const btnSettings = document.getElementById('btn-settings');
    const addToTimelineCheckbox = document.getElementById('add-to-timeline-checkbox');
    const addToTimelineContainer = document.getElementById('add-to-timeline-container');
    const importImagesCheckbox = document.getElementById('import-images-checkbox');
    const importImagesContainer = document.getElementById('import-images-container');

    const storage = {
        getDowpPath: () => {
            return new Promise((resolve) => {
                csInterface.evalScript('loadConfig("dowpPath")', (result) => {
                    if (result && result !== "null" && result !== "") {
                        resolve(result);
                    } else {
                        const legacy = localStorage.getItem('dowpPath');
                        if (legacy) {
                            storage.setDowpPath(legacy);
                            resolve(legacy);
                        } else {
                            resolve(null);
                        }
                    }
                });
            });
        },
        
        setDowpPath: (path) => {
            return new Promise((resolve) => {
                csInterface.evalScript(`saveConfig("dowpPath", "${path.replace(/\\/g, '\\\\')}")`, (result) => {
                    if (result === "success") {
                        localStorage.setItem('dowpPath', path);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            });
        }
    };

    function showMessage(text, type = 'info', persistent = false, duration = 0) {
        const DEFAULT_PERSISTENT_TIMEOUT = 8000;

        currentMessageType = type;
        logText.textContent = text;

        if (messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }

        if (persistent) {
            isShowingPersistentMessage = true;
            const wait = (duration && duration > 0) ? duration : DEFAULT_PERSISTENT_TIMEOUT;
            messageTimeout = setTimeout(() => {
                isShowingPersistentMessage = false;
                messageTimeout = null;
                try { updateStatusMessage(); } catch (e) {}
            }, wait);
        } else {
            if (duration && duration > 0) {
                messageTimeout = setTimeout(() => {
                    if (logText.textContent === text) logText.textContent = '';
                    messageTimeout = null;
                    try { updateStatusMessage(); } catch (e) {}
                }, duration);
            } else {
            }
        }
    }

    function updateStatusMessage() {
        if (isShowingPersistentMessage) return;

        if (isUpdateNoticeActive) {
            return;
        }
            
        switch (currentState) {
            case 'unconfigured':
                showMessage(`Hola, haz clic en ⚙️ para configurar DowP.`, 'info');
                break;
            case 'connecting':
                showMessage("Conectando con DowP...", 'info');
                break;
            case 'connected':
                showMessage(`✓ Enlazado con ${thisAppName}.`, 'success');
                break;
            case 'linked-elsewhere':
                showMessage("Conectado. Haz clic en 🔗 para enlazar.", 'info');
                break;
            case 'linked-other-app':
                const activeTarget = socket?.lastActiveTarget || 'otra aplicación';
                const otherAppName = activeTarget.charAt(0).toUpperCase() + activeTarget.slice(1);
                showMessage(`Enlazado con ${otherAppName}.`, 'warning');
                break;
            case 'dowp-closed':
                showMessage("DowP no está abierto.", 'warning');
                break;
            case 'disconnected':
            default:
                if (storage.getDowpPath()) {
                    showMessage("DowP no está abierto.", 'warning');
                } else {
                    showMessage(`Hola, haz clic en ⚙️ para configurar DowP.`, 'info');
                }
                break;
        }
    }

    function clearUpdateNotice() {
        if (isUpdateNoticeActive) {
            isUpdateNoticeActive = false;
            if (updateNoticeTimeout) {
                clearTimeout(updateNoticeTimeout);
                updateNoticeTimeout = null;
            }
            updateStatusMessage(); 
        }
    }

    function updateStatusIndicator() {
        let className = currentState;
        
        if (isLaunching) {
            className = 'launching';
        } else if (currentState === 'linked-other-app') {
            className = 'linked-elsewhere';
        }
        
        statusIndicator.className = className;
    }
    function setState(newState, data = null) {
        const previousState = currentState;
        currentState = newState;

        if (newState === 'launching') {
            updateStatusIndicator();
            showMessage("Iniciando DowP...", 'info');
            return; 
        }
        
        if (data && socket) {
            socket.lastActiveTarget = data.activeTarget;
        }
        
        if (previousState !== newState || newState === 'linked-elsewhere') {
            updateStatusIndicator();
            updateStatusMessage();
        }
    }

    function setLinkButtonState(state) {
    const btn = document.getElementById('btn-check');
    if (!btn) return;

    btn.classList.remove('state-disconnected','state-connecting','state-connected','state-linked-other','state-linked-me');
    btn.setAttribute('aria-pressed', 'false');

    switch(state) {
        case 'disconnected':
        btn.classList.add('state-disconnected');
        btn.title = 'DowP no está abierto';
        btn.innerHTML = '<span class="icon">⛔️👥</span>';
        break;
        case 'connecting':
        btn.classList.add('state-connecting');
        btn.title = 'Conectando a DowP...';
        btn.innerHTML = '<span class="icon">⏳</span>';
        break;
        case 'connected':
        btn.classList.add('state-connected');
        btn.title = 'Conectado – pulsa para enlazar';
        btn.innerHTML = '<span class="icon">🔗</span>';
        break;
        case 'linked-other':
        btn.classList.add('state-linked-other');
        btn.title = 'Enlazado en otra aplicación';
        btn.innerHTML = '<span class="icon">🔐</span>';
        break;
        case 'linked-me':
        btn.classList.add('state-linked-me');
        btn.title = 'Enlazado contigo';
        btn.innerHTML = '<span class="icon">✅</span>';
        break;
        default:
        btn.classList.add('state-disconnected');
        btn.title = '';
        btn.innerHTML = '<span class="icon">❓</span>';
    }
    }

    function setLaunchButtonState(state) {
    const btn = document.getElementById('btn-launch');
    if (!btn) return;
    btn.classList.remove('state-open','state-closed');

    if (state === 'open') {
        btn.classList.add('state-open');
        btn.title = 'DowP abierto';
        btn.setAttribute('aria-pressed', 'true');
    } else {
        btn.classList.add('state-closed');
        btn.title = 'Iniciar DowP';
        btn.setAttribute('aria-pressed', 'false');
    }
    }

    function _resolveTimelineElement() {
        return addToTimelineContainer || document.getElementById('add-to-timeline-container') || null;
    }

    function setTimelineActiveState(active, options = {}) {
        const el = _resolveTimelineElement();
        if (!el) return;

        el.classList.remove('glow-active', 'glow-strong', 'glow-pulse');

        const isStrong = options.strong || false;
        if (active && isStrong) {
            el.classList.add('glow-active', 'glow-strong', 'glow-pulse');
        }
    }

    function connectToServer() {
        if (socket && (socket.connected || socket.connecting)) return; // <-- Mejora esta línea
        if (isConnectingAttempt) return; // <-- AÑADE ESTA LÍNEA (El guardián)
        
        isConnectingAttempt = true; // <-- AÑADE ESTA LÍNEA (Activa el lock)

        if (!isLaunching) {
            isShowingPersistentMessage = false;
            setState('connecting');
            updateStatusMessage();
            setLinkButtonState('connecting');
        }
        socket = io(serverUrl, {
            transports: ['websocket'],
            reconnectionAttempts: 5
        });
        
        socket.on('connect', () => {
            isConnectingAttempt = false;
            if (isLaunching) {
                isLaunching = false;
                if (launchTimeout) {
                    clearTimeout(launchTimeout);
                    launchTimeout = null;
                }
                showMessage("¡DowP iniciado correctamente!", 'success', true, 3000);
            }
            
            // ✅ Solo registrar UNA VEZ por sesión de conexión
            if (!isSocketRegistered) {
                socket.emit('register', { appIdentifier: thisAppIdentifier });
                isSocketRegistered = true;
            }
            
            setLaunchButtonState('open');
            setLinkButtonState('connected');
            setLaunchButtonState('open'); 
            setTimeout(() => {
                socket.emit('get_active_target');
            }, 500);
        });
        
        socket.on('connect_error', (err) => {
            if (!isLaunching) {
                setState('dowp-closed');
            }
            setLaunchButtonState('closed');
        });

        socket.on('reconnect_failed', () => {
            isConnectingAttempt = false; // <-- Libera el lock en el fallo FINAL
            console.error("Socket.io: All reconnection attempts failed.");
            setState('dowp-closed');
            setLaunchButtonState('closed');
        });
        
        socket.on('disconnect', () => {
            isSocketRegistered = false;  // ← Resetear para la próxima reconexión
            toggleLinked = false;
            isShowingPersistentMessage = false;
            if (!isLaunching) {
                setState('disconnected');
            }
            setLinkButtonState('disconnected');
            setLaunchButtonState('closed');
        });
        
        socket.on('active_target_update', (data) => {
            if (unlinkingTimeout) {
                clearTimeout(unlinkingTimeout);
                unlinkingTimeout = null;
            }
            const activeTarget = data.activeTarget;
            if (!activeTarget) {
                toggleLinked = false;
                setState('linked-elsewhere', data);   
                setLinkButtonState('connected');
            } else if (activeTarget === thisAppIdentifier) {
                toggleLinked = true;
                setState('connected', data);          
                setLinkButtonState('linked-me');
            } else {
                toggleLinked = false;
                setState('linked-other-app', data);   
                setLinkButtonState('linked-other');
            }
        });

        socket.on('new_file', (data) => {
            if (data.filePackage) {
                importFileToProject(data.filePackage);
            }
        });
    }

    function linkToThisApp() {
        clearUpdateNotice();
        if (!socket || !socket.connected) {
            showMessage("Conectando y enlazando...", 'info', true);
            setLinkButtonState('connecting');

            socket.once('connect', () => {
                socket.emit('set_active_target', { targetApp: thisAppIdentifier });
            });

            connectToServer();
            return; 
        }

        if (toggleLinked) {
            unlinkingTimeout = setTimeout(() => {
                showMessage('Desvinculando...', 'info', true, 2000);
            }, 500); 
            socket.emit('clear_active_target');
            return;
        }

        socket.emit('set_active_target', { targetApp: thisAppIdentifier });
        setLinkButtonState('connecting'); 
    }

    function importFileToProject(filePackage) {
        // 1. Extraer el nombre de la papelera (bin) de destino del paquete
        const targetBinName = filePackage.targetBin || null;
        
        // ✅ NUEVA LÓGICA: Detectar tipo por extensión
        const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|flac|aac|ogg|opus|weba)$/i;
        const VIDEO_EXTENSIONS = /\.(mp4|mkv|webm|mov|avi|flv|wmv|m4v)$/i;
        const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i;
        const SUBTITLE_EXTENSIONS = /\.(srt|vtt|ass|ssa|sub)$/i;

        const classifyFile = (path) => {
            if (AUDIO_EXTENSIONS.test(path)) return 'audio';
            if (VIDEO_EXTENSIONS.test(path)) return 'video';
            if (IMAGE_EXTENSIONS.test(path)) return 'image';
            if (SUBTITLE_EXTENSIONS.test(path)) return 'subtitle';
            return 'unknown';
        };

        const filesToImport = [];
        let hasAudio = false;
        let hasVideo = false;
        let hasImage = false;

        // ✅ MEJORADO: Clasificar cada archivo por extensión
        if (filePackage.video) {
            const type = classifyFile(filePackage.video);
            console.log("filePackage.video clasificado como:", type, filePackage.video);
            
            if (type === 'audio') {
                hasAudio = true;
                filesToImport.push(filePackage.video);
            } else if (type === 'video') {
                hasVideo = true;
                filesToImport.push(filePackage.video);
            } else if (type === 'image') {
                hasImage = true;
                filesToImport.push(filePackage.video);
            }
        }

        if (filePackage.thumbnail) {
            const type = classifyFile(filePackage.thumbnail);
            console.log("filePackage.thumbnail clasificado como:", type, filePackage.thumbnail);
            
            if (type !== 'subtitle') {
                filesToImport.push(filePackage.thumbnail);
                if (type === 'image') hasImage = true;
            }
        }

        if (filePackage.subtitle) {
            const type = classifyFile(filePackage.subtitle);
            console.log("filePackage.subtitle clasificado como:", type, filePackage.subtitle);
            
            if (type === 'subtitle') {
                filesToImport.push(filePackage.subtitle);
            }
        }

        console.log("Clasificación final - Audio:", hasAudio, "Video:", hasVideo, "Image:", hasImage);
        console.log("Archivos a importar:", filesToImport);

        if (filesToImport.length === 0) {
            // ✅ Si no encontramos nada, verifica si hay ALGO en filePackage
            console.error("ERROR: filesToImport está vacío");
            console.error("filePackage.video:", filePackage.video);
            console.error("filePackage.thumbnail:", filePackage.thumbnail);
            console.error("filePackage.subtitle:", filePackage.subtitle);
            console.error("filePackage completo:", JSON.stringify(filePackage));
            showMessage("Error: DowP no envió ningún archivo. Verifica que la descarga fue exitosa.", 'error', true, 5000);
            return;
        }

        showMessage(`Importando ${filesToImport.length} archivo(s)...`, 'info', true);
        
        // ✅ SEGURIDAD: Escapar correctamente
        const escapeForExtendScript = (str) => {
            return str
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'");
        };
        
        const fileListJSON = JSON.stringify(filesToImport);
        const escapedJSON = escapeForExtendScript(fileListJSON);
        
        const shouldAddToTimeline = addToTimelineCheckbox.checked;
        const shouldImportImages = importImagesCheckbox.checked;

        // 2. Preparar el nombre de la papelera para ExtendScript (será null o "nombre")
        const escapedBinName = targetBinName ? `"${escapeForExtendScript(targetBinName)}"` : "null";

        if (shouldAddToTimeline) {
            csInterface.evalScript('getActiveTimelineInfo()', (result) => {
                try {
                    const timelineInfo = JSON.parse(result);
                    if (timelineInfo.hasActiveTimeline) {
                        console.log("Timeline activa encontrada. Playhead:", timelineInfo.playheadTime);
                        csInterface.evalScript(
                            `importFiles("${escapedJSON}", true, ${timelineInfo.playheadTime}, ${shouldImportImages}, ${escapedBinName})`, // <-- AÑADIDO
                            (importResult) => {
                                console.log("Resultado de importación:", importResult);
                                handleImportResult(importResult);
                            }
                        );
                    } else {
                        showMessage("Error: No hay secuencia/composición activa.", 'error', true, 5000);
                        console.error("No timeline activa");
                    }
                } catch (e) {
                    showMessage(`Error al procesar timeline: ${e.message}`, 'error', true, 5000);
                    console.error("Error procesando timeline:", e);
                }
            });
        } else {
            console.log("Importando sin timeline, archivo(s):", filesToImport);
            csInterface.evalScript(
                `importFiles("${escapedJSON}", false, 0, ${shouldImportImages}, ${escapedBinName})`, // <-- AÑADIDO
                (importResult) => {
                    console.log("Resultado de importación (sin timeline):", importResult);
                    handleImportResult(importResult);
                }
            );
        }
    }

    function handleImportResult(result) {
        if (result === "success") {
            showMessage("¡Importado con éxito!", 'success', true, 3000);
        } else {
            showMessage(`Error al importar: ${result}`, 'error', true, 6000);
        }
    }

    async function setDowPPath() {
        clearUpdateNotice();
        showMessage("Selecciona el ejecutable de DowP (DowP.exe)", 'info', true);
        csInterface.evalScript('selectDowPExecutable()', async (result) => {
            if (result && result !== "cancel") {
                const saved = await storage.setDowpPath(result);
                if (saved) {
                    showMessage(`Ruta guardada correctamente.`, 'success', true, 3000);
                    btnLaunch.classList.remove('is-disabled');
                    btnLink.classList.remove('is-disabled');
                    setState('disconnected');
                    connectToServer();
                } else {
                    showMessage(`Error al guardar la configuración.`, 'error', true, 5000);
                }
            } else {
                showMessage("Configuración cancelada.", 'warning', true, 3000);
            }
        });
    }

    async function launchDowP() {
        clearUpdateNotice();
        const path = await storage.getDowpPath();
        if (!path) {
            showMessage("Primero configura la ruta de DowP con el icono ⚙️.", 'error', true, 5000);
            return;
        }

        isLaunching = true;
        setState('launching');
        
        const safePath = path.replace(/\\/g, '\\\\');
        csInterface.evalScript(`executeDowP("${safePath}", "${thisAppIdentifier}")`);
        
        setTimeout(() => {
            connectToServer();
        }, 2000);
        
        launchTimeout = setTimeout(() => {
            if (isLaunching) {
                isLaunching = false;
                showMessage("Timeout al iniciar DowP. Verifica que la ruta sea correcta.", 'error', true, 8000);
                setState('disconnected');
            }
        }, 30000);
    }

    function checkActiveTimeline() {
        const now = Date.now();
        
        // Debounce: solo ejecutar si ha pasado suficiente tiempo desde la última verificación
        if (now - lastTimelineCheck < TIMELINE_CHECK_INTERVAL) {
            return;
        }
        lastTimelineCheck = now;
        
        if (checkingTimeline) return;
        
        checkingTimeline = true;
        
        const timeoutId = setTimeout(() => {
            checkingTimeline = false;
            updateTimelineState(false);
        }, 1000);
        
        csInterface.evalScript('getActiveTimelineInfo()', (result) => {
            clearTimeout(timeoutId);
            checkingTimeline = false;
            
            try {
                const info = JSON.parse(result);
                
                // Si AHORA hay timeline activa, resetear contador de fallos
                if (info.hasActiveTimeline) {
                    lastSuccessfulTimelineCheck = info;
                    timelineCheckFailureCount = 0;
                    updateTimelineState(true);
                } else {
                    // Si NO hay timeline, pero hace poco SÍ la había, ignorar cambio momentáneo
                    if (lastSuccessfulTimelineCheck && timelineCheckFailureCount < 5) {
                        timelineCheckFailureCount++;
                        // Mantener el estado anterior, NO desactivar
                        return;
                    }
                    // Si han sido 2+ fallos consecutivos, ENTONCES desactivar
                    timelineCheckFailureCount = 0;
                    lastSuccessfulTimelineCheck = null;
                    updateTimelineState(false);
                }
            } catch (e) {
                updateTimelineState(false);
            }
        });
    }

    function updateTimelineState(hasActiveTimeline) {
        if (lastTimelineState === hasActiveTimeline) return;

        lastTimelineState = hasActiveTimeline;
        addToTimelineCheckbox.disabled = !hasActiveTimeline;

        if (hasActiveTimeline) {
            addToTimelineContainer.title = "Añadir a la línea de tiempo activa";
        } else {
            addToTimelineContainer.title = "No hay una secuencia/composición activa";
            if (addToTimelineCheckbox.checked) {
                addToTimelineCheckbox.checked = false;
                addToTimelineCheckbox.dispatchEvent(new Event('change'));
            }
        }

        setTimelineActiveState(hasActiveTimeline, { strong: addToTimelineCheckbox.checked });
    }


    function setupEventListeners() {
        window.addEventListener('focus', () => {
            checkActiveTimeline();
        });
        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkActiveTimeline();
            }
        });

        // Nueva verificación cuando el usuario interactúa con el checkbox
        addToTimelineCheckbox.addEventListener('click', () => {
            checkActiveTimeline();
        });
    }

    addToTimelineCheckbox.addEventListener('change', () => {
        const isChecked = addToTimelineCheckbox.checked;

        importImagesCheckbox.disabled = !isChecked;

        if (isChecked) {
            addToTimelineContainer.classList.add('is-active');
            importImagesContainer.classList.remove('is-disabled');
        } else {
            addToTimelineContainer.classList.remove('is-active');
            importImagesContainer.classList.add('is-disabled');
            if (importImagesCheckbox.checked) {
                importImagesCheckbox.checked = false;
                importImagesCheckbox.dispatchEvent(new Event('change'));
            }
        }
        setTimelineActiveState(lastTimelineState, { strong: isChecked });
    });

    importImagesCheckbox.addEventListener('change', () => {
        if (importImagesCheckbox.checked) {
            importImagesContainer.classList.add('is-active');
        } else {
            importImagesContainer.classList.remove('is-active');
        }
    });

    function compareVersions(currentVersion, remoteVersion) {
        console.log(`Comparando versiones: actual=${currentVersion}, remota=${remoteVersion}`);
        
        const current = currentVersion.split('.').map(Number);
        const remote = remoteVersion.split('.').map(Number);
        const maxLength = Math.max(current.length, remote.length);

        for (let i = 0; i < maxLength; i++) {
            const currentPart = current[i] || 0;
            const remotePart = remote[i] || 0;
            
            if (remotePart > currentPart) {
                console.log(`Nueva versión disponible: ${remoteVersion} > ${currentVersion}`);
                return 1; 
            }
            if (currentPart > remotePart) {
                console.log(`Versión actual es más nueva: ${currentVersion} > ${remoteVersion}`);
                return -1; 
            }
        }
        
        console.log(`Versiones iguales: ${currentVersion} = ${remoteVersion}`);
        return 0;
    }

    function showUpdateNotification() {
        console.log("Mostrando notificación de actualización:", updateManifestData);
        
        const logArea = document.getElementById('log-text');
        if (!logArea) {
            console.error("No se encontró el elemento log-text");
            return;
        }

        if (updateNoticeTimeout) {
            clearTimeout(updateNoticeTimeout);
        }
        isUpdateNoticeActive = true;

        const updateMessage = `✨ ¡Versión ${updateManifestData.extension_version} disponible! <a href="#" id="update-link" style="color: #0066cc; text-decoration: underline;">Descargar</a>`;
        
        logArea.innerHTML = updateMessage;
        
        const updateLink = document.getElementById('update-link');
        if (updateLink) {
            updateLink.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("Abriendo URL de descarga:", manifest.release_notes_url || manifest.download_url);
                clearUpdateNotice(); 
                const urlToOpen = updateManifestData.release_notes_url || updateManifestData.download_url || updateManifestData.url;
                if (urlToOpen) {
                    csInterface.openURLInDefaultBrowser(urlToOpen);
                } else {
                    console.error("No se encontró URL válida en el manifest");
                    alert("No se pudo abrir la página de descarga. Revisa manualmente en GitHub.");
                }
            });
            
            updateNoticeTimeout = setTimeout(() => {
                if (isUpdateNoticeActive) { 
                    console.log("El temporizador de 20s para el aviso de actualización ha terminado.");
                    clearUpdateNotice();
                }
            }, 20000);
        }
    }
    async function checkForUpdates() {
        console.log("Iniciando verificación de actualizaciones...");
        console.log(`Versión actual: ${CURRENT_EXTENSION_VERSION}`);
        console.log(`URL del manifest: ${UPDATE_MANIFEST_URL}`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); 
            
            const response = await fetch(UPDATE_MANIFEST_URL, {
                signal: controller.signal,
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
            }
            
            const manifest = await response.json();
            console.log("Manifest obtenido:", manifest);
            
            if (!manifest.extension_version) {
                console.error("El manifest no contiene extension_version");
                return;
            }
            
            const comparisonResult = compareVersions(CURRENT_EXTENSION_VERSION, manifest.extension_version);
            
            if (comparisonResult === 1) {
                console.log("Nueva versión encontrada, mostrando notificación");
                updateManifestData = manifest;
                showUpdateNotification(); 
            } else if (comparisonResult === 0) {
                console.log("La extensión está actualizada");
            } else {
                console.log("La versión actual es más nueva que la remota (¿versión de desarrollo?)");
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error("Timeout al verificar actualizaciones");
            } else {
                console.error("Error al verificar actualizaciones:", error);
            }
        }
    }

    function forceUpdateCheck() {
        console.log("Verificación manual de actualizaciones forzada");
        checkForUpdates();
    }

    window.debugUpdates = {
        forceCheck: forceUpdateCheck,
        currentVersion: CURRENT_EXTENSION_VERSION,
        manifestUrl: UPDATE_MANIFEST_URL,
        compareVersions: compareVersions
    };

    async function initializeApp() {
        isUpdateNoticeActive = false;
        csInterface.evalScript('getHostAppName()', async (result) => {
            if (result && result !== "unknown") {
                thisAppName = result.replace("Adobe ", "");
                thisAppIdentifier = thisAppName.toLowerCase().replace(" pro", "").replace(" ", "");
            }

            checkActiveTimeline();
            setupEventListeners();

            let dowpPath = await storage.getDowpPath();
            
            // Si no hay ruta guardada, intentar detectar automáticamente
            if (!dowpPath) {
                csInterface.evalScript('findDowPExecutable()', async (detectedPath) => {
                    if (detectedPath && detectedPath !== "not_found" && !detectedPath.startsWith("error")) {
                        // DowP encontrado automáticamente
                        dowpPath = detectedPath;
                        const saved = await storage.setDowpPath(dowpPath);
                        if (saved) {
                            showMessage("✓ DowP detectado automáticamente", 'success', true, 3000);
                            setState('disconnected');
                            setLinkButtonState('disconnected');
                            connectToServer();
                        }
                    } else {
                        // DowP no encontrado - pedir al usuario
                        setState('unconfigured');
                        setLinkButtonState('disconnected');
                        btnLaunch.classList.add('is-disabled');
                        btnLink.classList.add('is-disabled');
                    }
                });
            } else {
                setState('disconnected');
                setLinkButtonState('disconnected');
                connectToServer();
            }

            setTimelineActiveState(Boolean(lastTimelineState), { strong: Boolean(addToTimelineCheckbox.checked) });

            // Intervalo principal: conexión y verificaciones periódicas
            setInterval(() => {
                // Gestión de conexión
                if (!socket || !socket.connected) {
                    
                    // V MODIFICA ESTA LÍNEA V
                    if (!isLaunching && !isConnectingAttempt) {
                    // ^ AÑADE "!isConnectingAttempt" ^
                        connectToServer();
                    }
                } else {
                    socket.emit('get_active_target');

                    if (isLaunching && !launchTimeout) {
                        isLaunching = false;
                        setState('linked-elsewhere');
                    }
                }

                // Verificación de timeline con debounce inteligente
                if (!checkingTimeline) {
                    checkActiveTimeline();
                }
            }, 800);
            
            setTimeout(checkForUpdates, 3000);
        });
    }

    btnLink.onclick = linkToThisApp;
    btnLaunch.onclick = launchDowP;
    btnSettings.onclick = setDowPPath;
    initializeApp();
};