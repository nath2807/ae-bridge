// AE Bridge ExtendScript Dispatcher

(function () {
    var scriptFolder = File($.fileName).parent;
    var jsonFile = File(scriptFolder.fsName + "/json.jsx");
    if (jsonFile.exists) {
        $.evalFile(jsonFile);
    } else {
        throw new Error("json.jsx not found at " + jsonFile.fsName);
    }

    $.global.aeBridge = {
        scriptFolder: scriptFolder,
        handlers: {
            ping: function (params) {
                var proj = app.project;
                return {
                    aeVersion: app.version,
                    projectName: (proj && proj.file) ? proj.file.name : "Untitled",
                    numItems: proj ? proj.numItems : 0
                };
            },

            getProjectInfo: function (params) {
                var proj = app.project;
                if (!proj) return [];

                var comps = [];
                for (var i = 1; i <= proj.numItems; i++) {
                    var item = proj.items[i];
                    if (item instanceof CompItem) {
                        comps.push({
                            id: item.id,
                            name: item.name,
                            duration: item.duration,
                            frameRate: item.frameRate,
                            width: item.width,
                            height: item.height,
                            numLayers: item.numLayers
                        });
                    }
                }
                return comps;
            },

            executeScript: function (params) {
                if (!params || typeof params.code !== "string") {
                    throw new Error("Missing code parameter");
                }
                app.beginUndoGroup("AE Bridge Script");
                try {
                    var result = eval(params.code);
                    return String(result);
                } finally {
                    app.endUndoGroup();
                }
            }
        },

        dispatch: function (method, encodedParams) {
            try {
                var decoded = decodeURIComponent(encodedParams || "");
                var params = decoded ? aeParse(decoded) : {};

                if (!this.handlers.hasOwnProperty(method)) {
                    throw new Error("Unknown method: " + method);
                }

                var res = this.handlers[method](params);
                return aeStringify({ ok: true, result: res });
            } catch (e) {
                return aeStringify({
                    ok: false,
                    error: e ? (e.message || e.toString()) : "Unknown error",
                    line: e ? e.line : null
                });
            }
        }
    };

    // Load shared helpers and libraries in lib/
    var helpersFile = File(scriptFolder.fsName + "/lib/helpers.jsx");
    if (helpersFile.exists) {
        $.evalFile(helpersFile);
    }
    var libFolder = Folder(scriptFolder.fsName + "/lib");
    if (libFolder.exists) {
        var libFiles = libFolder.getFiles("*.jsx");
        for (var l = 0; l < libFiles.length; l++) {
            var lf = libFiles[l];
            if (lf instanceof File && lf.name !== "helpers.jsx") {
                $.evalFile(lf);
            }
        }
    }

    // Load all tool files in tools/
    var toolsFolder = Folder(scriptFolder.fsName + "/tools");
    if (toolsFolder.exists) {
        var toolFiles = toolsFolder.getFiles();
        for (var i = 0; i < toolFiles.length; i++) {
            var tf = toolFiles[i];
            if (tf instanceof File && /\.jsx$/i.test(tf.name)) {
                $.evalFile(tf);
            }
        }
    }
})();
