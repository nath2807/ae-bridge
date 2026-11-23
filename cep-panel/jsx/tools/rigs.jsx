// Dynamic Expression Rigs, Controllers, and Expression Baking for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading rigs.jsx");
    }

    var RIGS_CATALOG = [
        {
            rig: "wiggle",
            description: "Organic procedural jitter with external Slider controls for frequency and amplitude",
            applicableProperties: "Position, Scale, Rotation, Opacity, Effect controls",
            controlsAdded: ["Wiggle Frequency (Slider)", "Wiggle Amplitude (Slider)"]
        },
        {
            rig: "smoothWiggle",
            description: "Multi-octave harmonic continuous noise for liquid-smooth organic drifting",
            applicableProperties: "Position, Scale, Rotation, Camera coordinates",
            controlsAdded: ["Smooth Wiggle Frequency (Slider)", "Smooth Wiggle Amplitude (Slider)", "Smooth Wiggle Octaves (Slider)"]
        },
        {
            rig: "loop",
            description: "Continuous cyclic, ping-pong, or relative offset looping after keyframes",
            applicableProperties: "Any keyframed property",
            controlsAdded: ["None (configured via options.mode)"]
        },
        {
            rig: "bounce",
            description: "Physically-calculated damped oscillator overshoot springing naturally after every keyframe",
            applicableProperties: "Scale, Position, Rotation",
            controlsAdded: ["Bounce Amplitude (Slider)", "Bounce Frequency (Slider)", "Bounce Decay (Slider)"]
        },
        {
            rig: "elastic",
            description: "Rubbery damped sine oscillation with velocity-dependent spring recoil",
            applicableProperties: "Scale, Position, Rotation",
            controlsAdded: ["Elastic Magnitude (Slider)", "Elastic Frequency (Slider)", "Elastic Damping (Slider)"]
        },
        {
            rig: "pendulum",
            description: "Gravity-driven rotational swinging oscillation with exponential decay",
            applicableProperties: "Rotation, Angle",
            controlsAdded: ["Swing Angle (Slider)", "Swing Speed (Slider)", "Swing Decay (Slider)"]
        },
        {
            rig: "orbit",
            description: "Planetary circular orbital trajectory around a configurable point in 2D space",
            applicableProperties: "Position",
            controlsAdded: ["Orbit Radius (Slider)", "Orbit Speed (Slider)", "Orbit Center (Point)"]
        },
        {
            rig: "flicker",
            description: "Stroboscopic random luminance/opacity flashing with stepped frame cadence",
            applicableProperties: "Opacity, Intensity",
            controlsAdded: ["Flicker Min (Slider)", "Flicker Max (Slider)", "Flicker Cadence (Slider)"]
        },
        {
            rig: "counter",
            description: "Smooth numeric ticker counting from start to end with configurable duration, decimals, and comma formatting",
            applicableProperties: "Source Text",
            controlsAdded: ["Counter Start (Slider)", "Counter End (Slider)", "Counter Duration (Slider)", "Counter Decimals (Slider)", "Thousands Separator (Checkbox)"]
        },
        {
            rig: "typeCursor",
            description: "Retro terminal blinking vertical cursor appended dynamically after typed text",
            applicableProperties: "Source Text",
            controlsAdded: ["Cursor Blink Speed (Slider)", "Show Cursor (Checkbox)"]
        },
        {
            rig: "delayFollow",
            description: "Leader-follower delay rig trailing another layer's motion with customizable frame lag",
            applicableProperties: "Position, Scale, Rotation",
            controlsAdded: ["Lag Frames (Slider)"]
        },
        {
            rig: "audioReact",
            description: "Dynamic amplitude modulation driven by the composition's Audio Amplitude layer",
            applicableProperties: "Scale, Position, Opacity, Blur, Glow radius",
            controlsAdded: ["Audio Multiplier (Slider)", "Audio Baseline (Slider)"]
        },
        {
            rig: "autoFade",
            description: "Automatic smooth opacity fade-in at layer in-point and fade-out before out-point",
            applicableProperties: "Opacity",
            controlsAdded: ["Fade In Seconds (Slider)", "Fade Out Seconds (Slider)"]
        },
        {
            rig: "lookAt",
            description: "Real-time automatic 2D rotation aiming toward a specified target layer in the composition",
            applicableProperties: "Rotation",
            controlsAdded: ["None (expression targets options.targetLayer)"]
        },
        {
            rig: "breathing",
            description: "Continuous subtle organic sinusoidal expansion and contraction pulse",
            applicableProperties: "Scale",
            controlsAdded: ["Breath Rate (Slider)", "Breath Scale Percent (Slider)"]
        },
        {
            rig: "scaleToBeat",
            description: "Dynamic rhythmic beat pulse triggering exponential decay on every composition marker",
            applicableProperties: "Scale, Opacity",
            controlsAdded: ["Beat Expansion (Slider)", "Beat Decay Rate (Slider)"]
        }
    ];

    var CONTROL_MATCH_NAMES = {
        "slider": "ADBE Slider Control",
        "angle": "ADBE Angle Control",
        "checkbox": "ADBE Checkbox Control",
        "color": "ADBE Color Control",
        "point": "ADBE Point Control",
        "point3d": "ADBE Point3D Control",
        "layer": "ADBE Layer Control",
        "dropdown": "ADBE Dropdown Control"
    };

    function safeSet(prop, val) {
        if (!prop) return;
        try { prop.setValue(val); } catch (e) {}
    }

    // 1. ae_add_expression_control
    function addExpressionControl(params) {
        return withUndo("Add Expression Control", function () {
            if (!params || !params.type) {
                throw new Error("type parameter is required ('slider', 'angle', 'checkbox', 'color', 'point', 'point3d', 'layer', 'dropdown').");
            }
            if (!params.name) {
                throw new Error("name parameter is required for the expression control.");
            }

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var fxParade = layer.property("ADBE Effect Parade");
            if (!fxParade) {
                throw new Error("Layer '" + layer.name + "' does not support effects/expression controls.");
            }

            var typeKey = String(params.type).toLowerCase();
            var matchName = CONTROL_MATCH_NAMES[typeKey] || params.type;

            var ctrl = null;
            try {
                ctrl = fxParade.addProperty(matchName);
            } catch (e1) {
                throw new Error("Failed to add expression control '" + matchName + "': " + e1.message);
            }

            ctrl.name = String(params.name);

            if (params.value !== undefined) {
                var valProp = ctrl.property(1);
                if (valProp) {
                    if (typeKey === "color") {
                        safeSet(valProp, toColor(params.value));
                    } else {
                        safeSet(valProp, params.value);
                    }
                }
            }

            return {
                compName: comp.name,
                layerName: layer.name,
                controlName: ctrl.name,
                type: typeKey
            };
        });
    }

    // 2. ae_link_property (Pick-whip equivalent)
    function linkProperty(params) {
        return withUndo("Link Property", function () {
            if (!params || !params.sourceLayer || !params.sourcePath) {
                throw new Error("sourceLayer and sourcePath are required for linkProperty.");
            }
            if (!params.targetLayer || !params.targetPath) {
                throw new Error("targetLayer and targetPath are required for linkProperty.");
            }

            var comp = findComp(params.compRef);
            var srcLayer = findLayer(comp, params.sourceLayer);
            var tgtLayer = findLayer(comp, params.targetLayer);

            var srcProp = resolveProperty(srcLayer, params.sourcePath);
            var tgtProp = resolveProperty(tgtLayer, params.targetPath);

            var multiplier = (params.multiplier !== undefined && !isNaN(Number(params.multiplier))) ? Number(params.multiplier) : 1.0;
            var offset = (params.offset !== undefined && !isNaN(Number(params.offset))) ? Number(params.offset) : 0.0;

            // Build relative or clean layer path
            var normSrcPath = normalizePropertyPath(params.sourcePath);
            var propExprSegments = [];
            for (var i = 0; i < normSrcPath.length; i++) {
                propExprSegments.push('("' + normSrcPath[i] + '")');
            }
            var srcRefStr = 'thisComp.layer("' + srcLayer.name + '")' + propExprSegments.join("");

            var expr = "";
            if (multiplier === 1.0 && offset === 0.0) {
                expr = srcRefStr + ';';
            } else if (offset === 0.0) {
                expr = srcRefStr + ' * ' + multiplier + ';';
            } else {
                expr = '(' + srcRefStr + ' * ' + multiplier + ') + ' + offset + ';';
            }

            tgtProp.expression = expr;

            return {
                compName: comp.name,
                sourceLayer: srcLayer.name,
                targetLayer: tgtLayer.name,
                targetProperty: tgtProp.name,
                expression: tgtProp.expression
            };
        });
    }

    // Helper to ensure an expression control exists on a layer
    function ensureControl(layer, type, name, initialVal) {
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade) return null;

        for (var i = 1; i <= fxParade.numProperties; i++) {
            var c = fxParade.property(i);
            if (c && c.name === name) return c;
        }

        var match = CONTROL_MATCH_NAMES[type] || type;
        try {
            var newCtrl = fxParade.addProperty(match);
            newCtrl.name = name;
            if (initialVal !== undefined && newCtrl.property(1)) {
                safeSet(newCtrl.property(1), initialVal);
            }
            return newCtrl;
        } catch (e) {
            return null;
        }
    }

    // 3. ae_apply_rig
    function applyRig(params) {
        return withUndo("Apply Expression Rig", function () {
            if (!params || !params.rig) {
                throw new Error("rig parameter is required ('wiggle', 'smoothWiggle', 'loop', 'bounce', 'elastic', 'pendulum', 'orbit', 'flicker', 'counter', 'typeCursor', 'delayFollow', 'audioReact', 'autoFade', 'lookAt', 'breathing', 'scaleToBeat').");
            }
            if (!params.layerRef) {
                throw new Error("layerRef parameter is required for applyRig.");
            }
            if (!params.path) {
                throw new Error("path parameter is required for applyRig.");
            }

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);
            var rig = String(params.rig).toLowerCase();
            var options = params.options || {};

            var addedControls = [];

            // 1. Wiggle Rig
            if (rig === "wiggle") {
                ensureControl(layer, "slider", "Wiggle Frequency", 2.0);
                ensureControl(layer, "slider", "Wiggle Amplitude", 30.0);
                addedControls.push("Wiggle Frequency", "Wiggle Amplitude");

                prop.expression = [
                    'var wFreq = effect("Wiggle Frequency")("Slider");',
                    'var wAmp = effect("Wiggle Amplitude")("Slider");',
                    'wiggle(wFreq, wAmp);'
                ].join("\n");
            }

            // 2. Smooth Wiggle Rig
            else if (rig === "smoothwiggle") {
                ensureControl(layer, "slider", "Smooth Wiggle Frequency", 1.5);
                ensureControl(layer, "slider", "Smooth Wiggle Amplitude", 25.0);
                ensureControl(layer, "slider", "Smooth Wiggle Octaves", 3.0);
                addedControls.push("Smooth Wiggle Frequency", "Smooth Wiggle Amplitude", "Smooth Wiggle Octaves");

                prop.expression = [
                    'var swF = effect("Smooth Wiggle Frequency")("Slider");',
                    'var swA = effect("Smooth Wiggle Amplitude")("Slider");',
                    'var swOct = Math.round(effect("Smooth Wiggle Octaves")("Slider"));',
                    'wiggle(swF, swA, swOct);'
                ].join("\n");
            }

            // 3. Loop Rig
            else if (rig === "loop") {
                var mode = options.mode ? String(options.mode).toLowerCase() : "cycle";
                prop.expression = 'loopOut("' + mode + '");';
            }

            // 4. Natural Bounce Overshoot Rig (Original damped oscillator math)
            else if (rig === "bounce") {
                ensureControl(layer, "slider", "Bounce Amplitude", 0.08);
                ensureControl(layer, "slider", "Bounce Frequency", 3.5);
                ensureControl(layer, "slider", "Bounce Decay", 5.0);
                addedControls.push("Bounce Amplitude", "Bounce Frequency", "Bounce Decay");

                prop.expression = [
                    '// Custom damped oscillator overshoot designed for ae-bridge',
                    'var oscAmp = effect("Bounce Amplitude")("Slider");',
                    'var oscFreq = effect("Bounce Frequency")("Slider");',
                    'var oscDamp = effect("Bounce Decay")("Slider");',
                    'if (numKeys > 0) {',
                    '    var curKey = nearestKey(time).index;',
                    '    if (key(curKey).time > time) curKey--;',
                    '    if (curKey > 0 && curKey < numKeys) {',
                    '        var anchorTime = key(curKey).time;',
                    '        var tau = time - anchorTime;',
                    '        if (tau >= 0) {',
                    '            var velRef = velocityAtTime(anchorTime - thisComp.frameDuration * 0.4);',
                    '            var decayCurve = Math.exp(-oscDamp * tau);',
                    '            var cycleWave = Math.cos(oscFreq * tau * 2 * Math.PI);',
                    '            value + (velRef * oscAmp * cycleWave * decayCurve);',
                    '        } else { value; }',
                    '    } else { value; }',
                    '} else { value; }'
                ].join("\n");
            }

            // 5. Elastic Spring Rig (Original formulation)
            else if (rig === "elastic") {
                ensureControl(layer, "slider", "Elastic Magnitude", 0.12);
                ensureControl(layer, "slider", "Elastic Frequency", 4.0);
                ensureControl(layer, "slider", "Elastic Damping", 6.0);
                addedControls.push("Elastic Magnitude", "Elastic Frequency", "Elastic Damping");

                prop.expression = [
                    '// Elastic spring recoil for ae-bridge',
                    'var elMag = effect("Elastic Magnitude")("Slider");',
                    'var elFreq = effect("Elastic Frequency")("Slider");',
                    'var elDamp = effect("Elastic Damping")("Slider");',
                    'if (numKeys > 0) {',
                    '    var k = nearestKey(time).index;',
                    '    if (key(k).time > time) k--;',
                    '    if (k > 0) {',
                    '        var dt = time - key(k).time;',
                    '        if (dt >= 0) {',
                    '            var v0 = velocityAtTime(key(k).time - thisComp.frameDuration * 0.5);',
                    '            var env = Math.exp(-elDamp * dt);',
                    '            var phase = Math.sin(elFreq * dt * 2 * Math.PI);',
                    '            value + (v0 * elMag * phase * env);',
                    '        } else { value; }',
                    '    } else { value; }',
                    '} else { value; }'
                ].join("\n");
            }

            // 6. Pendulum Swing Rig
            else if (rig === "pendulum") {
                ensureControl(layer, "slider", "Swing Angle", 25.0);
                ensureControl(layer, "slider", "Swing Speed", 1.2);
                ensureControl(layer, "slider", "Swing Decay", 0.35);
                addedControls.push("Swing Angle", "Swing Speed", "Swing Decay");

                prop.expression = [
                    'var sAng = effect("Swing Angle")("Slider");',
                    'var sSpeed = effect("Swing Speed")("Slider");',
                    'var sDecay = effect("Swing Decay")("Slider");',
                    'var tNorm = Math.max(0, time - inPoint);',
                    'value + (Math.sin(tNorm * sSpeed * 2 * Math.PI) * sAng * Math.exp(-sDecay * tNorm));'
                ].join("\n");
            }

            // 7. Orbit Rig (2D Position)
            else if (rig === "orbit") {
                ensureControl(layer, "slider", "Orbit Radius", 180.0);
                ensureControl(layer, "slider", "Orbit Speed", 0.5);
                ensureControl(layer, "point", "Orbit Center", [comp.width / 2, comp.height / 2]);
                addedControls.push("Orbit Radius", "Orbit Speed", "Orbit Center");

                prop.expression = [
                    'var orbR = effect("Orbit Radius")("Slider");',
                    'var orbSpd = effect("Orbit Speed")("Slider");',
                    'var orbCtr = effect("Orbit Center")("Point");',
                    'var theta = time * orbSpd * 2 * Math.PI;',
                    '[orbCtr[0] + Math.cos(theta) * orbR, orbCtr[1] + Math.sin(theta) * orbR];'
                ].join("\n");
            }

            // 8. Flicker Rig (Opacity / Luminance)
            else if (rig === "flicker") {
                ensureControl(layer, "slider", "Flicker Min", 20.0);
                ensureControl(layer, "slider", "Flicker Max", 100.0);
                ensureControl(layer, "slider", "Flicker Cadence", 14.0);
                addedControls.push("Flicker Min", "Flicker Max", "Flicker Cadence");

                prop.expression = [
                    'var flkMin = effect("Flicker Min")("Slider");',
                    'var flkMax = effect("Flicker Max")("Slider");',
                    'var flkCad = effect("Flicker Cadence")("Slider");',
                    'posterizeTime(flkCad);',
                    'flkMin + random(flkMax - flkMin);'
                ].join("\n");
            }

            // 9. Numeric Counter Rig (Source Text)
            else if (rig === "counter") {
                ensureControl(layer, "slider", "Counter Start", 0.0);
                ensureControl(layer, "slider", "Counter End", 1000.0);
                ensureControl(layer, "slider", "Counter Duration", 3.0);
                ensureControl(layer, "slider", "Counter Decimals", 0.0);
                ensureControl(layer, "checkbox", "Thousands Separator", 1);
                addedControls.push("Counter Start", "Counter End", "Counter Duration", "Counter Decimals", "Thousands Separator");

                prop.expression = [
                    'var cStart = effect("Counter Start")("Slider");',
                    'var cEnd = effect("Counter End")("Slider");',
                    'var cDur = Math.max(0.01, effect("Counter Duration")("Slider"));',
                    'var cDec = Math.max(0, Math.round(effect("Counter Decimals")("Slider")));',
                    'var useCommas = effect("Thousands Separator")("Checkbox").value == 1;',
                    'var progress = clamp((time - inPoint) / cDur, 0, 1);',
                    'var eased = progress * progress * (3 - 2 * progress);',
                    'var val = cStart + (cEnd - cStart) * eased;',
                    'var formatted = val.toFixed(cDec);',
                    'if (useCommas) {',
                    '    var parts = formatted.split(".");',
                    '    parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");',
                    '    formatted = parts.join(".");',
                    '}',
                    'formatted;'
                ].join("\n");
            }

            // 10. Typewriter Blinking Cursor Rig (Source Text)
            else if (rig === "typecursor") {
                ensureControl(layer, "slider", "Cursor Blink Speed", 3.0);
                ensureControl(layer, "checkbox", "Show Cursor", 1);
                addedControls.push("Cursor Blink Speed", "Show Cursor");

                prop.expression = [
                    'var cSpeed = effect("Cursor Blink Speed")("Slider");',
                    'var cActive = effect("Show Cursor")("Checkbox").value == 1;',
                    'var glyph = (cActive && (time * cSpeed % 1 < 0.5)) ? "|" : "";',
                    'value + glyph;'
                ].join("\n");
            }

            // 11. Delay Follow Rig
            else if (rig === "delayfollow") {
                var leaderName = options.leader ? String(options.leader) : null;
                if (!leaderName) {
                    throw new Error("options.leader (name of leader layer) is required for delayFollow rig.");
                }
                ensureControl(layer, "slider", "Lag Frames", 6.0);
                addedControls.push("Lag Frames");

                prop.expression = [
                    'var lagFrames = effect("Lag Frames")("Slider");',
                    'var lagTime = lagFrames * thisComp.frameDuration;',
                    'thisComp.layer("' + leaderName + '").transform.position.valueAtTime(time - lagTime);'
                ].join("\n");
            }

            // 12. Audio Reactive Rig
            else if (rig === "audioreact") {
                ensureControl(layer, "slider", "Audio Multiplier", 2.0);
                ensureControl(layer, "slider", "Audio Baseline", 0.0);
                addedControls.push("Audio Multiplier", "Audio Baseline");

                prop.expression = [
                    'var aMult = effect("Audio Multiplier")("Slider");',
                    'var aBase = effect("Audio Baseline")("Slider");',
                    'var aLyr = null;',
                    'try { aLyr = thisComp.layer("Audio Amplitude"); } catch(e) {}',
                    'var aLev = (aLyr && aLyr.effect("Both Channels")) ? aLyr.effect("Both Channels")("Slider") : 0;',
                    'value + (aLev * aMult) + aBase;'
                ].join("\n");
            }

            // 13. Auto Fade Rig (Opacity)
            else if (rig === "autofade") {
                ensureControl(layer, "slider", "Fade In Seconds", 0.5);
                ensureControl(layer, "slider", "Fade Out Seconds", 0.5);
                addedControls.push("Fade In Seconds", "Fade Out Seconds");

                prop.expression = [
                    'var fIn = Math.max(0.01, effect("Fade In Seconds")("Slider"));',
                    'var fOut = Math.max(0.01, effect("Fade Out Seconds")("Slider"));',
                    'var tIn = linear(time, inPoint, inPoint + fIn, 0, value);',
                    'var tOut = linear(time, outPoint - fOut, outPoint, 0, value);',
                    'Math.min(tIn, tOut);'
                ].join("\n");
            }

            // 14. Look At Rig (2D Rotation toward Target Layer)
            else if (rig === "lookat") {
                var targetName = options.targetLayer ? String(options.targetLayer) : null;
                if (!targetName) {
                    throw new Error("options.targetLayer is required for lookAt rig.");
                }

                prop.expression = [
                    'var tgt = thisComp.layer("' + targetName + '");',
                    'var diff = tgt.toComp(tgt.anchorPoint) - toComp(anchorPoint);',
                    'radiansToDegrees(Math.atan2(diff[1], diff[0]));'
                ].join("\n");
            }

            // 15. Breathing Scale Rig
            else if (rig === "breathing") {
                ensureControl(layer, "slider", "Breath Rate", 0.4);
                ensureControl(layer, "slider", "Breath Scale Percent", 5.0);
                addedControls.push("Breath Rate", "Breath Scale Percent");

                prop.expression = [
                    'var bRate = effect("Breath Rate")("Slider");',
                    'var bScale = effect("Breath Scale Percent")("Slider");',
                    'var pulse = Math.sin(time * bRate * 2 * Math.PI) * (bScale / 100);',
                    'value * (1 + pulse);'
                ].join("\n");
            }

            // 16. Scale To Beat Rig (Marker sync)
            else if (rig === "scaletobeat") {
                ensureControl(layer, "slider", "Beat Expansion", 20.0);
                ensureControl(layer, "slider", "Beat Decay Rate", 7.0);
                addedControls.push("Beat Expansion", "Beat Decay Rate");

                prop.expression = [
                    'var bExp = effect("Beat Expansion")("Slider");',
                    'var bDec = effect("Beat Decay Rate")("Slider");',
                    'var delta = 9999;',
                    'if (thisComp.marker.numKeys > 0) {',
                    '    var mIdx = thisComp.marker.nearestKey(time).index;',
                    '    if (thisComp.marker.key(mIdx).time > time) mIdx--;',
                    '    if (mIdx > 0) delta = time - thisComp.marker.key(mIdx).time;',
                    '}',
                    'var envelope = (delta >= 0 && delta < 2.0) ? Math.exp(-bDec * delta) * (bExp / 100) : 0;',
                    'value * (1 + envelope);'
                ].join("\n");
            }

            else {
                throw new Error("Unknown rig: '" + rig + "'. Valid rigs: 'wiggle', 'smoothWiggle', 'loop', 'bounce', 'elastic', 'pendulum', 'orbit', 'flicker', 'counter', 'typeCursor', 'delayFollow', 'audioReact', 'autoFade', 'lookAt', 'breathing', 'scaleToBeat'.");
            }

            return {
                compName: comp.name,
                layerName: layer.name,
                property: prop.name,
                rig: rig,
                controlsAdded: addedControls,
                expression: prop.expression
            };
        });
    }

    // 4. ae_list_rigs
    function listRigs() {
        return RIGS_CATALOG;
    }

    // 5. ae_bake_expression
    function bakeExpression(params) {
        return withUndo("Bake Expression to Keyframes", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for bakeExpression.");
            }
            if (!params.path) {
                throw new Error("path is required for bakeExpression.");
            }

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);

            if (!prop || !prop.expressionEnabled) {
                throw new Error("Property '" + prop.name + "' on layer '" + layer.name + "' does not have an active expression enabled.");
            }

            var start = layer.inPoint;
            var end = layer.outPoint;
            var step = comp.frameDuration;

            var times = [];
            var values = [];

            for (var t = start; t <= end; t += step) {
                times.push(t);
                values.push(prop.valueAtTime(t, false));
            }

            // Set evaluated keyframe values across the layer range
            for (var k = 0; k < times.length; k++) {
                prop.setValueAtTime(times[k], values[k]);
            }

            // Remove expression
            prop.expression = "";

            return {
                compName: comp.name,
                layerName: layer.name,
                property: prop.name,
                keyframeCount: times.length,
                rangeStart: start,
                rangeEnd: end
            };
        });
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_add_expression_control = addExpressionControl;
    h.addExpressionControl = addExpressionControl;
    h.ae_link_property = linkProperty;
    h.linkProperty = linkProperty;
    h.ae_apply_rig = applyRig;
    h.applyRig = applyRig;
    h.ae_list_rigs = listRigs;
    h.listRigs = listRigs;
    h.ae_bake_expression = bakeExpression;
    h.bakeExpression = bakeExpression;
})();
