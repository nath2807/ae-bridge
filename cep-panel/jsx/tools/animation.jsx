// Animation tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading animation.jsx");
    }

    function extractSimpleValue(prop) {
        if (!prop || prop.propertyType !== PropertyType.PROPERTY) return null;
        try {
            var val = prop.value;
            if (typeof val === "number" || typeof val === "string" || typeof val === "boolean") {
                return val;
            }
            if (val instanceof Array) {
                var arr = [];
                for (var i = 0; i < val.length; i++) {
                    arr.push(typeof val[i] === "number" ? Math.round(val[i] * 1000) / 1000 : val[i]);
                }
                return arr;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function buildPropertyTree(item, depth) {
        if (!item) return null;
        var isProp = (item.propertyType === PropertyType.PROPERTY);
        var node = {
            name: item.name,
            matchName: item.matchName,
            type: isProp ? "property" : "group",
            numKeys: isProp ? item.numKeys : 0,
            canSetExpression: isProp ? !!item.canSetExpression : false
        };
        if (isProp) {
            node.value = extractSimpleValue(item);
        }
        if (!isProp && depth > 0 && item.numProperties !== undefined) {
            node.children = [];
            for (var i = 1; i <= item.numProperties; i++) {
                var child = item.property(i);
                if (child) {
                    node.children.push(buildPropertyTree(child, depth - 1));
                }
            }
        }
        return node;
    }

    function listProperties(params) {
        var comp = findComp(params ? params.compRef : null);
        var layer = findLayer(comp, params ? params.layerRef : null);
        var depth = (params && params.depth !== undefined) ? Number(params.depth) : 2;

        var root = layer;
        if (params && params.path) {
            root = resolveProperty(layer, params.path);
        }

        return buildPropertyTree(root, depth);
    }

    function describePropertyTree(params) {
        var comp = findComp(params ? params.compRef : null);
        var layer = findLayer(comp, params ? params.layerRef : null);
        var maxDepth = (params && params.maxDepth !== undefined) ? Number(params.maxDepth) : 5;

        function traverse(propGroup, currentDepth, currentPath) {
            if (!propGroup || currentDepth > maxDepth) return null;
            var isProp = (propGroup.propertyType === PropertyType.PROPERTY);
            var node = {
                name: propGroup.name,
                matchName: propGroup.matchName,
                path: currentPath,
                propertyType: isProp ? "PROPERTY" : (propGroup.propertyType === PropertyType.INDEXED_GROUP ? "INDEXED_GROUP" : "NAMED_GROUP"),
                depth: currentDepth
            };

            if (isProp) {
                node.numKeys = propGroup.numKeys || 0;
                node.hasExpression = !!propGroup.hasExpression;
                node.expressionEnabled = !!propGroup.expressionEnabled;
                if (propGroup.hasExpression) {
                    node.expression = String(propGroup.expression || "");
                }
                node.isModified = !!propGroup.isModified;
                node.canVaryOverTime = !!propGroup.canVaryOverTime;
                node.value = extractSimpleValue(propGroup);
                try {
                    node.propertyValueType = String(propGroup.propertyValueType);
                } catch (e) {}
            } else if (propGroup.numProperties !== undefined) {
                node.children = [];
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var child = propGroup.property(i);
                    if (child) {
                        var childPath = currentPath.slice(0);
                        childPath.push(child.name);
                        var childNode = traverse(child, currentDepth + 1, childPath);
                        if (childNode) {
                            node.children.push(childNode);
                        }
                    }
                }
            }

            return node;
        }

        var root = layer;
        var startPath = [];
        if (params && params.path) {
            root = resolveProperty(layer, params.path);
            startPath = (params.path instanceof Array) ? params.path : [String(params.path)];
        }

        return {
            layerName: layer.name,
            layerIndex: layer.index,
            tree: traverse(root, 0, startPath)
        };
    }

    function getProperty(params) {
        if (!params || !params.path) {
            throw new Error("Property path is required for getProperty.");
        }
        var comp = findComp(params.compRef);
        var layer = findLayer(comp, params.layerRef);
        var prop = resolveProperty(layer, params.path);

        var isProp = (prop.propertyType === PropertyType.PROPERTY);
        var keyframes = [];

        if (isProp && prop.numKeys > 0) {
            for (var k = 1; k <= prop.numKeys; k++) {
                var kTime = prop.keyTime(k);
                var kVal = prop.keyValue(k);
                if (kVal instanceof Array) {
                    var cleanedVal = [];
                    for (var j = 0; j < kVal.length; j++) {
                        cleanedVal.push(typeof kVal[j] === "number" ? Math.round(kVal[j] * 1000) / 1000 : kVal[j]);
                    }
                    kVal = cleanedVal;
                }
                keyframes.push({
                    index: k,
                    time: Math.round(kTime * 1000) / 1000,
                    value: kVal,
                    inInterpolationType: prop.keyInInterpolationType(k),
                    outInterpolationType: prop.keyOutInterpolationType(k)
                });
            }
        }

        return {
            name: prop.name,
            matchName: prop.matchName,
            type: isProp ? "property" : "group",
            value: isProp ? extractSimpleValue(prop) : null,
            numKeys: isProp ? prop.numKeys : 0,
            keyframes: keyframes,
            canSetExpression: isProp ? !!prop.canSetExpression : false,
            expression: (isProp && prop.canSetExpression) ? prop.expression : "",
            expressionEnabled: (isProp && prop.canSetExpression) ? !!prop.expressionEnabled : false,
            expressionError: (isProp && prop.canSetExpression) ? (prop.expressionError || null) : null
        };
    }

    function setProperty(params) {
        return withUndo("Set Property", function () {
            if (!params || !params.path) {
                throw new Error("Property path is required for setProperty.");
            }
            if (params.value === undefined) {
                throw new Error("Value is required for setProperty.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);

            if (prop.propertyType !== PropertyType.PROPERTY) {
                throw new Error("Cannot set value on '" + prop.name + "': target is a group, not a property.");
            }

            var val = params.value;
            if (typeof val === "string" && val.charAt(0) === "#") {
                val = toColor(val);
            } else if (prop.propertyValueType === PropertyValueType.COLOR && !(typeof val === "number")) {
                val = toColor(val);
            }

            prop.setValue(val);
            return {
                name: prop.name,
                matchName: prop.matchName,
                value: extractSimpleValue(prop)
            };
        });
    }

    function getEaseDimension(prop) {
        if (prop.isSpatial) {
            return 1;
        }
        try {
            var v = prop.value;
            if (v instanceof Array && v.length > 1) {
                return v.length;
            }
        } catch (e) {}
        return 1;
    }

    function applyKeyframeEasing(prop, keyIndex, kf, dim) {
        var easeMode = kf.ease || "linear";
        if (easeMode === "hold") {
            prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            return;
        }
        if (easeMode === "linear") {
            prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
            return;
        }

        var inSpeed = kf.easeInSpeed !== undefined ? Number(kf.easeInSpeed) : 0;
        var outSpeed = kf.easeOutSpeed !== undefined ? Number(kf.easeOutSpeed) : 0;
        var inInf = kf.easeInInfluence !== undefined ? Number(kf.easeInInfluence) : (easeMode === "easeOut" ? 0.1 : 33.33);
        var outInf = kf.easeOutInfluence !== undefined ? Number(kf.easeOutInfluence) : (easeMode === "easeIn" ? 0.1 : 33.33);

        inInf = Math.max(0.1, Math.min(100, inInf));
        outInf = Math.max(0.1, Math.min(100, outInf));

        var inEases = [];
        var outEases = [];
        for (var d = 0; d < dim; d++) {
            inEases.push(new KeyframeEase(inSpeed, inInf));
            outEases.push(new KeyframeEase(outSpeed, outInf));
        }

        try {
            prop.setTemporalEaseAtKey(keyIndex, inEases, outEases);
        } catch (e) {
            prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        }
    }

    function addKeyframes(params) {
        return withUndo("Add Keyframes", function () {
            if (!params || !params.path) {
                throw new Error("Property path is required for addKeyframes.");
            }
            if (!params.keyframes || !(params.keyframes instanceof Array) || params.keyframes.length === 0) {
                throw new Error("keyframes array is required for addKeyframes.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);

            if (prop.propertyType !== PropertyType.PROPERTY) {
                throw new Error("Target property '" + prop.name + "' is a group, not an animatable property.");
            }

            var dim = getEaseDimension(prop);
            var results = [];

            for (var i = 0; i < params.keyframes.length; i++) {
                var kf = params.keyframes[i];
                var t = Number(kf.time);
                var v = kf.value;

                if (typeof v === "string" && v.charAt(0) === "#") {
                    v = toColor(v);
                } else if (prop.propertyValueType === PropertyValueType.COLOR && !(typeof v === "number")) {
                    v = toColor(v);
                }

                prop.setValueAtTime(t, v);
                var keyIdx = prop.nearestKeyIndex(t);

                if (kf.ease || kf.easeInInfluence !== undefined || kf.easeOutInfluence !== undefined ||
                    kf.easeInSpeed !== undefined || kf.easeOutSpeed !== undefined) {
                    applyKeyframeEasing(prop, keyIdx, kf, dim);
                }

                results.push({
                    index: keyIdx,
                    time: t,
                    value: v
                });
            }

            return {
                name: prop.name,
                numKeys: prop.numKeys,
                added: results
            };
        });
    }

    function removeKeyframes(params) {
        return withUndo("Remove Keyframes", function () {
            if (!params || !params.path) {
                throw new Error("Property path is required for removeKeyframes.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);

            if (prop.propertyType !== PropertyType.PROPERTY) {
                throw new Error("Target property '" + prop.name + "' is a group, not an animatable property.");
            }

            var times = params.times;
            var removedCount = 0;

            if (times && times instanceof Array && times.length > 0) {
                for (var i = 0; i < times.length; i++) {
                    var targetTime = Number(times[i]);
                    if (prop.numKeys > 0) {
                        var kIdx = prop.nearestKeyIndex(targetTime);
                        if (Math.abs(prop.keyTime(kIdx) - targetTime) <= 0.001) {
                            prop.removeKey(kIdx);
                            removedCount++;
                        }
                    }
                }
            } else {
                removedCount = prop.numKeys;
                while (prop.numKeys > 0) {
                    prop.removeKey(1);
                }
            }

            return {
                name: prop.name,
                removedCount: removedCount,
                remainingKeys: prop.numKeys
            };
        });
    }

    function setExpression(params) {
        return withUndo("Set Expression", function () {
            if (!params || !params.path) {
                throw new Error("Property path is required for setExpression.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);

            if (prop.propertyType !== PropertyType.PROPERTY || !prop.canSetExpression) {
                throw new Error("Target property '" + prop.name + "' does not support expressions.");
            }

            var expr = params.expression;
            if (expr === undefined || expr === null || expr === "") {
                prop.expression = "";
                prop.expressionEnabled = false;
            } else {
                prop.expression = String(expr);
                prop.expressionEnabled = true;
            }

            return {
                name: prop.name,
                expression: prop.expression,
                expressionEnabled: prop.expressionEnabled,
                expressionError: prop.expressionError || null
            };
        });
    }

    // Helper to add snappy keyframes on a property with strong ease-out curves
    function setSnappyKeyframes(prop, t0, v0, t1, v1, easeOutInf, easeInInf) {
        var dim = getEaseDimension(prop);
        prop.setValueAtTime(t0, v0);
        prop.setValueAtTime(t1, v1);

        var k1 = prop.nearestKeyIndex(t0);
        var k2 = prop.nearestKeyIndex(t1);

        var outInf = easeOutInf !== undefined ? easeOutInf : 80;
        var inInf = easeInInf !== undefined ? easeInInf : 80;

        applyKeyframeEasing(prop, k1, { ease: "bezier", easeOutInfluence: outInf, easeInInfluence: 33.33 }, dim);
        applyKeyframeEasing(prop, k2, { ease: "bezier", easeOutInfluence: 33.33, easeInInfluence: inInf }, dim);
    }

    function animateLayer(params) {
        return withUndo("Apply Animation Preset", function () {
            if (!params || !params.preset) {
                throw new Error("Animation preset name is required (e.g. 'fadeIn', 'scalePop', etc.).");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var preset = String(params.preset).toLowerCase();
            var t0 = params.startTime !== undefined ? Number(params.startTime) : 0;
            var dur = params.duration !== undefined ? Number(params.duration) : 0.6;
            var t1 = t0 + dur;
            var opts = params.options || {};

            var transform = layer.property("ADBE Transform Group");

            if (preset === "fadein") {
                var op = transform.property("ADBE Opacity");
                setSnappyKeyframes(op, t0, 0, t1, 100, 80, 80);
                return { preset: "fadeIn", startTime: t0, duration: dur, layer: layer.name };
            }

            if (preset === "fadeout") {
                var opOut = transform.property("ADBE Opacity");
                setSnappyKeyframes(opOut, t0, 100, t1, 0, 80, 80);
                return { preset: "fadeOut", startTime: t0, duration: dur, layer: layer.name };
            }

            if (preset === "slideinleft" || preset === "slideinright" || preset === "slideinup" || preset === "slideindown") {
                var posProp = transform.property("ADBE Position");
                var endPos = posProp.value;
                var startPos = [endPos[0], endPos[1]];
                if (endPos.length >= 3) startPos.push(endPos[2]);

                var offsetDistX = opts.distance !== undefined ? Number(opts.distance) : comp.width;
                var offsetDistY = opts.distance !== undefined ? Number(opts.distance) : comp.height;

                if (preset === "slideinleft") startPos[0] = endPos[0] - offsetDistX;
                else if (preset === "slideinright") startPos[0] = endPos[0] + offsetDistX;
                else if (preset === "slideinup") startPos[1] = endPos[1] + offsetDistY;
                else if (preset === "slideindown") startPos[1] = endPos[1] - offsetDistY;

                setSnappyKeyframes(posProp, t0, startPos, t1, endPos, 85, 80);
                return { preset: params.preset, startTime: t0, duration: dur, layer: layer.name };
            }

            if (preset === "scalepop") {
                var scaleProp = transform.property("ADBE Scale");
                var baseScale = scaleProp.value;
                var dim = getEaseDimension(scaleProp);

                var zeroScale = dim === 3 ? [0, 0, 0] : [0, 0];
                var overScale = [];
                for (var s = 0; s < baseScale.length; s++) {
                    overScale.push(baseScale[s] * 1.10);
                }

                var tMid = t0 + dur * 0.7;
                scaleProp.setValueAtTime(t0, zeroScale);
                scaleProp.setValueAtTime(tMid, overScale);
                scaleProp.setValueAtTime(t1, baseScale);

                var k1 = scaleProp.nearestKeyIndex(t0);
                var k2 = scaleProp.nearestKeyIndex(tMid);
                var k3 = scaleProp.nearestKeyIndex(t1);

                applyKeyframeEasing(scaleProp, k1, { ease: "bezier", easeOutInfluence: 80, easeInInfluence: 40 }, dim);
                applyKeyframeEasing(scaleProp, k2, { ease: "bezier", easeOutInfluence: 70, easeInInfluence: 70 }, dim);
                applyKeyframeEasing(scaleProp, k3, { ease: "bezier", easeOutInfluence: 40, easeInInfluence: 80 }, dim);

                return { preset: "scalePop", startTime: t0, duration: dur, layer: layer.name };
            }

            if (preset === "spinin") {
                var rotProp = transform.property("ADBE Rotate Z") || transform.property("Rotation");
                var turns = opts.rotations !== undefined ? Number(opts.rotations) : 1;
                var startRot = -(turns * 360);
                setSnappyKeyframes(rotProp, t0, startRot, t1, 0, 85, 80);

                var opSpin = transform.property("ADBE Opacity");
                setSnappyKeyframes(opSpin, t0, 0, t1, 100, 80, 80);

                return { preset: "spinIn", startTime: t0, duration: dur, layer: layer.name };
            }

            if (preset === "blurin") {
                var fxParade = layer.property("ADBE Effect Parade");
                var blurFx = null;
                if (fxParade) {
                    for (var f = 1; f <= fxParade.numProperties; f++) {
                        var fx = fxParade.property(f);
                        if (fx && (fx.matchName === "ADBE Gaussian Blur 2" || fx.name === "Gaussian Blur")) {
                            blurFx = fx;
                            break;
                        }
                    }
                    if (!blurFx) {
                        try {
                            blurFx = fxParade.addProperty("ADBE Gaussian Blur 2");
                        } catch (e) {
                            blurFx = fxParade.addProperty("Gaussian Blur");
                        }
                    }
                }
                if (!blurFx) {
                    throw new Error("Could not add or find Gaussian Blur effect on layer.");
                }

                var blurProp = blurFx.property("ADBE Gaussian Blur 2-0001") || blurFx.property("Blurriness");
                var startBlur = opts.blurriness !== undefined ? Number(opts.blurriness) : 50;
                setSnappyKeyframes(blurProp, t0, startBlur, t1, 0, 80, 80);

                var opBlur = transform.property("ADBE Opacity");
                setSnappyKeyframes(opBlur, t0, 0, t1, 100, 80, 80);

                return { preset: "blurIn", startTime: t0, duration: dur, layer: layer.name };
            }

            if (preset === "typewriter") {
                if (!(layer instanceof TextLayer)) {
                    throw new Error("Preset 'typewriter' is only supported on text layers.");
                }
                var textProps = layer.property("ADBE Text Properties");
                var animators = textProps.property("ADBE Text Animators");
                var animator = animators.addProperty("ADBE Text Animator");
                animator.name = "Typewriter Effect";

                var animProps = animator.property("ADBE Text Animator Properties");
                var animOpacity = animProps.addProperty("ADBE Text Opacity");
                animOpacity.setValue(0);

                var selectors = animator.property("ADBE Text Selectors");
                var rangeSel = (selectors.numProperties > 0) ? selectors.property(1) : selectors.addProperty("ADBE Text Selector");

                var startProp = rangeSel.property("ADBE Text Percent Start");
                startProp.setValueAtTime(t0, 0);
                startProp.setValueAtTime(t1, 100);

                var kStart1 = startProp.nearestKeyIndex(t0);
                var kStart2 = startProp.nearestKeyIndex(t1);
                applyKeyframeEasing(startProp, kStart1, { ease: "linear" }, 1);
                applyKeyframeEasing(startProp, kStart2, { ease: "linear" }, 1);

                return { preset: "typewriter", startTime: t0, duration: dur, layer: layer.name };
            }

            throw new Error("Unknown animation preset: '" + params.preset + "'. Available presets: 'fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown', 'scalePop', 'spinIn', 'blurIn', 'typewriter'.");
        });
    }

    // Register handlers on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_list_properties = listProperties;
    h.listProperties = listProperties;
    h.ae_get_property = getProperty;
    h.getProperty = getProperty;
    h.ae_set_property = setProperty;
    h.setProperty = setProperty;
    h.ae_add_keyframes = addKeyframes;
    h.addKeyframes = addKeyframes;
    h.ae_remove_keyframes = removeKeyframes;
    h.removeKeyframes = removeKeyframes;
    h.ae_set_expression = setExpression;
    h.setExpression = setExpression;
    h.ae_animate = animateLayer;
    h.animateLayer = animateLayer;
    h.ae_describe_property_tree = describePropertyTree;
    h.describePropertyTree = describePropertyTree;
})();
