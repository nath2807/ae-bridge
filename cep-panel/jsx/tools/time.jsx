// Time, speed remapping, and frame rate manipulation tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading time.jsx");
    }

    function easeTimeKeys(prop, inf) {
        if (!prop || prop.numKeys < 2) return;
        var influence = inf !== undefined ? Number(inf) : 75;
        influence = Math.max(0.1, Math.min(100, influence));

        for (var k = 1; k <= prop.numKeys; k++) {
            var inEases = [new KeyframeEase(0, influence)];
            var outEases = [new KeyframeEase(0, influence)];
            try {
                prop.setTemporalEaseAtKey(k, inEases, outEases);
            } catch (e) {}
        }
    }

    function setSpeed(params) {
        return withUndo("Set Layer Speed", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setSpeed.");
            }
            if (params.speed === undefined || Number(params.speed) === 0) {
                throw new Error("speed parameter is required and cannot be 0 (e.g. 100 for normal, 200 for 2x, 50 for slow-mo, -100 for reverse).");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var sp = Number(params.speed);
            var stretchVal = (100 / sp) * 100;
            layer.stretch = stretchVal;

            return {
                layerName: layer.name,
                speedPercent: sp,
                stretchPercent: stretchVal,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                duration: layer.outPoint - layer.inPoint
            };
        });
    }

    function enableTimeRemap(params) {
        return withUndo("Enable Time Remapping", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for enableTimeRemap.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            if (!layer.canSetTimeRemapEnabled) {
                throw new Error("Layer '" + layer.name + "' does not support time remapping.");
            }

            layer.timeRemapEnabled = true;
            var trProp = layer.property("ADBE Time Remapping");

            return {
                layerName: layer.name,
                timeRemapEnabled: true,
                numKeys: trProp ? trProp.numKeys : 0
            };
        });
    }

    function speedRamp(params) {
        return withUndo("Apply Speed Ramp", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for speedRamp.");
            }
            if (!params.points || !(params.points instanceof Array) || params.points.length < 2) {
                throw new Error("points array with at least 2 points [{time, speed}] is required for speedRamp.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            if (!layer.canSetTimeRemapEnabled) {
                throw new Error("Layer '" + layer.name + "' does not support time remapping.");
            }

            layer.timeRemapEnabled = true;
            var trProp = layer.property("ADBE Time Remapping");
            if (!trProp) {
                throw new Error("Could not access ADBE Time Remapping property on layer.");
            }

            // Remove existing keyframes
            while (trProp.numKeys > 0) {
                trProp.removeKey(1);
            }

            // Sort points by time
            var pts = params.points.slice(0).sort(function (a, b) {
                return Number(a.time) - Number(b.speed);
            });

            var sourceTime = 0;
            var prevCompTime = Number(pts[0].time);
            trProp.setValueAtTime(prevCompTime, 0);

            var keyInfo = [{ time: prevCompTime, sourceTime: 0, speed: Number(pts[0].speed) }];

            for (var i = 1; i < pts.length; i++) {
                var curCompTime = Number(pts[i].time);
                var dt = curCompTime - prevCompTime;
                var avgSpeed = (Number(pts[i - 1].speed) + Number(pts[i].speed)) / 2;
                sourceTime += dt * (avgSpeed / 100);

                trProp.setValueAtTime(curCompTime, Math.max(0, sourceTime));
                keyInfo.push({ time: curCompTime, sourceTime: Math.round(sourceTime * 1000) / 1000, speed: Number(pts[i].speed) });

                prevCompTime = curCompTime;
            }

            easeTimeKeys(trProp, 75);

            return {
                layerName: layer.name,
                pointsCount: pts.length,
                keyframes: keyInfo
            };
        });
    }

    function freezeFrame(params) {
        return withUndo("Freeze Frame", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for freezeFrame.");
            }
            if (params.time === undefined) {
                throw new Error("time is required for freezeFrame.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            if (!layer.canSetTimeRemapEnabled) {
                throw new Error("Layer '" + layer.name + "' does not support time remapping.");
            }

            var freezeTime = Number(params.time);
            layer.timeRemapEnabled = true;
            var trProp = layer.property("ADBE Time Remapping");

            // Remove existing keys
            while (trProp.numKeys > 0) {
                trProp.removeKey(1);
            }

            // Calculate source time at freeze time
            var srcTime = Math.max(0, freezeTime - layer.startTime);
            trProp.setValueAtTime(freezeTime, srcTime);

            var kIdx = trProp.nearestKeyIndex(freezeTime);
            try {
                trProp.setInterpolationTypeAtKey(kIdx, KeyframeInterpolationType.HOLD);
            } catch (e) {}

            if (params.duration !== undefined) {
                layer.outPoint = freezeTime + Number(params.duration);
            }

            return {
                layerName: layer.name,
                freezeTime: freezeTime,
                sourceTime: srcTime,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint
            };
        });
    }

    function setFrameBlending(params) {
        return withUndo("Set Frame Blending", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setFrameBlending.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var mode = params.mode ? String(params.mode).toLowerCase() : "off";

            if (!(layer instanceof AVLayer)) {
                throw new Error("Frame blending is only supported on AVLayers.");
            }

            if (mode === "framemix") {
                layer.frameBlending = true;
                layer.frameBlendingType = FrameBlendingType.FRAME_MIX;
            } else if (mode === "pixelmotion") {
                layer.frameBlending = true;
                layer.frameBlendingType = FrameBlendingType.PIXEL_MOTION;
            } else {
                layer.frameBlending = false;
                layer.frameBlendingType = FrameBlendingType.NO_FRAME_BLEND;
            }

            comp.frameBlending = true; // Enable comp preview flag

            return {
                layerName: layer.name,
                frameBlending: layer.frameBlending,
                mode: mode
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_set_speed = setSpeed;
    h.setSpeed = setSpeed;
    h.ae_enable_time_remap = enableTimeRemap;
    h.enableTimeRemap = enableTimeRemap;
    h.ae_speed_ramp = speedRamp;
    h.speedRamp = speedRamp;
    h.ae_freeze_frame = freezeFrame;
    h.freezeFrame = freezeFrame;
    h.ae_set_frame_blending = setFrameBlending;
    h.setFrameBlending = setFrameBlending;
})();
