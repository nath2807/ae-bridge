// Scene Graph Export & Reconstruction Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading scenegraph.jsx");
    }

    function exportSceneGraph(params) {
        var comp = findComp(params ? params.compRef : null);

        var scene = {
            version: "1.3",
            comp: {
                id: comp.id,
                name: comp.name,
                width: comp.width,
                height: comp.height,
                duration: comp.duration,
                frameRate: comp.frameRate,
                pixelAspect: comp.pixelAspect,
                bgColor: [comp.bgColor[0], comp.bgColor[1], comp.bgColor[2]],
                numLayers: comp.numLayers
            },
            layers: []
        };

        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var layerType = "unknown";

            if (layer instanceof TextLayer) {
                layerType = "text";
            } else if (layer instanceof CameraLayer) {
                layerType = "camera";
            } else if (layer instanceof LightLayer) {
                layerType = "light";
            } else if (layer.source instanceof CompItem) {
                layerType = "comp";
            } else if (layer.source && layer.source.mainSource instanceof SolidSource) {
                layerType = layer.nullLayer ? "null" : (layer.adjustmentLayer ? "adjustment" : "solid");
            } else if (layer.source instanceof FootageItem) {
                layerType = "footage";
            } else if (layer instanceof ShapeLayer) {
                layerType = "shape";
            }

            var layerData = {
                index: layer.index,
                name: layer.name,
                type: layerType,
                inPoint: Math.round(layer.inPoint * 1000) / 1000,
                outPoint: Math.round(layer.outPoint * 1000) / 1000,
                startTime: Math.round(layer.startTime * 1000) / 1000,
                threeD: !!layer.threeDLayer,
                enabled: !!layer.enabled,
                parentIndex: layer.parent ? layer.parent.index : null
            };

            // Transform
            try {
                var t = layer.transform;
                var transformData = {};
                if (t.position) transformData.position = t.position.value;
                if (t.scale) transformData.scale = t.scale.value;
                if (t.rotation) transformData.rotation = t.rotation.value;
                if (t.opacity) transformData.opacity = t.opacity.value;
                if (t.anchorPoint) transformData.anchorPoint = t.anchorPoint.value;
                layerData.transform = transformData;
            } catch (eTr) {}

            // Text content if applicable
            if (layerType === "text") {
                try {
                    var sourceText = layer.property("Source Text");
                    if (sourceText && sourceText.value) {
                        var textDoc = sourceText.value;
                        layerData.text = {
                            content: textDoc.text,
                            fontSize: textDoc.fontSize,
                            font: textDoc.font,
                            justification: String(textDoc.justification)
                        };
                    }
                } catch (eTxt) {}
            }

            // Solid / color if applicable
            if (layerType === "solid" && layer.source && layer.source.mainSource) {
                try {
                    layerData.solid = {
                        color: layer.source.mainSource.color,
                        width: layer.source.width,
                        height: layer.source.height
                    };
                } catch (eSol) {}
            }

            // Effects
            try {
                var fxGroup = layer.property("ADBE Effect Parade");
                if (fxGroup && fxGroup.numProperties > 0) {
                    layerData.effects = [];
                    for (var f = 1; f <= fxGroup.numProperties; f++) {
                        var fx = fxGroup.property(f);
                        if (fx) {
                            layerData.effects.push({
                                name: fx.name,
                                matchName: fx.matchName,
                                enabled: !!fx.enabled
                            });
                        }
                    }
                }
            } catch (eFx) {}

            scene.layers.push(layerData);
        }

        return scene;
    }

    function applySceneGraph(params) {
        if (!params || !params.scene) {
            throw new Error("Missing 'scene' payload for applySceneGraph.");
        }
        var scene = params.scene;

        return withUndo("Apply Scene Graph", function () {
            var compData = scene.comp || {};
            var compName = compData.name || ("Reconstructed_" + Date.now());
            var width = compData.width || 1920;
            var height = compData.height || 1080;
            var pixelAspect = compData.pixelAspect || 1;
            var duration = compData.duration || 10;
            var frameRate = compData.frameRate || 30;

            var comp = app.project.items.addComp(compName, width, height, pixelAspect, duration, frameRate);
            if (compData.bgColor && compData.bgColor instanceof Array) {
                comp.bgColor = compData.bgColor;
            }

            var layers = scene.layers || [];
            var createdLayers = {};

            // Add layers in reverse index order so index 1 ends up on top
            for (var i = layers.length - 1; i >= 0; i--) {
                var lData = layers[i];
                var newLayer = null;

                if (lData.type === "text") {
                    var txtContent = (lData.text && lData.text.content) ? lData.text.content : (lData.name || "Text");
                    newLayer = comp.layers.addText(txtContent);
                    if (lData.text && lData.text.fontSize) {
                        try {
                            var textProp = newLayer.property("Source Text");
                            var doc = textProp.value;
                            doc.fontSize = Number(lData.text.fontSize);
                            textProp.setValue(doc);
                        } catch (eDoc) {}
                    }
                } else if (lData.type === "solid") {
                    var sCol = (lData.solid && lData.solid.color) ? lData.solid.color : [0.5, 0.5, 0.5];
                    var sW = (lData.solid && lData.solid.width) ? lData.solid.width : width;
                    var sH = (lData.solid && lData.solid.height) ? lData.solid.height : height;
                    newLayer = comp.layers.addSolid(sCol, lData.name || "Solid", sW, sH, pixelAspect, duration);
                } else if (lData.type === "null") {
                    newLayer = comp.layers.addNull();
                    newLayer.name = lData.name || "Null";
                } else if (lData.type === "camera") {
                    newLayer = comp.layers.addCamera(lData.name || "Camera", [width / 2, height / 2]);
                } else if (lData.type === "light") {
                    newLayer = comp.layers.addLight(lData.name || "Light", [width / 2, height / 2]);
                } else if (lData.type === "shape") {
                    newLayer = comp.layers.addShape();
                    newLayer.name = lData.name || "Shape";
                }

                if (newLayer) {
                    if (lData.name) newLayer.name = lData.name;
                    if (lData.threeD && newLayer.canSetThreeD) newLayer.threeDLayer = true;

                    // Set transform
                    if (lData.transform) {
                        try {
                            var tr = newLayer.transform;
                            if (lData.transform.position && tr.position) tr.position.setValue(lData.transform.position);
                            if (lData.transform.scale && tr.scale) tr.scale.setValue(lData.transform.scale);
                            if (lData.transform.rotation && tr.rotation) tr.rotation.setValue(lData.transform.rotation);
                            if (lData.transform.opacity !== undefined && tr.opacity) tr.opacity.setValue(lData.transform.opacity);
                        } catch (eTr) {}
                    }

                    if (lData.inPoint !== undefined) newLayer.inPoint = lData.inPoint;
                    if (lData.outPoint !== undefined) newLayer.outPoint = lData.outPoint;

                    createdLayers[lData.index] = newLayer;
                }
            }

            // Restore parenting
            for (var p = 0; p < layers.length; p++) {
                var pData = layers[p];
                if (pData.parentIndex && createdLayers[pData.index] && createdLayers[pData.parentIndex]) {
                    try {
                        createdLayers[pData.index].parent = createdLayers[pData.parentIndex];
                    } catch (eParent) {}
                }
            }

            return {
                compId: comp.id,
                compName: comp.name,
                numLayers: comp.numLayers,
                success: true
            };
        });
    }

    var h = $.global.aeBridge.handlers;
    h.ae_export_scene_graph = exportSceneGraph;
    h.exportSceneGraph = exportSceneGraph;
    h.ae_apply_scene_graph = applySceneGraph;
    h.applySceneGraph = applySceneGraph;
})();
