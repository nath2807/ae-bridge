// Composition tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading comps.jsx");
    }

    function createComp(params) {
        return withUndo("Create Composition", function () {
            if (!params || !params.name) {
                throw new Error("Composition name is required.");
            }
            var name = String(params.name);
            var width = params.width !== undefined ? Number(params.width) : 1920;
            var height = params.height !== undefined ? Number(params.height) : 1080;
            var pixelAspect = params.pixelAspect !== undefined ? Number(params.pixelAspect) : 1;
            var duration = params.duration !== undefined ? Number(params.duration) : 10;
            var frameRate = params.frameRate !== undefined ? Number(params.frameRate) : 30;

            var comp = app.project.items.addComp(name, width, height, pixelAspect, duration, frameRate);
            if (params.bgColor !== undefined) {
                comp.bgColor = toColor(params.bgColor);
            }
            return {
                id: comp.id,
                name: comp.name,
                width: comp.width,
                height: comp.height,
                duration: comp.duration,
                frameRate: comp.frameRate,
                pixelAspect: comp.pixelAspect,
                bgColor: comp.bgColor,
                numLayers: comp.numLayers
            };
        });
    }

    function listComps(params) {
        if (!app.project) return [];
        var comps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.items[i];
            if (item instanceof CompItem) {
                comps.push({
                    id: item.id,
                    name: item.name,
                    width: item.width,
                    height: item.height,
                    duration: item.duration,
                    frameRate: item.frameRate,
                    pixelAspect: item.pixelAspect,
                    numLayers: item.numLayers
                });
            }
        }
        return comps;
    }

    function getComp(params) {
        var comp = findComp(params ? params.compRef : null);
        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            layers.push(layerSummary(comp.layer(i)));
        }
        return {
            id: comp.id,
            name: comp.name,
            width: comp.width,
            height: comp.height,
            duration: comp.duration,
            frameRate: comp.frameRate,
            pixelAspect: comp.pixelAspect,
            bgColor: comp.bgColor,
            workAreaStart: comp.workAreaStart,
            workAreaDuration: comp.workAreaDuration,
            numLayers: comp.numLayers,
            layers: layers
        };
    }

    function updateComp(params) {
        return withUndo("Update Composition", function () {
            var comp = findComp(params ? params.compRef : null);
            if (params) {
                if (params.name !== undefined) comp.name = String(params.name);
                if (params.width !== undefined) comp.width = Number(params.width);
                if (params.height !== undefined) comp.height = Number(params.height);
                if (params.duration !== undefined) comp.duration = Number(params.duration);
                if (params.frameRate !== undefined) comp.frameRate = Number(params.frameRate);
                if (params.pixelAspect !== undefined) comp.pixelAspect = Number(params.pixelAspect);
                if (params.bgColor !== undefined) comp.bgColor = toColor(params.bgColor);
                if (params.workAreaStart !== undefined) comp.workAreaStart = Number(params.workAreaStart);
                if (params.workAreaDuration !== undefined) comp.workAreaDuration = Number(params.workAreaDuration);
            }
            return {
                id: comp.id,
                name: comp.name,
                width: comp.width,
                height: comp.height,
                duration: comp.duration,
                frameRate: comp.frameRate,
                pixelAspect: comp.pixelAspect,
                bgColor: comp.bgColor,
                workAreaStart: comp.workAreaStart,
                workAreaDuration: comp.workAreaDuration,
                numLayers: comp.numLayers
            };
        });
    }

    function openComp(params) {
        var comp = findComp(params ? params.compRef : null);
        comp.openInViewer();
        return {
            id: comp.id,
            name: comp.name,
            opened: true
        };
    }

    function precompose(params) {
        return withUndo("Precompose Layers", function () {
            if (!params || !params.layerRefs || params.layerRefs.length === 0) {
                throw new Error("layerRefs array is required for precompose.");
            }
            if (!params.name) {
                throw new Error("Precomposition name is required.");
            }
            var comp = findComp(params.compRef);
            var layerIndices = [];
            for (var i = 0; i < params.layerRefs.length; i++) {
                var layer = findLayer(comp, params.layerRefs[i]);
                layerIndices.push(layer.index);
            }
            var moveAll = params.moveAllAttributes !== undefined ? !!params.moveAllAttributes : true;
            var precomp = comp.layers.precompose(layerIndices, String(params.name), moveAll);
            return {
                id: precomp.id,
                name: precomp.name,
                width: precomp.width,
                height: precomp.height,
                duration: precomp.duration,
                frameRate: precomp.frameRate,
                pixelAspect: precomp.pixelAspect,
                numLayers: precomp.numLayers
            };
        });
    }

    function duplicateComp(params) {
        return withUndo("Duplicate Composition", function () {
            var comp = findComp(params ? params.compRef : null);
            var dup = comp.duplicate();
            if (params && params.newName) {
                dup.name = String(params.newName);
            }
            return {
                id: dup.id,
                name: dup.name,
                width: dup.width,
                height: dup.height,
                duration: dup.duration,
                frameRate: dup.frameRate,
                pixelAspect: dup.pixelAspect,
                numLayers: dup.numLayers
            };
        });
    }

    function deleteItem(params) {
        return withUndo("Delete Project Item", function () {
            if (!params || params.itemId === undefined) {
                throw new Error("itemId is required for deleteItem.");
            }
            var targetId = Number(params.itemId);
            var targetItem = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.items[i].id === targetId) {
                    targetItem = app.project.items[i];
                    break;
                }
            }
            if (!targetItem) {
                throw new Error("Project item with ID " + targetId + " not found.");
            }
            var deletedName = targetItem.name;
            targetItem.remove();
            return {
                deleted: true,
                itemId: targetId,
                name: deletedName
            };
        });
    }

    // Register handlers on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_create_comp = createComp;
    h.createComp = createComp;
    h.ae_list_comps = listComps;
    h.listComps = listComps;
    h.ae_get_comp = getComp;
    h.getComp = getComp;
    h.ae_update_comp = updateComp;
    h.updateComp = updateComp;
    h.ae_open_comp = openComp;
    h.openComp = openComp;
    h.ae_precompose = precompose;
    h.precompose = precompose;
    h.ae_duplicate_comp = duplicateComp;
    h.duplicateComp = duplicateComp;
    h.ae_delete_item = deleteItem;
    h.deleteItem = deleteItem;
})();
