// Shared ExtendScript helpers for AE Bridge

(function () {
    function findComp(ref) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }
        if (ref) {
            if (ref.compId !== undefined && ref.compId !== null && ref.compId !== "") {
                var targetId = Number(ref.compId);
                for (var i = 1; i <= app.project.numItems; i++) {
                    var item = app.project.items[i];
                    if (item instanceof CompItem && item.id === targetId) {
                        return item;
                    }
                }
                throw new Error("Composition with ID " + targetId + " not found.");
            }
            if (ref.compName !== undefined && ref.compName !== null && ref.compName !== "") {
                var targetName = String(ref.compName);
                for (var j = 1; j <= app.project.numItems; j++) {
                    var cItem = app.project.items[j];
                    if (cItem instanceof CompItem && cItem.name === targetName) {
                        return cItem;
                    }
                }
                throw new Error("Composition named '" + targetName + "' not found.");
            }
        }
        var active = app.project.activeItem;
        if (active && active instanceof CompItem) {
            return active;
        }
        throw new Error("No composition specified and no active composition is selected in After Effects.");
    }

    function findLayer(comp, ref) {
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Invalid composition provided to findLayer.");
        }
        if (!ref) {
            throw new Error("Layer reference is missing.");
        }
        if (ref.layerIndex !== undefined && ref.layerIndex !== null && ref.layerIndex !== "") {
            var idx = Number(ref.layerIndex);
            if (idx >= 1 && idx <= comp.numLayers) {
                return comp.layer(idx);
            }
            throw new Error("Layer index " + idx + " out of range (1-" + comp.numLayers + ") in comp '" + comp.name + "'.");
        }
        if (ref.layerName !== undefined && ref.layerName !== null && ref.layerName !== "") {
            var targetName = String(ref.layerName);
            for (var i = 1; i <= comp.numLayers; i++) {
                var l = comp.layer(i);
                if (l.name === targetName) {
                    return l;
                }
            }
            throw new Error("Layer named '" + targetName + "' not found in comp '" + comp.name + "'.");
        }
        throw new Error("Invalid layer reference: must specify layerIndex or layerName.");
    }

    function toColor(value) {
        if (value === null || value === undefined) {
            throw new Error("No color value provided.");
        }
        if (typeof value === "string") {
            var hex = value.replace(/^#/, "");
            if (hex.length === 3) {
                hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
            }
            if (hex.length !== 6) {
                throw new Error("Invalid hex color string: '" + value + "'. Expected #RRGGBB or #RGB.");
            }
            var rHex = parseInt(hex.substring(0, 2), 16) / 255.0;
            var gHex = parseInt(hex.substring(2, 4), 16) / 255.0;
            var bHex = parseInt(hex.substring(4, 6), 16) / 255.0;
            return [rHex, gHex, bHex];
        }
        if (value instanceof Array || (typeof value === "object" && typeof value.length === "number")) {
            if (value.length < 3) {
                throw new Error("Color array must contain 3 elements [r, g, b]. Received length: " + value.length);
            }
            var r = Number(value[0]);
            var g = Number(value[1]);
            var b = Number(value[2]);
            if (r > 1.0 || g > 1.0 || b > 1.0) {
                r /= 255.0;
                g /= 255.0;
                b /= 255.0;
            }
            r = Math.max(0, Math.min(1, r));
            g = Math.max(0, Math.min(1, g));
            b = Math.max(0, Math.min(1, b));
            return [r, g, b];
        }
        throw new Error("Invalid color value format: " + value);
    }

    function getLayerType(layer) {
        if (layer instanceof CameraLayer) return "camera";
        if (layer instanceof LightLayer) return "light";
        if (layer instanceof ShapeLayer) return "shape";
        if (layer instanceof TextLayer) return "text";
        if (layer instanceof AVLayer) {
            if (layer.nullLayer) return "null";
            if (layer.adjustmentLayer) return "adjustment";
            if (layer.source) {
                if (layer.source instanceof CompItem) return "precomp";
                if (layer.source instanceof FootageItem) {
                    if (layer.source.mainSource && layer.source.mainSource instanceof SolidSource) {
                        return "solid";
                    }
                    return "footage";
                }
            }
            return "footage";
        }
        return "footage";
    }

    function isLayer3D(layer) {
        if (layer instanceof CameraLayer || layer instanceof LightLayer) {
            return true;
        }
        try {
            return !!layer.threeDLayer;
        } catch (e) {
            return false;
        }
    }

    function layerSummary(layer) {
        if (!layer) return null;
        return {
            index: layer.index,
            name: layer.name,
            type: getLayerType(layer),
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            startTime: layer.startTime,
            enabled: !!layer.enabled,
            threeD: isLayer3D(layer),
            parentIndex: layer.parent ? layer.parent.index : null
        };
    }

    function withUndo(undoName, fn) {
        app.beginUndoGroup(undoName || "AE Bridge Action");
        try {
            return fn();
        } finally {
            app.endUndoGroup();
        }
    }

    var PROPERTY_SHORTCUTS = {
        "position": ["Transform", "Position"],
        "scale": ["Transform", "Scale"],
        "rotation": ["Transform", "Rotation"],
        "opacity": ["Transform", "Opacity"],
        "anchorpoint": ["Transform", "Anchor Point"],
        "xrotation": ["Transform", "X Rotation"],
        "yrotation": ["Transform", "Y Rotation"],
        "zrotation": ["Transform", "Z Rotation"],
        "orientation": ["Transform", "Orientation"]
    };

    function normalizePropertyPath(pathInput) {
        if (!pathInput) return [];
        if (typeof pathInput === "string") {
            var lower = pathInput.toLowerCase();
            if (PROPERTY_SHORTCUTS.hasOwnProperty(lower)) {
                return PROPERTY_SHORTCUTS[lower].slice(0);
            }
            return [pathInput];
        }
        if (pathInput instanceof Array || (typeof pathInput === "object" && typeof pathInput.length === "number")) {
            if (pathInput.length === 1 && typeof pathInput[0] === "string") {
                var l = pathInput[0].toLowerCase();
                if (PROPERTY_SHORTCUTS.hasOwnProperty(l)) {
                    return PROPERTY_SHORTCUTS[l].slice(0);
                }
            }
            var result = [];
            for (var i = 0; i < pathInput.length; i++) {
                result.push(String(pathInput[i]));
            }
            return result;
        }
        return [String(pathInput)];
    }

    function resolveProperty(layer, pathInput) {
        if (!layer) {
            throw new Error("No layer provided to resolveProperty.");
        }
        var path = normalizePropertyPath(pathInput);
        if (!path || path.length === 0) {
            throw new Error("Property path cannot be empty.");
        }

        var current = layer;
        for (var i = 0; i < path.length; i++) {
            var segment = path[i];
            if (!current || typeof current.property !== "function") {
                throw new Error("Cannot traverse into segment '" + segment + "': current item is not a property group.");
            }

            var next = null;
            // 1. Try direct lookup by name or matchName
            try {
                next = current.property(segment);
            } catch (e) {
                next = null;
            }

            // 2. Search children by name or matchName (case-insensitive fallback)
            if (!next && current.numProperties !== undefined) {
                for (var p = 1; p <= current.numProperties; p++) {
                    var child = current.property(p);
                    if (child) {
                        if (child.name === segment || child.matchName === segment ||
                            child.name.toLowerCase() === segment.toLowerCase() ||
                            child.matchName.toLowerCase() === segment.toLowerCase()) {
                            next = child;
                            break;
                        }
                    }
                }
            }

            if (!next) {
                var available = [];
                if (current.numProperties !== undefined) {
                    for (var a = 1; a <= current.numProperties; a++) {
                        var c = current.property(a);
                        if (c) {
                            available.push("'" + c.name + "' [" + c.matchName + "]");
                        }
                    }
                }
                var failedPath = path.slice(0, i + 1).join(" > ");
                throw new Error("Failed to resolve property segment '" + segment + "' in path '" + failedPath + "'. Available properties at this level: (" + available.join(", ") + ")");
            }

            current = next;
        }

        return current;
    }

    function cleanPath(p) {
        if (!p) return "";
        return String(p).replace(/\\/g, "/");
    }

    function findItem(ref) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }
        if (ref === null || ref === undefined) {
            throw new Error("Item reference is required.");
        }
        var targetId = null;
        var targetName = null;
        if (typeof ref === "number") {
            targetId = ref;
        } else if (typeof ref === "string") {
            targetName = ref;
        } else if (typeof ref === "object") {
            if (ref.itemId !== undefined && ref.itemId !== null) targetId = Number(ref.itemId);
            else if (ref.id !== undefined && ref.id !== null) targetId = Number(ref.id);
            else if (ref.itemName !== undefined && ref.itemName !== null) targetName = String(ref.itemName);
            else if (ref.name !== undefined && ref.name !== null) targetName = String(ref.name);
        }

        if (targetId !== null) {
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.items[i];
                if (it.id === targetId) return it;
            }
            throw new Error("Project item with ID " + targetId + " not found.");
        }
        if (targetName !== null) {
            for (var j = 1; j <= app.project.numItems; j++) {
                var it2 = app.project.items[j];
                if (it2.name === targetName) return it2;
            }
            throw new Error("Project item named '" + targetName + "' not found.");
        }
        throw new Error("Invalid item reference: must provide itemId or itemName.");
    }

    function findFolder(folderName, createIfMissing) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }
        if (!folderName) return app.project.rootFolder;
        var fName = String(folderName);
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.items[i];
            if (it instanceof FolderItem && it.name === fName) {
                return it;
            }
        }
        if (createIfMissing !== false) {
            return app.project.items.addFolder(fName);
        }
        return null;
    }

    // Export globally for ExtendScript evaluation
    $.global.findComp = findComp;
    $.global.findLayer = findLayer;
    $.global.findItem = findItem;
    $.global.findFolder = findFolder;
    $.global.cleanPath = cleanPath;
    $.global.toColor = toColor;
    $.global.layerSummary = layerSummary;
    $.global.withUndo = withUndo;
    $.global.normalizePropertyPath = normalizePropertyPath;
    $.global.resolveProperty = resolveProperty;

    if ($.global.aeBridge) {
        $.global.aeBridge.findComp = findComp;
        $.global.aeBridge.findLayer = findLayer;
        $.global.aeBridge.findItem = findItem;
        $.global.aeBridge.findFolder = findFolder;
        $.global.aeBridge.cleanPath = cleanPath;
        $.global.aeBridge.toColor = toColor;
        $.global.aeBridge.layerSummary = layerSummary;
        $.global.aeBridge.withUndo = withUndo;
        $.global.aeBridge.normalizePropertyPath = normalizePropertyPath;
        $.global.aeBridge.resolveProperty = resolveProperty;
    }
})();
