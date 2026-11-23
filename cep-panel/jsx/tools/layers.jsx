// Layer tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading layers.jsx");
    }

    var BLEND_MODES = {
        "normal": BlendingMode.NORMAL,
        "dissolve": BlendingMode.DISSOLVE,
        "darken": BlendingMode.DARKEN,
        "multiply": BlendingMode.MULTIPLY,
        "colorburn": BlendingMode.COLOR_BURN,
        "classiccolorburn": BlendingMode.CLASSIC_COLOR_BURN,
        "linearburn": BlendingMode.LINEAR_BURN,
        "darkercolor": BlendingMode.DARKER_COLOR,
        "add": BlendingMode.ADD,
        "lighten": BlendingMode.LIGHTEN,
        "screen": BlendingMode.SCREEN,
        "colordodge": BlendingMode.COLOR_DODGE,
        "classiccolordodge": BlendingMode.CLASSIC_COLOR_DODGE,
        "lineardodge": BlendingMode.LINEAR_DODGE,
        "lightercolor": BlendingMode.LIGHTER_COLOR,
        "overlay": BlendingMode.OVERLAY,
        "softlight": BlendingMode.SOFT_LIGHT,
        "hardlight": BlendingMode.HARD_LIGHT,
        "vividlight": BlendingMode.VIVID_LIGHT,
        "linearlight": BlendingMode.LINEAR_LIGHT,
        "pinlight": BlendingMode.PIN_LIGHT,
        "hardmix": BlendingMode.HARD_MIX,
        "difference": BlendingMode.DIFFERENCE,
        "exclusion": BlendingMode.EXCLUSION,
        "subtract": BlendingMode.SUBTRACT,
        "divide": BlendingMode.DIVIDE,
        "hue": BlendingMode.HUE,
        "saturation": BlendingMode.SATURATION,
        "color": BlendingMode.COLOR,
        "luminosity": BlendingMode.LUMINOSITY
    };

    function addSolid(params) {
        return withUndo("Add Solid Layer", function () {
            if (!params || !params.name) {
                throw new Error("Solid layer name is required.");
            }
            if (!params.color) {
                throw new Error("Solid layer color is required.");
            }
            var comp = findComp(params.compRef);
            var color = toColor(params.color);
            var width = params.width !== undefined ? Number(params.width) : comp.width;
            var height = params.height !== undefined ? Number(params.height) : comp.height;
            var solid = comp.layers.addSolid(color, String(params.name), width, height, comp.pixelAspect, comp.duration);
            if (params.adjustment) {
                solid.adjustmentLayer = true;
            }
            return layerSummary(solid);
        });
    }

    function addNull(params) {
        return withUndo("Add Null Layer", function () {
            var comp = findComp(params ? params.compRef : null);
            var nullLayer = comp.layers.addNull(comp.duration);
            if (params && params.name) {
                nullLayer.name = String(params.name);
            }
            return layerSummary(nullLayer);
        });
    }

    function addText(params) {
        return withUndo("Add Text Layer", function () {
            var comp = findComp(params ? params.compRef : null);
            var textStr = params && params.text !== undefined ? String(params.text) : "";
            var textLayer = comp.layers.addText(textStr);

            var textPropGroup = textLayer.property("ADBE Text Properties");
            var sourceTextProp = textPropGroup ? textPropGroup.property("ADBE Text Document") : textLayer.property("Source Text");
            var textDoc = sourceTextProp.value;
            textDoc.text = textStr;

            if (params) {
                if (params.font) {
                    textDoc.font = String(params.font);
                }
                var fontSize = params.fontSize !== undefined ? Number(params.fontSize) : 100;
                textDoc.fontSize = fontSize;

                if (params.fillColor !== undefined) {
                    textDoc.fillColor = toColor(params.fillColor);
                    textDoc.applyFill = true;
                }

                if (params.justification) {
                    var just = String(params.justification).toLowerCase();
                    if (just === "left") {
                        textDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
                    } else if (just === "center") {
                        textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                    } else if (just === "right") {
                        textDoc.justification = ParagraphJustification.RIGHT_JUSTIFY;
                    }
                }
            }
            sourceTextProp.setValue(textDoc);

            var pos = [comp.width / 2, comp.height / 2];
            if (params && params.position && params.position.length >= 2) {
                pos = [Number(params.position[0]), Number(params.position[1])];
            }
            textLayer.property("ADBE Transform Group").property("ADBE Position").setValue(pos);

            return layerSummary(textLayer);
        });
    }

    function addShape(params) {
        return withUndo("Add Shape Layer", function () {
            if (!params || !params.shape) {
                throw new Error("shape type is required ('rectangle', 'ellipse', 'star', or 'polygon').");
            }
            if (!params.size || params.size.length < 2) {
                throw new Error("size [width, height] is required.");
            }
            var comp = findComp(params.compRef);
            var shapeLayer = comp.layers.addShape();
            if (params.name) {
                shapeLayer.name = String(params.name);
            }

            var rootGroup = shapeLayer.property("ADBE Root Vectors Group");
            var shapeGroup = rootGroup.addProperty("ADBE Vector Group");
            var vectors = shapeGroup.property("ADBE Vectors Group");

            var w = Number(params.size[0]);
            var h = Number(params.size[1]);
            var shapeType = String(params.shape).toLowerCase();

            if (shapeType === "rectangle") {
                var rect = vectors.addProperty("ADBE Vector Shape - Rect");
                rect.property("ADBE Vector Rect Size").setValue([w, h]);
                if (params.roundness !== undefined) {
                    rect.property("ADBE Vector Rect Roundness").setValue(Number(params.roundness));
                }
            } else if (shapeType === "ellipse") {
                var ellipse = vectors.addProperty("ADBE Vector Shape - Ellipse");
                ellipse.property("ADBE Vector Ellipse Size").setValue([w, h]);
            } else if (shapeType === "star") {
                var star = vectors.addProperty("ADBE Vector Shape - Star");
                star.property("ADBE Vector Star Type").setValue(1);
                star.property("ADBE Vector Star Outer Radius").setValue(Math.max(w, h) / 2);
                star.property("ADBE Vector Star Inner Radius").setValue(Math.min(w, h) / 4);
                if (params.roundness !== undefined) {
                    star.property("ADBE Vector Star Outer Roundness").setValue(Number(params.roundness));
                }
            } else if (shapeType === "polygon") {
                var poly = vectors.addProperty("ADBE Vector Shape - Star");
                poly.property("ADBE Vector Star Type").setValue(2);
                poly.property("ADBE Vector Star Outer Radius").setValue(Math.max(w, h) / 2);
                if (params.roundness !== undefined) {
                    poly.property("ADBE Vector Star Outer Roundness").setValue(Number(params.roundness));
                }
            } else {
                throw new Error("Unsupported shape type: " + params.shape);
            }

            var hasFill = (params.fillColor !== undefined);
            var hasStroke = (params.strokeColor !== undefined || params.strokeWidth !== undefined);

            if (!hasFill && !hasStroke) {
                hasFill = true;
                params.fillColor = [1, 1, 1];
            }

            if (hasFill) {
                var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
                fill.property("ADBE Vector Fill Color").setValue(toColor(params.fillColor));
            }

            if (hasStroke) {
                var stroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
                if (params.strokeColor !== undefined) {
                    stroke.property("ADBE Vector Stroke Color").setValue(toColor(params.strokeColor));
                }
                var sWidth = params.strokeWidth !== undefined ? Number(params.strokeWidth) : 2;
                stroke.property("ADBE Vector Stroke Width").setValue(sWidth);
            }

            return layerSummary(shapeLayer);
        });
    }

    function addCamera(params) {
        return withUndo("Add Camera Layer", function () {
            var comp = findComp(params ? params.compRef : null);
            var name = params && params.name ? String(params.name) : "Camera 1";
            var centerPoint = [comp.width / 2, comp.height / 2];
            var camera = comp.layers.addCamera(name, centerPoint);

            var focalLengthMap = {
                "35mm": 35,
                "50mm": 50,
                "85mm": 85
            };
            var fl = 50;
            if (params && params.preset) {
                var p = String(params.preset).toLowerCase();
                if (focalLengthMap.hasOwnProperty(p)) {
                    fl = focalLengthMap[p];
                }
            }
            var zoomVal = (comp.width * fl) / 36.0;

            try {
                var camOptions = camera.property("ADBE Camera Options Group");
                if (camOptions) {
                    var zoomProp = camOptions.property("ADBE Camera Zoom");
                    if (zoomProp) zoomProp.setValue(zoomVal);
                    var focusProp = camOptions.property("ADBE Camera Focus Distance");
                    if (focusProp) focusProp.setValue(zoomVal);
                }
            } catch (e) {}

            if (params && params.position && params.position.length >= 3) {
                var pos = [Number(params.position[0]), Number(params.position[1]), Number(params.position[2])];
                camera.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
            }

            return layerSummary(camera);
        });
    }

    function addLight(params) {
        return withUndo("Add Light Layer", function () {
            var comp = findComp(params ? params.compRef : null);
            var name = params && params.name ? String(params.name) : "Light 1";
            var centerPoint = [comp.width / 2, comp.height / 2];
            var light = comp.layers.addLight(name, centerPoint);

            if (params && params.type) {
                var type = String(params.type).toLowerCase();
                if (type === "point") light.lightType = LightType.POINT;
                else if (type === "spot") light.lightType = LightType.SPOT;
                else if (type === "parallel") light.lightType = LightType.PARALLEL;
                else if (type === "ambient") light.lightType = LightType.AMBIENT;
                else throw new Error("Unsupported light type: " + params.type);
            }

            var lightOptions = light.property("ADBE Light Options Group");
            if (lightOptions) {
                if (params && params.color !== undefined) {
                    var colProp = lightOptions.property("ADBE Light Color");
                    if (colProp) colProp.setValue(toColor(params.color));
                }
                if (params && params.intensity !== undefined) {
                    var intProp = lightOptions.property("ADBE Light Intensity");
                    if (intProp) intProp.setValue(Number(params.intensity));
                }
            }

            return layerSummary(light);
        });
    }

    function listLayers(params) {
        var comp = findComp(params ? params.compRef : null);
        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            layers.push(layerSummary(comp.layer(i)));
        }
        return layers;
    }

    function updateLayer(params) {
        return withUndo("Update Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for updateLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var wasLocked = layer.locked;
            if (wasLocked && params.locked !== true) {
                layer.locked = false;
            }

            if (params.name !== undefined) layer.name = String(params.name);
            if (params.enabled !== undefined) layer.enabled = !!params.enabled;
            if (params.solo !== undefined) layer.solo = !!params.solo;
            if (params.shy !== undefined) layer.shy = !!params.shy;
            if (params.label !== undefined) layer.label = Number(params.label);

            if (params.threeD !== undefined) {
                try {
                    layer.threeDLayer = !!params.threeD;
                } catch (e) {}
            }

            if (params.startTime !== undefined) layer.startTime = Number(params.startTime);
            if (params.inPoint !== undefined) layer.inPoint = Number(params.inPoint);
            if (params.outPoint !== undefined) layer.outPoint = Number(params.outPoint);

            if (params.parent === null) {
                layer.parent = null;
            } else if (params.parent !== undefined) {
                var parentLayer = findLayer(comp, params.parent);
                layer.parent = parentLayer;
            }

            if (params.blendMode !== undefined && layer instanceof AVLayer) {
                var bmKey = String(params.blendMode).toLowerCase().replace(/[\s_-]/g, "");
                if (BLEND_MODES.hasOwnProperty(bmKey)) {
                    layer.blendingMode = BLEND_MODES[bmKey];
                } else {
                    throw new Error("Unknown blending mode: " + params.blendMode);
                }
            }

            if (params.locked !== undefined) {
                layer.locked = !!params.locked;
            } else if (wasLocked) {
                layer.locked = true;
            }

            return layerSummary(layer);
        });
    }

    function setTransform(params) {
        return withUndo("Set Transform", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setTransform.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var transformGroup = layer.property("ADBE Transform Group");

            if (params.anchorPoint !== undefined) {
                var apProp = transformGroup.property("ADBE Anchor Point");
                if (apProp) apProp.setValue(params.anchorPoint);
            }

            if (params.position !== undefined) {
                var posProp = transformGroup.property("ADBE Position");
                if (posProp) {
                    if (posProp.dimensionsSeparated) {
                        var posX = transformGroup.property("ADBE Position_0");
                        var posY = transformGroup.property("ADBE Position_1");
                        if (posX && params.position[0] !== undefined) posX.setValue(Number(params.position[0]));
                        if (posY && params.position[1] !== undefined) posY.setValue(Number(params.position[1]));
                        var is3DLayer = false;
                        try { is3DLayer = !!layer.threeDLayer; } catch (e) {}
                        if (is3DLayer && params.position[2] !== undefined) {
                            var posZ = transformGroup.property("ADBE Position_2");
                            if (posZ) posZ.setValue(Number(params.position[2]));
                        }
                    } else {
                        posProp.setValue(params.position);
                    }
                }
            }

            if (params.scale !== undefined) {
                var scaleProp = transformGroup.property("ADBE Scale");
                if (scaleProp) {
                    var sVal = params.scale;
                    if (typeof sVal === "number") {
                        sVal = [sVal, sVal, 100];
                    } else if (sVal instanceof Array && sVal.length === 2) {
                        sVal = [Number(sVal[0]), Number(sVal[1]), 100];
                    }
                    scaleProp.setValue(sVal);
                }
            }

            if (params.opacity !== undefined) {
                var opProp = transformGroup.property("ADBE Opacity");
                if (opProp) opProp.setValue(Number(params.opacity));
            }

            var is3D = false;
            try { is3D = !!layer.threeDLayer; } catch (e) {}

            if (is3D) {
                if (params.orientation !== undefined) {
                    var orientProp = transformGroup.property("ADBE Orientation");
                    if (orientProp) orientProp.setValue(params.orientation);
                }
                if (params.rotationX !== undefined) {
                    var rotX = transformGroup.property("ADBE Rotate X");
                    if (rotX) rotX.setValue(Number(params.rotationX));
                }
                if (params.rotationY !== undefined) {
                    var rotY = transformGroup.property("ADBE Rotate Y");
                    if (rotY) rotY.setValue(Number(params.rotationY));
                }
                if (params.rotationZ !== undefined) {
                    var rotZ = transformGroup.property("ADBE Rotate Z");
                    if (rotZ) rotZ.setValue(Number(params.rotationZ));
                }
                if (params.rotation !== undefined) {
                    var rotZAlt = transformGroup.property("ADBE Rotate Z");
                    if (rotZAlt) rotZAlt.setValue(Number(params.rotation));
                }
            } else {
                if (params.rotation !== undefined) {
                    var rot2D = transformGroup.property("ADBE Rotate Z");
                    if (rot2D) rot2D.setValue(Number(params.rotation));
                }
            }

            return layerSummary(layer);
        });
    }

    function duplicateLayer(params) {
        return withUndo("Duplicate Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for duplicateLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var dup = layer.duplicate();
            return layerSummary(dup);
        });
    }

    function deleteLayer(params) {
        return withUndo("Delete Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for deleteLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var deletedInfo = {
                index: layer.index,
                name: layer.name
            };
            layer.remove();
            return {
                deleted: true,
                layer: deletedInfo
            };
        });
    }

    function reorderLayer(params) {
        return withUndo("Reorder Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for reorderLayer.");
            }
            if (params.newIndex === undefined) {
                throw new Error("newIndex is required for reorderLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var target = Number(params.newIndex);

            if (target <= 1) {
                layer.moveToBeginning();
            } else if (target >= comp.numLayers) {
                layer.moveToEnd();
            } else {
                if (target < layer.index) {
                    layer.moveBefore(comp.layer(target));
                } else if (target > layer.index) {
                    layer.moveAfter(comp.layer(target));
                }
            }
            return layerSummary(layer);
        });
    }

    // Register handlers on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_add_solid = addSolid;
    h.addSolid = addSolid;
    h.ae_add_null = addNull;
    h.addNull = addNull;
    h.ae_add_text = addText;
    h.addText = addText;
    h.ae_add_shape = addShape;
    h.addShape = addShape;
    h.ae_add_camera = addCamera;
    h.addCamera = addCamera;
    h.ae_add_light = addLight;
    h.addLight = addLight;
    h.ae_list_layers = listLayers;
    h.listLayers = listLayers;
    h.ae_update_layer = updateLayer;
    h.updateLayer = updateLayer;
    h.ae_set_transform = setTransform;
    h.setTransform = setTransform;
    h.ae_duplicate_layer = duplicateLayer;
    h.duplicateLayer = duplicateLayer;
    h.ae_delete_layer = deleteLayer;
    h.deleteLayer = deleteLayer;
    h.ae_reorder_layer = reorderLayer;
    h.reorderLayer = reorderLayer;
})();
