// Color grading, LUT application, and adjustment layer styling tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading color.jsx");
    }

    function findOrAddEffect(layer, matchName, displayName) {
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade) {
            throw new Error("Layer '" + layer.name + "' does not support effects.");
        }
        for (var i = 1; i <= fxParade.numProperties; i++) {
            var fx = fxParade.property(i);
            if (fx && (fx.matchName === matchName || fx.name === displayName || fx.name === matchName)) {
                return fx;
            }
        }
        try {
            return fxParade.addProperty(matchName);
        } catch (e1) {
            try {
                return fxParade.addProperty(displayName);
            } catch (e2) {
                return null;
            }
        }
    }

    function setPropertyByNameOrMatch(group, propNames, value) {
        if (!group) return false;
        for (var n = 0; n < propNames.length; n++) {
            var pName = propNames[n];
            try {
                var p = group.property(pName);
                if (p && p.propertyType === PropertyType.PROPERTY) {
                    p.setValue(Number(value));
                    return true;
                }
            } catch (e) {}
        }
        // Scan children recursively
        if (group.numProperties !== undefined) {
            for (var i = 1; i <= group.numProperties; i++) {
                var child = group.property(i);
                if (child) {
                    if (child.propertyType === PropertyType.PROPERTY) {
                        for (var k = 0; k < propNames.length; k++) {
                            if (child.name.toLowerCase() === propNames[k].toLowerCase() || child.matchName === propNames[k]) {
                                child.setValue(Number(value));
                                return true;
                            }
                        }
                    } else {
                        if (setPropertyByNameOrMatch(child, propNames, value)) return true;
                    }
                }
            }
        }
        return false;
    }

    function colorGrade(params) {
        return withUndo("Apply Color Grade", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for colorGrade.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var lumetri = findOrAddEffect(layer, "ADBE Lumetri", "Lumetri Color");
            if (!lumetri) {
                throw new Error("Lumetri Color effect is not available or could not be loaded on layer '" + layer.name + "'. Ensure Adobe Lumetri Color plugin is installed.");
            }

            var applied = {};

            if (params.exposure !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Exposure", "ADBE Lumetri-0005"], params.exposure)) {
                    applied.exposure = Number(params.exposure);
                }
            }
            if (params.contrast !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Contrast", "ADBE Lumetri-0006"], params.contrast)) {
                    applied.contrast = Number(params.contrast);
                }
            }
            if (params.highlights !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Highlights", "ADBE Lumetri-0007"], params.highlights)) {
                    applied.highlights = Number(params.highlights);
                }
            }
            if (params.shadows !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Shadows", "ADBE Lumetri-0008"], params.shadows)) {
                    applied.shadows = Number(params.shadows);
                }
            }
            if (params.saturation !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Saturation", "ADBE Lumetri-0012"], params.saturation)) {
                    applied.saturation = Number(params.saturation);
                }
            }
            if (params.temperature !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Temperature", "ADBE Lumetri-0003"], params.temperature)) {
                    applied.temperature = Number(params.temperature);
                }
            }
            if (params.tint !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Tint", "ADBE Lumetri-0004"], params.tint)) {
                    applied.tint = Number(params.tint);
                }
            }
            if (params.vibrance !== undefined) {
                if (setPropertyByNameOrMatch(lumetri, ["Vibrance", "ADBE Lumetri-0011"], params.vibrance)) {
                    applied.vibrance = Number(params.vibrance);
                }
            }

            return {
                layerName: layer.name,
                effect: lumetri.name,
                appliedParameters: applied
            };
        });
    }

    function applyLut(params) {
        return withUndo("Apply Color LUT", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for applyLut.");
            }
            if (!params.lutPath) {
                throw new Error("lutPath is required for applyLut.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var clean = cleanPath(params.lutPath);
            var lutFile = new File(clean);
            if (!lutFile.exists) {
                throw new Error("LUT file does not exist at path: '" + clean + "'.");
            }

            var lutEffect = findOrAddEffect(layer, "ADBE Apply Color LUT", "Apply Color LUT");
            if (!lutEffect) {
                throw new Error("Apply Color LUT effect is not available on this system.");
            }

            // In After Effects, LUT File property can be set directly or via choose file
            try {
                var fileProp = lutEffect.property("ADBE Apply Color LUT-0001") || lutEffect.property(1);
                if (fileProp) {
                    fileProp.setValue(lutFile.fsName);
                }
            } catch (e) {}

            return {
                layerName: layer.name,
                effectName: lutEffect.name,
                lutPath: lutFile.fsName
            };
        });
    }

    function addAdjustmentGrade(params) {
        return withUndo("Add Adjustment Grade", function () {
            var comp = findComp(params ? params.compRef : null);
            var look = (params && params.look) ? String(params.look).toLowerCase() : "cinematic";

            // Create full-comp adjustment layer on top
            var adj = comp.layers.addSolid([1, 1, 1], "Color Grade — " + look, comp.width, comp.height, 1, comp.duration);
            adj.adjustmentLayer = true;
            adj.moveToBeginning();

            var appliedEffects = [];

            if (look === "cinematic") {
                // Subtle S-curve contrast and film atmosphere
                var lum = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lum) {
                    setPropertyByNameOrMatch(lum, ["Contrast"], 15);
                    setPropertyByNameOrMatch(lum, ["Shadows"], -8);
                    setPropertyByNameOrMatch(lum, ["Highlights"], 6);
                    setPropertyByNameOrMatch(lum, ["Saturation"], 94);
                    appliedEffects.push("Lumetri Color (Film Contrast & Soft Roll-off)");
                } else {
                    var bc = findOrAddEffect(adj, "ADBE Brightness & Contrast 2", "Brightness & Contrast");
                    if (bc) {
                        try { bc.property(2).setValue(18); } catch (e) {}
                        appliedEffects.push("Brightness & Contrast");
                    }
                }
            } else if (look === "tealorange") {
                // Teal/orange split tone grade
                var lumTO = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lumTO) {
                    setPropertyByNameOrMatch(lumTO, ["Temperature"], 12);
                    setPropertyByNameOrMatch(lumTO, ["Contrast"], 20);
                    setPropertyByNameOrMatch(lumTO, ["Shadows"], -15);
                    setPropertyByNameOrMatch(lumTO, ["Highlights"], 15);
                    setPropertyByNameOrMatch(lumTO, ["Saturation"], 115);
                    appliedEffects.push("Lumetri Color (Teal & Orange Split Tone)");
                } else {
                    var hs = findOrAddEffect(adj, "ADBE HUE SATURATION", "Hue/Saturation");
                    if (hs) appliedEffects.push("Hue/Saturation");
                }
            } else if (look === "warm") {
                // Golden hour warmth
                var lumWarm = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lumWarm) {
                    setPropertyByNameOrMatch(lumWarm, ["Temperature"], 32);
                    setPropertyByNameOrMatch(lumWarm, ["Tint"], 5);
                    setPropertyByNameOrMatch(lumWarm, ["Highlights"], 10);
                    appliedEffects.push("Lumetri Color (Golden Hour Warmth)");
                }
            } else if (look === "cool") {
                // Nordic cool blue
                var lumCool = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lumCool) {
                    setPropertyByNameOrMatch(lumCool, ["Temperature"], -30);
                    setPropertyByNameOrMatch(lumCool, ["Contrast"], 12);
                    setPropertyByNameOrMatch(lumCool, ["Saturation"], 90);
                    appliedEffects.push("Lumetri Color (Clean Cool Blue)");
                }
            } else if (look === "bw") {
                // High-contrast monochrome black & white
                var lumBW = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lumBW) {
                    setPropertyByNameOrMatch(lumBW, ["Saturation"], 0);
                    setPropertyByNameOrMatch(lumBW, ["Contrast"], 35);
                    setPropertyByNameOrMatch(lumBW, ["Shadows"], -12);
                    appliedEffects.push("Lumetri Color (Monochrome Noir)");
                } else {
                    var tint = findOrAddEffect(adj, "ADBE Tint", "Tint");
                    if (tint) appliedEffects.push("Tint (Monochrome)");
                }
            } else if (look === "vintage") {
                // Lifted blacks, faded vintage warmth
                var lumVint = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lumVint) {
                    setPropertyByNameOrMatch(lumVint, ["Shadows"], 20);
                    setPropertyByNameOrMatch(lumVint, ["Contrast"], -10);
                    setPropertyByNameOrMatch(lumVint, ["Temperature"], 18);
                    setPropertyByNameOrMatch(lumVint, ["Saturation"], 82);
                    appliedEffects.push("Lumetri Color (Faded Film Vintage)");
                }
            } else if (look === "highcontrast") {
                // Punchy punch commercial high contrast
                var lumHC = findOrAddEffect(adj, "ADBE Lumetri", "Lumetri Color");
                if (lumHC) {
                    setPropertyByNameOrMatch(lumHC, ["Contrast"], 42);
                    setPropertyByNameOrMatch(lumHC, ["Highlights"], 20);
                    setPropertyByNameOrMatch(lumHC, ["Shadows"], -25);
                    setPropertyByNameOrMatch(lumHC, ["Saturation"], 112);
                    appliedEffects.push("Lumetri Color (Commercial High Contrast)");
                }
            }

            return {
                compName: comp.name,
                layerIndex: adj.index,
                adjustmentLayerName: adj.name,
                lookPreset: look,
                appliedEffects: appliedEffects
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_color_grade = colorGrade;
    h.colorGrade = colorGrade;
    h.ae_apply_lut = applyLut;
    h.applyLut = applyLut;
    h.ae_add_adjustment_grade = addAdjustmentGrade;
    h.addAdjustmentGrade = addAdjustmentGrade;
})();
