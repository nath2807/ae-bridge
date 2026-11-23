// Footage and media management tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading footage.jsx");
    }

    function importFiles(params) {
        return withUndo("Import Files", function () {
            if (!params || !params.paths || !(params.paths instanceof Array) || params.paths.length === 0) {
                throw new Error("paths array is required for importFiles.");
            }
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var targetFolder = null;
            if (params.folderName) {
                targetFolder = findFolder(params.folderName, true);
            }

            var asSequence = !!params.asSequence;
            var imported = [];

            for (var i = 0; i < params.paths.length; i++) {
                var rawPath = cleanPath(params.paths[i]);
                var file = new File(rawPath);
                if (!file.exists) {
                    throw new Error("File not found at path: '" + rawPath + "'.");
                }

                var io = new ImportOptions(file);
                if (asSequence) {
                    io.sequence = true;
                }

                var item = app.project.importFile(io);
                if (targetFolder && item) {
                    item.parentFolder = targetFolder;
                }

                if (item) {
                    var isFootage = (item instanceof FootageItem);
                    imported.push({
                        id: item.id,
                        name: item.name,
                        type: isFootage ? "footage" : (item instanceof CompItem ? "comp" : "item"),
                        duration: item.duration || 0,
                        frameRate: item.frameRate || 0,
                        width: item.width || 0,
                        height: item.height || 0,
                        hasAudio: isFootage ? !!item.hasAudio : false,
                        hasVideo: isFootage ? !!item.hasVideo : false,
                        file: (isFootage && item.file) ? item.file.fsName : rawPath
                    });
                }
            }

            return {
                count: imported.length,
                folder: targetFolder ? targetFolder.name : null,
                items: imported
            };
        });
    }

    function scanFolder(folder, extensions, recursive, result) {
        var files = folder.getFiles();
        for (var i = 0; i < files.length; i++) {
            var item = files[i];
            if (item instanceof Folder && recursive) {
                scanFolder(item, extensions, recursive, result);
            } else if (item instanceof File) {
                var ext = item.name.split(".").pop().toLowerCase();
                for (var e = 0; e < extensions.length; e++) {
                    if (ext === extensions[e].toLowerCase()) {
                        result.push(item);
                        break;
                    }
                }
            }
        }
    }

    function importFolder(params) {
        return withUndo("Import Folder", function () {
            if (!params || !params.folderPath) {
                throw new Error("folderPath is required for importFolder.");
            }
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var rawFolder = cleanPath(params.folderPath);
            var folder = new Folder(rawFolder);
            if (!folder.exists) {
                throw new Error("Folder not found at path: '" + rawFolder + "'.");
            }

            var extensions = params.extensions || ["mp4", "mov", "png", "jpg", "jpeg", "wav", "mp3", "psd", "ai"];
            var recursive = !!params.recursive;
            var matchedFiles = [];
            scanFolder(folder, extensions, recursive, matchedFiles);

            if (matchedFiles.length === 0) {
                return {
                    folder: folder.name,
                    count: 0,
                    items: [],
                    message: "No matching media files found with specified extensions."
                };
            }

            var projFolder = findFolder(folder.name, true);
            var imported = [];

            for (var i = 0; i < matchedFiles.length; i++) {
                var file = matchedFiles[i];
                try {
                    var io = new ImportOptions(file);
                    var item = app.project.importFile(io);
                    if (item) {
                        item.parentFolder = projFolder;
                        var isFootage = (item instanceof FootageItem);
                        imported.push({
                            id: item.id,
                            name: item.name,
                            type: isFootage ? "footage" : "item",
                            duration: item.duration || 0,
                            frameRate: item.frameRate || 0,
                            width: item.width || 0,
                            height: item.height || 0,
                            hasAudio: isFootage ? !!item.hasAudio : false,
                            hasVideo: isFootage ? !!item.hasVideo : false,
                            file: file.fsName
                        });
                    }
                } catch (err) {}
            }

            return {
                folder: projFolder.name,
                count: imported.length,
                items: imported
            };
        });
    }

    function listFootage(params) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }
        var filter = (params && params.filter) ? String(params.filter).toLowerCase() : "";
        var footageList = [];

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.items[i];
            if (item instanceof FootageItem) {
                var isSolid = (item.mainSource && item.mainSource instanceof SolidSource);
                var fPath = item.file ? item.file.fsName : "";

                if (filter) {
                    var matchName = item.name.toLowerCase().indexOf(filter) !== -1;
                    var matchPath = fPath.toLowerCase().indexOf(filter) !== -1;
                    if (!matchName && !matchPath) continue;
                }

                footageList.push({
                    id: item.id,
                    name: item.name,
                    isSolid: isSolid,
                    duration: item.duration,
                    frameRate: item.frameRate,
                    width: item.width,
                    height: item.height,
                    hasAudio: !!item.hasAudio,
                    hasVideo: !!item.hasVideo,
                    file: fPath || null,
                    parentFolder: item.parentFolder ? item.parentFolder.name : null
                });
            }
        }

        return footageList;
    }

    function interpretFootage(params) {
        return withUndo("Interpret Footage", function () {
            if (!params || params.itemId === undefined) {
                throw new Error("itemId is required for interpretFootage.");
            }
            var item = findItem(params.itemId);
            if (!(item instanceof FootageItem) || !item.mainSource) {
                throw new Error("Item with ID " + params.itemId + " is not a valid FootageItem.");
            }

            var src = item.mainSource;

            if (params.conformFrameRate !== undefined) {
                var fps = Number(params.conformFrameRate);
                if (fps > 0) {
                    src.conformFrameRate = fps;
                }
            }

            if (params.alphaMode) {
                var am = String(params.alphaMode).toLowerCase();
                if (am === "straight") {
                    src.alphaMode = AlphaMode.STRAIGHT;
                } else if (am === "premultiplied") {
                    src.alphaMode = AlphaMode.PREMULTIPLIED;
                } else if (am === "ignore") {
                    src.alphaMode = AlphaMode.IGNORE;
                } else {
                    throw new Error("Unknown alphaMode: '" + params.alphaMode + "'. Valid options: 'straight', 'premultiplied', 'ignore'.");
                }
            }

            if (params.loop !== undefined) {
                var loopCount = Number(params.loop);
                if (loopCount >= 1) {
                    src.loop = loopCount;
                }
            }

            return {
                id: item.id,
                name: item.name,
                duration: item.duration,
                frameRate: item.frameRate,
                conformFrameRate: src.conformFrameRate,
                loop: src.loop,
                alphaMode: params.alphaMode || null
            };
        });
    }

    function replaceFootage(params) {
        return withUndo("Replace Footage", function () {
            if (!params || params.itemId === undefined) {
                throw new Error("itemId is required for replaceFootage.");
            }
            if (!params.newPath) {
                throw new Error("newPath is required for replaceFootage.");
            }
            var item = findItem(params.itemId);
            if (!(item instanceof FootageItem)) {
                throw new Error("Item with ID " + params.itemId + " is not a FootageItem.");
            }

            var clean = cleanPath(params.newPath);
            var f = new File(clean);
            if (!f.exists) {
                throw new Error("Replacement file does not exist: '" + clean + "'.");
            }

            item.replace(f);

            return {
                id: item.id,
                name: item.name,
                file: f.fsName,
                width: item.width,
                height: item.height,
                duration: item.duration,
                frameRate: item.frameRate
            };
        });
    }

    function createCompFromFootage(params) {
        return withUndo("Create Comp from Footage", function () {
            if (!params || !params.itemIds || !(params.itemIds instanceof Array) || params.itemIds.length === 0) {
                throw new Error("itemIds array is required for createCompFromFootage.");
            }
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var items = [];
            for (var i = 0; i < params.itemIds.length; i++) {
                var it = findItem(params.itemIds[i]);
                items.push(it);
            }

            var leadItem = items[0];
            var compName = params.name ? String(params.name) : (leadItem.name + " Comp");
            var useFootageSettings = (params.useFootageSettings !== false);

            var width = (useFootageSettings && leadItem.width) ? leadItem.width : 1920;
            var height = (useFootageSettings && leadItem.height) ? leadItem.height : 1080;
            var frameRate = (useFootageSettings && leadItem.frameRate > 0) ? leadItem.frameRate : 30;

            var isSequence = !!params.sequence;
            var totalDuration = 0;

            if (isSequence) {
                for (var d = 0; d < items.length; d++) {
                    totalDuration += (items[d].duration > 0 ? items[d].duration : 5);
                }
            } else {
                for (var m = 0; m < items.length; m++) {
                    var itemDur = (items[m].duration > 0 ? items[m].duration : 5);
                    if (itemDur > totalDuration) totalDuration = itemDur;
                }
            }
            if (totalDuration <= 0) totalDuration = 10;

            var comp = app.project.items.addComp(compName, width, height, 1, totalDuration, frameRate);

            var layers = [];
            var currentStart = 0;

            for (var l = 0; l < items.length; l++) {
                var footage = items[l];
                var layer = comp.layers.add(footage);

                if (isSequence) {
                    layer.startTime = currentStart;
                    var dur = (footage.duration > 0 ? footage.duration : 5);
                    layer.inPoint = currentStart;
                    layer.outPoint = currentStart + dur;
                    currentStart += dur;
                }

                layers.push({
                    index: layer.index,
                    name: layer.name,
                    startTime: layer.startTime,
                    inPoint: layer.inPoint,
                    outPoint: layer.outPoint
                });
            }

            comp.openInViewer();

            return {
                compId: comp.id,
                compName: comp.name,
                width: comp.width,
                height: comp.height,
                duration: comp.duration,
                frameRate: comp.frameRate,
                numLayers: comp.numLayers,
                layers: layers
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_import_files = importFiles;
    h.importFiles = importFiles;
    h.ae_import_folder = importFolder;
    h.importFolder = importFolder;
    h.ae_list_footage = listFootage;
    h.listFootage = listFootage;
    h.ae_interpret_footage = interpretFootage;
    h.interpretFootage = interpretFootage;
    h.ae_replace_footage = replaceFootage;
    h.replaceFootage = replaceFootage;
    h.ae_create_comp_from_footage = createCompFromFootage;
    h.createCompFromFootage = createCompFromFootage;
})();
