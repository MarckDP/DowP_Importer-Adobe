(function() {
    if (typeof JSON === "undefined" || typeof JSON.stringify === "undefined" || typeof JSON.parse === "undefined") {
        
        var LocalJSON = {};
        
        if (typeof JSON === "undefined") {
            JSON = {};
        }

        if (typeof JSON.stringify !== "function") {
            JSON.stringify = function (obj) {
                try {
                    if (obj === null) return "null";
                    if (obj === undefined) return "null"; 
                    if (typeof obj === "string") return '"' + obj.replace(/"/g, '\\"').replace(/\\/g, '\\\\') + '"';
                    if (typeof obj === "number") {
                        if (isNaN(obj) || !isFinite(obj)) return "null";
                        return obj.toString();
                    }
                    if (typeof obj === "boolean") return obj.toString();
                    if (obj instanceof Array) {
                        var arr = [];
                        for (var i = 0; i < obj.length; i++) {
                            arr.push(JSON.stringify(obj[i]));
                        }
                        return "[" + arr.join(",") + "]";
                    }
                    if (typeof obj === "object") {
                        var props = [];
                        for (var key in obj) {
                            if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
                                props.push('"' + key.replace(/"/g, '\\"') + '":' + JSON.stringify(obj[key]));
                            }
                        }
                        return "{" + props.join(",") + "}";
                    }
                    return "null";
                } catch (e) {
                    return "null";
                }
            };
        }

        if (typeof JSON.parse !== "function") {
            JSON.parse = function (str) {
                try {
                    if (typeof str !== "string") return null;
                    if (str === "") return null;
                    if (str === "undefined") return null;
                    
                    str = str.replace(/^\s+|\s+$/g, '');
                    if (str === "") return null;
                    
                    if (!/^[\[\{]/.test(str) && !/^"/.test(str) && !/^-?\d/.test(str) && !/^(true|false|null)$/.test(str)) {
                        return null;
                    }
                    
                    return eval("(" + str + ")");
                } catch (e) {
                    return null;
                }
            };
        }
    }
})();

function getHostAppName() {
    try {
        if (typeof app !== 'undefined' && app.appName && app.appName.indexOf("After Effects") > -1) {
            return "Adobe After Effects";
        } else if (typeof $ !== 'undefined' && $.global && $.global.app && $.global.app.isDocumentOpen && $.global.app.isDocumentOpen()) {
            return "Adobe Premiere Pro";
        } else {
            return "unknown";
        }
    } catch (e) {
        return "unknown";
    }
}

function selectDowPExecutable() {
    try {
        var file = File.openDialog("Selecciona el ejecutable de DowP (DowP.exe)");
        if (file) { return file.fsName; }
        return "cancel";
    } catch (e) {
        return "cancel";
    }
}

function executeDowP(path, appIdentifier) {
    try {
        var exeFile = new File(path);
        if (!exeFile.exists) {
            return "Error: El archivo DowP.exe no se encontró en la ruta especificada: " + path;
        }

        if ($.os.indexOf("Windows") > -1) {
            var scriptFile = new File(Folder.temp.fsName + "/launch_dowp_temp.bat");
            var scriptContent = '@echo off\n' +
                                'start "" "' + path + '" "' + appIdentifier + '"\n';
            
            scriptFile.open("w");
            scriptFile.encoding = "UTF-8";
            scriptFile.write(scriptContent);
            scriptFile.close();
            scriptFile.execute();

        } else {
            exeFile.execute();
        }

        return "success";

    } catch (e) {
        return "Error al intentar ejecutar DowP: " + e.toString();
    }
}

function getActiveTimelineInfo() {
    var info = {
        hasActiveTimeline: false,
        playheadTime: 0
    };
    
    try {
        var host = getHostAppName();
        if (host === "Adobe Premiere Pro") {
            if (app.project && app.project.activeSequence) {
                var sequence = app.project.activeSequence;
                info.hasActiveTimeline = true;
                info.playheadTime = sequence.getPlayerPosition().seconds;
            }
        } else if (host === "Adobe After Effects") {
            if (app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) {
                var comp = app.project.activeItem;
                try {
                    var currentTime = comp.time;
                    if (comp.width > 0 && comp.height > 0) {
                        info.hasActiveTimeline = true;
                        info.playheadTime = currentTime;
                    }
                } catch (e) {
                    info.hasActiveTimeline = false;
                }
            }
        }
    } catch (e) {
    }
    
    try {
        return JSON.stringify(info);
    } catch (e) {
        return '{"hasActiveTimeline":false,"playheadTime":0}';
    }
}

function clearCacheForExistingItems(filePath, targetBin) {
    try {
        if (!filePath || !app.project) return;
        
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item && item.file && item.file.fsName === filePath) {
                item.replace(item.file);
            }
        }
    } catch (e) {
    }
}

function isFileRecentlyModified(filePath, thresholdMinutes) {
    try {
        var file = new File(filePath);
        if (!file.exists) return false;
        
        var now = new Date();
        var fileModified = new Date(file.modified);
        var diffMinutes = (now.getTime() - fileModified.getTime()) / (1000 * 60);
        
        return diffMinutes < (thresholdMinutes || 5); 
    } catch (e) {
        return false;
    }
}

function importFiles(fileListJSON, addToTimeline, playheadTime, importImagesToTimeline) {
    try {
        var filePaths = null;
        
        if (!fileListJSON || fileListJSON === "undefined" || fileListJSON === "") {
            return "Error: La lista de archivos está vacía o es inválida.";
        }
        
        try {
            filePaths = JSON.parse(fileListJSON);
        } catch (e) {
            return "Error: JSON inválido - " + e.toString();
        }
        
        if (!filePaths || !filePaths.length || filePaths.length === 0) {
            return "Error: La lista de archivos está vacía.";
        }

        var host = getHostAppName();
        if (host === "Adobe After Effects") {
            return importForAfterEffects(filePaths, addToTimeline, playheadTime, importImagesToTimeline);
        } else if (host === "Adobe Premiere Pro") {
            return importForPremiere(filePaths, addToTimeline, playheadTime, importImagesToTimeline);
        } else {
            return "Error: Aplicación no soportada.";
        }
    } catch (error) {
        return "Error crítico en ExtendScript: " + error.toString();
    }
}

function getTrackIndex(trackCollection, track) {
    try {
        for (var i = 0; i < trackCollection.numTracks; i++) {
            if (trackCollection[i] === track) {
                return i;
            }
        }
    } catch (e) {
    }
    return -1;
}

function importForPremiere(filePaths, addToTimeline, playheadTime, importImagesToTimeline) {
    try {
        if (!app.project) return "Error: No hay un proyecto abierto en Premiere Pro.";

        var project = app.project;
        var binName = "DowP Imports";
        var targetBin = null;

        for (var i = 0; i < project.rootItem.children.numItems; i++) {
            var item = project.rootItem.children[i];
            if (item.name === binName && item.type === ProjectItemType.BIN) {
                targetBin = item;
                break;
            }
        }
        
        if (targetBin === null) {
            targetBin = project.rootItem.createBin(binName);
        }

        var uidsBeforeImport = getItemUIDs(targetBin);

        project.importFiles(filePaths, true, targetBin, false);
        $.sleep(500);

        if (addToTimeline) {
            var sequence = app.project.activeSequence;
            if (!sequence) return "Error: No hay una secuencia activa para añadir el clip.";

            var playheadTimeObject = new Time();
            playheadTimeObject.seconds = playheadTime || 0;

            for (var j = 0; j < targetBin.children.numItems; j++) {
                var currentItem = targetBin.children[j];

                if (!uidsBeforeImport.hasOwnProperty(currentItem.nodeId)) {
                    var avDetection = detectAVviaXMP(currentItem);

                    if (avDetection.video && avDetection.audio) {
                        handleMixedClipInsert(sequence, playheadTimeObject, currentItem);
                    } else if (avDetection.video && !avDetection.audio) {
                        var path = currentItem.getMediaPath().toLowerCase();
                        if (!importImagesToTimeline && path.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i)) {
                            continue;
                        }
                        var vTrack = findAvailableVideoTrack(sequence, playheadTimeObject, currentItem);
                        if (vTrack) {
                            vTrack.insertClip(currentItem, playheadTimeObject);
                        }
                    } else if (!avDetection.video && avDetection.audio) {
                        var aTrack = findAvailableAudioTrack(sequence, playheadTimeObject, currentItem);
                        if (aTrack) {
                            aTrack.insertClip(currentItem, playheadTimeObject);
                        }
                    }
                }
            }
        }
        return "success";
    } catch (error) {
        return "Error en importForPremiere: " + error.toString();
    }
}

function findAvailableVideoTrack(sequence, playheadTimeObject, mediaItem) {
    try {
        var clipDuration = getClipDuration(mediaItem);
        var clipEndTime = playheadTimeObject.seconds + clipDuration;

        for (var i = 0; i < sequence.videoTracks.numTracks; i++) {
            var currentTrack = sequence.videoTracks[i];
            var isRangeFree = true;
            for (var j = 0; j < currentTrack.clips.numItems; j++) {
                var currentClip = currentTrack.clips[j];
                if (!(clipEndTime <= currentClip.start.seconds || playheadTimeObject.seconds >= currentClip.end.seconds)) {
                    isRangeFree = false;
                    break;
                }
            }
            if (isRangeFree) {
                return currentTrack;
            }
        }

        var qeSequence = qe.project.getActiveSequence();
        if (qeSequence) {
            var currentVideoTrackCount = sequence.videoTracks.numTracks;
            qeSequence.addTracks(1, currentVideoTrackCount, 0, 0, 0);
            app.project.activeSequence = app.project.activeSequence;
            return sequence.videoTracks[currentVideoTrackCount];
        }
    } catch (e) {
        return null;
    }

    return null;
}

function detectNeededAudioTracks(projectItem) {
    try {
        var xmp = projectItem.getProjectMetadata() || "";
        var m = xmp.match(/(\d+)\s*(?:canal(es)?|channels?)/i);
        if (m && m[1]) {
            var count = parseInt(m[1], 10);
            if (!isNaN(count) && count > 0) {
                return (count <= 2) ? 1 : Math.ceil(count / 2);
            }
        }
        if (/stereo|estéreo|estereo/i.test(xmp)) return 1;
        if (/mono/i.test(xmp)) return 1;
        if (/5\.1|5.1/i.test(xmp)) return 1;
    } catch (e) {
    }
    return 1;
}

function findAvailableAVPair(sequence, playheadTimeObject, mediaItem) {
    try {
        var clipDuration = getClipDuration(mediaItem);
        var clipEndTime = playheadTimeObject.seconds + clipDuration;

        var numV = sequence.videoTracks.numTracks;
        var numA = sequence.audioTracks.numTracks;
        var neededAudioTracks = detectNeededAudioTracks(mediaItem);

        var maxPairs = Math.min(numV, Math.max(0, numA - (neededAudioTracks - 1)));

        for (var i = 0; i < maxPairs; i++) {
            var vTrack = sequence.videoTracks[i];
            var videoFree = true;
            for (var j = 0; j < vTrack.clips.numItems; j++) {
                var vClip = vTrack.clips[j];
                if (!(clipEndTime <= vClip.start.seconds || playheadTimeObject.seconds >= vClip.end.seconds)) {
                    videoFree = false; 
                    break;
                }
            }
            if (!videoFree) continue;

            var audioOk = true;
            for (var aOff = 0; aOff < neededAudioTracks; aOff++) {
                var ai = i + aOff;
                var aTrack = sequence.audioTracks[ai];
                if (!aTrack) { 
                    audioOk = false; 
                    break; 
                }
                for (var k = 0; k < aTrack.clips.numItems; k++) {
                    var aClip = aTrack.clips[k];
                    if (!(clipEndTime <= aClip.start.seconds || playheadTimeObject.seconds >= aClip.end.seconds)) {
                        audioOk = false; 
                        break;
                    }
                }
                if (!audioOk) break;
            }
            if (audioOk) return i;
        }
    } catch (e) {
        return -1;
    }

    return -1;
}

function handleMixedClipInsert(sequence, playheadTimeObject, mediaItem) {
    try {
        var qeSequence = null;
        try { 
            qeSequence = qe.project.getActiveSequence(); 
        } catch(e) { 
            qeSequence = null; 
        }

        var neededAudioTracks = detectNeededAudioTracks(mediaItem);
        var freeIndex = findAvailableAVPair(sequence, playheadTimeObject, mediaItem);

        if (freeIndex >= 0) {
            sequence.videoTracks[freeIndex].insertClip(mediaItem, playheadTimeObject);
            return;
        }

        var numV = sequence.videoTracks.numTracks;
        var numA = sequence.audioTracks.numTracks;
        var desiredIndex = Math.max(numV, numA);

        var needVideoToAdd = Math.max(0, (desiredIndex + 1) - numV);
        var needAudioToAdd = Math.max(0, (desiredIndex + neededAudioTracks) - numA);

        if (qeSequence) {
            if (needVideoToAdd > 0) {
                qeSequence.addTracks(needVideoToAdd, numV, 0, 0, 0);
            }
            if (needAudioToAdd > 0) {
                var baseType = 1;
                var currentAudioCount = sequence.audioTracks.numTracks;
                qeSequence.addTracks(0, 0, needAudioToAdd, baseType, currentAudioCount);
            }
            app.project.activeSequence = app.project.activeSequence;
        }

        var newVIndex = Math.max(desiredIndex, sequence.videoTracks.numTracks - 1);
        sequence.videoTracks[newVIndex].insertClip(mediaItem, playheadTimeObject);
    } catch (e) {
    }
}

function findAvailableAudioTrack(sequence, playheadTimeObject, mediaItem) {
    try {
        var clipDuration = getClipDuration(mediaItem);
        var clipEndTime = playheadTimeObject.seconds + clipDuration;

        for (var i = 0; i < sequence.audioTracks.numTracks; i++) {
            var currentTrack = sequence.audioTracks[i];
            var isRangeFree = true;
            for (var j = 0; j < currentTrack.clips.numItems; j++) {
                var currentClip = currentTrack.clips[j];
                if (!(clipEndTime <= currentClip.start.seconds || playheadTimeObject.seconds >= currentClip.end.seconds)) {
                    isRangeFree = false;
                    break;
                }
            }
            if (isRangeFree) {
                return currentTrack;
            }
        }

        var qeSequence = qe.project.getActiveSequence();
        if (qeSequence) {
            var firstTrack = sequence.audioTracks[0];
            var baseType = firstTrack.audioTrackType;

            var audioTypeMap = {
                "Mono": 0,
                "Stereo": 1,
                "5.1": 2,
                "Adaptive": 3
            };

            var audioType = audioTypeMap[baseType] !== undefined ? audioTypeMap[baseType] : 1;

            var vCount = sequence.videoTracks.numTracks;
            var aCount = sequence.audioTracks.numTracks;

            qeSequence.addTracks(0, vCount, 1, audioType, aCount);

            return sequence.audioTracks[sequence.audioTracks.numTracks - 1];
        }
    } catch (e) {
        return null;
    }

    return null;
}

function importForAfterEffects(filePaths, addToTimeline, playheadTime, importImagesToTimeline) { 
    try {
        if (!app.project) return "Error: No hay un proyecto abierto en After Effects.";
        
        app.beginUndoGroup("Importar desde DowP");
        var project = app.project;
        var binName = "DowP Imports";
        var targetBin = null;

        for (var i = 1; i <= project.numItems; i++) {
            var item = project.item(i);
            if (item.name === binName && item instanceof FolderItem) {
                targetBin = item;
                break;
            }
        }
        if (targetBin === null) {
            targetBin = project.items.addFolder(binName);
        }
        
        var mediaItems = [];
        
        for (var j = 0; j < filePaths.length; j++) {
            var currentPath = filePaths[j];
            var lowerPath = currentPath.toLowerCase();
            
            if (lowerPath.slice(-4) === ".srt") continue;
            
            try {
                clearCacheForExistingItems(currentPath, targetBin);
                
                if (isFileRecentlyModified(currentPath, 2)) {
                    $.sleep(200); 
                }
                
                var importOptions = new ImportOptions(new File(currentPath));
                
                if (importOptions.canImportAs && importOptions.canImportAs(ImportAsType.FOOTAGE)) {
                    importOptions.importAs = ImportAsType.FOOTAGE;
                }
                
                importOptions.sequence = false;
                
                var importedItem = project.importFile(importOptions);
                importedItem.parentFolder = targetBin;
                
                if (importedItem.file && importedItem.file.exists) {
                    try {
                        importedItem.replace(importedItem.file);
                    } catch (e) {
                    }
                }
                
                var isImage = lowerPath.slice(-5) === ".jpeg" || lowerPath.slice(-4) === ".jpg" || lowerPath.slice(-4) === ".png";

                if ( (importedItem.hasVideo || importedItem.hasAudio) && (!isImage || importImagesToTimeline) ) {
                    mediaItems.push(importedItem);
                }
            } catch (e) {
                try {
                    var file = new File(currentPath);
                    if (file.exists) {
                        var altImportOptions = new ImportOptions(file);
                        altImportOptions.forceAlphabetical = false;
                        var altImportedItem = project.importFile(altImportOptions);
                        altImportedItem.parentFolder = targetBin;
                        
                        if ((altImportedItem.hasVideo || altImportedItem.hasAudio)) {
                            mediaItems.push(altImportedItem);
                        }
                    }
                } catch (e2) {
                    continue;
                }
            }
        }

        if (addToTimeline && mediaItems.length > 0) {
            var comp = app.project.activeItem;
            if (comp && comp instanceof CompItem) {
                for (var m = 0; m < mediaItems.length; m++) {
                    try {
                        var newLayer = comp.layers.add(mediaItems[m]);
                        newLayer.startTime = playheadTime || 0;
                        newLayer.moveToBeginning();
                        
                        comp.displayStartTime = comp.displayStartTime;
                    } catch (e) {
                        continue;
                    }
                }
                
                try {
                    comp.openInViewer();
                } catch (e) {
                }
            }
        }

        app.endUndoGroup();
        return "success";
    } catch (error) {
        app.endUndoGroup();
        return "Error en importForAfterEffects: " + error.toString();
    }
}

function getClipDuration(mediaItem) {
    try {
        if (mediaItem.getOutPoint && mediaItem.getInPoint) {
            return mediaItem.getOutPoint().seconds - mediaItem.getInPoint().seconds;
        }
        if (mediaItem.duration) {
            return mediaItem.duration.seconds;
        }
        return 10.0;
    } catch (e) {
        return 10.0;
    }
}

function getItemUIDs(bin) {
    var uids = {};
    try {
        for (var i = 0; i < bin.children.numItems; i++) {
            uids[bin.children[i].nodeId] = true; 
        }
    } catch (e) {
    }
    return uids;
}

function detectAVviaXMP(projectItem) {
    var hasVideo = false;
    var hasAudio = false;

    try {
        var xmp = projectItem.getProjectMetadata();
        if (xmp) {
            if (xmp.indexOf("<premierePrivateProjectMetaData:Column.Intrinsic.VideoInfo>") !== -1) {
                hasVideo = true;
            }
            if (xmp.indexOf("<premierePrivateProjectMetaData:Column.Intrinsic.AudioInfo>") !== -1) {
                hasAudio = true;
            }
        }
    } catch (e) {
    }

    return { video: hasVideo, audio: hasAudio };
}

// ============================================
// SISTEMA DE ALMACENAMIENTO PERSISTENTE
// ============================================

function getConfigFilePath() {
    try {
        var userFolder = Folder.userData;
        var configFolder = new Folder(userFolder.fsName + "/DowP_Importer");
        
        if (!configFolder.exists) {
            configFolder.create();
        }
        
        return configFolder.fsName + "/config.json";
    } catch (e) {
        return null;
    }
}

function saveConfig(key, value) {
    try {
        var configPath = getConfigFilePath();
        if (!configPath) return "error";
        
        var configFile = new File(configPath);
        var config = {};
        
        if (configFile.exists) {
            configFile.open("r");
            var content = configFile.read();
            configFile.close();
            
            if (content && content !== "") {
                try {
                    config = JSON.parse(content);
                } catch (e) {
                    config = {};
                }
            }
        }
        
        config[key] = value;
        
        configFile.open("w");
        configFile.encoding = "UTF-8";
        configFile.write(JSON.stringify(config, null, 2));
        configFile.close();
        
        return "success";
    } catch (e) {
        return "error: " + e.toString();
    }
}

function loadConfig(key) {
    try {
        var configPath = getConfigFilePath();
        if (!configPath) return null;
        
        var configFile = new File(configPath);
        
        if (!configFile.exists) {
            return null;
        }
        
        configFile.open("r");
        var content = configFile.read();
        configFile.close();
        
        if (!content || content === "") {
            return null;
        }
        
        var config = JSON.parse(content);
        return config[key] || null;
    } catch (e) {
        return null;
    }
}