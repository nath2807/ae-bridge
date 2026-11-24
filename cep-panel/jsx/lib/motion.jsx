// Motion Language, Keyframe Curve Conversion, and Layer Stagger Library for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading motion.jsx");
    }

    var CURVE_PRESETS = {
        linear: { inInfluence: 0.1, outInfluence: 0.1, inSpeed: 0, outSpeed: 0 },
        smooth: { inInfluence: 60, outInfluence: 60, inSpeed: 0, outSpeed: 0 },
        expoOut: { inInfluence: 88, outInfluence: 16, inSpeed: 0, outSpeed: 0 },
        expoInOut: { inInfluence: 85, outInfluence: 85, inSpeed: 0, outSpeed: 0 },
        quintOut: { inInfluence: 78, outInfluence: 22, inSpeed: 0, outSpeed: 0 },
        snap: { inInfluence: 96, outInfluence: 10, inSpeed: 0, outSpeed: 0 },
        heavy: { inInfluence: 35, outInfluence: 82, inSpeed: 0, outSpeed: 0 },
        backOut: { inInfluence: 72, outInfluence: 40, inSpeed: 0, outSpeed: 0, overshoot: 0.08, timeRatio: 0.72 },
        elasticOut: { inInfluence: 68, outInfluence: 28, inSpeed: 0, outSpeed: 0, isElastic: true }
    };

    function getCurveDef(curveName) {
        if (!curveName) return CURVE_PRESETS.smooth;
        var clean = String(curveName).trim();
        if (CURVE_PRESETS.hasOwnProperty(clean)) {
            return CURVE_PRESETS[clean];
        }
        var lower = clean.toLowerCase();
        for (var k in CURVE_PRESETS) {
            if (CURVE_PRESETS.hasOwnProperty(k) && k.toLowerCase() === lower) {
                return CURVE_PRESETS[k];
            }
        }
        return CURVE_PRESETS.smooth;
    }

    function calculateOvershootValue(startVal, endVal, factor) {
        if (startVal instanceof Array && endVal instanceof Array) {
            var len = Math.min(startVal.length, endVal.length);
            var res = [];
            for (var i = 0; i < len; i++) {
                var s = Number(startVal[i]) || 0;
                var e = Number(endVal[i]) || 0;
                res.push(e + (e - s) * factor);
            }
            return res;
        }
        var sNum = Number(startVal) || 0;
        var eNum = Number(endVal) || 0;
        return eNum + (eNum - sNum) * factor;
    }

    function applyMotionCurveToProperty(prop, curveName) {
        if (!prop || prop.numKeys < 2) return false;

        var curve = getCurveDef(curveName);
        var dim = (prop.isSpatial) ? 1 : ((prop.value instanceof Array) ? prop.value.length : 1);

        // Special handling for backOut: add overshoot keyframe if not already present
        if (curve.overshoot && prop.numKeys >= 2) {
            try {
                var lastIdx = prop.numKeys;
                var penIdx = lastIdx - 1;
                var t1 = prop.keyTime(penIdx);
                var t2 = prop.keyTime(lastIdx);
                var v1 = prop.keyValue(penIdx);
                var v2 = prop.keyValue(lastIdx);

                var dur = t2 - t1;
                if (dur > 0.15) {
                    var tOver = t1 + dur * (curve.timeRatio || 0.72);
                    var vOver = calculateOvershootValue(v1, v2, curve.overshoot);
                    prop.setValueAtTime(tOver, vOver);
                }
            } catch (e) {}
        }

        // Apply temporal ease to all keyframes
        for (var k = 1; k <= prop.numKeys; k++) {
            var inEases = [];
            var outEases = [];

            var inInf = Math.max(0.1, Math.min(100, curve.inInfluence));
            var outInf = Math.max(0.1, Math.min(100, curve.outInfluence));

            for (var d = 0; d < dim; d++) {
                inEases.push(new KeyframeEase(curve.inSpeed || 0, inInf));
                outEases.push(new KeyframeEase(curve.outSpeed || 0, outInf));
            }

            try {
                prop.setTemporalEaseAtKey(k, inEases, outEases);
            } catch (err) {}
        }

        // If elasticOut curve requested, attach subtle harmonic settling expression if suitable
        if (curve.isElastic) {
            try {
                var expr = "var amp = 0.08; var freq = 3.5; var decay = 6.0;\n" +
                    "var n = 0; if (numKeys > 0) {\n" +
                    "  n = nearestKey(time).index;\n" +
                    "  if (key(n).time > time) n--;\n" +
                    "}\n" +
                    "if (n == 0) { value; } else {\n" +
                    "  var t = time - key(n).time;\n" +
                    "  if (t > 0 && t < 1.5) {\n" +
                    "    var v = velocityAtTime(key(n).time - thisComp.frameDuration/10);\n" +
                    "    value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);\n" +
                    "  } else { value; }\n" +
                    "}";
                prop.expression = expr;
            } catch (e) {}
        }

        return true;
    }

    // 1. ae_apply_motion_curve
    function applyMotionCurveHandler(params) {
        return withUndo("Apply Motion Curve", function () {
            if (!params) throw new Error("Missing parameters for ae_apply_motion_curve.");
            if (!params.path) throw new Error("Property 'path' parameter is required.");
            if (!params.curve) throw new Error("Motion 'curve' parameter is required.");

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);

            if (!prop) {
                throw new Error("Property not found at specified path.");
            }

            var success = applyMotionCurveToProperty(prop, params.curve);

            return {
                applied: success,
                compName: comp.name,
                layerName: layer.name,
                property: prop.name,
                numKeys: prop.numKeys,
                curve: params.curve
            };
        });
    }

    // 2. ae_stagger
    function staggerLayersHandler(params) {
        return withUndo("Stagger Layers", function () {
            if (!params) throw new Error("Missing parameters for ae_stagger.");
            if (!params.layerRefs || !(params.layerRefs instanceof Array) || params.layerRefs.length === 0) {
                throw new Error("layerRefs array is required for ae_stagger.");
            }

            var comp = findComp(params.compRef);
            var delay = params.delay !== undefined ? Number(params.delay) : 0.06;
            var order = params.order ? String(params.order).toLowerCase() : "forward";

            var layers = [];
            for (var i = 0; i < params.layerRefs.length; i++) {
                try {
                    var l = findLayer(comp, params.layerRefs[i]);
                    if (l) layers.push(l);
                } catch (e) {}
            }

            if (layers.length === 0) {
                throw new Error("No matching layers found in composition for staggering.");
            }

            // Determine order indexing
            var count = layers.length;
            var offsets = new Array(count);

            if (order === "reverse") {
                for (var r = 0; r < count; r++) {
                    offsets[r] = (count - 1 - r) * delay;
                }
            } else if (order === "center") {
                var centerIdx = (count - 1) / 2.0;
                for (var c = 0; c < count; c++) {
                    var distFromCenter = Math.abs(c - centerIdx);
                    offsets[c] = distFromCenter * delay;
                }
            } else if (order === "random") {
                // Pseudo-random deterministic shuffle
                var indices = [];
                for (var s = 0; s < count; s++) indices.push(s);
                for (var j = count - 1; j > 0; j--) {
                    var randIdx = Math.floor(Math.random() * (j + 1));
                    var tmp = indices[j];
                    indices[j] = indices[randIdx];
                    indices[randIdx] = tmp;
                }
                for (var k = 0; k < count; k++) {
                    offsets[k] = indices[k] * delay;
                }
            } else {
                // "forward" (default)
                for (var f = 0; f < count; f++) {
                    offsets[f] = f * delay;
                }
            }

            var results = [];
            var baseTime = layers[0].startTime;

            for (var idx = 0; idx < count; idx++) {
                var targetLayer = layers[idx];
                var newStartTime = baseTime + offsets[idx];
                targetLayer.startTime = newStartTime;

                results.push({
                    layerIndex: targetLayer.index,
                    layerName: targetLayer.name,
                    startTime: Math.round(newStartTime * 1000) / 1000,
                    offset: Math.round(offsets[idx] * 1000) / 1000
                });
            }

            return {
                staggered: true,
                compName: comp.name,
                order: order,
                delay: delay,
                layers: results
            };
        });
    }

    // Register globally
    $.global.applyMotionCurveToProperty = applyMotionCurveToProperty;
    $.global.getCurveDef = getCurveDef;

    var h = $.global.aeBridge.handlers;
    h.ae_apply_motion_curve = applyMotionCurveHandler;
    h.applyMotionCurve = applyMotionCurveHandler;
    h.ae_stagger = staggerLayersHandler;
    h.staggerLayers = staggerLayersHandler;

    if ($.global.aeBridge.helpers) {
        $.global.aeBridge.helpers.applyMotionCurveToProperty = applyMotionCurveToProperty;
        $.global.aeBridge.helpers.getCurveDef = getCurveDef;
    }
})();
