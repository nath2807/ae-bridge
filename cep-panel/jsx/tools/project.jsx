// Project Management, Asset Organization, and Script Reloading Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading project.jsx");
    }

    // 1. ae_save_project
    function saveProject(params) {
        if (!app.project) {
            throw new Error("No active project found in After Effects.");
        }

        var savePath = params && params.path ? cleanPath(params.path) : null;

        if (savePath) {
            var targetFile = new File(savePath);
            if (targetFile.parent && !targetFile.parent.exists) {
                targetFile.parent.create();
            }
            app.project.save(targetFile);
        } else if (app.project.file) {
            app.project.save();
        } else {
            throw new Error("Project is untitled. Please provide a destination 'path' (e.g. Documents/ae-bridge-projects/MyProject.aep).");
        }

        return {
            saved: true,
            path: app.project.file ? cleanPath(app.project.file.fsName) : savePath,
            name: app.project.file ? app.project.file.name : "Untitled"
        };
    }

    // 2. ae_open_project
    function openProject(params) {
        if (!params || !params.path) {
            throw new Error("Project 'path' parameter is required to open a project.");
        }

        var targetFile = new File(cleanPath(params.path));
        if (!targetFile.exists) {
            throw new Error("Project file does not exist: " + targetFile.fsName);
        }

        if (app.project && app.project.dirty && (!params || !params.force)) {
            throw new Error("Current project has unsaved changes. Set force=true to discard changes, or save with ae_save_project first.");
        }

        app.open(targetFile);

        return {
            opened: true,
            path: app.project.file ? cleanPath(app.project.file.fsName) : cleanPath(targetFile.fsName),
            name: app.project.file ? app.project.file.name : targetFile.name,
            numItems: app.project.numItems
        };
    }

    // 3. ae_new_project
    function newProject(params) {
        if (app.project && app.project.dirty && (!params || !params.force)) {
            throw new Error("Current project has unsaved changes. Set force=true to discard changes and create a new project.");
        }

        app.newProject();

        return {
            created: true,
            name: "Untitled",
            numItems: app.project.numItems
        };
    }

    // 4. ae_project_status
    function projectStatus(params) {
        if (!app.project) {
            return {
                path: null,
                name: "None",
                dirty: false,
                numItems: 0,
                numComps: 0,
                numFootage: 0,
                numFolders: 0,
                aeVersion: app.version,
                renderers: []
            };
        }

        var numComps = 0;
        var numFootage = 0;
        var numFolders = 0;

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.items[i];
            if (item instanceof CompItem) numComps++;
            else if (item instanceof FootageItem) numFootage++;
            else if (item instanceof FolderItem) numFolders++;
        }

        var renderers = ["ADBE Standard 3d", "ADBE Advanced 3d", "ADBE Ernst"];
        if (app.project.activeItem && app.project.activeItem instanceof CompItem && app.project.activeItem.renderers) {
            renderers = app.project.activeItem.renderers;
        }

        return {
            path: app.project.file ? cleanPath(app.project.file.fsName) : null,
            name: app.project.file ? app.project.file.name : "Untitled",
            dirty: !!app.project.dirty,
            numItems: app.project.numItems,
            numComps: numComps,
            numFootage: numFootage,
            numFolders: numFolders,
            aeVersion: app.version,
            renderers: renderers
        };
    }

    // 5. ae_organize_project
    function organizeProject(params) {
        return withUndo("Organize Project Bins", function () {
            if (!app.project) {
                throw new Error("No active project found in After Effects.");
            }

            // Detect precomps (comps used as source layers inside other comps)
            var precompIds = {};
            for (var c = 1; c <= app.project.numItems; c++) {
                var cItem = app.project.items[c];
                if (cItem instanceof CompItem) {
                    for (var l = 1; l <= cItem.numLayers; l++) {
                        var lyr = cItem.layer(l);
                        if (lyr.source && lyr.source instanceof CompItem) {
                            precompIds[lyr.source.id] = true;
                        }
                    }
                }
            }

            var compsFolder = findFolder("Comps", true);
            var precompsFolder = findFolder("Precomps", true);
            var footageFolder = findFolder("Footage", true);
            var audioFolder = findFolder("Audio", true);
            var imagesFolder = findFolder("Images", true);
            var solidsFolder = findFolder("Solids", true);

            var orgFolderIds = {
                comps: compsFolder.id,
                precomps: precompsFolder.id,
                footage: footageFolder.id,
                audio: audioFolder.id,
                images: imagesFolder.id,
                solids: solidsFolder.id
            };

            var counts = {
                Comps: 0,
                Precomps: 0,
                Footage: 0,
                Audio: 0,
                Images: 0,
                Solids: 0
            };

            // Collect non-folder items to move
            var itemsToOrganize = [];
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.items[i];
                if (it instanceof FolderItem) continue;

                // If already inside one of our organization bins, skip
                var isAlreadyInBin = false;
                if (it.parentFolder) {
                    for (var k in orgFolderIds) {
                        if (it.parentFolder.id === orgFolderIds[k]) {
                            isAlreadyInBin = true;
                            break;
                        }
                    }
                }
                if (!isAlreadyInBin) {
                    itemsToOrganize.push(it);
                }
            }

            for (var j = 0; j < itemsToOrganize.length; j++) {
                var itemToMove = itemsToOrganize[j];

                if (itemToMove instanceof CompItem) {
                    if (precompIds[itemToMove.id]) {
                        itemToMove.parentFolder = precompsFolder;
                        counts.Precomps++;
                    } else {
                        itemToMove.parentFolder = compsFolder;
                        counts.Comps++;
                    }
                } else if (itemToMove instanceof FootageItem) {
                    if (itemToMove.mainSource && itemToMove.mainSource instanceof SolidSource) {
                        itemToMove.parentFolder = solidsFolder;
                        counts.Solids++;
                    } else if (itemToMove.hasAudio && !itemToMove.hasVideo) {
                        itemToMove.parentFolder = audioFolder;
                        counts.Audio++;
                    } else if (itemToMove.duration === 0 || (itemToMove.file && /\.(png|jpg|jpeg|psd|ai|tiff|tif|svg)$/i.test(itemToMove.file.name))) {
                        itemToMove.parentFolder = imagesFolder;
                        counts.Images++;
                    } else {
                        itemToMove.parentFolder = footageFolder;
                        counts.Footage++;
                    }
                }
            }

            return {
                organized: true,
                counts: counts
            };
        });
    }

    // 6. ae_reduce_project
    function reduceProject(params) {
        return withUndo("Reduce Project", function () {
            if (!app.project) {
                throw new Error("No active project found in After Effects.");
            }
            if (!params || !params.keepComps || !params.keepComps.length) {
                throw new Error("keepComps array is required specifying compositions to preserve.");
            }

            var compsToKeep = [];
            for (var i = 0; i < params.keepComps.length; i++) {
                var c = findComp(params.keepComps[i]);
                compsToKeep.push(c);
            }

            app.project.reduceProject(compsToKeep);

            return {
                reduced: true,
                remainingItems: app.project.numItems
            };
        });
    }

    // 7. ae_reload_tools
    function reloadTools(params) {
        var thisFile = File($.fileName);
        var scriptFolder = thisFile.parent.parent; // parent is tools/, parent.parent is jsx/

        var helpersFile = File(scriptFolder.fsName + "/lib/helpers.jsx");
        if (helpersFile.exists) {
            $.evalFile(helpersFile);
            reloadedFiles.push("lib/helpers.jsx");
        }
        var libFolder = Folder(scriptFolder.fsName + "/lib");
        if (libFolder.exists) {
            var libFiles = libFolder.getFiles("*.jsx");
            for (var l = 0; l < libFiles.length; l++) {
                var lf = libFiles[l];
                if (lf instanceof File && lf.name !== "helpers.jsx") {
                    try {
                        $.evalFile(lf);
                        reloadedFiles.push("lib/" + lf.name);
                    } catch (eLib) {
                        reloadedFiles.push("lib/" + lf.name + " (ERROR: " + eLib.message + ")");
                    }
                }
            }
        }

        var toolsFolder = Folder(scriptFolder.fsName + "/tools");
        var reloadedFiles = [];

        if (toolsFolder.exists) {
            var files = toolsFolder.getFiles("*.jsx");
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (f instanceof File) {
                    try {
                        $.evalFile(f);
                        reloadedFiles.push(f.name);
                    } catch (e) {
                        reloadedFiles.push(f.name + " (ERROR: " + e.message + ")");
                    }
                }
            }
        }

        return {
            reloaded: true,
            count: reloadedFiles.length,
            files: reloadedFiles
        };
    }

    // 8. ae_checkpoint
    function createCheckpoint(params) {
        if (!app.project) {
            throw new Error("No active project found in After Effects.");
        }

        if (!app.project.file) {
            var fallbackPath = params && params.defaultPath ? params.defaultPath : null;
            saveProject({ path: fallbackPath });
        }

        var curFile = app.project.file;
        var pName = curFile.name.replace(/\.aep$/i, "");
        var checkpointsFolder = new Folder(curFile.parent.fsName + "/" + pName + "_checkpoints");
        if (!checkpointsFolder.exists) {
            checkpointsFolder.create();
        }

        var now = new Date();
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        var ts = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "_" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
        var rawLabel = (params && params.label) ? String(params.label) : "checkpoint";
        var safeLabel = rawLabel.replace(/[^\w\s-]/g, "_").replace(/\s+/g, "_");
        var cpFile = new File(checkpointsFolder.fsName + "/" + ts + "_" + safeLabel + ".aep");

        app.project.save(cpFile);
        // Switch back immediately to original active project file
        app.project.save(curFile);

        return {
            checkpointPath: cleanPath(cpFile.fsName),
            checkpointName: cpFile.name,
            timestamp: ts,
            label: safeLabel,
            activeProjectFile: cleanPath(curFile.fsName)
        };
    }

    // 9. ae_list_checkpoints
    function listCheckpoints(params) {
        if (!app.project || !app.project.file) {
            return { checkpoints: [], projectPath: null };
        }

        var curFile = app.project.file;
        var pName = curFile.name.replace(/\.aep$/i, "");
        var checkpointsFolder = new Folder(curFile.parent.fsName + "/" + pName + "_checkpoints");

        if (!checkpointsFolder.exists) {
            return {
                checkpoints: [],
                folder: cleanPath(checkpointsFolder.fsName),
                activeProjectFile: cleanPath(curFile.fsName)
            };
        }

        var files = checkpointsFolder.getFiles("*.aep");
        var results = [];

        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (f instanceof File) {
                var m = f.name.match(/^(\d{8}_\d{6})_(.+)\.aep$/i);
                results.push({
                    name: f.name,
                    path: cleanPath(f.fsName),
                    timestamp: m ? m[1] : null,
                    label: m ? m[2] : f.name,
                    sizeBytes: f.length,
                    modified: f.modified ? f.modified.toString() : null
                });
            }
        }

        // Sort latest first
        results.sort(function (a, b) {
            if (a.name > b.name) return -1;
            if (a.name < b.name) return 1;
            return 0;
        });

        return {
            folder: cleanPath(checkpointsFolder.fsName),
            activeProjectFile: cleanPath(curFile.fsName),
            totalCheckpoints: results.length,
            checkpoints: results
        };
    }

    // 10. ae_restore_checkpoint
    function restoreCheckpoint(params) {
        if (!params || !params.file) {
            throw new Error("Checkpoint 'file' parameter (name or full path) is required.");
        }

        var targetFile = new File(cleanPath(params.file));

        if (!targetFile.exists && app.project && app.project.file) {
            var pName = app.project.file.name.replace(/\.aep$/i, "");
            var testFolder = app.project.file.parent.fsName + "/" + pName + "_checkpoints/";
            var altFile = new File(testFolder + params.file);
            if (altFile.exists) {
                targetFile = altFile;
            }
        }

        if (!targetFile.exists) {
            throw new Error("Checkpoint file not found: " + targetFile.fsName);
        }

        if (app.project && app.project.dirty && (!params || !params.force)) {
            throw new Error("Current project has unsaved changes. Set force=true to discard changes and restore checkpoint.");
        }

        app.open(targetFile);

        return {
            restored: true,
            path: cleanPath(app.project.file.fsName),
            name: app.project.file.name
        };
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_save_project = saveProject;
    h.saveProject = saveProject;
    h.ae_open_project = openProject;
    h.openProject = openProject;
    h.ae_new_project = newProject;
    h.newProject = newProject;
    h.ae_project_status = projectStatus;
    h.projectStatus = projectStatus;
    h.ae_organize_project = organizeProject;
    h.organizeProject = organizeProject;
    h.ae_reduce_project = reduceProject;
    h.reduceProject = reduceProject;
    h.ae_reload_tools = reloadTools;
    h.reloadTools = reloadTools;
    h.ae_checkpoint = createCheckpoint;
    h.createCheckpoint = createCheckpoint;
    h.ae_list_checkpoints = listCheckpoints;
    h.listCheckpoints = listCheckpoints;
    h.ae_restore_checkpoint = restoreCheckpoint;
    h.restoreCheckpoint = restoreCheckpoint;
})();
