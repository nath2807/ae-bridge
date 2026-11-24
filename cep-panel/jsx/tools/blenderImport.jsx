// Blender 3D Sequence & Camera Sync Importer for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading blenderImport.jsx");
    }

    function importSequenceFile(firstFilePath, fps) {
        var fileObj = new File(cleanPath(firstFilePath));
        if (!fileObj.exists) {
            throw new Error("Sequence start file does not exist: " + fileObj.fsName);
        }

        var io = new ImportOptions(fileObj);
        io.sequence = true;
        io.forceAlphabetical = true;

        var footage = app.project.importFile(io);
        if (footage && fps && footage.mainSource) {
            try {
                footage.mainSource.conformFrameRate = Number(fps);
            } catch (e) {}
        }
        return footage;
    }

    // 1. ae_import_blender_render
    function importBlenderRenderHandler(params) {
        return withUndo("Import Blender Render Sequence", function () {
            if (!params) throw new Error("Missing parameters for ae_import_blender_render.");
            if (!params.colorFirstFrame) throw new Error("colorFirstFrame path is required.");

            var comp = findComp(params.compRef);
            var fps = params.fps || comp.frameRate || 30;

            // Import main color image sequence
            var colorFootage = importSequenceFile(params.colorFirstFrame, fps);
            var colorLayer = comp.layers.add(colorFootage);
            colorLayer.name = params.layerName || "Blender 3D Render";
            colorLayer.startTime = params.startTime !== undefined ? Number(params.startTime) : 0;
            if (colorFootage.duration > 0) {
                colorLayer.outPoint = colorLayer.startTime + colorFootage.duration;
            }

            var depthLayer = null;
            if (params.depthFirstFrame && params.addDepthPass !== false) {
                try {
                    var depthFootage = importSequenceFile(params.depthFirstFrame, fps);
                    depthLayer = comp.layers.add(depthFootage);
                    depthLayer.name = "Blender Depth Pass";
                    depthLayer.startTime = colorLayer.startTime;
                    depthLayer.enabled = false; // Kept hidden as an effect reference map
                    depthLayer.moveAfter(colorLayer);
                } catch (eDepth) {}
            }

            var createdCamera = null;
            var createdNulls = [];

            // Camera Sync from pre-parsed camera tracking data
            if (params.cameraData && params.syncCamera !== false) {
                var camData = params.cameraData;
                var meta = camData.metadata || {};
                var startFrame = meta.startFrame || 1;
                var camFrames = (camData.camera && camData.camera.frames) ? camData.camera.frames : {};

                var camObj = comp.layers.addCamera("Blender Camera", [comp.width / 2, comp.height / 2]);
                camObj.startTime = colorLayer.startTime;

                var posProp = camObj.property("Transform").property("Position");
                var poiProp = camObj.property("Transform").property("Point of Interest");
                var zoomProp = camObj.property("Camera Options").property("Zoom");
                var xRotProp = camObj.property("Transform").property("X Rotation");
                var yRotProp = camObj.property("Transform").property("Y Rotation");
                var zRotProp = camObj.property("Transform").property("Z Rotation");

                for (var frameStr in camFrames) {
                    if (!camFrames.hasOwnProperty(frameStr)) continue;
                    var fNum = parseInt(frameStr, 10);
                    var t = colorLayer.startTime + ((fNum - startFrame) / floatFps(fps));
                    var frameData = camFrames[frameStr];
                    var aeVals = frameData.afterEffects;
                    if (!aeVals) continue;

                    if (aeVals.position) posProp.setValueAtTime(t, aeVals.position);
                    if (aeVals.pointOfInterest) poiProp.setValueAtTime(t, aeVals.pointOfInterest);
                    if (aeVals.zoom !== undefined) zoomProp.setValueAtTime(t, aeVals.zoom);
                    if (aeVals.rotationX !== undefined && xRotProp) xRotProp.setValueAtTime(t, aeVals.rotationX);
                    if (aeVals.rotationY !== undefined && yRotProp) yRotProp.setValueAtTime(t, aeVals.rotationY);
                    if (aeVals.rotationZ !== undefined && zRotProp) zRotProp.setValueAtTime(t, aeVals.rotationZ);
                }

                createdCamera = camObj.name;

                // Create 3D Null targets for scene objects
                if (camData.objects) {
                    for (var objName in camData.objects) {
                        if (!camData.objects.hasOwnProperty(objName)) continue;
                        var objFrames = camData.objects[objName].frames;
                        if (!objFrames) continue;

                        var nullL = comp.layers.addNull();
                        nullL.name = "Blender_" + objName;
                        nullL.threeDLayer = true;
                        nullL.startTime = colorLayer.startTime;
                        var nullPos = nullL.property("Transform").property("Position");

                        for (var oFStr in objFrames) {
                            if (!objFrames.hasOwnProperty(oFStr)) continue;
                            var ofNum = parseInt(oFStr, 10);
                            var ot = colorLayer.startTime + ((ofNum - startFrame) / floatFps(fps));
                            var oAe = objFrames[oFStr].afterEffectsPosition;
                            if (oAe) nullPos.setValueAtTime(ot, oAe);
                        }

                        createdNulls.push(nullL.name);
                    }
                }
            }

            return {
                imported: true,
                compName: comp.name,
                colorLayer: colorLayer.name,
                depthLayer: depthLayer ? depthLayer.name : null,
                camera: createdCamera,
                nullCount: createdNulls.length,
                nulls: createdNulls
            };
        });
    }

    function floatFps(f) {
        var num = Number(f);
        return num > 0 ? num : 30.0;
    }

    // 2. ae_depth_effects
    function applyDepthEffectsHandler(params) {
        return withUndo("Apply Depth Effects", function () {
            if (!params) throw new Error("Missing parameters for ae_depth_effects.");
            var comp = findComp(params.compRef);
            var depthLayer = findLayer(comp, params.depthLayerRef);
            var targetLayer = params.targetLayerRef ? findLayer(comp, params.targetLayerRef) : comp.layer(1);
            var effects = params.effects || ["dof"];

            var applied = [];

            // A. Depth of Field (Camera Lens Blur using depth map)
            if (containsEffect(effects, "dof")) {
                var lensBlur = targetLayer.property("Effects").addProperty("ADBE Camera Lens Blur");
                if (lensBlur) {
                    try {
                        lensBlur.name = "Depth of Field (Blender Z)";
                        // Set depth map layer reference
                        if (lensBlur.property("Blur Map")) {
                            lensBlur.property("Blur Map").setValue(depthLayer.index);
                        }
                        if (lensBlur.property("Blur Radius")) {
                            lensBlur.property("Blur Radius").setValue(params.dofRadius !== undefined ? Number(params.dofRadius) : 15);
                        }
                        applied.push("dof");
                    } catch (eDof) {}
                }
            }

            // B. Atmospheric Gradient Fog
            if (containsEffect(effects, "fog")) {
                var fogAdj = comp.layers.addSolid([1, 1, 1], "Atmospheric Fog (Depth Matte)", comp.width, comp.height, 1, comp.duration);
                fogAdj.adjustmentLayer = true;
                fogAdj.moveBefore(targetLayer);

                var tintFx = fogAdj.property("Effects").addProperty("ADBE Tint");
                if (tintFx) {
                    try {
                        var fogCol = params.fogColor ? toColor(params.fogColor) : [0.75, 0.82, 0.95];
                        tintFx.property("Map White To").setValue(fogCol);
                    } catch (eFog) {}
                }

                // Set track matte to depth layer
                try {
                    fogAdj.setTrackMatte(depthLayer, TrackMatteType.LUMA);
                } catch (eTm) {}

                applied.push("fog");
            }

            return {
                applied: applied,
                compName: comp.name,
                depthLayer: depthLayer.name,
                targetLayer: targetLayer.name
            };
        });
    }

    function containsEffect(arr, name) {
        if (!arr || !(arr instanceof Array)) return false;
        var n = name.toLowerCase();
        for (var i = 0; i < arr.length; i++) {
            if (String(arr[i]).toLowerCase() === n) return true;
        }
        return false;
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_import_blender_render = importBlenderRenderHandler;
    h.importBlenderRender = importBlenderRenderHandler;
    h.ae_depth_effects = applyDepthEffectsHandler;
    h.applyDepthEffects = applyDepthEffectsHandler;
})();
