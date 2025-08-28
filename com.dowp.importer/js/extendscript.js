if (typeof JSON === "undefined") {
    JSON = {};
}

if (typeof JSON.stringify !== "function") {
    JSON.stringify = function (obj) {
        if (obj === null) return "null";
        if (typeof obj === "string") return '"' + obj + '"';
        if (typeof obj === "number" || typeof obj === "boolean") return obj.toString();
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
                if (obj.hasOwnProperty(key)) {
                    props.push('"' + key + '":' + JSON.stringify(obj[key]));
                }
            }
            return "{" + props.join(",") + "}";
        }
        return "null";
    };
}

if (typeof JSON.parse !== "function") {
    JSON.parse = function (str) {
        return eval("(" + str + ")");
    };
}

function getHostAppName() {
    try {
        if (typeof app.appName !== 'undefined' && app.appName.indexOf("After Effects") > -1) {
            return "Adobe After Effects";
        } else if (typeof $ !== 'undefined' && $.global.app.isDocumentOpen && $.global.app.isDocumentOpen()) {
            return "Adobe Premiere Pro";
        } else {
            return "unknown";
        }
    } catch (e) {
        return "unknown";
    }
}

function selectDowPExecutable() {
    var file = File.openDialog("Selecciona el script lanzador de DowP (.bat o .sh)");
    if (file) { return file.fsName; }
    return "cancel";
}

function executeDowP(path, appIdentifier) { 
    try {
        var scriptFile;
        var scriptContent = '';
        var isWindows = $.os.indexOf("Windows") > -1;
        var tempFolderPath = Folder.temp.fsName;

        if (isWindows) {
            var fileToRun = new File(path);
            var folderPath = fileToRun.parent.fsName;
            
            scriptFile = new File(tempFolderPath + "/launch_dowp_temp.bat");
            scriptContent = '@echo off\n' +
                            'cd /d "' + folderPath + '"\n' +
                            'start "" pythonw "main.py" "' + appIdentifier + '"\n';
        } else {
            scriptFile = new File(tempFolderPath + "/launch_dowp_temp.sh");
            scriptContent = '#!/bin/bash\n' +
                            'sh "' + path + '" "' + appIdentifier + '"\n';
        }
        scriptFile.open("w");
        scriptFile.encoding = "UTF-8";
        scriptFile.write(scriptContent);
        scriptFile.close();
        scriptFile.execute();
    } catch (e) {
        alert("Error al intentar crear el script lanzador: " + e.toString());
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
            var sequence = app.project.activeSequence;
            if (sequence) {
                info.hasActiveTimeline = true;
                info.playheadTime = sequence.getPlayerPosition().seconds;
            }
        } else if (host === "Adobe After Effects") {
            if (app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) {
                var comp = app.project.activeItem;
                try {
                    var currentTime = comp.time;
                    var duration = comp.duration;
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
    return JSON.stringify(info);
}

function importFiles(fileListJSON, addToTimeline, playheadTime) {
    try {
        var filePaths = JSON.parse(fileListJSON);
        if (!filePaths || filePaths.length === 0) {
            return "Error: La lista de archivos está vacía.";
        }

        var host = getHostAppName();
        if (host === "Adobe After Effects") {
            return importForAfterEffects(filePaths, addToTimeline, playheadTime);
        } else if (host === "Adobe Premiere Pro") {
            return importForPremiere(filePaths, addToTimeline, playheadTime);
        } else {
            return "Error: Aplicación no soportada.";
        }
    } catch (error) {
        return "Error crítico en ExtendScript: " + error.toString();
    }
}

function getTrackIndex(trackCollection, track) {
    for (var i = 0; i < trackCollection.numTracks; i++) {
        if (trackCollection[i] === track) {
            return i;
        }
    }
    return -1;
}

function importForPremiere(filePaths, addToTimeline, playheadTime) {
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
        playheadTimeObject.seconds = playheadTime;

        for (var j = 0; j < targetBin.children.numItems; j++) {
            var currentItem = targetBin.children[j];

            if (!uidsBeforeImport.hasOwnProperty(currentItem.nodeId)) {
                var avDetection = detectAVviaXMP(currentItem);

                if (avDetection.video && avDetection.audio) {
                    handleMixedClipInsert(sequence, playheadTimeObject, currentItem);
                } else if (avDetection.video && !avDetection.audio) {
                    var path = currentItem.getMediaPath().toLowerCase();
                    if (path.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i)) {
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
}

function findAvailableVideoTrack(sequence, playheadTimeObject, mediaItem) {
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

    return -1;
}

function handleMixedClipInsert(sequence, playheadTimeObject, mediaItem) {
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
            try {
                var firstTrack = sequence.audioTracks[0];
                if (firstTrack && firstTrack.audioTrackType) {
                    var tname = firstTrack.audioTrackType;
                }
            } catch (e) {}
            var currentAudioCount = sequence.audioTracks.numTracks;
            qeSequence.addTracks(0, 0, needAudioToAdd, baseType, currentAudioCount);
        }
        app.project.activeSequence = app.project.activeSequence;
    }

    var newVIndex = Math.max(desiredIndex, sequence.videoTracks.numTracks - 1);
    sequence.videoTracks[newVIndex].insertClip(mediaItem, playheadTimeObject);
}

function findAvailableAudioTrack(sequence, playheadTimeObject, mediaItem) {
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

    return null;
}

function importForAfterEffects(filePaths, addToTimeline, playheadTime) {
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
            var importOptions = new ImportOptions(new File(currentPath));
            var importedItem = project.importFile(importOptions);
            importedItem.parentFolder = targetBin;
            
            if ((importedItem.hasVideo || importedItem.hasAudio) && 
                lowerPath.slice(-4) !== ".jpg" && 
                lowerPath.slice(-4) !== ".png") {
                mediaItems.push(importedItem);
            }
        } catch (e) {
        }
    }

    if (addToTimeline && mediaItems.length > 0) {
        var comp = app.project.activeItem;
        if (comp && comp instanceof CompItem) {
            for (var m = 0; m < mediaItems.length; m++) {
                var newLayer = comp.layers.add(mediaItems[m]);
                newLayer.startTime = playheadTime;
                newLayer.moveToBeginning();
            }
        }
    }

    app.endUndoGroup();
    return "success";
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
    for (var i = 0; i < bin.children.numItems; i++) {
        uids[bin.children[i].nodeId] = true; 
    }
    return uids;
}

function detectAVviaXMP(projectItem) {
    var hasVideo = false;
    var hasAudio = false;

    try {
        var xmp = projectItem.getProjectMetadata();

        if (xmp.indexOf("<premierePrivateProjectMetaData:Column.Intrinsic.VideoInfo>") !== -1) {
            hasVideo = true;
        }
        if (xmp.indexOf("<premierePrivateProjectMetaData:Column.Intrinsic.AudioInfo>") !== -1) {
            hasAudio = true;
        }
    } catch (e) {
    }

    return { video: hasVideo, audio: hasAudio };
}