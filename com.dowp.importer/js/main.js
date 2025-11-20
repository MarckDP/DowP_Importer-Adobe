window.onload = function() {
    const csInterface = new CSInterface();
    const CURRENT_EXTENSION_VERSION = "1.1.9";
    const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/MarckDP/DowP_Importer-Adobe/refs/heads/main/update.json";
    const serverUrl = "http://127.0.0.1:7788";
    let thisAppName = "Desconocido";
    let thisAppIdentifier = "unknown";
    let socket = null;
    let toggleLinked = false;

    // ✅ NUEVO: Estado de conexión centralizado
    const connectionState = {
        isConnecting: false,
        isLaunching: false,
        lastAttempt: 0,
        attemptCount: 0,
        connectionTimeout: null,
        maxRetries: 3
    };

    let isSocketRegistered = false;
    let unlinkingTimeout = null;

    let lastTimelineState = null;
    let checkingTimeline = false;
    let lastTimelineCheck = 0;
    const TIMELINE_CHECK_INTERVAL = 1500;
    
    let lastSuccessfulTimelineCheck = null;
    let timelineCheckFailureCount = 0;

    let currentState = 'unconfigured';

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
        
        if (connectionState.isLaunching) {
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
                btn.innerHTML = '<span class="icon">⛔</span>';
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
                btn.innerHTML = '<span class="icon">🔒</span>';
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

    // ✅ NUEVO: Función para resetear el estado de conexión
    function resetConnectionState() {
        connectionState.isConnecting = false;
        connectionState.attemptCount = 0;
        if (connectionState.connectionTimeout) {
            clearTimeout(connectionState.connectionTimeout);
            connectionState.connectionTimeout = null;
        }
    }

    // ✅ NUEVO: Verificar si podemos intentar conectar
    function canAttemptConnection() {
        const now = Date.now();
        const timeSinceLastAttempt = now - connectionState.lastAttempt;
        
        if (connectionState.isConnecting) {
            console.log("⏸️ Conexión ya en progreso");
            return false;
        }
        
        if (connectionState.isLaunching) {
            console.log("⏸️ DowP está iniciando");
            return false;
        }
        
        // ✅ CRÍTICO: Si ya alcanzamos el máximo de reintentos, NUNCA reintentar automáticamente
        if (connectionState.attemptCount >= connectionState.maxRetries) {
            console.log("🛑 Máximo de reintentos alcanzado. Se requiere acción manual.");
            return false;
        }
        
        if (timeSinceLastAttempt < 2000) {
            console.log("⏸️ Debounce: esperando 2s entre intentos");
            return false;
        }
        
        return true;
    }

    // ✅ REFACTORIZADO: Conexión al servidor con protecciones
    function connectToServer(forceConnection = false) {
        if (socket && socket.connected) {
            console.log("✅ Ya conectado al servidor");
            return;
        }

        if (!forceConnection && !canAttemptConnection()) {
            return;
        }

        console.log("🔌 Iniciando conexión al servidor...");
        
        connectionState.isConnecting = true;
        connectionState.lastAttempt = Date.now();
        connectionState.attemptCount++;

        if (!connectionState.isLaunching) {
            isShowingPersistentMessage = false;
            setState('connecting');
            updateStatusMessage();
            setLinkButtonState('connecting');
        }

        // ✅ CRÍTICO: Destruir socket anterior si existe
        if (socket) {
            console.log("🧹 Limpiando socket anterior");
            socket.removeAllListeners();
            socket.disconnect();
            socket = null;
        }

        // ✅ NUEVO: Timeout de seguridad (10 segundos)
        connectionState.connectionTimeout = setTimeout(() => {
            console.error("⏱️ Timeout de conexión alcanzado");
            resetConnectionState();
            
            if (!connectionState.isLaunching) {
                setState('dowp-closed');
                setLaunchButtonState('closed');
                setLinkButtonState('disconnected');
            }
        }, 10000);

        socket = io(serverUrl, {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 3,
            reconnectionDelay: 2000,
            timeout: 8000
        });
        
        socket.on('connect', () => {
            console.log("✅ Conectado al servidor");
            resetConnectionState();
            
            if (connectionState.isLaunching) {
                connectionState.isLaunching = false;
                showMessage("¡DowP iniciado correctamente!", 'success', true, 3000);
            }
            
            if (!isSocketRegistered) {
                socket.emit('register', { appIdentifier: thisAppIdentifier });
                isSocketRegistered = true;
            }
            
            setLaunchButtonState('open');
            setLinkButtonState('connected');
            
            setTimeout(() => {
                socket.emit('get_active_target');
            }, 500);
        });
        
        socket.on('connect_error', (err) => {
            console.error("❌ Error de conexión:", err.message);
            resetConnectionState();
            
            if (!connectionState.isLaunching) {
                setState('dowp-closed');
                setLaunchButtonState('closed');
                setLinkButtonState('disconnected');
            }
        });

        socket.on('disconnect', (reason) => {
            console.log("🔌 Desconectado:", reason);
            isSocketRegistered = false;
            toggleLinked = false;
            resetConnectionState();
            
            if (!connectionState.isLaunching) {
                setState('disconnected');
                setLinkButtonState('disconnected');
                setLaunchButtonState('closed');
            }
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

        socket.on('import_files', (data) => {
            if (data && data.files && data.files.length > 0) {
                console.log(`Recibido lote de ${data.files.length} archivos para la papelera: ${data.targetBin}`);
                importBatchToProject(data.files, data.targetBin);
            }
        });
    }

    function linkToThisApp() {
        clearUpdateNotice();
        
        // ✅ NUEVO: Al presionar el botón 🔗, resetear los contadores de reintento
        connectionState.attemptCount = 0;
        
        if (!socket || !socket.connected) {
            showMessage("Conectando y enlazando...", 'info', true);
            setLinkButtonState('connecting');

            if (socket) {
                socket.once('connect', () => {
                    socket.emit('set_active_target', { targetApp: thisAppIdentifier });
                });
            }

            connectToServer(true);
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
        const targetBinName = filePackage.targetBin || null;
        
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
            console.error("ERROR: filesToImport está vacío");
            console.error("filePackage.video:", filePackage.video);
            console.error("filePackage.thumbnail:", filePackage.thumbnail);
            console.error("filePackage.subtitle:", filePackage.subtitle);
            console.error("filePackage completo:", JSON.stringify(filePackage));
            showMessage("Error: DowP no envió ningún archivo. Verifica que la descarga fue exitosa.", 'error', true, 5000);
            return;
        }

        showMessage(`Importando ${filesToImport.length} archivo(s)...`, 'info', true);
        
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

        const escapedBinName = targetBinName ? `"${escapeForExtendScript(targetBinName)}"` : "null";

        if (shouldAddToTimeline) {
            csInterface.evalScript('getActiveTimelineInfo()', (result) => {
                try {
                    const timelineInfo = JSON.parse(result);
                    if (timelineInfo.hasActiveTimeline) {
                        console.log("Timeline activa encontrada. Playhead:", timelineInfo.playheadTime);
                        csInterface.evalScript(
                            `importFiles("${escapedJSON}", true, ${timelineInfo.playheadTime}, ${shouldImportImages}, ${escapedBinName})`,
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
                `importFiles("${escapedJSON}", false, 0, ${shouldImportImages}, ${escapedBinName})`,
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

    function importBatchToProject(fileList, targetBinName) {
        const host = thisAppIdentifier;
        const totalFiles = fileList.length;

        const escapeForExtendScript = (str) => {
            return str
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'");
        };
        
        const escapedBinName = targetBinName ? `"${escapeForExtendScript(targetBinName)}"` : "null";
        const shouldAddToTimeline = false;
        const shouldImportImages = false;

        if (host === 'premiere') {
            showMessage(`Importando ${totalFiles} archivo(s) a Premiere...`, 'info', true);
            
            const fileListJSON = JSON.stringify(fileList);
            const escapedJSON = escapeForExtendScript(fileListJSON);

            console.log("Importando lote a Premiere:", fileList);
            
            csInterface.evalScript(
                `importFiles("${escapedJSON}", ${shouldAddToTimeline}, 0, ${shouldImportImages}, ${escapedBinName})`,
                (importResult) => {
                    console.log("Resultado de importación (lote Premiere):", importResult);
                    handleImportResult(importResult);
                }
            );

        } else if (host === 'aftereffects') {
            console.log("Importando lote a After Effects (uno por uno)...");
            let importedCount = 0;
            let errorCount = 0;

            function importNext(index) {
                if (index >= totalFiles) {
                    let finalMessage = `¡Importación a AE completada! (${importedCount} archivos)`;
                    if (errorCount > 0) {
                        finalMessage = `Importación a AE completada (${importedCount} archivos, ${errorCount} errores)`;
                    }
                    showMessage(finalMessage, errorCount > 0 ? 'warning' : 'success', true, 3000);
                    return;
                }

                const fileToImport = fileList[index];
                const fileListJSON = JSON.stringify([fileToImport]);
                const escapedJSON = escapeForExtendScript(fileListJSON);

                showMessage(`Importando ${index + 1} de ${totalFiles} a AE...`, 'info', true);

                csInterface.evalScript(
                    `importFiles("${escapedJSON}", ${shouldAddToTimeline}, 0, ${shouldImportImages}, ${escapedBinName})`,
                    (importResult) => {
                        if (importResult === "success") {
                            importedCount++;
                        } else {
                            errorCount++;
                            console.warn(`Error al importar ${fileToImport}: ${importResult}`);
                        }
                        importNext(index + 1);
                    }
                );
            }
            
            importNext(0);

        } else {
            console.error(`Host desconocido '${host}', no se puede importar el lote.`);
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

        // ✅ NUEVO: Al lanzar DowP, resetear los contadores de reintento
        connectionState.attemptCount = 0;
        connectionState.isLaunching = true;
        setState('launching');
        
        const safePath = path.replace(/\\/g, '\\\\');
        csInterface.evalScript(`executeDowP("${safePath}", "${thisAppIdentifier}")`);
        
        setTimeout(() => {
            connectToServer(true);
        }, 2000);
        
        setTimeout(() => {
            if (connectionState.isLaunching) {
                connectionState.isLaunching = false;
                showMessage("Timeout al iniciar DowP. Verifica que la ruta sea correcta.", 'error', true, 8000);
                setState('disconnected');
                resetConnectionState();
            }
        }, 30000);
    }

    function checkActiveTimeline() {
        const now = Date.now();
        
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
                
                if (info.hasActiveTimeline) {
                    lastSuccessfulTimelineCheck = info;
                    timelineCheckFailureCount = 0;
                    updateTimelineState(true);
                } else {
                    if (lastSuccessfulTimelineCheck && timelineCheckFailureCount < 5) {
                        timelineCheckFailureCount++;
                        return;
                    }
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
                console.log("Abriendo URL de descarga:", updateManifestData.release_notes_url || updateManifestData.download_url);
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
            
            if (!dowpPath) {
                csInterface.evalScript('findDowPExecutable()', async (detectedPath) => {
                    if (detectedPath && detectedPath !== "not_found" && !detectedPath.startsWith("error")) {
                        dowpPath = detectedPath;
                        const saved = await storage.setDowpPath(dowpPath);
                        if (saved) {
                            showMessage("✓ DowP detectado automáticamente", 'success', true, 3000);
                            setState('disconnected');
                            setLinkButtonState('disconnected');
                            connectToServer();
                        }
                    } else {
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

            // ✅ CRÍTICO: Intervalo de mantenimiento MÁS CONSERVADOR
            setInterval(() => {
                // ✅ BLOQUEADO: No reconectar automáticamente si ya fallamos 3 veces
                if (!socket || !socket.connected) {
                    // NO hacer nada automáticamente, solo actualizar UI
                    if (!connectionState.isLaunching) {
                        setState('dowp-closed');
                        setLinkButtonState('disconnected');
                        setLaunchButtonState('closed');
                    }
                } else {
                    socket.emit('get_active_target');
                    
                    if (connectionState.attemptCount > 0) {
                        connectionState.attemptCount = 0;
                    }
                }

                if (!checkingTimeline) {
                    checkActiveTimeline();
                }
            }, 1000);
            
            setTimeout(checkForUpdates, 1000);
        });
    }

    btnLink.onclick = linkToThisApp;
    btnLaunch.onclick = launchDowP;
    btnSettings.onclick = setDowPPath;
    initializeApp();
};