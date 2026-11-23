// Visual Looks, Film Emulations, and Stylistic Effect Stacks for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading looks.jsx");
    }

    var LOOKS_CATALOG = [
        {
            look: "filmGrain",
            description: "Authentic 35mm celluloid film grain with subtle organic color noise and analog warmth",
            recommendedUse: "Cinematic footage, vintage color grading, analog realism",
            effectsUsed: ["Noise", "Curves / Color Balance"]
        },
        {
            look: "vignette",
            description: "Cinematic optical peripheral darkening drawing the viewer's gaze toward center frame",
            recommendedUse: "Portraits, dramatic sequences, title cards, focal emphasis",
            effectsUsed: ["CC Vignette / Mask Curves"]
        },
        {
            look: "chromaticAberration",
            description: "Prismatic RGB channel separation and edge color fringing simulating vintage glass optics",
            recommendedUse: "Sci-fi interfaces, cinematic lens imperfections, impacts, glitch accents",
            effectsUsed: ["Channel Blur / Shift Channels"]
        },
        {
            look: "vhs",
            description: "Retro 1980s magnetic VHS tape look with color bleed, tracking jitter, scanlines, and noise",
            recommendedUse: "Retro synthwave, found-footage horror, 80s/90s nostalgia",
            effectsUsed: ["Channel Blur", "Wave Warp", "Noise", "Color Balance"]
        },
        {
            look: "glitch",
            description: "High-energy digital transmission error with slice displacement, scan artifacts, and color jumps",
            recommendedUse: "Cyberpunk titles, transitions, tech breakdowns, dynamic logos",
            effectsUsed: ["Wave Warp (Square)", "Channel Blur", "Noise"]
        },
        {
            look: "neonGlow",
            description: "Vibrant multi-stage luminous bloom with tight high-intensity core and wide atmospheric falloff",
            recommendedUse: "Neon typography, synthwave grids, laser effects, magical runes",
            effectsUsed: ["Glow (Dual Stack) / Deep Glow"]
        },
        {
            look: "dreamy",
            description: "Ethereal romantic diffusion blending soft Gaussian blur, warm highlight glow, and pastel tones",
            recommendedUse: "Flashbacks, dream sequences, weddings, music videos",
            effectsUsed: ["Fast Blur", "Glow", "Color Balance"]
        },
        {
            look: "lightLeak",
            description: "Organic camera body light ingress with warm amber and crimson flares undulating over time",
            recommendedUse: "Film headers, summer montages, romantic intros, transition accents",
            effectsUsed: ["Fractal Noise", "Tritone / Tint", "Fast Blur"]
        },
        {
            look: "filmBurn",
            description: "Overexposed celluloid leader burn with searing highlights, rapid flares, and fiery edges",
            recommendedUse: "Aggressive scene transitions, action trailers, film reel start/ends",
            effectsUsed: ["Fractal Noise", "Tint", "Glow"]
        },
        {
            look: "halftone",
            description: "Retro printmaker comic book dot screen pattern breaking continuous tones into stylized dots",
            recommendedUse: "Pop art, comic book aesthetics, graphic design reels, retro branding",
            effectsUsed: ["CC Ball Action / Mosaic + Posterize"]
        },
        {
            look: "posterizeTime",
            description: "Stop-motion / anime stepped cadence reducing temporal frame rate without changing duration",
            recommendedUse: "Stop-motion look, Spider-Verse style animation, anime aesthetic",
            effectsUsed: ["Posterize Time"]
        },
        {
            look: "scanlines",
            description: "Authentic cathode-ray tube (CRT) television horizontal raster lines with phosphorescent glow",
            recommendedUse: "Arcade UI, security monitors, retro cyberpunk screens, broadcast graphics",
            effectsUsed: ["Venetian Blinds", "Noise", "Glow"]
        },
        {
            look: "bloom",
            description: "Modern cinematic anamorphic highlight bloom with smooth luminous diffusion",
            recommendedUse: "Sci-fi lighting, luxury commercials, 3D render enhancement",
            effectsUsed: ["Glow", "Gaussian Blur"]
        },
        {
            look: "cinemaBars",
            description: "Standard theatrical 2.39:1 widescreen letterbox framing bars top and bottom",
            recommendedUse: "Cinematic widescreen delivery, film trailers, theatrical presentations",
            effectsUsed: ["Letterbox Solid Plates"]
        }
    ];

    function safeAddEffect(layer, matchName, fallbackName) {
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade) return null;
        var fx = null;
        if (matchName) {
            try {
                fx = fxParade.addProperty(matchName);
            } catch (e1) {
                fx = null;
            }
        }
        if (!fx && fallbackName) {
            try {
                fx = fxParade.addProperty(fallbackName);
            } catch (e2) {
                fx = null;
            }
        }
        return fx;
    }

    function safeSet(prop, val) {
        if (!prop) return;
        try {
            prop.setValue(val);
        } catch (e) {}
    }

    function isEffectInstalled(nameOrMatch) {
        if (!app.effects) return false;
        var q = String(nameOrMatch).toLowerCase();
        for (var i = 0; i < app.effects.length; i++) {
            var fx = app.effects[i];
            if ((fx.displayName && fx.displayName.toLowerCase().indexOf(q) !== -1) ||
                (fx.matchName && fx.matchName.toLowerCase().indexOf(q) !== -1)) {
                return true;
            }
        }
        return false;
    }

    function applyLook(params) {
        return withUndo("Apply Look", function () {
            if (!params || !params.look) {
                throw new Error("look parameter is required for applyLook.");
            }

            var comp = findComp(params.compRef);
            var look = String(params.look).toLowerCase();
            var intensity = (params.intensity !== undefined && !isNaN(Number(params.intensity))) ? Number(params.intensity) : 1.0;
            intensity = Math.max(0.05, Math.min(10.0, intensity));

            // Target layer: if not specified, create an adjustment layer on top
            var layer = null;
            var isNewAdjustment = false;

            if (params.layerRef) {
                layer = findLayer(comp, params.layerRef);
            } else {
                layer = comp.layers.addSolid([1, 1, 1], "Look — " + params.look, comp.width, comp.height, 1, comp.duration);
                layer.adjustmentLayer = true;
                layer.moveToBeginning();
                isNewAdjustment = true;
            }

            var appliedEffects = [];

            // 1. Film Grain
            if (look === "filmgrain") {
                var grain = safeAddEffect(layer, "ADBE Noise", "Noise");
                if (grain) {
                    safeSet(grain.property("ADBE Noise-0001") || grain.property("Amount of Noise"), Math.round(8 * intensity));
                    safeSet(grain.property("ADBE Noise-0002") || grain.property("Use Color Noise"), 0);
                    appliedEffects.push(grain.name);
                }
            }

            // 2. Vignette
            else if (look === "vignette") {
                var vig = safeAddEffect(layer, "CC Vignette", "CC Vignette");
                if (vig) {
                    safeSet(vig.property(1) || vig.property("Amount"), Math.round(110 * intensity));
                    safeSet(vig.property(2) || vig.property("Radius"), 60);
                    appliedEffects.push(vig.name);
                } else {
                    // Fallback to Curves or Brightness & Contrast
                    var bc = safeAddEffect(layer, "ADBE Brightness & Contrast 2", "Brightness & Contrast");
                    if (bc) {
                        safeSet(bc.property("ADBE Brightness & Contrast 2-0001") || bc.property("Brightness"), -25 * intensity);
                        safeSet(bc.property("ADBE Brightness & Contrast 2-0002") || bc.property("Contrast"), 20 * intensity);
                        appliedEffects.push(bc.name);
                    }
                }
            }

            // 3. Chromatic Aberration
            else if (look === "chromaticaberration") {
                var cb = safeAddEffect(layer, "ADBE Channel Blur", "Channel Blur");
                if (cb) {
                    safeSet(cb.property("ADBE Channel Blur-0001") || cb.property("Red Blurriness"), Math.round(14 * intensity));
                    safeSet(cb.property("ADBE Channel Blur-0002") || cb.property("Red Blur Dimensions"), 1); // Horizontal
                    safeSet(cb.property("ADBE Channel Blur-0005") || cb.property("Blue Blurriness"), Math.round(10 * intensity));
                    safeSet(cb.property("ADBE Channel Blur-0006") || cb.property("Blue Blur Dimensions"), 2); // Vertical
                    safeSet(cb.property("ADBE Channel Blur-0008") || cb.property("Edge Behavior"), 1); // Repeat edge pixels
                    appliedEffects.push(cb.name);
                }
            }

            // 4. VHS
            else if (look === "vhs") {
                // Color bleed
                var vhsCb = safeAddEffect(layer, "ADBE Channel Blur", "Channel Blur");
                if (vhsCb) {
                    safeSet(vhsCb.property("ADBE Channel Blur-0001") || vhsCb.property("Red Blurriness"), Math.round(10 * intensity));
                    safeSet(vhsCb.property("ADBE Channel Blur-0002") || vhsCb.property("Red Blur Dimensions"), 1);
                    safeSet(vhsCb.property("ADBE Channel Blur-0008") || vhsCb.property("Edge Behavior"), 1);
                    appliedEffects.push(vhsCb.name);
                }
                // Tape scanlines jitter
                var wave = safeAddEffect(layer, "ADBE Wave Warp", "Wave Warp");
                if (wave) {
                    safeSet(wave.property("ADBE Wave Warp-0001") || wave.property("Wave Type"), 2); // Square
                    safeSet(wave.property("ADBE Wave Warp-0002") || wave.property("Wave Height"), Math.max(1, Math.round(2 * intensity)));
                    safeSet(wave.property("ADBE Wave Warp-0003") || wave.property("Wave Width"), 600);
                    safeSet(wave.property("ADBE Wave Warp-0004") || wave.property("Direction"), 0);
                    safeSet(wave.property("ADBE Wave Warp-0005") || wave.property("Wave Speed"), 0.5);
                    appliedEffects.push(wave.name);
                }
                // Noise
                var vhsNoise = safeAddEffect(layer, "ADBE Noise", "Noise");
                if (vhsNoise) {
                    safeSet(vhsNoise.property("ADBE Noise-0001") || vhsNoise.property("Amount of Noise"), Math.round(7 * intensity));
                    safeSet(vhsNoise.property("ADBE Noise-0002") || vhsNoise.property("Use Color Noise"), 1);
                    appliedEffects.push(vhsNoise.name);
                }
            }

            // 5. Glitch
            else if (look === "glitch") {
                var gWave = safeAddEffect(layer, "ADBE Wave Warp", "Wave Warp");
                if (gWave) {
                    safeSet(gWave.property("ADBE Wave Warp-0001") || gWave.property("Wave Type"), 2); // Square
                    safeSet(gWave.property("ADBE Wave Warp-0003") || gWave.property("Wave Width"), 45);
                    safeSet(gWave.property("ADBE Wave Warp-0004") || gWave.property("Direction"), 0);
                    safeSet(gWave.property("ADBE Wave Warp-0005") || gWave.property("Wave Speed"), 4.0);
                    var hProp = gWave.property("ADBE Wave Warp-0002") || gWave.property("Wave Height");
                    if (hProp) {
                        try {
                            hProp.expression = 'posterizeTime(10); var hit = random() > 0.65; hit ? (1 + random(2.5)) * ' + (18 * intensity) + ' : 0;';
                        } catch (eExp) {}
                    }
                    appliedEffects.push(gWave.name);
                }
                var gChan = safeAddEffect(layer, "ADBE Channel Blur", "Channel Blur");
                if (gChan) {
                    var rProp = gChan.property("ADBE Channel Blur-0001") || gChan.property("Red Blurriness");
                    if (rProp) {
                        try {
                            rProp.expression = 'posterizeTime(8); var spike = random() > 0.6; spike ? random(20 * ' + intensity + ') : 0;';
                        } catch (eR) {}
                    }
                    safeSet(gChan.property("ADBE Channel Blur-0008") || gChan.property("Edge Behavior"), 1);
                    appliedEffects.push(gChan.name);
                }
            }

            // 6. Neon Glow
            else if (look === "neonglow") {
                if (isEffectInstalled("Deep Glow")) {
                    var dg = safeAddEffect(layer, "Deep Glow", "Deep Glow");
                    if (dg) {
                        appliedEffects.push(dg.name);
                    }
                } else {
                    // Double glow stack: tight core + wide falloff
                    var g1 = safeAddEffect(layer, "ADBE Glo2", "Glow");
                    if (g1) {
                        safeSet(g1.property("ADBE Glo2-0001") || g1.property("Glow Threshold"), 35);
                        safeSet(g1.property("ADBE Glo2-0002") || g1.property("Glow Radius"), Math.round(18 * intensity));
                        safeSet(g1.property("ADBE Glo2-0003") || g1.property("Glow Intensity"), 1.2 * intensity);
                        appliedEffects.push(g1.name + " (Core)");
                    }
                    var g2 = safeAddEffect(layer, "ADBE Glo2", "Glow");
                    if (g2) {
                        safeSet(g2.property("ADBE Glo2-0001") || g2.property("Glow Threshold"), 20);
                        safeSet(g2.property("ADBE Glo2-0002") || g2.property("Glow Radius"), Math.round(140 * intensity));
                        safeSet(g2.property("ADBE Glo2-0003") || g2.property("Glow Intensity"), 0.75 * intensity);
                        appliedEffects.push(g2.name + " (Wide)");
                    }
                }
            }

            // 7. Dreamy
            else if (look === "dreamy") {
                var dBlur = safeAddEffect(layer, "ADBE Gaussian Blur 2", "Gaussian Blur");
                if (dBlur) {
                    safeSet(dBlur.property("ADBE Gaussian Blur 2-0001") || dBlur.property("Blurriness"), Math.round(12 * intensity));
                    safeSet(dBlur.property("ADBE Gaussian Blur 2-0003") || dBlur.property("Repeat Edge Pixels"), 1);
                    appliedEffects.push(dBlur.name);
                }
                var dGlow = safeAddEffect(layer, "ADBE Glo2", "Glow");
                if (dGlow) {
                    safeSet(dGlow.property("ADBE Glo2-0001") || dGlow.property("Glow Threshold"), 45);
                    safeSet(dGlow.property("ADBE Glo2-0002") || dGlow.property("Glow Radius"), Math.round(80 * intensity));
                    safeSet(dGlow.property("ADBE Glo2-0003") || dGlow.property("Glow Intensity"), 0.9 * intensity);
                    appliedEffects.push(dGlow.name);
                }
            }

            // 8. Light Leak
            else if (look === "lightleak") {
                layer.blendingMode = BlendingMode.SCREEN;
                var fn = safeAddEffect(layer, "ADBE Fractal Noise", "Fractal Noise");
                if (fn) {
                    safeSet(fn.property("ADBE Fractal Noise-0001") || fn.property("Fractal Type"), 2); // Dynamic
                    safeSet(fn.property("ADBE Fractal Noise-0002") || fn.property("Noise Type"), 1); // Soft Linear
                    safeSet(fn.property("ADBE Fractal Noise-0006") || fn.property("Contrast"), 135);
                    safeSet(fn.property("ADBE Fractal Noise-0007") || fn.property("Brightness"), -15);
                    var evo = fn.property("ADBE Fractal Noise-0010") || fn.property("Evolution");
                    if (evo) {
                        try { evo.expression = 'time * 45 * ' + intensity + ';'; } catch (eEv) {}
                    }
                    appliedEffects.push(fn.name);
                }
                var tint = safeAddEffect(layer, "ADBE Tritone", "Tritone");
                if (tint) {
                    safeSet(tint.property(1) || tint.property("Highlights"), [1.0, 0.72, 0.28]); // Gold
                    safeSet(tint.property(2) || tint.property("Midtones"), [0.92, 0.22, 0.38]); // Crimson
                    safeSet(tint.property(3) || tint.property("Shadows"), [0.05, 0.02, 0.1]);
                    appliedEffects.push(tint.name);
                }
                var lBlur = safeAddEffect(layer, "ADBE Gaussian Blur 2", "Gaussian Blur");
                if (lBlur) {
                    safeSet(lBlur.property("ADBE Gaussian Blur 2-0001") || lBlur.property("Blurriness"), Math.round(40 * intensity));
                    appliedEffects.push(lBlur.name);
                }
            }

            // 9. Film Burn
            else if (look === "filmburn") {
                layer.blendingMode = BlendingMode.SCREEN;
                var bFn = safeAddEffect(layer, "ADBE Fractal Noise", "Fractal Noise");
                if (bFn) {
                    safeSet(bFn.property("ADBE Fractal Noise-0006") || bFn.property("Contrast"), 230);
                    safeSet(bFn.property("ADBE Fractal Noise-0007") || bFn.property("Brightness"), 25);
                    var bEvo = bFn.property("ADBE Fractal Noise-0010") || bFn.property("Evolution");
                    if (bEvo) {
                        try { bEvo.expression = 'time * 110 * ' + intensity + ';'; } catch (eB) {}
                    }
                    appliedEffects.push(bFn.name);
                }
                var bTint = safeAddEffect(layer, "ADBE Tritone", "Tritone");
                if (bTint) {
                    safeSet(bTint.property(1) || bTint.property("Highlights"), [1.0, 0.95, 0.7]);
                    safeSet(bTint.property(2) || bTint.property("Midtones"), [1.0, 0.35, 0.1]);
                    safeSet(bTint.property(3) || bTint.property("Shadows"), [0.3, 0.05, 0.02]);
                    appliedEffects.push(bTint.name);
                }
                var bGlow = safeAddEffect(layer, "ADBE Glo2", "Glow");
                if (bGlow) {
                    safeSet(bGlow.property("ADBE Glo2-0002") || bGlow.property("Glow Radius"), Math.round(160 * intensity));
                    safeSet(bGlow.property("ADBE Glo2-0003") || bGlow.property("Glow Intensity"), 1.4 * intensity);
                    appliedEffects.push(bGlow.name);
                }
            }

            // 10. Halftone
            else if (look === "halftone") {
                var ball = safeAddEffect(layer, "CC Ball Action", "CC Ball Action");
                if (ball) {
                    safeSet(ball.property(2) || ball.property("Grid Spacing"), Math.round(5 * intensity));
                    safeSet(ball.property(3) || ball.property("Ball Size"), Math.round(45 / intensity));
                    appliedEffects.push(ball.name);
                } else {
                    var mos = safeAddEffect(layer, "ADBE Mosaic", "Mosaic");
                    if (mos) {
                        safeSet(mos.property(1) || mos.property("Horizontal Blocks"), Math.round(60 / intensity));
                        safeSet(mos.property(2) || mos.property("Vertical Blocks"), Math.round(40 / intensity));
                        appliedEffects.push(mos.name);
                    }
                    var post = safeAddEffect(layer, "ADBE Posterize", "Posterize");
                    if (post) {
                        safeSet(post.property(1) || post.property("Levels"), 5);
                        appliedEffects.push(post.name);
                    }
                }
            }

            // 11. Posterize Time
            else if (look === "posterizetime") {
                var pTime = safeAddEffect(layer, "ADBE Posterize Time", "Posterize Time");
                if (pTime) {
                    var fps = Math.max(4, Math.round(12 / intensity));
                    safeSet(pTime.property(1) || pTime.property("Frame Rate"), fps);
                    appliedEffects.push(pTime.name + " (" + fps + " fps)");
                }
            }

            // 12. Scanlines
            else if (look === "scanlines") {
                var vb = safeAddEffect(layer, "ADBE Venetian Blinds", "Venetian Blinds");
                if (vb) {
                    safeSet(vb.property("ADBE Venetian Blinds-0001") || vb.property("Transition Completion"), Math.round(22 * intensity));
                    safeSet(vb.property("ADBE Venetian Blinds-0002") || vb.property("Direction"), 90); // Horizontal
                    safeSet(vb.property("ADBE Venetian Blinds-0003") || vb.property("Width"), 3);
                    safeSet(vb.property("ADBE Venetian Blinds-0004") || vb.property("Feather"), 0.5);
                    appliedEffects.push(vb.name);
                }
                var sNoise = safeAddEffect(layer, "ADBE Noise", "Noise");
                if (sNoise) {
                    safeSet(sNoise.property("ADBE Noise-0001") || sNoise.property("Amount of Noise"), Math.round(4 * intensity));
                    appliedEffects.push(sNoise.name);
                }
            }

            // 13. Bloom
            else if (look === "bloom") {
                var blGlow = safeAddEffect(layer, "ADBE Glo2", "Glow");
                if (blGlow) {
                    safeSet(blGlow.property("ADBE Glo2-0001") || blGlow.property("Glow Threshold"), 55);
                    safeSet(blGlow.property("ADBE Glo2-0002") || blGlow.property("Glow Radius"), Math.round(180 * intensity));
                    safeSet(blGlow.property("ADBE Glo2-0003") || blGlow.property("Glow Intensity"), 0.7 * intensity);
                    appliedEffects.push(blGlow.name);
                }
                var blBlur = safeAddEffect(layer, "ADBE Gaussian Blur 2", "Gaussian Blur");
                if (blBlur) {
                    safeSet(blBlur.property("ADBE Gaussian Blur 2-0001") || blBlur.property("Blurriness"), Math.round(5 * intensity));
                    safeSet(blBlur.property("ADBE Gaussian Blur 2-0003") || blBlur.property("Repeat Edge Pixels"), 1);
                    appliedEffects.push(blBlur.name);
                }
            }

            // 14. Cinema Bars (Letterbox 2.39:1)
            else if (look === "cinemabars") {
                var targetHeight = comp.width / 2.39;
                var barHeight = Math.round((comp.height - targetHeight) / 2);
                if (barHeight > 0) {
                    var topBar = comp.layers.addSolid([0, 0, 0], "Cinema Letterbox Top", comp.width, barHeight, 1, comp.duration);
                    topBar.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, barHeight / 2]);
                    topBar.moveToBeginning();

                    var botBar = comp.layers.addSolid([0, 0, 0], "Cinema Letterbox Bottom", comp.width, barHeight, 1, comp.duration);
                    botBar.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height - barHeight / 2]);
                    botBar.moveToBeginning();

                    appliedEffects.push("Letterbox Bars (2.39:1, " + barHeight + "px)");
                }
            }

            else {
                throw new Error("Unknown look: '" + look + "'. Valid looks: 'filmGrain', 'vignette', 'chromaticAberration', 'vhs', 'glitch', 'neonGlow', 'dreamy', 'lightLeak', 'filmBurn', 'halftone', 'posterizeTime', 'scanlines', 'bloom', 'cinemaBars'.");
            }

            return {
                compName: comp.name,
                layerName: layer.name,
                look: look,
                intensity: intensity,
                isNewAdjustmentLayer: isNewAdjustment,
                appliedEffects: appliedEffects
            };
        });
    }

    function listLooks() {
        return LOOKS_CATALOG;
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_apply_look = applyLook;
    h.applyLook = applyLook;
    h.ae_list_looks = listLooks;
    h.listLooks = listLooks;
})();
