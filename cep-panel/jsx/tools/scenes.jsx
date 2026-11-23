// High-level 3D Motion Graphics Scene Generators for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading scenes.jsx");
    }

    var PRESETS_CATALOG = [
        { preset: "extrudedLogoReveal", description: "Metallic 3D extruded logo or title with dramatic rim lighting and orbiting camera reveal on reflective floor" },
        { preset: "floatingCards", description: "Array of glossy 3D cards/planes floating at varying depths with soft parallax drift camera and depth of field" },
        { preset: "cubeGrid", description: "Matrix grid of extruded 3D cubes oscillating in animated wave formation via procedural harmonic expressions" },
        { preset: "infiniteTunnel", description: "Futuristic neon geometric tunnel of concentric rings receding into deep space with fly-through camera motion" },
        { preset: "layeredParallax", description: "Multi-plane layered landscape with foreground framing, midground typography, and distant atmosphere" },
        { preset: "orbitingShowcase", description: "Hero product/title showcase centered on a shadow-catching circular pedestal with continuous 360 orbit" },
        { preset: "helixText", description: "Kinetic typography arranged along an ascending 3D double helix with dynamic corkscrew camera trajectory" }
    ];

    function ensureCompRenderer(comp) {
        if (!comp) return;
        try {
            if (comp.renderer === "ADBE Standard 3d") {
                var avail = comp.renderers;
                for (var i = 0; i < avail.length; i++) {
                    if (avail[i] === "ADBE Advanced 3d") {
                        comp.renderer = "ADBE Advanced 3d";
                        return;
                    }
                }
                for (var j = 0; j < avail.length; j++) {
                    if (avail[j] === "ADBE Ernst") {
                        comp.renderer = "ADBE Ernst";
                        return;
                    }
                }
            }
        } catch (e) {}
    }

    function create3dTextScene(params) {
        return withUndo("Create 3D Text Scene", function () {
            if (!params || !params.text) {
                throw new Error("text parameter is required for create3dText.");
            }

            var textStr = String(params.text);
            var duration = params.duration !== undefined ? Number(params.duration) : 6.0;
            var depth = params.depth !== undefined ? Number(params.depth) : 40;
            var isMetal = params.metal === true;
            var hasFloor = params.floor === true;
            var textColor = params.color ? toColor(params.color) : (isMetal ? [0.92, 0.78, 0.35] : [0.95, 0.95, 0.98]);
            var lightPreset = params.lighting || "dramatic";
            var camMovePreset = params.cameraMove || "pushIn";

            var comp = null;
            if (params.compRef) {
                comp = findComp(params.compRef);
            } else {
                comp = app.project.items.addComp(textStr + " — 3D Scene", 1920, 1080, 1, duration, 24);
                comp.bgColor = [0.03, 0.03, 0.04];
            }

            ensureCompRenderer(comp);

            var cX = comp.width / 2;
            var cY = comp.height / 2;

            // 1. Atmosphere Background Solid
            var bg = comp.layers.addSolid([0.025, 0.03, 0.04], "Background Dark Void", comp.width, comp.height, 1, duration);

            // 2. Main 3D Extruded Text Layer
            var textLayer = comp.layers.addText(textStr);
            textLayer.name = "3D Text — " + textStr;
            textLayer.threeDLayer = true;

            var doc = textLayer.property("Source Text").value;
            doc.fontSize = textStr.length > 15 ? 90 : 130;
            doc.fillColor = textColor;
            doc.applyFill = true;
            doc.tracking = 160;
            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
            if (params.font) {
                try { doc.font = String(params.font); } catch (eF) {}
            }
            textLayer.property("Source Text").setValue(doc);

            var tTr = textLayer.property("ADBE Transform Group");
            tTr.property("ADBE Position").setValue([cX, cY - 20, 0]);

            // Set Extrusion on Text
            try {
                var geom = textLayer.property("ADBE Extrsn Options Group") || textLayer.property("Geometry Options");
                if (geom) {
                    var dProp = geom.property("ADBE Extrsn Depth") || geom.property("Extrusion Depth");
                    if (dProp) dProp.setValue(depth);

                    if (params.bevel !== false) {
                        var bProp = geom.property("ADBE Bevel Styles") || geom.property("Bevel Style");
                        if (bProp) bProp.setValue(4); // Convex bevel
                        var bdProp = geom.property("ADBE Bevel Depth") || geom.property("Bevel Depth");
                        if (bdProp) bdProp.setValue(3);
                    }
                }
            } catch (eGeom) {}

            // Set Materials
            try {
                var mat = textLayer.property("ADBE Material Options Group") || textLayer.property("Material Options");
                if (mat) {
                    try { mat.property("ADBE Casts Shadows").setValue(1); } catch (e) {}
                    try { mat.property("ADBE Accepts Shadows").setValue(1); } catch (e) {}
                    try { mat.property("ADBE Specular Coefficient").setValue(85); } catch (e) {}
                    try { mat.property("ADBE Shininess Coefficient").setValue(75); } catch (e) {}
                    if (isMetal) {
                        try { mat.property("ADBE Metal Coefficient").setValue(85); } catch (e) {}
                    }
                }
            } catch (eMat) {}

            // 3. Optional Floor Layer
            var floorLayer = null;
            if (hasFloor) {
                floorLayer = comp.layers.addSolid([0.08, 0.09, 0.12], "3D Shadow Floor", 3840, 3840, 1, duration);
                floorLayer.threeDLayer = true;
                var fTr = floorLayer.property("ADBE Transform Group");
                fTr.property("ADBE Position").setValue([cX, cY + 220, 0]);
                fTr.property("ADBE Rotate X").setValue(90);

                var fMat = floorLayer.property("ADBE Material Options Group");
                if (fMat) {
                    try { fMat.property("ADBE Accepts Shadows").setValue(1); } catch (e) {}
                    try { fMat.property("ADBE Casts Shadows").setValue(0); } catch (e) {}
                    try { fMat.property("ADBE Reflection Coefficient").setValue(35); } catch (e) {}
                }
            }

            // 4. Setup Lighting Rig
            var h = $.global.aeBridge.handlers;
            if (h && h.setupLighting) {
                h.setupLighting({ compRef: { compId: comp.id }, preset: lightPreset, shadows: true });
            }

            // 5. Setup Camera & Cinematic Motion
            if (h && h.createCameraRig) {
                var rig = h.createCameraRig({ compRef: { compId: comp.id }, type: "orbitNull" });
                if (h.cameraMove) {
                    h.cameraMove({
                        compRef: { compId: comp.id },
                        move: camMovePreset,
                        startTime: 0,
                        duration: duration,
                        amount: 1.0
                    });
                }
            }

            comp.openInViewer();

            return {
                compId: comp.id,
                compName: comp.name,
                text: textStr,
                depth: depth,
                lightingPreset: lightPreset,
                cameraMove: camMovePreset,
                hasFloor: hasFloor
            };
        });
    }

    function create3dScene(params) {
        return withUndo("Create 3D Scene", function () {
            if (!params || !params.preset) {
                throw new Error("preset parameter is required for create3dScene.");
            }

            var preset = String(params.preset).toLowerCase();
            var text = params.text ? String(params.text) : "FUTURE VISION";
            var duration = params.duration !== undefined ? Number(params.duration) : 8.0;
            var colors = params.colors || {};

            var compName = "3D Scene — " + params.preset;
            var comp = app.project.items.addComp(compName, 1920, 1080, 1, duration, 24);
            comp.bgColor = [0.02, 0.025, 0.035];
            ensureCompRenderer(comp);

            var cX = comp.width / 2;
            var cY = comp.height / 2;
            var h = $.global.aeBridge.handlers;

            // 1. Extruded Logo Reveal
            if (preset === "extrudedlogoreveal") {
                var goldCol = colors.accent ? toColor(colors.accent) : [0.95, 0.78, 0.35];

                var title = comp.layers.addText(text);
                title.threeDLayer = true;
                var tDoc = title.property("Source Text").value;
                tDoc.fontSize = 110;
                tDoc.fillColor = goldCol;
                tDoc.applyFill = true;
                tDoc.tracking = 200;
                tDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                title.property("Source Text").setValue(tDoc);
                title.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY, 0]);

                if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: title.name }, depth: 55, bevelStyle: "convex", bevelDepth: 4 });
                if (h.setMaterial) h.setMaterial({ compRef: { compId: comp.id }, layerRef: { layerName: title.name }, specular: 90, shininess: 85, metal: 85, castsShadows: true });

                // Floor
                var fl = comp.layers.addSolid([0.06, 0.07, 0.09], "Studio Floor", 3840, 3840, 1, duration);
                fl.threeDLayer = true;
                fl.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY + 200, 0]);
                fl.property("ADBE Transform Group").property("ADBE Rotate X").setValue(90);

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "dramatic", shadows: true });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "orbitHalf", startTime: 0, duration: duration, amount: 0.8 });
            }

            // 2. Floating Cards
            else if (preset === "floatingcards") {
                var cardColors = [
                    colors.primary ? toColor(colors.primary) : [0.15, 0.45, 0.95],
                    colors.secondary ? toColor(colors.secondary) : [0.95, 0.25, 0.45],
                    colors.accent ? toColor(colors.accent) : [0.1, 0.85, 0.65],
                    [0.95, 0.75, 0.2],
                    [0.65, 0.3, 0.95]
                ];

                for (var c = 0; c < 5; c++) {
                    var card = comp.layers.addSolid(cardColors[c % cardColors.length], "Floating Card " + (c + 1), 340, 480, 1, duration);
                    card.threeDLayer = true;
                    var cTr = card.property("ADBE Transform Group");
                    var zPos = (c - 2) * 450;
                    var xOff = (c - 2) * 280;
                    var yOff = (c % 2 === 0 ? -40 : 40);
                    cTr.property("ADBE Position").setValue([cX + xOff, cY + yOff, zPos]);
                    cTr.property("ADBE Rotate Y").setValue((c - 2) * 12);

                    if (h.setMaterial) h.setMaterial({ compRef: { compId: comp.id }, layerRef: { layerName: card.name }, specular: 80, shininess: 85, castsShadows: true });
                }

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "studio", shadows: true });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "parallaxDrift", startTime: 0, duration: duration, amount: 1.2 });
                if (h.setDepthOfField) h.setDepthOfField({ compRef: { compId: comp.id }, enabled: true, aperture: 45, blurLevel: 100 });
            }

            // 3. Cube Grid
            else if (preset === "cubegrid") {
                var cubeCol = colors.primary ? toColor(colors.primary) : [0.2, 0.7, 1.0];
                var gridSize = 3;
                var cubeSpacing = 220;

                for (var r = 0; r < gridSize; r++) {
                    for (var col = 0; col < gridSize; col++) {
                        var idx = r * gridSize + col + 1;
                        var cube = comp.layers.addShape();
                        cube.name = "Cube " + idx;
                        cube.threeDLayer = true;

                        var root = cube.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                        var rect = root.addProperty("ADBE Vector Shape - Rect");
                        rect.property("ADBE Vector Rect Size").setValue([140, 140]);
                        var fill = root.addProperty("ADBE Vector Graphic - Fill");
                        fill.property("ADBE Vector Fill Color").setValue(cubeCol);

                        var posX = cX + (col - 1) * cubeSpacing;
                        var posY = cY + (r - 1) * cubeSpacing;
                        var pProp = cube.property("ADBE Transform Group").property("ADBE Position");
                        pProp.setValue([posX, posY, 0]);

                        // Wave animation expression on position
                        pProp.expression = 'var base = [' + posX + ', ' + posY + ', 0]; base[2] = Math.sin(time * 3 + ' + (r + col) + ' * 0.8) * 120; base;';

                        if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: cube.name }, depth: 140, bevelStyle: "angular", bevelDepth: 3 });
                    }
                }

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "dramatic", shadows: true });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "orbit", startTime: 0, duration: duration, amount: 0.6 });
            }

            // 4. Infinite Tunnel
            else if (preset === "infinitetunnel") {
                var ringCount = 10;
                var ringSpacing = 450;
                var cyanCol = [0.0, 0.94, 1.0];
                var magentaCol = [1.0, 0.08, 0.55];

                for (var ringIdx = 0; ringIdx < ringCount; ringIdx++) {
                    var ring = comp.layers.addShape();
                    ring.name = "Tunnel Ring " + (ringIdx + 1);
                    ring.threeDLayer = true;

                    var rGroup = ring.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                    var el = rGroup.addProperty("ADBE Vector Shape - Ellipse");
                    el.property("ADBE Vector Ellipse Size").setValue([700, 700]);
                    var stroke = rGroup.addProperty("ADBE Vector Graphic - Stroke");
                    stroke.property("ADBE Vector Stroke Color").setValue(ringIdx % 2 === 0 ? cyanCol : magentaCol);
                    stroke.property("ADBE Vector Stroke Width").setValue(18);

                    ring.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY, ringIdx * ringSpacing]);

                    if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: ring.name }, depth: 30 });
                }

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "neon", shadows: false });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "flyThrough", startTime: 0, duration: duration, amount: 1.2 });
            }

            // 5. Layered Parallax
            else if (preset === "layeredparallax") {
                var pColors = [[0.05, 0.06, 0.1], [0.12, 0.2, 0.35], [0.95, 0.95, 1.0]];

                var fg = comp.layers.addSolid(pColors[0], "Foreground Frame", 1600, 900, 1, duration);
                fg.threeDLayer = true;
                fg.property("ADBE Transform Group").property("ADBE Position").setValue([cX - 450, cY + 300, -400]);

                var midText = comp.layers.addText(text);
                midText.name = "Midground Typography";
                midText.threeDLayer = true;
                var mDoc = midText.property("Source Text").value;
                mDoc.fontSize = 120;
                mDoc.fillColor = pColors[2];
                mDoc.applyFill = true;
                mDoc.tracking = 240;
                mDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                midText.property("Source Text").setValue(mDoc);
                midText.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY, 200]);

                if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: midText.name }, depth: 35 });

                var bgCard = comp.layers.addSolid(pColors[1], "Distant Atmosphere Plate", 2600, 1600, 1, duration);
                bgCard.threeDLayer = true;
                bgCard.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY - 100, 1000]);

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "sunset", shadows: true });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "parallaxDrift", startTime: 0, duration: duration, amount: 1.5 });
            }

            // 6. Orbiting Showcase
            else if (preset === "orbitingshowcase") {
                var heroCol = colors.primary ? toColor(colors.primary) : [0.95, 0.8, 0.25];

                // Pedestal
                var ped = comp.layers.addShape();
                ped.name = "Showcase Pedestal";
                ped.threeDLayer = true;
                var pedGroup = ped.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                var pedEl = pedGroup.addProperty("ADBE Vector Shape - Ellipse");
                pedEl.property("ADBE Vector Ellipse Size").setValue([500, 500]);
                var pedFill = pedGroup.addProperty("ADBE Vector Graphic - Fill");
                pedFill.property("ADBE Vector Fill Color").setValue([0.15, 0.17, 0.22]);
                ped.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY + 120, 0]);
                ped.property("ADBE Transform Group").property("ADBE Rotate X").setValue(90);
                if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: ped.name }, depth: 35 });

                // Hero object
                var hero = comp.layers.addText(text);
                hero.name = "Showcase Hero";
                hero.threeDLayer = true;
                var hDoc = hero.property("Source Text").value;
                hDoc.fontSize = 95;
                hDoc.fillColor = heroCol;
                hDoc.applyFill = true;
                hDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                hero.property("Source Text").setValue(hDoc);
                hero.property("ADBE Transform Group").property("ADBE Position").setValue([cX, cY - 40, 0]);

                if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: hero.name }, depth: 50, bevelStyle: "convex", bevelDepth: 4 });
                if (h.setMaterial) h.setMaterial({ compRef: { compId: comp.id }, layerRef: { layerName: hero.name }, metal: 80, specular: 85, castsShadows: true });

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "threePoint", shadows: true });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "orbit", startTime: 0, duration: duration, amount: 1.0 });
            }

            // 7. Helix Text
            else if (preset === "helixtext") {
                var words = text.split(" ");
                if (words.length < 4) {
                    words = [text, "DESIGN", "MOTION", "SPACE", "FUTURE", "3D"];
                }
                var helixRadius = 400;
                var helixStepY = 90;

                for (var wIdx = 0; wIdx < words.length; wIdx++) {
                    var wLayer = comp.layers.addText(words[wIdx]);
                    wLayer.threeDLayer = true;
                    var wDoc = wLayer.property("Source Text").value;
                    wDoc.fontSize = 65;
                    wDoc.fillColor = [0.95, 0.95, 0.98];
                    wDoc.applyFill = true;
                    wLayer.property("Source Text").setValue(wDoc);

                    var angle2 = (wIdx / words.length) * (Math.PI * 4);
                    var hX = cX + Math.sin(angle2) * helixRadius;
                    var hZ = Math.cos(angle2) * helixRadius;
                    var hY = cY + (wIdx - words.length / 2) * helixStepY;

                    var wTr = wLayer.property("ADBE Transform Group");
                    wTr.property("ADBE Position").setValue([hX, hY, hZ]);
                    wTr.property("ADBE Rotate Y").setValue((angle2 * 180 / Math.PI) + 90);

                    if (h.setExtrusion) h.setExtrusion({ compRef: { compId: comp.id }, layerRef: { layerName: wLayer.name }, depth: 25 });
                }

                if (h.setupLighting) h.setupLighting({ compRef: { compId: comp.id }, preset: "neon", shadows: false });
                if (h.createCameraRig) h.createCameraRig({ compRef: { compId: comp.id } });
                if (h.cameraMove) h.cameraMove({ compRef: { compId: comp.id }, move: "spiral", startTime: 0, duration: duration, amount: 1.0 });
            }

            else {
                throw new Error("Unknown 3D scene preset: '" + preset + "'. Valid presets: 'extrudedLogoReveal', 'floatingCards', 'cubeGrid', 'infiniteTunnel', 'layeredParallax', 'orbitingShowcase', 'helixText'.");
            }

            comp.openInViewer();

            return {
                compId: comp.id,
                compName: comp.name,
                preset: preset,
                duration: duration
            };
        });
    }

    function list3dPresets() {
        return PRESETS_CATALOG;
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_create_3d_text = create3dTextScene;
    h.create3dText = create3dTextScene;
    h.ae_create_3d_scene = create3dScene;
    h.create3dScene = create3dScene;
    h.ae_list_3d_presets = list3dPresets;
    h.list3dPresets = list3dPresets;
})();
