function getHostAppName() {
    try {
        if (typeof app.appName !== 'undefined' && app.appName.indexOf("After Effects") > -1) {
            return "Adobe After Effects";
        }
        else if (typeof ProjectItemType !== 'undefined' || typeof BinType !== 'undefined') {
            return "Adobe Premiere Pro";
        }
        else {
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
        } else { // macOS o Linux
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
function importFiles(fileListJSON) {
    try {
        var filePaths = eval(fileListJSON); 
        if (!filePaths || filePaths.length === 0) {
            return "Error: La lista de archivos está vacía.";
        }
        if (typeof app.appName !== 'undefined' && app.appName.indexOf("After Effects") > -1) {
            return importForAfterEffects(filePaths);
        } else if (typeof ProjectItemType !== 'undefined' || typeof BinType !== 'undefined') {
            return importForPremiere(filePaths);
        } else {
            return "Error: Aplicación no soportada.";
        }
    } catch (error) {
        return "Error crítico en ExtendScript: " + error.toString();
    }
}
function importForPremiere(filePaths) {
    if (!app.project) { return "Error: No hay un proyecto abierto en Premiere Pro."; }
    var project = app.project;
    var binName = "DowP Imports";
    var targetBin = null;
    var binConstant = (typeof ProjectItemType !== 'undefined') ? ProjectItemType.BIN : BinType.BIN;
    for (var i = 0; i < project.rootItem.children.numItems; i++) {
        var item = project.rootItem.children[i];
        if (item.name === binName && item.type === binConstant) {
            targetBin = item;
            break;
        }
    }
    if (targetBin === null) {
        targetBin = project.rootItem.createBin(binName);
    }
    project.importFiles(filePaths, true, targetBin, false);
    return "success";
}
function importForAfterEffects(filePaths) {
    if (!app.project) { return "Error: No hay un proyecto abierto en After Effects."; }
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
    for (var j = 0; j < filePaths.length; j++) {
        var currentPath = filePaths[j];
        if (currentPath.toLowerCase().slice(-4) === ".srt") {
            continue; 
        }
        try {
            var importOptions = new ImportOptions(new File(currentPath));
            var importedItem = project.importFile(importOptions);
            importedItem.parentFolder = targetBin;
        } catch (e) {
            app.endUndoGroup(); 
            return "Error al importar " + currentPath + ": " + e.toString();
        }
    }
    app.endUndoGroup();
    return "success";
}