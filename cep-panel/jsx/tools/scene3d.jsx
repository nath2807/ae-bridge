// 3D Scene, Renderers, Extrusions, and Materials tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading scene3d.jsx");
    }

    var RENDERER_MAP = {
        "classic": "ADBE Standard 3d",
        "advanced": "ADBE Advanced 3d",
        "cinema4d": "ADBE Ernst"
    };

    function ensureExtrusionRenderer(comp) {
        if (!comp) return;
        try {
            var current = comp.renderer;
            if (current === "ADBE Standard 3d") {
                var avail = comp.renderers;
                var foundAdv = false;
                for (var r = 0; r < avail.length; r++) {
                    if (avail[r] === "ADBE Advanced 3d") {
                        foundAdv = true;
                        break;
                    }
                }
                if (foundAdv) {
                    comp.renderer = "ADBE Advanced 3d";
                } else {
                    for (var c = 0; c < avail.length; c++) {
                        if (avail[c] === "ADBE Ernst") {
                            comp.renderer = "ADBE Ernst";
                            break;
                        }
                    }
                }
            }
        } catch (e) {}
    }

    function set3dRenderer(params) {
        return withUndo("Set 3D Renderer", function () {
            if (!params || !params.renderer) {
                throw new Error("renderer parameter is required ('classic', 'advanced', or 'cinema4d').");
            }
            var comp = findComp(params.compRef);
            var req = String(params.renderer).toLowerCase();
            var targetMatch = RENDERER_MAP[req] || params.renderer;

            var avail = comp.renderers;
            var isAvail = false;
            for (var i = 0; i < avail.length; i++) {
                if (avail[i] === targetMatch) {
                    isAvail = true;
                    break;
                }
            }

            if (!isAvail) {
                throw new Error("Renderer '" + targetMatch + "' is not supported in this version of After Effects. Available renderers: " + avail.join(", "));
            }

            comp.renderer = targetMatch;

            return {
                compName: comp.name,
                renderer: comp.renderer,
                availableRenderers: avail
            };
        });
    }

    function make3d(params) {
        return withUndo("Make Layers 3D", function () {
            if (!params || !params.layerRefs || !(params.layerRefs instanceof Array) || params.layerRefs.length === 0) {
                throw new Error("layerRefs array is required for make3d.");
            }
            var comp = findComp(params.compRef);
            var enabled = params.enabled !== false;
            var updated = [];

            for (var i = 0; i < params.layerRefs.length; i++) {
                var layer = findLayer(comp, params.layerRefs[i]);
                try {
                    layer.threeDLayer = enabled;
                    updated.push({
                        index: layer.index,
                        name: layer.name,
                        threeD: layer.threeDLayer
                    });
                } catch (e) {
                    throw new Error("Layer '" + layer.name + "' cannot be made 3D: " + e.message);
                }
            }

            return {
                compName: comp.name,
                enabled: enabled,
                count: updated.length,
                layers: updated
            };
        });
    }

    function setExtrusion(params) {
        return withUndo("Set 3D Extrusion", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setExtrusion.");
            }
            if (params.depth === undefined) {
                throw new Error("depth is required for setExtrusion.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            // Ensure layer is 3D
            layer.threeDLayer = true;

            // Auto-switch comp renderer if on Classic 3D
            ensureExtrusionRenderer(comp);

            var geomGroup = layer.property("ADBE Extrsn Options Group") || layer.property("Geometry Options");
            if (!geomGroup) {
                throw new Error("Layer '" + layer.name + "' has no 3D Geometry Options. Ensure it is a Text or Shape layer in an Advanced 3D or Cinema 4D comp.");
            }

            var applied = {};
            var dVal = Number(params.depth);

            // Extrusion depth
            try {
                var depthProp = geomGroup.property("ADBE Extrsn Depth") || geomGroup.property("Extrusion Depth");
                if (depthProp) {
                    depthProp.setValue(dVal);
                    applied.depth = dVal;
                }
            } catch (eDepth) {
                throw new Error("Failed to set 'ADBE Extrsn Depth': " + eDepth.message);
            }

            // Bevel Style
            if (params.bevelStyle) {
                var bStyleMap = { "none": 1, "angular": 2, "concave": 3, "convex": 4 };
                var bKey = String(params.bevelStyle).toLowerCase();
                if (bStyleMap.hasOwnProperty(bKey)) {
                    try {
                        var bProp = geomGroup.property("ADBE Bevel Styles") || geomGroup.property("Bevel Style");
                        if (bProp) {
                            bProp.setValue(bStyleMap[bKey]);
                            applied.bevelStyle = params.bevelStyle;
                        }
                    } catch (eBevel) {}
                }
            }

            // Bevel Depth
            if (params.bevelDepth !== undefined) {
                try {
                    var bdProp = geomGroup.property("ADBE Bevel Depth") || geomGroup.property("Bevel Depth");
                    if (bdProp) {
                        bdProp.setValue(Number(params.bevelDepth));
                        applied.bevelDepth = Number(params.bevelDepth);
                    }
                } catch (eBd) {}
            }

            // Hole Bevel Depth
            if (params.holeBevelDepth !== undefined) {
                try {
                    var hbdProp = geomGroup.property("ADBE Hole Bevel Depth") || geomGroup.property("Hole Bevel Depth");
                    if (hbdProp) {
                        hbdProp.setValue(Number(params.holeBevelDepth));
                        applied.holeBevelDepth = Number(params.holeBevelDepth);
                    }
                } catch (eHbd) {}
            }

            return {
                layerName: layer.name,
                compRenderer: comp.renderer,
                extrusion: applied
            };
        });
    }

    function setMaterial(params) {
        return withUndo("Set 3D Material Options", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setMaterial.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            layer.threeDLayer = true;

            var matGroup = layer.property("ADBE Material Options Group") || layer.property("Material Options");
            if (!matGroup) {
                throw new Error("Layer '" + layer.name + "' has no 3D Material Options Group.");
            }

            var applied = {};

            function setMatProp(matchNames, displayNames, val, keyName) {
                for (var m = 0; m < matchNames.length; m++) {
                    try {
                        var p = matGroup.property(matchNames[m]);
                        if (p) {
                            p.setValue(val);
                            applied[keyName] = val;
                            return;
                        }
                    } catch (e) {}
                }
                for (var d = 0; d < displayNames.length; d++) {
                    try {
                        var p2 = matGroup.property(displayNames[d]);
                        if (p2) {
                            p2.setValue(val);
                            applied[keyName] = val;
                            return;
                        }
                    } catch (e2) {}
                }
            }

            if (params.castsShadows !== undefined) {
                var csVal = (params.castsShadows === true ? 1 : (params.castsShadows === false ? 0 : Number(params.castsShadows)));
                setMatProp(["ADBE Casts Shadows"], ["Casts Shadows"], csVal, "castsShadows");
            }
            if (params.acceptsShadows !== undefined) {
                var asVal = params.acceptsShadows ? 1 : 0;
                setMatProp(["ADBE Accepts Shadows"], ["Accepts Shadows"], asVal, "acceptsShadows");
            }
            if (params.acceptsLights !== undefined) {
                var alVal = params.acceptsLights ? 1 : 0;
                setMatProp(["ADBE Accepts Lights"], ["Accepts Lights"], alVal, "acceptsLights");
            }
            if (params.ambient !== undefined) {
                setMatProp(["ADBE Ambient Coefficient"], ["Ambient"], Number(params.ambient), "ambient");
            }
            if (params.diffuse !== undefined) {
                setMatProp(["ADBE Diffuse Coefficient"], ["Diffuse"], Number(params.diffuse), "diffuse");
            }
            if (params.specular !== undefined) {
                setMatProp(["ADBE Specular Coefficient"], ["Specular Intensity", "Specular"], Number(params.specular), "specular");
            }
            if (params.shininess !== undefined) {
                setMatProp(["ADBE Shininess Coefficient"], ["Specular Shininess", "Shininess"], Number(params.shininess), "shininess");
            }
            if (params.metal !== undefined) {
                setMatProp(["ADBE Metal Coefficient"], ["Metal"], Number(params.metal), "metal");
            }
            if (params.reflection !== undefined) {
                setMatProp(["ADBE Reflection Coefficient", "ADBE Reflection Intensity"], ["Reflection Intensity", "Reflection"], Number(params.reflection), "reflection");
            }

            return {
                layerName: layer.name,
                materialOptions: applied
            };
        });
    }

    function import3dModel(params) {
        return withUndo("Import 3D Model", function () {
            if (!params || !params.path) {
                throw new Error("path is required for import3dModel.");
            }
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var clean = cleanPath(params.path);
            var f = new File(clean);
            if (!f.exists) {
                throw new Error("3D model file does not exist: '" + clean + "'.");
            }

            var ext = f.name.split(".").pop().toLowerCase();
            if (ext !== "glb" && ext !== "gltf" && ext !== "obj") {
                throw new Error("Unsupported 3D model format (." + ext + "). Supported formats in After Effects 2024+: .glb, .gltf, .obj");
            }

            var io = new ImportOptions(f);
            var item = app.project.importFile(io);

            var addedLayer = null;
            if (params.compRef || app.project.activeItem) {
                try {
                    var comp = findComp(params.compRef);
                    ensureExtrusionRenderer(comp);
                    addedLayer = comp.layers.add(item);
                    addedLayer.threeDLayer = true;

                    var tr = addedLayer.property("ADBE Transform Group");
                    if (params.position && params.position instanceof Array) {
                        tr.property("ADBE Position").setValue(params.position);
                    }
                    if (params.scale && params.scale instanceof Array) {
                        tr.property("ADBE Scale").setValue(params.scale);
                    }
                } catch (eComp) {}
            }

            return {
                itemId: item.id,
                itemName: item.name,
                file: f.fsName,
                layerName: addedLayer ? addedLayer.name : null
            };
        });
    }

    function create3dPrimitive(params) {
        return withUndo("Create 3D Primitive", function () {
            if (!params || !params.type) {
                throw new Error("type is required for create3dPrimitive ('box', 'cylinder', 'plane', 'ring').");
            }
            var comp = findComp(params.compRef);
            ensureExtrusionRenderer(comp);

            var type = String(params.type).toLowerCase();
            var size = (params.size instanceof Array && params.size.length >= 2) ? params.size : [200, 200, 100];
            var w = Number(size[0]);
            var h = Number(size[1]);
            var d = size.length >= 3 ? Number(size[2]) : 50;
            var col = params.color ? toColor(params.color) : [0.8, 0.8, 0.85];
            var layerName = params.name ? String(params.name) : ("3D " + type.charAt(0).toUpperCase() + type.slice(1));

            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = layerName;
            shapeLayer.threeDLayer = true;

            var root = shapeLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");

            if (type === "box" || type === "plane") {
                var rect = root.addProperty("ADBE Vector Shape - Rect");
                rect.property("ADBE Vector Rect Size").setValue([w, h]);
            } else if (type === "cylinder") {
                var ellipse = root.addProperty("ADBE Vector Shape - Ellipse");
                ellipse.property("ADBE Vector Ellipse Size").setValue([w, h]);
            } else if (type === "ring") {
                var outer = root.addProperty("ADBE Vector Shape - Ellipse");
                outer.property("ADBE Vector Ellipse Size").setValue([w, h]);
                var stroke = root.addProperty("ADBE Vector Graphic - Stroke");
                stroke.property("ADBE Vector Stroke Color").setValue(col);
                stroke.property("ADBE Vector Stroke Width").setValue(Math.min(w, h) * 0.2);
            }

            if (type !== "ring") {
                var fill = root.addProperty("ADBE Vector Graphic - Fill");
                fill.property("ADBE Vector Fill Color").setValue(col);
            }

            // Position at center of comp
            var tr = shapeLayer.property("ADBE Transform Group");
            tr.property("ADBE Position").setValue([comp.width / 2, comp.height / 2, 0]);

            // Apply extrusion depth if box/cylinder/ring
            if (type !== "plane" && d > 0) {
                try {
                    var geom = shapeLayer.property("ADBE Extrsn Options Group") || shapeLayer.property("Geometry Options");
                    if (geom) {
                        var dProp = geom.property("ADBE Extrsn Depth") || geom.property("Extrusion Depth");
                        if (dProp) dProp.setValue(d);
                    }
                } catch (eExt) {}
            }

            return {
                compName: comp.name,
                layerIndex: shapeLayer.index,
                layerName: shapeLayer.name,
                primitiveType: type,
                dimensions: [w, h, d],
                color: col
            };
        });
    }

    function arrange3d(params) {
        return withUndo("Arrange 3D Layers", function () {
            if (!params || !params.layerRefs || !(params.layerRefs instanceof Array) || params.layerRefs.length === 0) {
                throw new Error("layerRefs array is required for arrange3d.");
            }
            var comp = findComp(params.compRef);
            var pattern = params.pattern ? String(params.pattern).toLowerCase() : "depthstack";
            var spacing = params.spacing !== undefined ? Number(params.spacing) : 200;
            var radius = params.radius !== undefined ? Number(params.radius) : 500;

            var cX = comp.width / 2;
            var cY = comp.height / 2;
            var numLayers = params.layerRefs.length;
            var arranged = [];

            for (var i = 0; i < numLayers; i++) {
                var layer = findLayer(comp, params.layerRefs[i]);
                layer.threeDLayer = true;
                var tr = layer.property("ADBE Transform Group");
                var posProp = tr.property("ADBE Position");

                var posX = cX;
                var posY = cY;
                var posZ = 0;

                if (pattern === "depthstack") {
                    posZ = i * spacing;
                } else if (pattern === "circle") {
                    var angle = (i / numLayers) * (Math.PI * 2);
                    posX = cX + Math.sin(angle) * radius;
                    posZ = Math.cos(angle) * radius;
                } else if (pattern === "spiral") {
                    var theta = i * 0.7;
                    var rCur = radius * (i / numLayers + 0.2);
                    posX = cX + Math.sin(theta) * rCur;
                    posZ = Math.cos(theta) * rCur;
                    posY = cY + (i - numLayers / 2) * (spacing * 0.5);
                } else if (pattern === "helix") {
                    var hAngle = (i / numLayers) * (Math.PI * 4);
                    posX = cX + Math.sin(hAngle) * radius;
                    posZ = Math.cos(hAngle) * radius;
                    posY = cY + (i - numLayers / 2) * spacing;
                } else if (pattern === "grid") {
                    var cols = Math.ceil(Math.sqrt(numLayers));
                    var row = Math.floor(i / cols);
                    var col = i % cols;
                    posX = cX + (col - (cols - 1) / 2) * spacing;
                    posY = cY + (row - (cols - 1) / 2) * spacing;
                } else if (pattern === "random") {
                    posX = cX + (Math.random() - 0.5) * spacing * 3;
                    posY = cY + (Math.random() - 0.5) * spacing * 2;
                    posZ = (Math.random() - 0.5) * spacing * 4;
                }

                posProp.setValue([posX, posY, posZ]);
                arranged.push({
                    name: layer.name,
                    position: [Math.round(posX), Math.round(posY), Math.round(posZ)]
                });
            }

            return {
                pattern: pattern,
                count: arranged.length,
                layers: arranged
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_set_3d_renderer = set3dRenderer;
    h.set3dRenderer = set3dRenderer;
    h.ae_make_3d = make3d;
    h.make3d = make3d;
    h.ae_set_extrusion = setExtrusion;
    h.setExtrusion = setExtrusion;
    h.ae_set_material = setMaterial;
    h.setMaterial = setMaterial;
    h.ae_import_3d_model = import3dModel;
    h.import3dModel = import3dModel;
    h.ae_create_3d_primitive = create3dPrimitive;
    h.create3dPrimitive = create3dPrimitive;
    h.ae_arrange_3d = arrange3d;
    h.arrange3d = arrange3d;
})();
