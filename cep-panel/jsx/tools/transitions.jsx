// Video transition tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading transitions.jsx");
    }

    var TRANSITION_CATALOG = [
        { type: "crossDissolve", category: "Dissolve", description: "Smooth standard crossfade between two overlapping clips" },
        { type: "dipToBlack", category: "Dissolve", description: "Fades outgoing clip to full black before fading into incoming clip" },
        { type: "dipToWhite", category: "Dissolve", description: "High-energy exposure flash dip between shots" },
        { type: "slideLeft", category: "Slide", description: "Incoming clip pushes outgoing clip smoothly to the left" },
        { type: "slideRight", category: "Slide", description: "Incoming clip pushes outgoing clip smoothly to the right" },
        { type: "pushUp", category: "Slide", description: "Vertical upward push transition between shots" },
        { type: "zoomIn", category: "Zoom", description: "Fast dynamic push-in zoom through outgoing frame into incoming clip" },
        { type: "zoomBlur", category: "Zoom", description: "Radial zoom blur expansion crossfade" },
        { type: "linearWipe", category: "Wipe", description: "Feathered directional linear wipe revealing incoming clip" },
        { type: "radialWipe", category: "Wipe", description: "Clockwise or counter-clockwise radial sweep wipe" },
        { type: "glitchCut", category: "Stylized", description: "Digital glitch distortion with slice jitter and flicker" },
        { type: "whipPan", category: "Motion", description: "High-speed camera whip pan with directional motion blur" }
    ];

    function easeProp(prop, inf) {
        if (!prop || prop.numKeys < 2) return;
        var dim = (prop.isSpatial) ? 1 : ((prop.value instanceof Array) ? prop.value.length : 1);
        var influence = inf !== undefined ? Number(inf) : 80;
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

    function addTransition(params) {
        return withUndo("Add Transition", function () {
            if (!params || !params.layerA || !params.layerB) {
                throw new Error("layerA and layerB are both required for addTransition.");
            }
            var comp = findComp(params.compRef);
            var lA = findLayer(comp, params.layerA);
            var lB = findLayer(comp, params.layerB);
            var type = params.type ? String(params.type) : "crossDissolve";
            var dur = params.duration !== undefined ? Number(params.duration) : 0.5;
            dur = Math.max(0.1, dur);

            // Establish transition window [t0, t1]
            // If layers are adjacent, slip layerB left by dur so they overlap
            var t0, t1;
            if (lB.inPoint >= lA.outPoint - 0.05) {
                t0 = lA.outPoint - dur;
                t1 = lA.outPoint;
                var shift = lB.inPoint - t0;
                lB.startTime -= shift;
                lB.inPoint = t0;
            } else {
                t0 = lB.inPoint;
                t1 = Math.min(lA.outPoint, t0 + dur);
                dur = t1 - t0;
            }

            var trA = lA.property("ADBE Transform Group");
            var trB = lB.property("ADBE Transform Group");
            var cW = comp.width;
            var cH = comp.height;
            var center = [cW / 2, cH / 2];

            var normType = type.toLowerCase();

            // 1. Cross Dissolve
            if (normType === "crossdissolve") {
                var opB = trB.property("ADBE Opacity");
                opB.setValueAtTime(t0, 0);
                opB.setValueAtTime(t1, 100);
                easeProp(opB, 75);
                return { type: "crossDissolve", t0: t0, t1: t1, duration: dur, layerA: lA.name, layerB: lB.name };
            }

            // 2. Dip to Black
            if (normType === "diptoblack") {
                var tMid = t0 + dur * 0.5;
                var opA = trA.property("ADBE Opacity");
                opA.setValueAtTime(t0, 100);
                opA.setValueAtTime(tMid, 0);
                easeProp(opA, 80);

                var opB2 = trB.property("ADBE Opacity");
                opB2.setValueAtTime(tMid, 0);
                opB2.setValueAtTime(t1, 100);
                easeProp(opB2, 80);
                return { type: "dipToBlack", t0: t0, t1: t1, duration: dur };
            }

            // 3. Dip to White
            if (normType === "diptowhite") {
                var flash = comp.layers.addSolid([1, 1, 1], "Dip to White Flash", cW, cH, 1, dur);
                flash.startTime = t0;
                flash.inPoint = t0;
                flash.outPoint = t1;
                try {
                    flash.moveBefore(lA);
                } catch (e) {}

                var opF = flash.property("ADBE Transform Group").property("ADBE Opacity");
                opF.setValueAtTime(t0, 0);
                opF.setValueAtTime(t0 + dur * 0.4, 100);
                opF.setValueAtTime(t1, 0);
                easeProp(opF, 80);

                var opB3 = trB.property("ADBE Opacity");
                opB3.setValueAtTime(t0, 0);
                opB3.setValueAtTime(t0 + dur * 0.45, 100);
                return { type: "dipToWhite", t0: t0, t1: t1, duration: dur };
            }

            // 4. Slide Left
            if (normType === "slideleft") {
                var posA = trA.property("ADBE Position");
                posA.setValueAtTime(t0, center);
                posA.setValueAtTime(t1, [center[0] - cW, center[1]]);
                easeProp(posA, 85);

                var posB = trB.property("ADBE Position");
                posB.setValueAtTime(t0, [center[0] + cW, center[1]]);
                posB.setValueAtTime(t1, center);
                easeProp(posB, 85);
                return { type: "slideLeft", t0: t0, t1: t1, duration: dur };
            }

            // 5. Slide Right
            if (normType === "slideright") {
                var posA2 = trA.property("ADBE Position");
                posA2.setValueAtTime(t0, center);
                posA2.setValueAtTime(t1, [center[0] + cW, center[1]]);
                easeProp(posA2, 85);

                var posB2 = trB.property("ADBE Position");
                posB2.setValueAtTime(t0, [center[0] - cW, center[1]]);
                posB2.setValueAtTime(t1, center);
                easeProp(posB2, 85);
                return { type: "slideRight", t0: t0, t1: t1, duration: dur };
            }

            // 6. Push Up
            if (normType === "pushup") {
                var posA3 = trA.property("ADBE Position");
                posA3.setValueAtTime(t0, center);
                posA3.setValueAtTime(t1, [center[0], center[1] - cH]);
                easeProp(posA3, 85);

                var posB3 = trB.property("ADBE Position");
                posB3.setValueAtTime(t0, [center[0], center[1] + cH]);
                posB3.setValueAtTime(t1, center);
                easeProp(posB3, 85);
                return { type: "pushUp", t0: t0, t1: t1, duration: dur };
            }

            // 7. Zoom In
            if (normType === "zoomin") {
                var scA = trA.property("ADBE Scale");
                scA.setValueAtTime(t0, [100, 100]);
                scA.setValueAtTime(t1, [240, 240]);
                easeProp(scA, 80);

                var opA4 = trA.property("ADBE Opacity");
                opA4.setValueAtTime(t0 + dur * 0.5, 100);
                opA4.setValueAtTime(t1, 0);

                var scB = trB.property("ADBE Scale");
                scB.setValueAtTime(t0, [40, 40]);
                scB.setValueAtTime(t1, [100, 100]);
                easeProp(scB, 80);

                var opB4 = trB.property("ADBE Opacity");
                opB4.setValueAtTime(t0, 0);
                opB4.setValueAtTime(t0 + dur * 0.4, 100);
                return { type: "zoomIn", t0: t0, t1: t1, duration: dur };
            }

            // 8. Zoom Blur
            if (normType === "zoomblur") {
                var scA2 = trA.property("ADBE Scale");
                scA2.setValueAtTime(t0, [100, 100]);
                scA2.setValueAtTime(t1, [180, 180]);
                easeProp(scA2, 80);

                var fxA = lA.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
                var blurPropA = fxA.property("ADBE Gaussian Blur 2-0001");
                blurPropA.setValueAtTime(t0, 0);
                blurPropA.setValueAtTime(t1, 60);

                var opB5 = trB.property("ADBE Opacity");
                opB5.setValueAtTime(t0, 0);
                opB5.setValueAtTime(t1, 100);

                var fxB = lB.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
                var blurPropB = fxB.property("ADBE Gaussian Blur 2-0001");
                blurPropB.setValueAtTime(t0, 60);
                blurPropB.setValueAtTime(t1, 0);
                return { type: "zoomBlur", t0: t0, t1: t1, duration: dur };
            }

            // 9. Linear Wipe
            if (normType === "linearwipe") {
                var wipe = lB.property("ADBE Effect Parade").addProperty("ADBE Linear Wipe");
                var compProp = wipe.property("ADBE Linear Wipe-0001"); // Transition Completion
                var angleProp = wipe.property("ADBE Linear Wipe-0002"); // Wipe Angle
                var featherProp = wipe.property("ADBE Linear Wipe-0003"); // Feather

                angleProp.setValue(90);
                featherProp.setValue(60);

                compProp.setValueAtTime(t0, 100);
                compProp.setValueAtTime(t1, 0);
                easeProp(compProp, 80);
                return { type: "linearWipe", t0: t0, t1: t1, duration: dur };
            }

            // 10. Radial Wipe
            if (normType === "radialwipe") {
                var rWipe = lB.property("ADBE Effect Parade").addProperty("ADBE Radial Wipe");
                var rComp = rWipe.property("ADBE Radial Wipe-0001");
                var rFeather = rWipe.property("ADBE Radial Wipe-0004");
                if (rFeather) rFeather.setValue(40);

                rComp.setValueAtTime(t0, 100);
                rComp.setValueAtTime(t1, 0);
                easeProp(rComp, 80);
                return { type: "radialWipe", t0: t0, t1: t1, duration: dur };
            }

            // 11. Glitch Cut
            if (normType === "glitchcut") {
                var pA = trA.property("ADBE Position");
                pA.setValueAtTime(t0, center);
                pA.setValueAtTime(t0 + dur * 0.3, [center[0] + 35, center[1] - 12]);
                pA.setValueAtTime(t0 + dur * 0.5, [center[0] - 25, center[1] + 18]);

                var pB = trB.property("ADBE Position");
                pB.setValueAtTime(t0 + dur * 0.5, [center[0] + 20, center[1] + 10]);
                pB.setValueAtTime(t1, center);

                var oB = trB.property("ADBE Opacity");
                oB.setValueAtTime(t0, 0);
                oB.setValueAtTime(t0 + dur * 0.35, 80);
                oB.setValueAtTime(t0 + dur * 0.5, 20);
                oB.setValueAtTime(t1, 100);
                return { type: "glitchCut", t0: t0, t1: t1, duration: dur };
            }

            // 12. Whip Pan
            if (normType === "whippan") {
                var tM = t0 + dur * 0.5;

                // Motion on A
                var posA4 = trA.property("ADBE Position");
                posA4.setValueAtTime(t0, center);
                posA4.setValueAtTime(tM, [center[0] - cW, center[1]]);
                easeProp(posA4, 85);

                var dBlurA = lA.property("ADBE Effect Parade").addProperty("ADBE Directional Blur");
                var dirA = dBlurA.property("ADBE Directional Blur-0001");
                var lenA = dBlurA.property("ADBE Directional Blur-0002");
                dirA.setValue(90);
                lenA.setValueAtTime(t0, 0);
                lenA.setValueAtTime(tM, 80);

                // Motion on B
                var posB4 = trB.property("ADBE Position");
                posB4.setValueAtTime(tM, [center[0] + cW, center[1]]);
                posB4.setValueAtTime(t1, center);
                easeProp(posB4, 85);

                var dBlurB = lB.property("ADBE Effect Parade").addProperty("ADBE Directional Blur");
                var dirB = dBlurB.property("ADBE Directional Blur-0001");
                var lenB = dBlurB.property("ADBE Directional Blur-0002");
                dirB.setValue(90);
                lenB.setValueAtTime(tM, 80);
                lenB.setValueAtTime(t1, 0);

                var oB6 = trB.property("ADBE Opacity");
                oB6.setValueAtTime(t0, 0);
                oB6.setValueAtTime(tM, 100);

                return { type: "whipPan", t0: t0, t1: t1, duration: dur };
            }

            throw new Error("Unknown transition type: '" + type + "'. Supported types: 'crossDissolve', 'dipToBlack', 'dipToWhite', 'slideLeft', 'slideRight', 'pushUp', 'zoomIn', 'zoomBlur', 'linearWipe', 'radialWipe', 'glitchCut', 'whipPan'.");
        });
    }

    function listTransitions() {
        return TRANSITION_CATALOG;
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_add_transition = addTransition;
    h.addTransition = addTransition;
    h.ae_list_transitions = listTransitions;
    h.listTransitions = listTransitions;
})();
