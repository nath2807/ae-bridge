// Finishing Pass Compositing Stack Engine for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading finishing.jsx");
    }

    var FINISH_PREFIX = "FINISH — ";

    function safeAddEffect(layer, effectMatchName, effectDisplayName) {
        if (!layer || !layer.property("Effects")) return null;
        try {
            var fx = layer.property("Effects").addProperty(effectMatchName);
            if (fx && effectDisplayName) fx.name = effectDisplayName;
            return fx;
        } catch (e1) {
            if (effectDisplayName) {
                try {
                    return layer.property("Effects").addProperty(effectDisplayName);
                } catch (e2) {
                    return null;
                }
            }
            return null;
        }
    }

    function removeExistingFinishPass(comp) {
        var removedCount = 0;
        for (var i = comp.numLayers; i >= 1; i--) {
            var lyr = comp.layer(i);
            if (lyr && lyr.name && (lyr.name.indexOf(FINISH_PREFIX) === 0 || lyr.name === "FINISH" || lyr.name.indexOf("FINISH") === 0)) {
                try {
                    lyr.remove();
                    removedCount++;
                } catch (e) {}
            }
        }
        return removedCount;
    }

    // 1. ae_finish_pass
    function finishPassHandler(params) {
        return withUndo("Apply Finishing Pass", function () {
            if (!params) params = {};
            var comp = findComp(params.compRef);
            var level = params.level ? String(params.level).toLowerCase() : "rich";
            var style = params.style || {};

            // Remove any existing finish pass first to keep comp clean
            removeExistingFinishPass(comp);

            var w = comp.width;
            var h = comp.height;
            var dur = comp.duration;

            // Tuning parameters based on level
            var glowThreshold = 75;
            var glowRadius = 40;
            var glowIntensity = 0.35;
            var grainAmount = 2.0;
            var vignetteOpacity = 25;
            var hazeOpacity = 12;
            var enableHalation = false;
            var enableAnamorphic = false;

            if (level === "subtle") {
                glowThreshold = 82;
                glowRadius = 25;
                glowIntensity = 0.2;
                grainAmount = 1.2;
                vignetteOpacity = 18;
                hazeOpacity = 8;
            } else if (level === "extreme") {
                glowThreshold = 55;
                glowRadius = 90;
                glowIntensity = 0.75;
                grainAmount = 5.5;
                vignetteOpacity = 50;
                hazeOpacity = 25;
                enableHalation = true;
                enableAnamorphic = true;
            } else {
                // "rich" (default)
                glowThreshold = 68;
                glowRadius = 50;
                glowIntensity = 0.45;
                grainAmount = 3.2;
                vignetteOpacity = 32;
                hazeOpacity = 16;
                enableHalation = true;
            }

            // Style look overrides
            var styleName = style.name ? String(style.name).toLowerCase() : "";
            if (styleName === "cinematicnoir" || styleName === "epictrailer") {
                enableHalation = true;
                enableAnamorphic = true;
                vignetteOpacity = Math.min(60, vignetteOpacity + 12);
            } else if (styleName === "neoncyber") {
                enableAnamorphic = true;
                glowIntensity += 0.2;
            }

            var createdLayers = [];

            // A. Null Group Controller
            var controller = comp.layers.addNull();
            controller.name = FINISH_PREFIX + "Controller";
            try { controller.label = 5; } catch (el) {} // Fuchsia/Magenta label
            controller.moveToBeginning();
            createdLayers.push(controller.name);

            // B. Background Texture Layer (placed near bottom, above background solid)
            var bgTex = comp.layers.addSolid([0.05, 0.05, 0.06], FINISH_PREFIX + "Background Atmosphere Texture", w, h, 1, dur);
            try {
                bgTex.blendingMode = BlendingMode.SOFT_LIGHT;
                bgTex.transform.opacity.setValue(18);
                var bgNoise = safeAddEffect(bgTex, "ADBE Noise", "Atmosphere Noise");
                if (bgNoise && bgNoise.property("Amount")) {
                    bgNoise.property("Amount").setValue(12);
                }
                // Move near bottom (above layer comp.numLayers)
                bgTex.moveToEnd();
                createdLayers.push(bgTex.name);
            } catch (ebt) {}

            // C. Foreground Atmosphere Dust Particles (placed near top)
            var dustLayer = comp.layers.addSolid([0.0, 0.0, 0.0], FINISH_PREFIX + "Foreground Atmosphere Dust", w, h, 1, dur);
            try {
                dustLayer.blendingMode = BlendingMode.SCREEN;
                dustLayer.transform.opacity.setValue(level === "subtle" ? 20 : 35);
                var dustNoise = safeAddEffect(dustLayer, "ADBE Fractal Noise", "Dust Texture");
                if (dustNoise) {
                    try {
                        dustNoise.property("Fractal Type").setValue(2); // Soft Turbulence
                        dustNoise.property("Contrast").setValue(350);
                        dustNoise.property("Brightness").setValue(-85);
                        dustNoise.property("Transform").property("Scale").setValue(60);
                        dustNoise.property("Evolution").expression = "time * 45;";
                    } catch (efn) {}
                }
                createdLayers.push(dustLayer.name);
            } catch (edust) {}

            // D. Adjustment Layer: Depth Haze
            var hazeLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Depth Haze", w, h, 1, dur);
            hazeLayer.adjustmentLayer = true;
            try {
                hazeLayer.blendingMode = BlendingMode.SCREEN;
                hazeLayer.transform.opacity.setValue(hazeOpacity);
                var rampFx = safeAddEffect(hazeLayer, "ADBE Ramp", "Depth Fog Gradient");
                if (rampFx) {
                    try {
                        var bgHex = (style.palette && style.palette.bg) ? style.palette.bg : [0.03, 0.04, 0.06];
                        rampFx.property("Start of Ramp").setValue([w / 2, h]);
                        rampFx.property("Start Color").setValue(toColor(bgHex));
                        rampFx.property("End of Ramp").setValue([w / 2, 0]);
                        rampFx.property("End Color").setValue([0, 0, 0]);
                    } catch (eramp) {}
                }
                createdLayers.push(hazeLayer.name);
            } catch (ehaze) {}

            // E. Adjustment Layer: Light Wrap & Optical Atmosphere
            var wrapLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Light Wrap", w, h, 1, dur);
            wrapLayer.adjustmentLayer = true;
            try {
                wrapLayer.blendingMode = BlendingMode.SOFT_LIGHT;
                wrapLayer.transform.opacity.setValue(22);
                var blurWrap = safeAddEffect(wrapLayer, "ADBE Fast Blur", "Atmospheric Blur");
                if (blurWrap && blurWrap.property("Blurriness")) {
                    blurWrap.property("Blurriness").setValue(20);
                }
                createdLayers.push(wrapLayer.name);
            } catch (ewrap) {}

            // F. Adjustment Layer: Bloom & Glow
            var bloomLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Bloom & Glow", w, h, 1, dur);
            bloomLayer.adjustmentLayer = true;
            try {
                var glowFx = safeAddEffect(bloomLayer, "ADBE Glo2", "Specular Bloom");
                if (glowFx) {
                    try {
                        if (glowFx.property("Glow Threshold")) glowFx.property("Glow Threshold").setValue(glowThreshold);
                        if (glowFx.property("Glow Radius")) glowFx.property("Glow Radius").setValue(glowRadius);
                        if (glowFx.property("Glow Intensity")) glowFx.property("Glow Intensity").setValue(glowIntensity);
                        if (style.palette && style.palette.glow) {
                            try {
                                glowFx.property("Glow Colors").setValue(2); // A & B colors
                                glowFx.property("Color A").setValue(toColor(style.palette.glow));
                            } catch (egc) {}
                        }
                    } catch (eglow) {}
                }
                createdLayers.push(bloomLayer.name);
            } catch (ebloom) {}

            // G. Optional Anamorphic Streak Flare (horizontal blur on highlights)
            if (enableAnamorphic) {
                var streakLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Anamorphic Streak", w, h, 1, dur);
                streakLayer.adjustmentLayer = true;
                try {
                    streakLayer.blendingMode = BlendingMode.SCREEN;
                    streakLayer.transform.opacity.setValue(level === "extreme" ? 45 : 25);
                    var streakBlur = safeAddEffect(streakLayer, "ADBE Directional Blur", "Horizontal Streak");
                    if (streakBlur) {
                        try {
                            streakBlur.property("Direction").setValue(90); // Horizontal
                            streakBlur.property("Blur Length").setValue(level === "extreme" ? 85 : 55);
                        } catch (esb) {}
                    }
                    createdLayers.push(streakLayer.name);
                } catch (eastreak) {}
            }

            // H. Optional Halation (warm photographic red glow around extreme highlights)
            if (enableHalation) {
                var halationLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Halation", w, h, 1, dur);
                halationLayer.adjustmentLayer = true;
                try {
                    halationLayer.blendingMode = BlendingMode.SCREEN;
                    halationLayer.transform.opacity.setValue(level === "extreme" ? 38 : 22);
                    var tintFx = safeAddEffect(halationLayer, "ADBE Tint", "Halation Warmth");
                    if (tintFx) {
                        try {
                            tintFx.property("Map Black To").setValue([0, 0, 0]);
                            tintFx.property("Map White To").setValue([0.95, 0.25, 0.1]); // Warm orange-red photochemical bleed
                        } catch (etint) {}
                    }
                    var halBlur = safeAddEffect(halationLayer, "ADBE Gaussian Blur 2", "Halation Softness");
                    if (halBlur && halBlur.property("Blurriness")) {
                        halBlur.property("Blurriness").setValue(15);
                    }
                    createdLayers.push(halationLayer.name);
                } catch (ehal) {}
            }

            // I. Adjustment Layer: Chromatic Aberration (RGB fringe at edges)
            var caLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Chromatic Aberration", w, h, 1, dur);
            caLayer.adjustmentLayer = true;
            try {
                var opticsFx = safeAddEffect(caLayer, "ADBE Optics Compensation", "Radial Dispersion");
                if (opticsFx) {
                    try {
                        var fovVal = level === "extreme" ? 8 : (level === "subtle" ? 2 : 4);
                        if (opticsFx.property("Field of View")) opticsFx.property("Field of View").setValue(fovVal);
                        if (opticsFx.property("Reverse Lens Distortion")) opticsFx.property("Reverse Lens Distortion").setValue(true);
                    } catch (eopt) {}
                }
                createdLayers.push(caLayer.name);
            } catch (eca) {}

            // J. Adjustment Layer: Film Grain (resolution matched)
            var grainLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Film Grain", w, h, 1, dur);
            grainLayer.adjustmentLayer = true;
            try {
                var noiseFx = safeAddEffect(grainLayer, "ADBE Noise", "Photographic Grain");
                if (noiseFx && noiseFx.property("Amount")) {
                    noiseFx.property("Amount").setValue(grainAmount);
                    if (noiseFx.property("Use Color Noise")) noiseFx.property("Use Color Noise").setValue(false);
                }
                createdLayers.push(grainLayer.name);
            } catch (egrain) {}

            // K. Adjustment Layer: Vignette
            var vigLayer = comp.layers.addSolid([0, 0, 0], FINISH_PREFIX + "Vignette", w, h, 1, dur);
            try {
                vigLayer.transform.opacity.setValue(vignetteOpacity);
                var mask = vigLayer.masks.addProperty("Mask");
                mask.maskMode = MaskMode.SUBTRACT;
                var myShape = mask.property("maskShape").value;
                myShape.ellipse = true;
                myShape.inTangents = [];
                myShape.outTangents = [];
                myShape.vertices = [[0, 0], [w, 0], [w, h], [0, h]];
                mask.property("maskShape").setValue(myShape);
                mask.property("maskFeather").setValue([w * 0.35, h * 0.35]);
                createdLayers.push(vigLayer.name);
            } catch (evig) {}

            // L. Adjustment Layer: Color Grade (Lift shadows toward bg, tint highlights toward glow)
            var gradeLayer = comp.layers.addSolid([1, 1, 1], FINISH_PREFIX + "Color Grade", w, h, 1, dur);
            gradeLayer.adjustmentLayer = true;
            try {
                var gradeTint = safeAddEffect(gradeLayer, "ADBE Tint", "Atmosphere Tone");
                if (gradeTint) {
                    var shadowCol = (style.palette && style.palette.bg) ? toColor(style.palette.bg) : [0.03, 0.04, 0.05];
                    var highCol = (style.palette && style.palette.glow) ? toColor(style.palette.glow) : [0.98, 0.98, 1.0];
                    try {
                        gradeTint.property("Map Black To").setValue(shadowCol);
                        gradeTint.property("Map White To").setValue(highCol);
                        gradeTint.property("Amount to Tint").setValue(level === "extreme" ? 28 : (level === "subtle" ? 12 : 20));
                    } catch (egt) {}
                }
                createdLayers.push(gradeLayer.name);
            } catch (egrade) {}

            // Parent all created adjustment layers to Controller null
            for (var k = 1; k <= comp.numLayers; k++) {
                var curL = comp.layer(k);
                if (curL && curL !== controller && curL.name && curL.name.indexOf(FINISH_PREFIX) === 0) {
                    try {
                        curL.parent = controller;
                        curL.label = 5; // Match Fuchsia label
                    } catch (ep) {}
                }
            }

            return {
                finished: true,
                compName: comp.name,
                level: level,
                style: styleName || "default",
                totalLayersAdded: createdLayers.length,
                layers: createdLayers
            };
        });
    }

    // 2. ae_remove_finish_pass
    function removeFinishPassHandler(params) {
        return withUndo("Remove Finishing Pass", function () {
            var comp = findComp(params.compRef);
            var removed = removeExistingFinishPass(comp);
            return {
                removed: true,
                compName: comp.name,
                count: removed
            };
        });
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_finish_pass = finishPassHandler;
    h.finishPass = finishPassHandler;
    h.ae_remove_finish_pass = removeFinishPassHandler;
    h.removeFinishPass = removeFinishPassHandler;
})();
