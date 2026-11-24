// Title and Lower-Third authoring tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading titles.jsx");
    }

    function easeLayerKeys(prop, inf) {
        if (!prop || prop.numKeys < 2) return;
        var dim = (prop.isSpatial) ? 1 : ((prop.value instanceof Array) ? prop.value.length : 1);
        var influence = inf !== undefined ? Number(inf) : 75;
        influence = Math.max(0.1, Math.min(100, influence));

        for (var k = 1; k <= prop.numKeys; k++) {
            var inEases = [];
            var outEases = [];
            for (var d = 0; d < dim; d++) {
                inEases.push(new KeyframeEase(0, influence));
                outEases.push(new KeyframeEase(0, influence));
            }
            try {
                prop.setTemporalEaseAtKey(k, inEases, outEases);
            } catch (e) {}
        }
    }

    function createTitleCard(params) {
        return withUndo("Create Title Card", function () {
            if (!params || !params.title) {
                throw new Error("Title text is required for createTitleCard.");
            }

            var titleStr = String(params.title);
            var subtitleStr = params.subtitle ? String(params.subtitle) : "";
            var compName = params.compName ? String(params.compName) : (titleStr + " — Title Card");

            var width = params.width !== undefined ? Number(params.width) : 1920;
            var height = params.height !== undefined ? Number(params.height) : 1080;
            var duration = params.duration !== undefined ? Number(params.duration) : 8.0;
            var frameRate = params.frameRate !== undefined ? Number(params.frameRate) : 24;

            var comp = app.project.items.addComp(compName, width, height, 1, duration, frameRate);

            var bgCol = params.bgColor ? toColor(params.bgColor) : [0.03, 0.035, 0.045];
            var goldCol = params.accentColor ? toColor(params.accentColor) : [0.83, 0.69, 0.22];
            var titleCol = params.titleColor ? toColor(params.titleColor) : [0.96, 0.96, 0.98];
            var subCol = params.subtitleColor ? toColor(params.subtitleColor) : goldCol;

            var isNeon = (params.style && String(params.style).toLowerCase() === "neon");
            if (isNeon) {
                if (!params.bgColor) bgCol = [0.02, 0.02, 0.03];
                if (!params.titleColor) titleCol = [0.0, 0.94, 1.0]; // Electric Cyan #00F0FF
                if (!params.accentColor) goldCol = [0.0, 0.94, 1.0];
                if (!params.subtitleColor) subCol = [1.0, 0.08, 0.55]; // Neon Magenta #FF148C
            }

            comp.bgColor = bgCol;
            var bgLayer = comp.layers.addSolid(bgCol, "Atmosphere Background", width, height, 1, duration);

            var accentStyle = params.accentStyle ? String(params.accentStyle).toLowerCase() : "line";
            var shouldAnimate = params.animate !== false;

            var centerX = width / 2;
            var centerY = height / 2;

            // 1. Accent element (if requested)
            var accentLayer = null;
            if (accentStyle === "line" || accentStyle === "bar") {
                accentLayer = comp.layers.addShape();
                accentLayer.name = "Accent Line";
                var root = accentLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                var rect = root.addProperty("ADBE Vector Shape - Rect");
                var lineWidth = accentStyle === "bar" ? 400 : 280;
                var lineHeight = accentStyle === "bar" ? 4 : 2;
                rect.property("ADBE Vector Rect Size").setValue([lineWidth, lineHeight]);
                var fill = root.addProperty("ADBE Vector Graphic - Fill");
                fill.property("ADBE Vector Fill Color").setValue(goldCol);

                var accTr = accentLayer.property("ADBE Transform Group");
                accTr.property("ADBE Position").setValue([centerX, centerY]);

                if (shouldAnimate) {
                    var scProp = accTr.property("ADBE Scale");
                    scProp.setValueAtTime(0.8, [0, 100]);
                    scProp.setValueAtTime(2.0, [100, 100]);
                    easeLayerKeys(scProp, 75);

                    var opAcc = accTr.property("ADBE Opacity");
                    opAcc.setValueAtTime(duration - 1.6, 100);
                    opAcc.setValueAtTime(duration - 0.4, 0);
                    easeLayerKeys(opAcc, 75);
                }

                if (isNeon) {
                    try {
                        var accGlow = accentLayer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
                        accGlow.property("ADBE Glo2-0002").setValue(40);
                        accGlow.property("ADBE Glo2-0003").setValue(45);
                        accGlow.property("ADBE Glo2-0004").setValue(1.5);
                    } catch (e) {}
                }
            }

            // 2. Main Title Text Layer
            var titleLayer = comp.layers.addText(titleStr);
            titleLayer.name = "Title — " + titleStr;
            var titleDoc = titleLayer.property("Source Text").value;
            titleDoc.fontSize = (titleStr.length > 20) ? 80 : 108;
            titleDoc.fillColor = titleCol;
            titleDoc.applyFill = true;
            titleDoc.tracking = 240;
            titleDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
            titleLayer.property("Source Text").setValue(titleDoc);

            var titleY = subtitleStr ? (centerY - 60) : centerY;
            var tTr = titleLayer.property("ADBE Transform Group");
            tTr.property("ADBE Position").setValue([centerX, titleY]);

            if (shouldAnimate) {
                var tScale = tTr.property("ADBE Scale");
                tScale.setValueAtTime(0, [96, 96]);
                tScale.setValueAtTime(duration, [104, 104]);

                var tOp = tTr.property("ADBE Opacity");
                tOp.setValueAtTime(0.4, 0);
                tOp.setValueAtTime(1.8, 100);
                tOp.setValueAtTime(duration - 1.6, 100);
                tOp.setValueAtTime(duration - 0.4, 0);
                easeLayerKeys(tOp, 75);
            }

            // Optional Glow effect on title
            if (isNeon) {
                try {
                    var neonGlow = titleLayer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
                    neonGlow.property("ADBE Glo2-0002").setValue(45); // threshold
                    neonGlow.property("ADBE Glo2-0003").setValue(60); // radius
                    neonGlow.property("ADBE Glo2-0004").setValue(1.8); // intensity
                } catch (e) {}
            } else if (accentStyle === "glow" || params.style === "cinematic") {
                try {
                    var glow = titleLayer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
                    glow.property("ADBE Glo2-0002").setValue(75);
                    glow.property("ADBE Glo2-0003").setValue(40);
                    glow.property("ADBE Glo2-0004").setValue(0.5);
                } catch (e) {}
            }

            // 3. Subtitle Text Layer (if provided)
            var subLayer = null;
            if (subtitleStr) {
                subLayer = comp.layers.addText(subtitleStr);
                subLayer.name = "Subtitle — " + subtitleStr;
                var sDoc = subLayer.property("Source Text").value;
                sDoc.fontSize = 32;
                sDoc.fillColor = subCol;
                sDoc.applyFill = true;
                sDoc.tracking = 300;
                sDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                subLayer.property("Source Text").setValue(sDoc);

                var subY = centerY + 65;
                var sTr = subLayer.property("ADBE Transform Group");
                sTr.property("ADBE Position").setValue([centerX, subY]);

                if (shouldAnimate) {
                    var sPos = sTr.property("ADBE Position");
                    sPos.setValueAtTime(1.2, [centerX, subY - 5]);
                    sPos.setValueAtTime(duration, [centerX, subY + 8]);

                    var sOp = sTr.property("ADBE Opacity");
                    sOp.setValueAtTime(1.2, 0);
                    sOp.setValueAtTime(2.4, 100);
                    sOp.setValueAtTime(duration - 1.6, 100);
                    sOp.setValueAtTime(duration - 0.4, 0);
                    easeLayerKeys(sOp, 75);
                }

                if (isNeon) {
                    try {
                        var subNeonGlow = subLayer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
                        subNeonGlow.property("ADBE Glo2-0002").setValue(50);
                        subNeonGlow.property("ADBE Glo2-0003").setValue(35);
                        subNeonGlow.property("ADBE Glo2-0004").setValue(1.2);
                    } catch (e) {}
                }
            }

            if ($.global.applyQualityDefaults) {
                try { $.global.applyQualityDefaults(comp); } catch (eQ) {}
            }
            comp.openInViewer();

            return {
                compId: comp.id,
                compName: comp.name,
                width: comp.width,
                height: comp.height,
                duration: comp.duration,
                numLayers: comp.numLayers,
                title: titleStr,
                subtitle: subtitleStr
            };
        });
    }

    function createLowerThird(params) {
        return withUndo("Create Lower Third", function () {
            if (!params || !params.name) {
                throw new Error("Name string is required for createLowerThird.");
            }

            var nameStr = String(params.name);
            var titleStr = params.title ? String(params.title) : "";
            var compName = params.compName ? String(params.compName) : (nameStr + " — Lower Third");

            var width = params.width !== undefined ? Number(params.width) : 1920;
            var height = params.height !== undefined ? Number(params.height) : 1080;
            var duration = params.duration !== undefined ? Number(params.duration) : 6.0;
            var frameRate = params.frameRate !== undefined ? Number(params.frameRate) : 30;

            var comp = null;
            if (params.compRef) {
                comp = findComp(params.compRef);
            } else {
                comp = app.project.items.addComp(compName, width, height, 1, duration, frameRate);
            }

            var accentCol = params.accentColor ? toColor(params.accentColor) : [0.83, 0.69, 0.22];
            var primaryCol = params.primaryColor ? toColor(params.primaryColor) : [1, 1, 1];
            var secCol = params.secondaryColor ? toColor(params.secondaryColor) : accentCol;
            var plateCol = params.plateColor ? toColor(params.plateColor) : [0.06, 0.08, 0.12];
            var plateOpVal = params.plateOpacity !== undefined ? Number(params.plateOpacity) : 92;

            var posX = 260;
            var posY = 880;
            if (params.position && params.position.length >= 2) {
                posX = Number(params.position[0]);
                posY = Number(params.position[1]);
            }

            var shouldAnimate = params.animate !== false;

            // 1. Background Plate
            var plateWidth = Math.max(540, nameStr.length * 24 + 120);
            var plateHeight = titleStr ? 86 : 64;

            var plate = comp.layers.addShape();
            plate.name = "Background Plate";
            var pRoot = plate.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var pRect = pRoot.addProperty("ADBE Vector Shape - Rect");
            pRect.property("ADBE Vector Rect Size").setValue([plateWidth, plateHeight]);
            pRect.property("ADBE Vector Rect Roundness").setValue(6);
            var pFill = pRoot.addProperty("ADBE Vector Graphic - Fill");
            pFill.property("ADBE Vector Fill Color").setValue(plateCol);

            var pTr = plate.property("ADBE Transform Group");
            pTr.property("ADBE Opacity").setValue(plateOpVal);
            var plateCenterX = posX + (plateWidth / 2) - 15;
            pTr.property("ADBE Position").setValue([plateCenterX, posY]);

            if (shouldAnimate) {
                var pSc = pTr.property("ADBE Scale");
                pSc.setValueAtTime(0.4, [0, 100]);
                pSc.setValueAtTime(1.0, [100, 100]);
                easeLayerKeys(pSc, 80);

                var pOp = pTr.property("ADBE Opacity");
                pOp.setValueAtTime(duration - 1.2, plateOpVal);
                pOp.setValueAtTime(duration - 0.5, 0);
                easeLayerKeys(pOp, 80);
            }

            // 2. Gold / Accent Vertical Bar
            var bar = comp.layers.addShape();
            bar.name = "Accent Bar";
            var bRoot = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var bRect = bRoot.addProperty("ADBE Vector Shape - Rect");
            bRect.property("ADBE Vector Rect Size").setValue([6, plateHeight]);
            var bFill = bRoot.addProperty("ADBE Vector Graphic - Fill");
            bFill.property("ADBE Vector Fill Color").setValue(accentCol);

            var bTr = bar.property("ADBE Transform Group");
            bTr.property("ADBE Position").setValue([posX - 17, posY]);

            if (shouldAnimate) {
                var bSc = bTr.property("ADBE Scale");
                bSc.setValueAtTime(0.2, [100, 0]);
                bSc.setValueAtTime(0.7, [100, 100]);
                easeLayerKeys(bSc, 80);

                var bOp = bTr.property("ADBE Opacity");
                bOp.setValueAtTime(duration - 1.2, 100);
                bOp.setValueAtTime(duration - 0.5, 0);
                easeLayerKeys(bOp, 80);
            }

            // 3. Name Text Layer
            var nameLayer = comp.layers.addText(nameStr);
            nameLayer.name = "Name — " + nameStr;
            var nameDoc = nameLayer.property("Source Text").value;
            nameDoc.fontSize = 38;
            nameDoc.fillColor = primaryCol;
            nameDoc.applyFill = true;
            nameDoc.tracking = 60;
            nameDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
            nameLayer.property("Source Text").setValue(nameDoc);

            var nameY = titleStr ? (posY - 14) : posY + 12;
            var nTr = nameLayer.property("ADBE Transform Group");
            nTr.property("ADBE Position").setValue([posX + 5, nameY]);

            if (shouldAnimate) {
                var nPos = nTr.property("ADBE Position");
                nPos.setValueAtTime(0.6, [posX - 30, nameY]);
                nPos.setValueAtTime(1.1, [posX + 5, nameY]);
                easeLayerKeys(nPos, 80);

                var nOp = nTr.property("ADBE Opacity");
                nOp.setValueAtTime(0.6, 0);
                nOp.setValueAtTime(1.1, 100);
                nOp.setValueAtTime(duration - 1.2, 100);
                nOp.setValueAtTime(duration - 0.5, 0);
                easeLayerKeys(nOp, 80);
            }

            // 4. Role Subtitle Text Layer
            var titleLayer = null;
            if (titleStr) {
                titleLayer = comp.layers.addText(titleStr);
                titleLayer.name = "Title — " + titleStr;
                var tDoc = titleLayer.property("Source Text").value;
                tDoc.fontSize = 20;
                tDoc.fillColor = secCol;
                tDoc.applyFill = true;
                tDoc.tracking = 180;
                tDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
                titleLayer.property("Source Text").setValue(tDoc);

                var titleY = posY + 18;
                var tTr = titleLayer.property("ADBE Transform Group");
                tTr.property("ADBE Position").setValue([posX + 5, titleY]);

                if (shouldAnimate) {
                    var tPos = tTr.property("ADBE Position");
                    tPos.setValueAtTime(0.8, [posX - 30, titleY]);
                    tPos.setValueAtTime(1.3, [posX + 5, titleY]);
                    easeLayerKeys(tPos, 80);

                    var tOp = tTr.property("ADBE Opacity");
                    tOp.setValueAtTime(0.8, 0);
                    tOp.setValueAtTime(1.3, 100);
                    tOp.setValueAtTime(duration - 1.2, 100);
                    tOp.setValueAtTime(duration - 0.5, 0);
                    easeLayerKeys(tOp, 80);
                }
            }

            if ($.global.applyQualityDefaults) {
                try { $.global.applyQualityDefaults(comp); } catch (eQ) {}
            }
            comp.openInViewer();

            return {
                compId: comp.id,
                compName: comp.name,
                name: nameStr,
                title: titleStr,
                duration: comp.duration
            };
        });
    }

    function createTextAnim(layer, name) {
        if (!(layer instanceof TextLayer)) {
            throw new Error("Target layer '" + layer.name + "' is not a TextLayer. Text animators are only supported on text layers.");
        }
        var textProps = layer.property("ADBE Text Properties");
        var animators = textProps.property("ADBE Text Animators");
        var anim = animators.addProperty("ADBE Text Animator");
        if (name) anim.name = name;
        var animProps = anim.property("ADBE Text Animator Properties");
        var selectors = anim.property("ADBE Text Selectors");
        var sel = (selectors.numProperties > 0) ? selectors.property(1) : selectors.addProperty("ADBE Text Selector");
        return {
            anim: anim,
            props: animProps,
            sel: sel
        };
    }

    function setUnits(sel, unitVal) {
        if (!sel) return;
        var adv = sel.property("ADBE Text Range Advanced");
        if (adv) {
            var bo = adv.property("ADBE Text Range Units Type2");
            if (bo) bo.setValue(unitVal);
        }
    }

    function animateStart(sel, t0, t1, inf) {
        if (!sel) return;
        var sProp = sel.property("ADBE Text Percent Start");
        if (!sProp) return;
        sProp.setValueAtTime(t0, 0);
        sProp.setValueAtTime(t1, 100);
        easeLayerKeys(sProp, inf !== undefined ? inf : 80);
    }

    function applyTitlePreset(params) {
        return withUndo("Apply Title Preset", function () {
            if (!params || !params.preset) {
                throw new Error("Preset name is required for applyTitlePreset.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var preset = String(params.preset).toLowerCase();
            var startTime = params.startTime !== undefined ? Number(params.startTime) : 0;
            var duration = params.duration !== undefined ? Number(params.duration) : 0.6;
            var opts = params.options || {};

            // 1. fadeUpChars: opacity 0 + position Y offset, characters reveal left-to-right
            if (preset === "fadeupchars") {
                var ta1 = createTextAnim(layer, "Fade Up Chars");
                var op1 = ta1.props.addProperty("ADBE Text Opacity");
                op1.setValue(0);
                var pos1 = ta1.props.addProperty("ADBE Text Position 3D");
                pos1.setValue([0, 50, 0]);
                setUnits(ta1.sel, 1); // Characters
                animateStart(ta1.sel, startTime, startTime + duration, 80);
                return { preset: "fadeUpChars", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 2. blurReveal: opacity 0 + blur, characters de-blur and fade in
            if (preset === "blurreveal") {
                var ta2 = createTextAnim(layer, "Blur Reveal");
                var op2 = ta2.props.addProperty("ADBE Text Opacity");
                op2.setValue(0);
                var blur2 = ta2.props.addProperty("ADBE Text Blur");
                var bVal = opts.blur !== undefined ? Number(opts.blur) : 40;
                blur2.setValue([bVal, bVal]);
                setUnits(ta2.sel, 1);
                animateStart(ta2.sel, startTime, startTime + duration, 80);
                return { preset: "blurReveal", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 3. trackingCollapse: wide tracking collapsing to normal with opacity fade
            if (preset === "trackingcollapse") {
                if (!(layer instanceof TextLayer)) {
                    throw new Error("trackingCollapse requires a TextLayer.");
                }
                var textGroup3 = layer.property("ADBE Text Properties");
                var animators3 = textGroup3.property("ADBE Text Animators");
                var anim3 = animators3.addProperty("ADBE Text Animator");
                anim3.name = "Tracking Collapse";
                var props3 = anim3.property("ADBE Text Animator Properties");
                var trk3 = props3.addProperty("ADBE Text Tracking Amount");
                var startTrk = opts.tracking !== undefined ? Number(opts.tracking) : 280;

                trk3.setValueAtTime(startTime, startTrk);
                trk3.setValueAtTime(startTime + duration, 0);
                easeLayerKeys(trk3, 85);

                var tr3 = layer.property("ADBE Transform Group");
                var op3 = tr3.property("ADBE Opacity");
                op3.setValueAtTime(startTime, 0);
                op3.setValueAtTime(startTime + Math.min(duration * 0.7, 0.4), 100);
                easeLayerKeys(op3, 80);
                return { preset: "trackingCollapse", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 4. popWords: scale [0,0,100] + opacity 0, units based on words
            if (preset === "popwords") {
                var ta4 = createTextAnim(layer, "Pop Words");
                var sc4 = ta4.props.addProperty("ADBE Text Scale 3D");
                sc4.setValue([0, 0, 100]);
                var op4 = ta4.props.addProperty("ADBE Text Opacity");
                op4.setValue(0);
                setUnits(ta4.sel, 3); // Words
                animateStart(ta4.sel, startTime, startTime + duration, 80);
                return { preset: "popWords", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 5. typewriter: opacity 0, linear character reveal
            if (preset === "typewriter") {
                var ta5 = createTextAnim(layer, "Typewriter");
                var op5 = ta5.props.addProperty("ADBE Text Opacity");
                op5.setValue(0);
                setUnits(ta5.sel, 1); // Characters
                var sProp5 = ta5.sel.property("ADBE Text Percent Start");
                sProp5.setValueAtTime(startTime, 0);
                sProp5.setValueAtTime(startTime + duration, 100);
                var k1 = sProp5.nearestKeyIndex(startTime);
                var k2 = sProp5.nearestKeyIndex(startTime + duration);
                try {
                    sProp5.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.LINEAR);
                    sProp5.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.LINEAR);
                } catch (e) {}
                return { preset: "typewriter", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 6. flip3D: 3D rotation X -90deg + opacity 0, 3D layer
            if (preset === "flip3d") {
                layer.threeDLayer = true;
                var ta6 = createTextAnim(layer, "Flip 3D");
                var rx6 = null;
                try {
                    rx6 = ta6.props.addProperty("ADBE Text Rotation X");
                } catch (e) {
                    try {
                        rx6 = ta6.props.addProperty("ADBE Text Rotation");
                    } catch (e2) {}
                }
                if (rx6) rx6.setValue(-90);
                var op6 = ta6.props.addProperty("ADBE Text Opacity");
                op6.setValue(0);
                setUnits(ta6.sel, 1); // Characters
                animateStart(ta6.sel, startTime, startTime + duration, 80);
                return { preset: "flip3D", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 7. slideMaskUp: position Y offset + opacity 0 with snappy 85% ease
            if (preset === "slidemaskup") {
                var ta7 = createTextAnim(layer, "Slide Mask Up");
                var pos7 = ta7.props.addProperty("ADBE Text Position 3D");
                var distY = opts.distance !== undefined ? Number(opts.distance) : 80;
                pos7.setValue([0, distY, 0]);
                var op7 = ta7.props.addProperty("ADBE Text Opacity");
                op7.setValue(0);
                setUnits(ta7.sel, 1);
                animateStart(ta7.sel, startTime, startTime + duration, 85);
                return { preset: "slideMaskUp", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 8. glitchIn: character offset jitter + rapid opacity flutter
            if (preset === "glitchin") {
                var ta8 = createTextAnim(layer, "Glitch In");
                var charOffset8 = null;
                try {
                    charOffset8 = ta8.props.addProperty("ADBE Text Character Offset");
                } catch (e) {
                    try {
                        charOffset8 = ta8.props.addProperty("ADBE Text Character Range");
                    } catch (e2) {}
                }
                if (charOffset8) {
                    charOffset8.setValueAtTime(startTime, 16);
                    charOffset8.setValueAtTime(startTime + duration * 0.45, 6);
                    charOffset8.setValueAtTime(startTime + duration, 0);
                    easeLayerKeys(charOffset8, 80);
                }
                var opAnim8 = ta8.props.addProperty("ADBE Text Opacity");
                opAnim8.setValue(0);
                setUnits(ta8.sel, 1);
                animateStart(ta8.sel, startTime, startTime + duration, 80);

                var tr8 = layer.property("ADBE Transform Group");
                var top8 = tr8.property("ADBE Opacity");
                top8.setValueAtTime(startTime, 0);
                top8.setValueAtTime(startTime + 0.05, 80);
                top8.setValueAtTime(startTime + 0.12, 30);
                top8.setValueAtTime(startTime + 0.22, 100);
                return { preset: "glitchIn", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 9. scaleDownSettle: 160% -> 95% -> 100% on transform scale with fade
            if (preset === "scaledownsettle") {
                var tr9 = layer.property("ADBE Transform Group");
                var sc9 = tr9.property("ADBE Scale");
                var baseScale = sc9.value;
                var sStart = [];
                var sDip = [];
                for (var i = 0; i < baseScale.length; i++) {
                    sStart.push(baseScale[i] * 1.6);
                    sDip.push(baseScale[i] * 0.95);
                }
                sc9.setValueAtTime(startTime, sStart);
                sc9.setValueAtTime(startTime + duration * 0.7, sDip);
                sc9.setValueAtTime(startTime + duration, baseScale);
                easeLayerKeys(sc9, 80);

                var op9 = tr9.property("ADBE Opacity");
                op9.setValueAtTime(startTime, 0);
                op9.setValueAtTime(startTime + Math.min(duration * 0.4, 0.25), 100);
                easeLayerKeys(op9, 80);
                return { preset: "scaleDownSettle", layer: layer.name, startTime: startTime, duration: duration };
            }

            // 10. lineByLine: lines animate in sequentially with position Y offset
            if (preset === "linebyline") {
                var ta10 = createTextAnim(layer, "Line By Line");
                var pos10 = ta10.props.addProperty("ADBE Text Position 3D");
                pos10.setValue([0, 50, 0]);
                var op10 = ta10.props.addProperty("ADBE Text Opacity");
                op10.setValue(0);
                setUnits(ta10.sel, 4); // Lines
                animateStart(ta10.sel, startTime, startTime + duration, 80);
                return { preset: "lineByLine", layer: layer.name, startTime: startTime, duration: duration };
            }

            // Additional title / motion presets
            if (preset === "cinematicpush") {
                var tr = layer.property("ADBE Transform Group");
                var sc = tr.property("ADBE Scale");
                sc.setValueAtTime(startTime, [95, 95]);
                sc.setValueAtTime(startTime + duration, [105, 105]);

                var op = tr.property("ADBE Opacity");
                op.setValueAtTime(startTime, 0);
                op.setValueAtTime(startTime + Math.min(duration, 1.2), 100);
                easeLayerKeys(op, 75);

                return { preset: "cinematicPush", layer: layer.name, startTime: startTime, duration: duration };
            }

            if (preset === "trackingout") {
                if (!(layer instanceof TextLayer)) {
                    throw new Error("trackingOut preset requires a TextLayer.");
                }
                var textGroup = layer.property("ADBE Text Properties");
                var animators = textGroup.property("ADBE Text Animators");
                var anim = animators.addProperty("ADBE Text Animator");
                anim.name = "Tracking Out";
                var props = anim.property("ADBE Text Animator Properties");
                var trk = props.addProperty("ADBE Text Tracking Amount");
                var endTrack = opts.tracking !== undefined ? Number(opts.tracking) : 150;

                trk.setValueAtTime(startTime, 0);
                trk.setValueAtTime(startTime + duration, endTrack);
                easeLayerKeys(trk, 80);

                return { preset: "trackingOut", layer: layer.name, startTime: startTime, duration: duration };
            }

            // Fallback / standard presets handled by ae_animate
            return $.global.aeBridge.handlers.ae_animate({
                compRef: { compId: comp.id },
                layerRef: { layerIndex: layer.index },
                preset: params.preset,
                startTime: startTime,
                duration: duration,
                options: opts
            });
        });
    }

    function addTextAnimator(params) {
        return withUndo("Add Text Animator", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for addTextAnimator.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            if (!(layer instanceof TextLayer)) {
                throw new Error("Layer '" + layer.name + "' is not a TextLayer. Text animators are only supported on text layers.");
            }

            var textProps = layer.property("ADBE Text Properties");
            var animators = textProps.property("ADBE Text Animators");
            var animator = animators.addProperty("ADBE Text Animator");
            if (params.name) {
                animator.name = String(params.name);
            }

            var animProps = animator.property("ADBE Text Animator Properties");
            var addedProps = [];

            if (params.properties && typeof params.properties === "object") {
                var p = params.properties;
                if (p.opacity !== undefined) {
                    var op = animProps.addProperty("ADBE Text Opacity");
                    op.setValue(Number(p.opacity));
                    addedProps.push("opacity");
                }
                if (p.position !== undefined) {
                    var posProp = animProps.addProperty("ADBE Text Position 3D");
                    if (p.position instanceof Array) {
                        posProp.setValue(p.position);
                    } else {
                        posProp.setValue([Number(p.position), 0]);
                    }
                    addedProps.push("position");
                }
                if (p.scale !== undefined) {
                    var scProp = animProps.addProperty("ADBE Text Scale 3D");
                    if (p.scale instanceof Array) {
                        scProp.setValue(p.scale);
                    } else {
                        scProp.setValue([Number(p.scale), Number(p.scale)]);
                    }
                    addedProps.push("scale");
                }
                if (p.tracking !== undefined) {
                    var trkProp = animProps.addProperty("ADBE Text Tracking Amount");
                    trkProp.setValue(Number(p.tracking));
                    addedProps.push("tracking");
                }
                if (p.rotation !== undefined) {
                    var rotProp = animProps.addProperty("ADBE Text Rotation");
                    rotProp.setValue(Number(p.rotation));
                    addedProps.push("rotation");
                }
                if (p.blur !== undefined) {
                    var blurProp = animProps.addProperty("ADBE Text Blur");
                    if (p.blur instanceof Array) {
                        blurProp.setValue(p.blur);
                    } else {
                        blurProp.setValue([Number(p.blur), Number(p.blur)]);
                    }
                    addedProps.push("blur");
                }
                if (p.fillColor !== undefined) {
                    var fillProp = animProps.addProperty("ADBE Text Fill Color");
                    fillProp.setValue(toColor(p.fillColor));
                    addedProps.push("fillColor");
                }
            }

            // Configure Selector
            var selectors = animator.property("ADBE Text Selectors");
            var selType = params.selectorType ? String(params.selectorType).toLowerCase() : "range";
            var selector = null;

            if (selType === "wiggly") {
                selector = selectors.addProperty("ADBE Text Wiggly Selector");
            } else {
                selector = (selectors.numProperties > 0) ? selectors.property(1) : selectors.addProperty("ADBE Text Selector");
            }

            if (params.basedOn && selector) {
                var adv = selector.property("ADBE Text Range Advanced");
                if (adv) {
                    var bo = adv.property("ADBE Text Range Units Type2");
                    var bMap = { "characters": 1, "charactersexcludingspaces": 2, "words": 3, "lines": 4 };
                    var bKey = String(params.basedOn).toLowerCase();
                    if (bo && bMap.hasOwnProperty(bKey)) {
                        bo.setValue(bMap[bKey]);
                    }
                }
            }

            if (params.start !== undefined && selector) {
                var sProp = selector.property("ADBE Text Percent Start");
                if (sProp) sProp.setValue(Number(params.start));
            }
            if (params.end !== undefined && selector) {
                var eProp = selector.property("ADBE Text Percent End");
                if (eProp) eProp.setValue(Number(params.end));
            }
            if (params.offset !== undefined && selector) {
                var oProp = selector.property("ADBE Text Percent Offset");
                if (oProp) oProp.setValue(Number(params.offset));
            }

            if (params.animate && typeof params.animate === "object" && selector) {
                var an = params.animate;
                var animTargetProp = null;
                if (an.property === "start") animTargetProp = selector.property("ADBE Text Percent Start");
                else if (an.property === "end") animTargetProp = selector.property("ADBE Text Percent End");
                else if (an.property === "offset") animTargetProp = selector.property("ADBE Text Percent Offset");

                if (animTargetProp) {
                    var t0 = an.startTime !== undefined ? Number(an.startTime) : 0;
                    var dur = an.duration !== undefined ? Number(an.duration) : 1.0;
                    var v0 = an.from !== undefined ? Number(an.from) : 0;
                    var v1 = an.to !== undefined ? Number(an.to) : 100;

                    animTargetProp.setValueAtTime(t0, v0);
                    animTargetProp.setValueAtTime(t0 + dur, v1);
                    easeLayerKeys(animTargetProp, 80);
                }
            }

            return {
                animatorName: animator.name,
                layerName: layer.name,
                properties: addedProps,
                selectorType: selType
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_create_title_card = createTitleCard;
    h.createTitleCard = createTitleCard;
    h.ae_create_lower_third = createLowerThird;
    h.createLowerThird = createLowerThird;
    h.ae_apply_title_preset = applyTitlePreset;
    h.applyTitlePreset = applyTitlePreset;
    h.ae_add_text_animator = addTextAnimator;
    h.addTextAnimator = addTextAnimator;
})();
