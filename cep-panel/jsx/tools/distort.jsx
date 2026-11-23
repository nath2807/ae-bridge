// Distortion, Optical Light FX, and Audio Visualizer Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading distort.jsx");
    }

    function safeAddEffect(layer, matchName, fallbackName) {
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade) return null;
        var fx = null;
        if (matchName) {
            try { fx = fxParade.addProperty(matchName); } catch (e1) { fx = null; }
        }
        if (!fx && fallbackName) {
            try { fx = fxParade.addProperty(fallbackName); } catch (e2) { fx = null; }
        }
        return fx;
    }

    function safeSet(prop, val) {
        if (!prop) return;
        try { prop.setValue(val); } catch (e) {}
    }

    function isEffectInstalled(query) {
        if (!app.effects) return false;
        var q = String(query).toLowerCase();
        for (var i = 0; i < app.effects.length; i++) {
            var fx = app.effects[i];
            if ((fx.displayName && fx.displayName.toLowerCase().indexOf(q) !== -1) ||
                (fx.matchName && fx.matchName.toLowerCase().indexOf(q) !== -1)) {
                return true;
            }
        }
        return false;
    }

    // 1. ae_apply_distortion
    function applyDistortion(params) {
        return withUndo("Apply Distortion", function () {
            if (!params || !params.type) {
                throw new Error("type parameter is required for applyDistortion.");
            }
            if (!params.layerRef) {
                throw new Error("layerRef parameter is required for applyDistortion.");
            }

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var type = String(params.type).toLowerCase();
            var amount = (params.amount !== undefined && !isNaN(Number(params.amount))) ? Number(params.amount) : 1.0;
            amount = Math.max(0.05, Math.min(20.0, amount));
            var animate = params.animate !== undefined ? !!params.animate : true;

            var applied = [];

            // 1. Wave Warp
            if (type === "wavewarp") {
                var wave = safeAddEffect(layer, "ADBE Wave Warp", "Wave Warp");
                if (wave) {
                    safeSet(wave.property("ADBE Wave Warp-0001") || wave.property("Wave Type"), 1); // Sine
                    safeSet(wave.property("ADBE Wave Warp-0002") || wave.property("Wave Height"), Math.round(14 * amount));
                    safeSet(wave.property("ADBE Wave Warp-0003") || wave.property("Wave Width"), 85);
                    safeSet(wave.property("ADBE Wave Warp-0005") || wave.property("Wave Speed"), animate ? 1.5 : 0);
                    applied.push(wave.name);
                }
            }

            // 2. Turbulent Displace
            else if (type === "turbulent") {
                var turb = safeAddEffect(layer, "ADBE Turbulent Displace", "Turbulent Displace");
                if (turb) {
                    safeSet(turb.property("ADBE Turbulent Displace-0002") || turb.property("Amount"), Math.round(50 * amount));
                    safeSet(turb.property("ADBE Turbulent Displace-0003") || turb.property("Size"), 80);
                    if (animate) {
                        var evo = turb.property("ADBE Turbulent Displace-0006") || turb.property("Evolution");
                        if (evo) {
                            try { evo.expression = 'time * 90;'; } catch (eTurb) {}
                        }
                    }
                    applied.push(turb.name);
                }
            }

            // 3. Ripple
            else if (type === "ripple") {
                var rip = safeAddEffect(layer, "ADBE Ripple", "Ripple");
                if (rip) {
                    safeSet(rip.property(1) || rip.property("Radius"), 300);
                    safeSet(rip.property(2) || rip.property("Wave Width"), 45);
                    safeSet(rip.property(3) || rip.property("Wave Height"), Math.round(20 * amount));
                    safeSet(rip.property(4) || rip.property("Wave Speed"), animate ? 2.5 : 0);
                    applied.push(rip.name);
                }
            }

            // 4. Bulge
            else if (type === "bulge") {
                var bul = safeAddEffect(layer, "ADBE Bulge", "Bulge");
                if (bul) {
                    safeSet(bul.property(1) || bul.property("Horizontal Radius"), 220);
                    safeSet(bul.property(2) || bul.property("Vertical Radius"), 220);
                    safeSet(bul.property(3) || bul.property("Bulge Height"), 1.0 * amount);
                    applied.push(bul.name);
                }
            }

            // 5. Twirl
            else if (type === "twirl") {
                var tw = safeAddEffect(layer, "ADBE Twirl", "Twirl");
                if (tw) {
                    safeSet(tw.property(1) || tw.property("Twirl Angle"), Math.round(75 * amount));
                    safeSet(tw.property(2) || tw.property("Twirl Radius"), 250);
                    applied.push(tw.name);
                }
            }

            // 6. Heat Haze
            else if (type === "heathaze") {
                var hhTurb = safeAddEffect(layer, "ADBE Turbulent Displace", "Turbulent Displace");
                if (hhTurb) {
                    safeSet(hhTurb.property("ADBE Turbulent Displace-0001") || hhTurb.property("Displacement"), 2); // Turbulent Smoother
                    safeSet(hhTurb.property("ADBE Turbulent Displace-0002") || hhTurb.property("Amount"), Math.round(16 * amount));
                    safeSet(hhTurb.property("ADBE Turbulent Displace-0003") || hhTurb.property("Size"), 28);
                    if (animate) {
                        var hhEvo = hhTurb.property("ADBE Turbulent Displace-0006") || hhTurb.property("Evolution");
                        if (hhEvo) {
                            try { hhEvo.expression = 'time * 180;'; } catch (eHh) {}
                        }
                    }
                    applied.push(hhTurb.name);
                }
                var hhBlur = safeAddEffect(layer, "ADBE Gaussian Blur 2", "Gaussian Blur");
                if (hhBlur) {
                    safeSet(hhBlur.property("ADBE Gaussian Blur 2-0001") || hhBlur.property("Blurriness"), Math.round(2 * amount));
                    safeSet(hhBlur.property("ADBE Gaussian Blur 2-0003") || hhBlur.property("Repeat Edge Pixels"), 1);
                    applied.push(hhBlur.name);
                }
            }

            // 7. Liquify-Style Displace (Procedural Noise Guide + Displacement Map)
            else if (type === "liquify-style displace" || type === "liquify" || type === "displacementmap") {
                // Generate hidden procedural noise guide solid
                var guideName = "Displacement Guide — " + layer.name;
                var guideSolid = comp.layers.addSolid([0.5, 0.5, 0.5], guideName, comp.width, comp.height, 1, comp.duration);
                guideSolid.enabled = false; // Hide from viewer and final output
                guideSolid.moveToEnd();

                var gFn = safeAddEffect(guideSolid, "ADBE Fractal Noise", "Fractal Noise");
                if (gFn) {
                    safeSet(gFn.property("ADBE Fractal Noise-0006") || gFn.property("Contrast"), 150);
                    safeSet(gFn.property("ADBE Fractal Noise-0007") || gFn.property("Brightness"), 0);
                    if (animate) {
                        var gEvo = gFn.property("ADBE Fractal Noise-0010") || gFn.property("Evolution");
                        if (gEvo) {
                            try { gEvo.expression = 'time * 50;'; } catch (eG) {}
                        }
                    }
                }

                // Add displacement map on target layer referencing the guide
                var disp = safeAddEffect(layer, "ADBE Displacement Map", "Displacement Map");
                if (disp) {
                    safeSet(disp.property(1) || disp.property("Displacement Map Layer"), guideSolid.index);
                    safeSet(disp.property(2) || disp.property("Use For Horizontal Displacement"), 1); // Red
                    safeSet(disp.property(3) || disp.property("Max Horizontal Displacement"), Math.round(30 * amount));
                    safeSet(disp.property(4) || disp.property("Use For Vertical Displacement"), 2); // Green
                    safeSet(disp.property(5) || disp.property("Max Vertical Displacement"), Math.round(30 * amount));
                    applied.push(disp.name + " (referencing " + guideName + ")");
                }
            }

            // 8. Shatter
            else if (type === "shatter") {
                var sh = safeAddEffect(layer, "ADBE Shatter", "Shatter");
                if (sh) {
                    applied.push(sh.name);
                } else {
                    throw new Error("Built-in Shatter effect ('ADBE Shatter') is not available in this installation of After Effects.");
                }
            }

            // 9. Pixelate (Mosaic)
            else if (type === "pixelate" || type === "mosaic") {
                var mos = safeAddEffect(layer, "ADBE Mosaic", "Mosaic");
                if (mos) {
                    var hBlocks = Math.max(4, Math.round(60 / amount));
                    var vBlocks = Math.max(4, Math.round(36 / amount));
                    safeSet(mos.property(1) || mos.property("Horizontal Blocks"), hBlocks);
                    safeSet(mos.property(2) || mos.property("Vertical Blocks"), vBlocks);
                    applied.push(mos.name + " (" + hBlocks + "x" + vBlocks + ")");
                }
            }

            else {
                throw new Error("Unknown distortion type: '" + type + "'. Valid types: 'waveWarp', 'turbulent', 'ripple', 'bulge', 'twirl', 'heatHaze', 'liquify-style displace', 'shatter', 'pixelate'.");
            }

            return {
                compName: comp.name,
                layerName: layer.name,
                type: type,
                amount: amount,
                animated: animate,
                appliedEffects: applied
            };
        });
    }

    // 2. ae_add_light_effect
    function addLightEffect(params) {
        return withUndo("Add Light Effect", function () {
            if (!params || !params.type) {
                throw new Error("type parameter is required for addLightEffect ('lightRays', 'lensFlare', 'lightSweep', 'godRays', 'shine').");
            }

            var comp = findComp(params.compRef);
            var type = String(params.type).toLowerCase();
            var pos = params.position ? [Number(params.position[0]), Number(params.position[1])] : [comp.width / 2, comp.height / 2];
            var customColor = params.color ? toColor(params.color) : null;

            // Target layer or new adjustment layer on top
            var layer = null;
            if (params.layerRef) {
                layer = findLayer(comp, params.layerRef);
            } else {
                layer = comp.layers.addSolid([0, 0, 0], "Light FX — " + params.type, comp.width, comp.height, 1, comp.duration);
                layer.blendingMode = BlendingMode.SCREEN;
                layer.moveToBeginning();
            }

            var applied = [];

            // 1. Light Rays
            if (type === "lightrays") {
                var rays = safeAddEffect(layer, "CC Light Rays", "CC Light Rays");
                if (rays) {
                    safeSet(rays.property(1) || rays.property("Intensity"), 125);
                    safeSet(rays.property(2) || rays.property("Radius"), 75);
                    safeSet(rays.property(4) || rays.property("Center"), pos);
                    if (customColor) safeSet(rays.property(5) || rays.property("Color"), customColor);
                    applied.push(rays.name);
                }
            }

            // 2. Lens Flare
            else if (type === "lensflare") {
                var flare = safeAddEffect(layer, "ADBE Lens Flare", "Lens Flare");
                if (flare) {
                    safeSet(flare.property(1) || flare.property("Flare Center"), pos);
                    safeSet(flare.property(2) || flare.property("Flare Brightness"), 115);
                    safeSet(flare.property(3) || flare.property("Lens Type"), 1); // 50-300mm Zoom
                    applied.push(flare.name);
                }
            }

            // 3. Light Sweep
            else if (type === "lightsweep") {
                var sweep = safeAddEffect(layer, "CC Light Sweep", "CC Light Sweep");
                if (sweep) {
                    safeSet(sweep.property(1) || sweep.property("Center"), pos);
                    safeSet(sweep.property(2) || sweep.property("Edge Intensity"), 80);
                    safeSet(sweep.property(4) || sweep.property("Width"), 45);
                    safeSet(sweep.property(5) || sweep.property("Angle"), -40);
                    safeSet(sweep.property(6) || sweep.property("Intensity"), 110);
                    if (customColor) safeSet(sweep.property(7) || sweep.property("Light Color"), customColor);
                    applied.push(sweep.name);
                }
            }

            // 4. God Rays
            else if (type === "godrays") {
                var rBlur = safeAddEffect(layer, "ADBE Radial Blur", "Radial Blur");
                if (rBlur) {
                    safeSet(rBlur.property(1) || rBlur.property("Amount"), 65);
                    safeSet(rBlur.property(2) || rBlur.property("Type"), 2); // Zoom
                    safeSet(rBlur.property(4) || rBlur.property("Center"), pos);
                    applied.push(rBlur.name);
                }
                var glow = safeAddEffect(layer, "ADBE Glo2", "Glow");
                if (glow) {
                    safeSet(glow.property("ADBE Glo2-0002") || glow.property("Glow Radius"), 120);
                    safeSet(glow.property("ADBE Glo2-0003") || glow.property("Glow Intensity"), 1.2);
                    applied.push(glow.name);
                }
            }

            // 5. Shine
            else if (type === "shine") {
                if (isEffectInstalled("Shine") || isEffectInstalled("Trapcode Shine")) {
                    var s = safeAddEffect(layer, "Trapcode Shine", "Shine");
                    if (s) applied.push(s.name);
                } else {
                    // High-quality fallback using CC Radial Fast Blur + tint
                    var fastBlur = safeAddEffect(layer, "CC Radial Fast Blur", "CC Radial Fast Blur");
                    if (fastBlur) {
                        safeSet(fastBlur.property(1) || fastBlur.property("Center"), pos);
                        safeSet(fastBlur.property(2) || fastBlur.property("Amount"), 75);
                        applied.push(fastBlur.name);
                    }
                    if (customColor) {
                        var tint = safeAddEffect(layer, "ADBE Tint", "Tint");
                        if (tint) {
                            safeSet(tint.property(2) || tint.property("Map White To"), customColor);
                            applied.push(tint.name);
                        }
                    }
                }
            }

            else {
                throw new Error("Unknown light effect type: '" + type + "'. Valid types: 'lightRays', 'lensFlare', 'lightSweep', 'godRays', 'shine'.");
            }

            return {
                compName: comp.name,
                layerName: layer.name,
                type: type,
                position: pos,
                appliedEffects: applied
            };
        });
    }

    // 3. ae_add_audio_visualizer
    function addAudioVisualizer(params) {
        return withUndo("Add Audio Visualizer", function () {
            if (!params || !params.audioLayer) {
                throw new Error("audioLayer parameter is required for addAudioVisualizer.");
            }

            var comp = findComp(params.compRef);
            var aLayer = findLayer(comp, params.audioLayer);
            var type = (params.type ? String(params.type).toLowerCase() : "spectrum");
            var customColor = params.color ? toColor(params.color) : [0.0, 0.95, 1.0]; // default neon cyan
            var pos = params.position ? [Number(params.position[0]), Number(params.position[1])] : [comp.width / 2, comp.height / 2];

            // Create solid layer for the visualizer
            var vSolid = comp.layers.addSolid([0, 0, 0], "Audio Visualizer — " + type, comp.width, comp.height, 1, comp.duration);
            vSolid.blendingMode = BlendingMode.SCREEN;

            var applied = [];

            // 1. Audio Spectrum
            if (type === "spectrum") {
                var spec = safeAddEffect(vSolid, "ADBE Audio Spectrum", "Audio Spectrum");
                if (spec) {
                    safeSet(spec.property(1) || spec.property("Audio Layer"), aLayer.index);
                    safeSet(spec.property(2) || spec.property("Start Point"), [comp.width * 0.12, pos[1]]);
                    safeSet(spec.property(3) || spec.property("End Point"), [comp.width * 0.88, pos[1]]);
                    safeSet(spec.property(6) || spec.property("Frequency Bands"), 64);
                    safeSet(spec.property(7) || spec.property("Maximum Height"), 280);
                    safeSet(spec.property(9) || spec.property("Thickness"), 3.5);
                    safeSet(spec.property(13) || spec.property("Inside Color"), customColor);
                    safeSet(spec.property(14) || spec.property("Outside Color"), [0.85, 0.15, 0.95]); // Magenta outer
                    applied.push(spec.name);
                }
            }

            // 2. Audio Waveform
            else if (type === "waveform") {
                var wave = safeAddEffect(vSolid, "ADBE Audio Waveform", "Audio Waveform");
                if (wave) {
                    safeSet(wave.property(1) || wave.property("Audio Layer"), aLayer.index);
                    safeSet(wave.property(2) || wave.property("Start Point"), [comp.width * 0.08, pos[1]]);
                    safeSet(wave.property(3) || wave.property("End Point"), [comp.width * 0.92, pos[1]]);
                    safeSet(wave.property(6) || wave.property("Samples"), 450);
                    safeSet(wave.property(7) || wave.property("Maximum Height"), 200);
                    safeSet(wave.property(9) || wave.property("Waveform Options"), 1); // Analog lines
                    safeSet(wave.property(11) || wave.property("Inside Color"), customColor);
                    safeSet(wave.property(12) || wave.property("Outside Color"), [0.95, 0.9, 0.2]); // Gold accent
                    applied.push(wave.name);
                }
            }

            // 3. Circular Spectrum (Audio Spectrum + Polar Coordinates)
            else if (type === "circularspectrum" || type === "circular") {
                var cSpec = safeAddEffect(vSolid, "ADBE Audio Spectrum", "Audio Spectrum");
                if (cSpec) {
                    safeSet(cSpec.property(1) || cSpec.property("Audio Layer"), aLayer.index);
                    safeSet(cSpec.property(2) || cSpec.property("Start Point"), [0, comp.height * 0.5]);
                    safeSet(cSpec.property(3) || cSpec.property("End Point"), [comp.width, comp.height * 0.5]);
                    safeSet(cSpec.property(6) || cSpec.property("Frequency Bands"), 90);
                    safeSet(cSpec.property(7) || cSpec.property("Maximum Height"), 220);
                    safeSet(cSpec.property(9) || cSpec.property("Thickness"), 3.0);
                    safeSet(cSpec.property(13) || cSpec.property("Inside Color"), customColor);
                    safeSet(cSpec.property(14) || cSpec.property("Outside Color"), [0.85, 0.2, 0.95]);
                    applied.push(cSpec.name);
                }

                var polar = safeAddEffect(vSolid, "ADBE Polar Coordinates", "Polar Coordinates");
                if (polar) {
                    safeSet(polar.property(1) || polar.property("Interpolation"), 100);
                    safeSet(polar.property(2) || polar.property("Type of Conversion"), 1); // Rect to Polar
                    applied.push(polar.name + " (Rect to Polar)");
                }
            }

            else {
                throw new Error("Unknown audio visualizer type: '" + type + "'. Valid types: 'spectrum', 'waveform', 'circularSpectrum'.");
            }

            return {
                compName: comp.name,
                layerName: vSolid.name,
                audioLayer: aLayer.name,
                type: type,
                appliedEffects: applied
            };
        });
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_apply_distortion = applyDistortion;
    h.applyDistortion = applyDistortion;
    h.ae_add_light_effect = addLightEffect;
    h.addLightEffect = addLightEffect;
    h.ae_add_audio_visualizer = addAudioVisualizer;
    h.addAudioVisualizer = addAudioVisualizer;
})();
