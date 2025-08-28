window.onload = function() {
    const csInterface = new CSInterface();
    const serverUrl = "http://127.0.0.1:7788";
    let thisAppName = "Desconocido";
    let thisAppIdentifier = "unknown";
    let socket = null;
    let toggleLinked = false;

    let lastTimelineState = null;
    let checkingTimeline = false;

    let currentState = 'disconnected';
    let isLaunching = false;
    let launchTimeout = null;
    
    let messageQueue = [];
    let currentMessageType = 'info';
    let messageTimeout = null;
    let isShowingPersistentMessage = false;

    let connectionAttempts = 0;
    let maxConnectionAttempts = 3;
    let isInStoppedState = false;
    let lastConnectionAttemptTime = 0;

    const statusIndicator = document.getElementById('status-indicator');
    const logText = document.getElementById('log-text');
    const btnLink = document.getElementById('btn-check');
    const btnLaunch = document.getElementById('btn-launch');
    const btnSettings = document.getElementById('btn-settings');
    const addToTimelineCheckbox = document.getElementById('add-to-timeline-checkbox');
    const addToTimelineContainer = document.getElementById('add-to-timeline-container');

    const storage = {
        getDowpPath: () => localStorage.getItem('dowpPath'),
        setDowpPath: (path) => localStorage.setItem('dowpPath', path)
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
        
        switch (currentState) {
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
        btn.innerHTML = '<span class="icon">⛓️‍💥</span>';
        break;
        case 'connecting':
        btn.classList.add('state-connecting');
        btn.title = 'Conectando a DowP...';
        btn.innerHTML = '<span class="icon">⏳</span>';
        break;
        case 'connected':
        btn.classList.add('state-connected');
        btn.title = 'Conectado — pulsa para enlazar';
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
        btn.innerHTML = '<span class="icon">❔</span>';
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

        el.classList.remove('glow-active','glow-strong','glow-pulse','glow-blue','glow-orange');

        if (active) {
            el.classList.add('glow-active', 'glow-pulse');

            if (options.strong) el.classList.add('glow-strong');

            if (options.color === 'blue') el.classList.add('glow-blue');
            else if (options.color === 'orange') el.classList.add('glow-orange');

            el.setAttribute('title', 'Añadir a la línea de tiempo (activo)');
            el.setAttribute('aria-pressed', options.strong ? 'true' : 'false');
        } else {
            el.setAttribute('title', 'Añadir a la línea de tiempo');
            el.setAttribute('aria-pressed', 'false');
        }
    }

    function connectToServer() {
        if (socket && socket.connected) return;
        
        if (!isLaunching) {
            isShowingPersistentMessage = false;
            setState('connecting');
            updateStatusMessage();
            setLinkButtonState('connecting');
        }
        if (isInStoppedState) return;
        connectionAttempts++;
        lastConnectionAttemptTime = Date.now();
        socket = io(serverUrl, {
            transports: ['websocket'],
            reconnectionAttempts: 5
        });
        
        socket.on('connect', () => {
            connectionAttempts = 0;
            isInStoppedState = false;
            if (isLaunching) {
                isLaunching = false;
                if (launchTimeout) {
                    clearTimeout(launchTimeout);
                    launchTimeout = null;
                }
                showMessage("¡DowP iniciado correctamente!", 'success', true, 3000);
            }
            
            socket.emit('register', { appIdentifier: thisAppIdentifier });
            setLaunchButtonState('open');
            setLinkButtonState('connected');
            setLaunchButtonState('open'); 
            setTimeout(() => {
                socket.emit('get_active_target');
            }, 500);
        });
        
        socket.on('connect_error', (err) => {
            if (!isLaunching) {
                if (connectionAttempts >= maxConnectionAttempts) {
                    isInStoppedState = true;
                    setState('dowp-closed');
                    showMessage("DowP no está disponible. Haz clic en 🚀 para iniciarlo.", 'warning', true);
                } else {
                    setState('dowp-closed');
                }
            }
            setLaunchButtonState('closed');
        });
        
        socket.on('disconnect', () => {
        toggleLinked = false;
        isShowingPersistentMessage = false;
        if (!isLaunching) {
            setState('disconnected');
        }
        setLinkButtonState('disconnected');
        setLaunchButtonState('closed');
    });
        
        socket.on('active_target_update', (data) => {
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
        if (!socket || !socket.connected) {
            showMessage("Conectando a DowP...", 'info', true);
            setLinkButtonState('connecting');
            connectToServer();
            socket.once('connect', () => {
                socket.emit('set_active_target', { targetApp: thisAppIdentifier });
                toggleLinked = true;
                try { updateStatusIndicator(); } catch(e) {}
            });
            return;
        }

        if (toggleLinked) {
            try {
                socket.disconnect();
                setLinkButtonState('disconnected');
            } catch (e) {
                console.warn('Error al desconectar socket:', e);
            }
            toggleLinked = false;
            showMessage('Desvinculado de DowP.', 'info', true, 3000);
            setState('disconnected');
            return;
        }

        const linkingTimeout = setTimeout(() => {
            showMessage("Enlazando...", 'info');
        }, 500);

        socket.emit('set_active_target', { targetApp: thisAppIdentifier });
        setLinkButtonState('connecting');
        socket.once('active_target_update', (data) => {
            clearTimeout(linkingTimeout);
        });
    }

    function importFileToProject(filePackage) {
        const filesToImport = [];
        if (filePackage.video) filesToImport.push(filePackage.video);
        if (filePackage.thumbnail) filesToImport.push(filePackage.thumbnail);
        if (filePackage.subtitle) filesToImport.push(filePackage.subtitle);

        if (filesToImport.length === 0) {
            showMessage("Error: No se encontraron archivos para importar.", 'error', true, 5000);
            return;
        }

        showMessage(`Importando ${filesToImport.length} archivo(s)...`, 'info', true);
        const fileListJSON = JSON.stringify(filesToImport);
        const shouldAddToTimeline = addToTimelineCheckbox.checked;

        if (shouldAddToTimeline) {
            csInterface.evalScript('getActiveTimelineInfo()', (result) => {
                const timelineInfo = JSON.parse(result);
                if (timelineInfo.hasActiveTimeline) {
                    csInterface.evalScript(`importFiles('${fileListJSON}', true, ${timelineInfo.playheadTime})`, (importResult) => {
                        handleImportResult(importResult);
                    });
                } else {
                    showMessage("Error: No hay secuencia/composición activa.", 'error', true, 5000);
                }
            });
        } else {
            csInterface.evalScript(`importFiles('${fileListJSON}', false, 0)`, (importResult) => {
                handleImportResult(importResult);
            });
        }
    }

    function handleImportResult(result) {
        if (result === "success") {
            showMessage("¡Importado con éxito!", 'success', true, 3000);
        } else {
            showMessage(`Error al importar: ${result}`, 'error', true, 6000);
        }
    }

    function setDowPPath() {
        showMessage("Selecciona el script lanzador (run_dowp.bat o .sh)...", 'info', true);
        csInterface.evalScript('selectDowPExecutable()', (result) => {
            if (result && result !== "cancel") {
                storage.setDowpPath(result);
                showMessage(`Ruta guardada correctamente.`, 'success', true, 3000);
                setTimeout(() => connectToServer(), 1000);
            } else {
                showMessage("Configuración cancelada.", 'warning', true, 3000);
            }
        });
    }

    function launchDowP() {
        const path = storage.getDowpPath();
        if (!path) {
            showMessage("Primero configura la ruta de DowP con el icono ⚙️.", 'error', true, 5000);
            return;
        }

        isLaunching = true;
        setState('launching');
        connectionAttempts = 0;
        isInStoppedState = false;
        
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
                updateTimelineState(info.hasActiveTimeline);
            } catch (e) {
                updateTimelineState(false);
            }
        });
    }

    function updateTimelineState(hasActiveTimeline) {
        if (lastTimelineState !== hasActiveTimeline) {
            lastTimelineState = hasActiveTimeline;

            addToTimelineCheckbox.disabled = !hasActiveTimeline;

            if (hasActiveTimeline) {
                addToTimelineContainer.title = "Añadir a la línea de tiempo activa";
            } else {
                addToTimelineContainer.title = "No hay una secuencia/composición activa";
                if (addToTimelineCheckbox.checked) {
                    addToTimelineCheckbox.checked = false;
                    addToTimelineContainer.classList.remove('is-active');
                }
            }

            const strong = !!addToTimelineCheckbox.checked;
            setTimelineActiveState(Boolean(hasActiveTimeline), { strong: strong });
        }
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
    }

    addToTimelineCheckbox.addEventListener('change', () => {
        if (addToTimelineCheckbox.checked) {
            addToTimelineContainer.classList.add('is-active');
        } else {
            addToTimelineContainer.classList.remove('is-active');
        }

        const effectiveActive = Boolean(lastTimelineState && addToTimelineCheckbox.checked);
        setTimelineActiveState(effectiveActive, { strong: addToTimelineCheckbox.checked });
    });

    function initializeApp() {
        csInterface.evalScript('getHostAppName()', (result) => {
            if (result && result !== "unknown") {
                thisAppName = result.replace("Adobe ", "");
                thisAppIdentifier = thisAppName.toLowerCase().replace(" pro", "").replace(" ", "");
            }

            checkActiveTimeline();
            setupEventListeners();
            setState('disconnected');
            setLinkButtonState('disconnected');
            setTimelineActiveState(Boolean(lastTimelineState), { strong: Boolean(addToTimelineCheckbox.checked) });
            connectToServer();

            setInterval(() => {
                if (!socket || !socket.connected) {
                    if (!isLaunching && !isInStoppedState) {
                        connectToServer();
                    }
                } else {
                    socket.emit('get_active_target');

                    if (isLaunching && !launchTimeout) {
                        isLaunching = false;
                        setState('linked-elsewhere');
                    }
                }

                if (!checkingTimeline) {
                    checkActiveTimeline();
                }
            }, 800);
        });
    }

    btnLink.onclick = linkToThisApp;
    btnLaunch.onclick = launchDowP;
    btnSettings.onclick = setDowPPath;
    initializeApp();
};