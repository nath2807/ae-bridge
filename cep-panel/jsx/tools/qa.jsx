// Visual QA, Geometry Inspection, and Timeline Analysis Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading qa.jsx");
    }

    function getLayerType(layer) {
        if (typeof $.global.getLayerType === "function") return $.global.getLayerType(layer);
        if (layer instanceof CameraLayer) return "camera";
        if (layer instanceof LightLayer) return "light";
        if (layer instanceof ShapeLayer) return "shape";
        if (layer instanceof TextLayer) return "text";
        if (layer instanceof AVLayer) {
            if (layer.nullLayer) return "null";
            if (layer.adjustmentLayer) return "adjustment";
            if (layer.source) {
                if (layer.source instanceof CompItem) return "precomp";
                if (layer.source instanceof FootageItem) {
                    if (layer.source.mainSource && layer.source.mainSource instanceof SolidSource) {
                        return "solid";
                    }
                    return "footage";
                }
            }
            return "footage";
        }
        return "footage";
    }

    function isLayer3D(layer) {
        if (typeof $.global.isLayer3D === "function") return $.global.isLayer3D(layer);
        if (layer instanceof CameraLayer || layer instanceof LightLayer) return true;
        try { return !!layer.threeDLayer; } catch (e) { return false; }
    }

    // Helper: calculate 2D comp-space coordinate for a local [x, y] point
    function transformPointToComp2D(pt, layer, time) {
        var curr = layer;
        var p = [pt[0], pt[1]];

        while (curr) {
            try {
                var xform = curr.property("Transform");
                var anchor = [0, 0];
                var pos = [0, 0];
                var scale = [100, 100];
                var rot = 0;

                if (xform) {
                    try { anchor = xform.property("Anchor Point").valueAtTime(time, false); } catch (eA) {}
                    try { pos = xform.property("Position").valueAtTime(time, false); } catch (eP) {}
                    try { scale = xform.property("Scale").valueAtTime(time, false); } catch (eS) {}
                    try { rot = xform.property("Rotation").valueAtTime(time, false); } catch (eR) {}
                }

                // 1. Subtract anchor point
                var ax = anchor[0] !== undefined ? anchor[0] : 0;
                var ay = anchor[1] !== undefined ? anchor[1] : 0;
                var x1 = p[0] - ax;
                var y1 = p[1] - ay;

                // 2. Scale
                var sx = (scale[0] !== undefined ? scale[0] : 100) / 100.0;
                var sy = (scale[1] !== undefined ? scale[1] : 100) / 100.0;
                var x2 = x1 * sx;
                var y2 = y1 * sy;

                // 3. Rotation (degrees)
                var rad = (rot || 0) * (Math.PI / 180.0);
                var cosR = Math.cos(rad);
                var sinR = Math.sin(rad);
                var x3 = x2 * cosR - y2 * sinR;
                var y3 = x2 * sinR + y2 * cosR;

                // 4. Translate by position
                var px = pos[0] !== undefined ? pos[0] : 0;
                var py = pos[1] !== undefined ? pos[1] : 0;
                p[0] = x3 + px;
                p[1] = y3 + py;

                curr = curr.parent;
            } catch (eWalk) {
                break;
            }
        }
        return p;
    }

    // Compute bounding box in comp space for a layer at a given time
    function computeLayerBounds(comp, layer, time) {
        var is3D = isLayer3D(layer);

        if (layer instanceof CameraLayer || layer instanceof LightLayer) {
            return null;
        }

        if (is3D) {
            var pos3D = [comp.width / 2, comp.height / 2, 0];
            var scale3D = [100, 100, 100];
            try { pos3D = layer.property("Transform").property("Position").valueAtTime(time, false); } catch (eP) {}
            try { scale3D = layer.property("Transform").property("Scale").valueAtTime(time, false); } catch (eS) {}

            var lW = (layer.width || 200) * (Math.abs(scale3D[0] !== undefined ? scale3D[0] : 100) / 100.0);
            var lH = (layer.height || 200) * (Math.abs(scale3D[1] !== undefined ? scale3D[1] : 100) / 100.0);
            var cX = pos3D[0] !== undefined ? pos3D[0] : comp.width / 2;
            var cY = pos3D[1] !== undefined ? pos3D[1] : comp.height / 2;

            return {
                left: cX - lW / 2,
                top: cY - lH / 2,
                right: cX + lW / 2,
                bottom: cY + lH / 2,
                width: lW,
                height: lH,
                is3D: true,
                approximate: true
            };
        }

        // 2D layer
        var rect = null;
        try {
            if (typeof layer.sourceRectAtTime === "function") {
                rect = layer.sourceRectAtTime(time, false);
            }
        } catch (eRect) {}

        if (!rect || (rect.width === 0 && rect.height === 0)) {
            var rawW = layer.width || comp.width;
            var rawH = layer.height || comp.height;
            rect = { top: 0, left: 0, width: rawW, height: rawH };
        }

        var c1 = transformPointToComp2D([rect.left, rect.top], layer, time);
        var c2 = transformPointToComp2D([rect.left + rect.width, rect.top], layer, time);
        var c3 = transformPointToComp2D([rect.left + rect.width, rect.top + rect.height], layer, time);
        var c4 = transformPointToComp2D([rect.left, rect.top + rect.height], layer, time);

        var minX = Math.min(c1[0], c2[0], c3[0], c4[0]);
        var maxX = Math.max(c1[0], c2[0], c3[0], c4[0]);
        var minY = Math.min(c1[1], c2[1], c3[1], c4[1]);
        var maxY = Math.max(c1[1], c2[1], c3[1], c4[1]);

        return {
            left: minX,
            top: minY,
            right: maxX,
            bottom: maxY,
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY),
            is3D: false,
            approximate: false
        };
    }

    // Helper: walk entire property tree
    function walkProperties(container, onProperty) {
        if (!container || container.numProperties === undefined) return;
        for (var i = 1; i <= container.numProperties; i++) {
            var prop = null;
            try {
                prop = container.property(i);
            } catch (e) {
                continue;
            }
            if (!prop) continue;

            if (prop.propertyType === PropertyType.PROPERTY) {
                onProperty(prop);
            } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                walkProperties(prop, onProperty);
            }
        }
    }

    // Relative luminance calculation for contrast check
    function channelLuminance(val) {
        return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    }

    function calculateLuminance(rgb) {
        if (!rgb || rgb.length < 3) return 0.5;
        return 0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2]);
    }

    function calculateContrastRatio(rgb1, rgb2) {
        var lum1 = calculateLuminance(rgb1);
        var lum2 = calculateLuminance(rgb2);
        var lighter = Math.max(lum1, lum2);
        var darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    // 1. ae_get_layer_bounds
    function getLayerBounds(params) {
        var comp = findComp(params ? params.compRef : null);
        var time = (params && params.time !== undefined && !isNaN(Number(params.time)))
            ? Number(params.time)
            : comp.time;
        time = Math.max(0, Math.min(comp.duration, time));

        var results = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var isVisible = !!layer.enabled && time >= layer.inPoint && time <= layer.outPoint;

            var opacity = 100;
            try {
                var opProp = layer.property("Transform").property("Opacity");
                if (opProp) {
                    opacity = typeof opProp.valueAtTime === "function" ? opProp.valueAtTime(time, false) : opProp.value;
                }
            } catch (eOp) {}

            var bounds = null;
            if (isVisible) {
                bounds = computeLayerBounds(comp, layer, time);
            }

            results.push({
                layerIndex: layer.index,
                layerName: layer.name,
                layerType: getLayerType(layer),
                is3D: isLayer3D(layer),
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                visible: isVisible,
                opacity: opacity,
                bounds: bounds
            });
        }

        return {
            compName: comp.name,
            compId: comp.id,
            compWidth: comp.width,
            compHeight: comp.height,
            time: time,
            layers: results
        };
    }

    // 2. ae_qa_check
    function runQaCheck(params) {
        var comp = findComp(params ? params.compRef : null);
        var issues = [];

        function addIssue(severity, category, message, fix, layer) {
            issues.push({
                severity: severity, // "error" | "warning" | "info"
                category: category, // "composition" | "asset" | "expression" | "layout" | "timing" | "text" | "effect" | "visibility"
                layerIndex: layer ? layer.index : undefined,
                layerName: layer ? layer.name : undefined,
                message: message,
                fix: fix
            });
        }

        // Check 1: Empty Comp
        if (comp.numLayers === 0) {
            addIssue("error", "composition", "Composition '" + comp.name + "' has no layers (empty composition).", "Add visual or audio layers to the composition.");
            return {
                compName: comp.name,
                compId: comp.id,
                duration: comp.duration,
                width: comp.width,
                height: comp.height,
                sampleTimes: [],
                stats: { errors: 1, warnings: 0, info: 0 },
                issues: issues
            };
        }

        // Determine sample times
        var sampleTimes = [];
        if (params && params.checkTimes && params.checkTimes.length) {
            for (var st = 0; st < params.checkTimes.length; st++) {
                sampleTimes.push(Number(params.checkTimes[st]));
            }
        } else {
            var numSamples = (params && params.checkTimes && typeof params.checkTimes === "number")
                ? Math.max(2, Math.min(20, Math.floor(params.checkTimes)))
                : 5;
            for (var s = 0; s < numSamples; s++) {
                var tSample = (s / (numSamples - 1)) * Math.max(0, comp.duration - comp.frameDuration);
                sampleTimes.push(Number(tSample.toFixed(3)));
            }
        }

        var titleSafeLeft = comp.width * 0.1;
        var titleSafeRight = comp.width * 0.9;
        var titleSafeTop = comp.height * 0.1;
        var titleSafeBottom = comp.height * 0.9;

        var hasEarlyMotion = false;

        // Iterate over layers
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var lType = getLayerType(layer);

            // Check 2: Missing Footage
            if (layer.source && layer.source.footageMissing) {
                var assetName = layer.source.file ? layer.source.file.name : (layer.source.name || "unnamed");
                addIssue("error", "asset", "Footage file is missing for layer '" + layer.name + "' (" + assetName + ").", "Relink or replace the missing file.", layer);
            }

            // Check 3: Layers outside composition duration
            if (layer.inPoint >= comp.duration || layer.outPoint <= 0) {
                addIssue("warning", "timing", "Layer '" + layer.name + "' [in: " + layer.inPoint.toFixed(2) + "s, out: " + layer.outPoint.toFixed(2) + "s] is positioned entirely outside composition duration (" + comp.duration.toFixed(2) + "s).", "Adjust layer inPoint/outPoint or extend comp duration.", layer);
            }

            // Check 4: Check if opening has entrances
            if (layer.inPoint > 0.001 && layer.inPoint <= 0.5) {
                hasEarlyMotion = true;
            }

            // Check 5: Disabled Effects
            try {
                var fxGroup = layer.property("Effects");
                if (fxGroup) {
                    for (var f = 1; f <= fxGroup.numProperties; f++) {
                        var fx = fxGroup.property(f);
                        if (fx && fx.enabled === false) {
                            addIssue("info", "effect", "Effect '" + fx.name + "' on layer '" + layer.name + "' is disabled.", "Enable the effect or delete it if unused.", layer);
                        }
                    }
                }
            } catch (eFx) {}

            // Check 6: Walk all properties for expression errors and keyframe issues
            walkProperties(layer, function (prop) {
                // Expression error check
                try {
                    if (prop.canSetExpression && prop.expressionEnabled) {
                        var errStr = prop.expressionError;
                        if (errStr && errStr.length > 0) {
                            addIssue("error", "expression", "Expression error on '" + layer.name + " > " + prop.name + "': " + errStr, "Fix expression syntax or referenced variable names.", layer);
                        }
                    }
                } catch (eExpr) {}

                // Keyframe checks
                try {
                    if (prop.numKeys && prop.numKeys > 0) {
                        for (var k = 1; k <= prop.numKeys; k++) {
                            var kt = prop.keyTime(k);

                            if (kt >= 0.001 && kt <= 0.5) {
                                hasEarlyMotion = true;
                            }

                            if (kt > layer.outPoint + 0.005) {
                                addIssue("warning", "timing", "Keyframe " + k + " at " + kt.toFixed(2) + "s on '" + layer.name + " > " + prop.name + "' is placed after layer outPoint (" + layer.outPoint.toFixed(2) + "s).", "Move keyframe inside active duration or extend layer outPoint.", layer);
                            } else if (kt < layer.inPoint - 0.005) {
                                addIssue("info", "timing", "Keyframe " + k + " at " + kt.toFixed(2) + "s on '" + layer.name + " > " + prop.name + "' is placed before layer inPoint (" + layer.inPoint.toFixed(2) + "s).", "Move keyframe inside active duration or adjust layer inPoint.", layer);
                            }

                            // Fast animation check (< 4 frames)
                            if (k < prop.numKeys) {
                                var nextKt = prop.keyTime(k + 1);
                                var dt = nextKt - kt;
                                var frameSpan = Math.round(dt / comp.frameDuration);
                                if (dt > 0.0001 && frameSpan < 4) {
                                    addIssue("warning", "timing", "Animation between keyframes " + k + " and " + (k + 1) + " on '" + layer.name + " > " + prop.name + "' spans only " + frameSpan + " frame(s) (< 4 frames). Motion may appear as a harsh cut or flicker.", "Extend keyframe easing duration to at least 6-12 frames for smooth animation.", layer);
                                }
                            }
                        }
                    }
                } catch (eKeys) {}
            });

            // Check 7: Wasted Layer - Opacity always 0%
            try {
                var opProp = layer.property("Transform").property("Opacity");
                if (opProp) {
                    if (opProp.numKeys === 0 && opProp.value === 0) {
                        addIssue("warning", "visibility", "Layer '" + layer.name + "' has static 0% opacity for its entire duration.", "Increase opacity or delete unused layer.", layer);
                    } else if (opProp.numKeys > 0) {
                        var allZero = true;
                        for (var ok = 1; ok <= opProp.numKeys; ok++) {
                            if (opProp.keyValue(ok) > 0) {
                                allZero = false;
                                break;
                            }
                        }
                        if (allZero) {
                            addIssue("warning", "visibility", "All opacity keyframes on layer '" + layer.name + "' are 0%. Layer is never visible.", "Animate opacity above 0% or delete layer.", layer);
                        }
                    }
                }
            } catch (eOpZero) {}

            // Check 8: Text specific checks (Tiny text, Contrast)
            if (lType === "text") {
                try {
                    var sourceTextProp = layer.property("Text").property("Source Text");
                    if (sourceTextProp) {
                        var textDoc = sourceTextProp.value;
                        var fontSize = textDoc.fontSize || 36;
                        var scaleY = 100;
                        try { scaleY = Math.abs(layer.property("Transform").property("Scale").value[1]); } catch (eSc) {}
                        var effectiveSize = fontSize * (scaleY / 100.0) * (1080.0 / comp.height);

                        if (effectiveSize < 24) {
                            addIssue("warning", "text", "Effective font size on '" + layer.name + "' is " + Math.round(effectiveSize) + "px (< 24px at 1080p equivalent). May be hard to read on mobile devices.", "Increase font size to at least 32-48px for legible titles.", layer);
                        }

                        // Contrast check against comp.bgColor
                        if (textDoc.applyFill && textDoc.fillColor && comp.bgColor) {
                            var ratio = calculateContrastRatio(textDoc.fillColor, comp.bgColor);
                            if (ratio < 3.0) {
                                addIssue("warning", "text", "Text contrast ratio on '" + layer.name + "' is " + ratio.toFixed(1) + ":1 against background (recommended minimum is 3:1).", "Increase color contrast between text fill and background, or add a dark drop shadow.", layer);
                            }
                        }
                    }
                } catch (eTextVal) {}
            }
        }

        // Check 9: Layout, Title-Safe, Off-screen, and Overlap across sample times
        var overlappingPairsReported = {};

        for (var tIdx = 0; tIdx < sampleTimes.length; tIdx++) {
            var stTime = sampleTimes[tIdx];
            var visibleTextLayersAtT = [];

            for (var lIdx = 1; lIdx <= comp.numLayers; lIdx++) {
                var lyr = comp.layer(lIdx);
                if (!lyr.enabled || stTime < lyr.inPoint || stTime > lyr.outPoint) {
                    continue;
                }

                var lyrOp = 100;
                try {
                    var opP = lyr.property("Transform").property("Opacity");
                    lyrOp = typeof opP.valueAtTime === "function" ? opP.valueAtTime(stTime, false) : opP.value;
                } catch (eOpSample) {}

                if (lyrOp <= 5) continue; // Layer is effectively transparent at this time

                var b = computeLayerBounds(comp, lyr, stTime);
                if (!b) continue;

                var isText = getLayerType(lyr) === "text";
                if (isText) {
                    visibleTextLayersAtT.push({ layer: lyr, bounds: b });

                    // Off-screen check
                    if (b.right < 0 || b.left > comp.width || b.bottom < 0 || b.top > comp.height) {
                        addIssue("error", "layout", "Text layer '" + lyr.name + "' is completely off-screen at " + stTime.toFixed(2) + "s.", "Reposition text layer into composition viewport.", lyr);
                    } else if (b.left < 0 || b.right > comp.width || b.top < 0 || b.bottom > comp.height) {
                        addIssue("warning", "layout", "Text layer '" + lyr.name + "' is clipped by composition edges at " + stTime.toFixed(2) + "s.", "Scale down or reposition text inside comp boundaries.", lyr);
                    } else if (b.left < titleSafeLeft || b.right > titleSafeRight || b.top < titleSafeTop || b.bottom > titleSafeBottom) {
                        addIssue("warning", "layout", "Text layer '" + lyr.name + "' extends outside the 10% title-safe margin at " + stTime.toFixed(2) + "s.", "Keep primary text inside the inner 80% title-safe area for broadcast and mobile margins.", lyr);
                    }
                }
            }

            // Pairwise text overlap check
            for (var a = 0; a < visibleTextLayersAtT.length; a++) {
                for (var bIdx = a + 1; bIdx < visibleTextLayersAtT.length; bIdx++) {
                    var itemA = visibleTextLayersAtT[a];
                    var itemB = visibleTextLayersAtT[bIdx];
                    var pairKey = Math.min(itemA.layer.index, itemB.layer.index) + "_" + Math.max(itemA.layer.index, itemB.layer.index);

                    if (!overlappingPairsReported[pairKey]) {
                        var bA = itemA.bounds;
                        var bB = itemB.bounds;
                        var intersects = !(bA.right <= bB.left || bA.left >= bB.right || bA.bottom <= bB.top || bA.top >= bB.bottom);
                        if (intersects) {
                            overlappingPairsReported[pairKey] = true;
                            addIssue("warning", "layout", "Text layers '" + itemA.layer.name + "' and '" + itemB.layer.name + "' overlap each other at " + stTime.toFixed(2) + "s.", "Adjust layer positions or stagger in/out timing to prevent colliding typography.", itemA.layer);
                        }
                    }
                }
            }
        }

        // Check 10: Static Opening
        if (comp.duration >= 1.0 && !hasEarlyMotion) {
            addIssue("info", "timing", "First 0.5 seconds has no movement, keyframes, or layer transitions (static opening).", "Add an entrance animation, scale/opacity build, or stagger entrances during the first 0.5s.");
        }

        // Tally severity stats
        var errCount = 0;
        var warnCount = 0;
        var infoCount = 0;
        for (var iss = 0; iss < issues.length; iss++) {
            var sev = issues[iss].severity;
            if (sev === "error") errCount++;
            else if (sev === "warning") warnCount++;
            else infoCount++;
        }

        return {
            compName: comp.name,
            compId: comp.id,
            width: comp.width,
            height: comp.height,
            duration: comp.duration,
            sampleTimes: sampleTimes,
            stats: {
                errors: errCount,
                warnings: warnCount,
                info: infoCount,
                total: issues.length
            },
            issues: issues
        };
    }

    // 3. ae_timeline_summary
    function getTimelineSummary(params) {
        var comp = findComp(params ? params.compRef : null);
        var lines = [];

        lines.push("================================================================================");
        lines.push("COMPOSITION: \"" + comp.name + "\" (ID: " + comp.id + ")");
        lines.push("Dimensions: " + comp.width + "x" + comp.height + " | Frame Rate: " + comp.frameRate + " fps | Duration: " + comp.duration.toFixed(2) + "s (" + Math.round(comp.duration * comp.frameRate) + " frames)");
        lines.push("Total Layers: " + comp.numLayers);
        lines.push("================================================================================");
        lines.push("");

        if (comp.numLayers === 0) {
            lines.push("(Empty composition - 0 layers)");
            return lines.join("\n");
        }

        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var lType = getLayerType(layer);
            var is3D = isLayer3D(layer);

            lines.push("[" + layer.index + "] \"" + layer.name + "\" (" + lType + (is3D ? ", 3D" : ", 2D") + (layer.enabled ? "" : ", DISABLED") + ")");
            lines.push("    - Timing: In: " + layer.inPoint.toFixed(2) + "s -> Out: " + layer.outPoint.toFixed(2) + "s (Span: " + (layer.outPoint - layer.inPoint).toFixed(2) + "s) | Start: " + layer.startTime.toFixed(2) + "s");

            if (layer.parent) {
                lines.push("    - Parent: [" + layer.parent.index + "] \"" + layer.parent.name + "\"");
            }

            // Keyframes and Expressions
            var keyframedProps = [];
            var expressionProps = [];

            walkProperties(layer, function (prop) {
                try {
                    if (prop.numKeys && prop.numKeys > 0) {
                        var firstT = prop.keyTime(1);
                        var lastT = prop.keyTime(prop.numKeys);
                        var pathSegments = [];
                        var pCur = prop;
                        while (pCur && pCur !== layer) {
                            pathSegments.unshift(pCur.name);
                            pCur = pCur.parentProperty;
                        }
                        var propPath = pathSegments.join(" > ");
                        keyframedProps.push(propPath + ": " + prop.numKeys + " keys [" + firstT.toFixed(2) + "s -> " + lastT.toFixed(2) + "s]");
                    }
                } catch (eK) {}

                try {
                    if (prop.canSetExpression && prop.expressionEnabled) {
                        var pSegments = [];
                        var pC = prop;
                        while (pC && pC !== layer) {
                            pSegments.unshift(pC.name);
                            pC = pC.parentProperty;
                        }
                        var exprPath = pSegments.join(" > ");
                        var hasErr = prop.expressionError && prop.expressionError.length > 0;
                        expressionProps.push(exprPath + (hasErr ? " (ERROR: " + prop.expressionError + ")" : ""));
                    }
                } catch (eX) {}
            });

            if (keyframedProps.length > 0) {
                lines.push("    - Keyframed Properties (" + keyframedProps.length + "):");
                for (var kp = 0; kp < keyframedProps.length; kp++) {
                    lines.push("        * " + keyframedProps[kp]);
                }
            } else {
                lines.push("    - Keyframes: None (static)");
            }

            // Effects
            var fxList = [];
            try {
                var fxGrp = layer.property("Effects");
                if (fxGrp && fxGrp.numProperties > 0) {
                    for (var f = 1; f <= fxGrp.numProperties; f++) {
                        var fx = fxGrp.property(f);
                        if (fx) {
                            fxList.push("\"" + fx.name + "\" [" + fx.matchName + "]" + (fx.enabled ? "" : " (DISABLED)"));
                        }
                    }
                }
            } catch (eFxList) {}

            if (fxList.length > 0) {
                lines.push("    - Effects (" + fxList.length + "): " + fxList.join(", "));
            }

            if (expressionProps.length > 0) {
                lines.push("    - Expressions (" + expressionProps.length + "):");
                for (var ep = 0; ep < expressionProps.length; ep++) {
                    lines.push("        * " + expressionProps[ep]);
                }
            }

            lines.push("");
        }

        return lines.join("\n");
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_get_layer_bounds = getLayerBounds;
    h.getLayerBounds = getLayerBounds;
    h.ae_qa_check = runQaCheck;
    h.runQaCheck = runQaCheck;
    h.ae_timeline_summary = getTimelineSummary;
    h.getTimelineSummary = getTimelineSummary;
})();
