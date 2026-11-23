// Effects tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading effects.jsx");
    }

    function listInstalledEffects(params) {
        var list = [];
        var filter = (params && params.filter) ? String(params.filter).toLowerCase() : null;
        if (!app.effects) return list;

        for (var i = 0; i < app.effects.length; i++) {
            var fx = app.effects[i];
            var dName = fx.displayName || "";
            var mName = fx.matchName || "";
            var cat = fx.category || "";

            if (filter) {
                if (dName.toLowerCase().indexOf(filter) === -1 &&
                    mName.toLowerCase().indexOf(filter) === -1 &&
                    cat.toLowerCase().indexOf(filter) === -1) {
                    continue;
                }
            }

            list.push({
                displayName: dName,
                matchName: mName,
                category: cat
            });
        }
        return list;
    }

    function findEffectInLayer(layer, effectRef) {
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade || fxParade.numProperties === 0) {
            throw new Error("Layer '" + layer.name + "' has no effects applied.");
        }
        if (typeof effectRef === "number" || (!isNaN(Number(effectRef)) && typeof effectRef !== "string")) {
            var idx = Number(effectRef);
            if (idx >= 1 && idx <= fxParade.numProperties) {
                return fxParade.property(idx);
            }
            throw new Error("Effect index " + idx + " out of range (1-" + fxParade.numProperties + ") on layer '" + layer.name + "'.");
        }
        var refStr = String(effectRef);
        var direct = null;
        try {
            direct = fxParade.property(refStr);
        } catch (e) {
            direct = null;
        }
        if (direct) return direct;

        for (var i = 1; i <= fxParade.numProperties; i++) {
            var fx = fxParade.property(i);
            if (fx && (fx.name === refStr || fx.matchName === refStr ||
                fx.name.toLowerCase() === refStr.toLowerCase() ||
                fx.matchName.toLowerCase() === refStr.toLowerCase())) {
                return fx;
            }
        }
        throw new Error("Effect '" + refStr + "' not found on layer '" + layer.name + "'.");
    }

    function addEffect(params) {
        return withUndo("Add Effect", function () {
            if (!params || !params.effect) {
                throw new Error("Effect name or matchName is required.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var fxParade = layer.property("ADBE Effect Parade");
            if (!fxParade) {
                throw new Error("Layer '" + layer.name + "' does not support effects.");
            }

            var effectIdentifier = String(params.effect);
            var fx = null;
            try {
                fx = fxParade.addProperty(effectIdentifier);
            } catch (e) {
                throw new Error("Failed to add effect '" + effectIdentifier + "': " + (e.message || e.toString()));
            }

            if (!fx) {
                throw new Error("Failed to add effect '" + effectIdentifier + "'.");
            }

            if (params.properties && typeof params.properties === "object") {
                for (var pName in params.properties) {
                    if (params.properties.hasOwnProperty(pName)) {
                        var pVal = params.properties[pName];
                        var targetProp = null;
                        try {
                            targetProp = fx.property(pName);
                        } catch (e) {
                            targetProp = null;
                        }
                        if (!targetProp) {
                            for (var p = 1; p <= fx.numProperties; p++) {
                                var childProp = fx.property(p);
                                if (childProp && (childProp.name === pName || childProp.matchName === pName ||
                                    childProp.name.toLowerCase() === pName.toLowerCase() ||
                                    childProp.matchName.toLowerCase() === pName.toLowerCase())) {
                                    targetProp = childProp;
                                    break;
                                }
                            }
                        }
                        if (targetProp && targetProp.propertyType === PropertyType.PROPERTY) {
                            if (typeof pVal === "string" && pVal.charAt(0) === "#") {
                                pVal = toColor(pVal);
                            } else if (targetProp.propertyValueType === PropertyValueType.COLOR && !(typeof pVal === "number")) {
                                pVal = toColor(pVal);
                            }
                            targetProp.setValue(pVal);
                        }
                    }
                }
            }

            var propNames = [];
            if (fx.numProperties !== undefined) {
                for (var k = 1; k <= fx.numProperties; k++) {
                    var child = fx.property(k);
                    if (child) {
                        propNames.push(child.name);
                    }
                }
            }

            return {
                index: fx.propertyIndex,
                name: fx.name,
                matchName: fx.matchName,
                properties: propNames
            };
        });
    }

    function setEffectProperty(params) {
        return withUndo("Set Effect Property", function () {
            if (!params || !params.effect) {
                throw new Error("Effect name or index is required for setEffectProperty.");
            }
            if (!params.property) {
                throw new Error("Property name is required for setEffectProperty.");
            }
            if (params.value === undefined) {
                throw new Error("Value is required for setEffectProperty.");
            }

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var fx = findEffectInLayer(layer, params.effect);

            var propName = String(params.property);
            var targetProp = null;
            try {
                targetProp = fx.property(propName);
            } catch (e) {
                targetProp = null;
            }
            if (!targetProp) {
                for (var i = 1; i <= fx.numProperties; i++) {
                    var p = fx.property(i);
                    if (p && (p.name === propName || p.matchName === propName ||
                        p.name.toLowerCase() === propName.toLowerCase() ||
                        p.matchName.toLowerCase() === propName.toLowerCase())) {
                        targetProp = p;
                        break;
                    }
                }
            }
            if (!targetProp) {
                var avail = [];
                for (var a = 1; a <= fx.numProperties; a++) {
                    var ch = fx.property(a);
                    if (ch) avail.push("'" + ch.name + "'");
                }
                throw new Error("Property '" + propName + "' not found on effect '" + fx.name + "'. Available properties: [" + avail.join(", ") + "]");
            }

            var val = params.value;
            if (typeof val === "string" && val.charAt(0) === "#") {
                val = toColor(val);
            } else if (targetProp.propertyValueType === PropertyValueType.COLOR && !(typeof val === "number")) {
                val = toColor(val);
            }

            targetProp.setValue(val);

            var outVal = targetProp.value;
            if (outVal instanceof Array) {
                var clean = [];
                for (var c = 0; c < outVal.length; c++) {
                    clean.push(typeof outVal[c] === "number" ? Math.round(outVal[c] * 1000) / 1000 : outVal[c]);
                }
                outVal = clean;
            }

            return {
                effectName: fx.name,
                propertyName: targetProp.name,
                value: outVal
            };
        });
    }

    function listLayerEffects(params) {
        var comp = findComp(params ? params.compRef : null);
        var layer = findLayer(comp, params ? params.layerRef : null);
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade) return [];

        var effects = [];
        for (var i = 1; i <= fxParade.numProperties; i++) {
            var fx = fxParade.property(i);
            if (fx) {
                var props = [];
                for (var p = 1; p <= fx.numProperties; p++) {
                    var prop = fx.property(p);
                    if (prop) {
                        var isP = (prop.propertyType === PropertyType.PROPERTY);
                        var val = null;
                        if (isP) {
                            try {
                                val = prop.value;
                                if (val instanceof Array) {
                                    var clean = [];
                                    for (var c = 0; c < val.length; c++) {
                                        clean.push(typeof val[c] === "number" ? Math.round(val[c] * 1000) / 1000 : val[c]);
                                    }
                                    val = clean;
                                }
                            } catch (e) {}
                        }
                        props.push({
                            name: prop.name,
                            matchName: prop.matchName,
                            type: isP ? "property" : "group",
                            value: val
                        });
                    }
                }
                effects.push({
                    index: fx.propertyIndex,
                    name: fx.name,
                    matchName: fx.matchName,
                    enabled: !!fx.enabled,
                    properties: props
                });
            }
        }
        return effects;
    }

    function removeEffect(params) {
        return withUndo("Remove Effect", function () {
            if (!params || !params.effect) {
                throw new Error("Effect name or index is required for removeEffect.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var fx = findEffectInLayer(layer, params.effect);
            var fxName = fx.name;
            fx.remove();

            return {
                removed: true,
                name: fxName
            };
        });
    }

    // Register handlers on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_list_installed_effects = listInstalledEffects;
    h.listInstalledEffects = listInstalledEffects;
    h.ae_add_effect = addEffect;
    h.addEffect = addEffect;
    h.ae_set_effect_property = setEffectProperty;
    h.setEffectProperty = setEffectProperty;
    h.ae_list_layer_effects = listLayerEffects;
    h.listLayerEffects = listLayerEffects;
    h.ae_remove_effect = removeEffect;
    h.removeEffect = removeEffect;
})();
