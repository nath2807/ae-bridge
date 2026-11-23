// Procedural Motion Graphic Backgrounds for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading backgrounds.jsx");
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

    function createBackground(params) {
        return withUndo("Create Background", function () {
            if (!params || !params.type) {
                throw new Error("type parameter is required for createBackground.");
            }

            var comp = findComp(params.compRef);
            var type = String(params.type).toLowerCase();
            var animated = params.animated !== undefined ? !!params.animated : true;
            var duration = (params.duration !== undefined && !isNaN(Number(params.duration))) ? Number(params.duration) : comp.duration;
            var colors = params.colors || {};

            var colPrimary = colors.primary ? toColor(colors.primary) : null;
            var colSecondary = colors.secondary ? toColor(colors.secondary) : null;
            var colAccent = colors.accent ? toColor(colors.accent) : null;
            var colBg = colors.background ? toColor(colors.background) : null;

            var w = comp.width;
            var h = comp.height;
            var baseColor = colBg || [0.03, 0.035, 0.05];

            // Create solid layer and place at bottom
            var bgLayer = comp.layers.addSolid(baseColor, "BG — " + params.type, w, h, 1, Math.max(1, duration));
            bgLayer.moveToEnd();

            var applied = [];

            // 1. 4-Color Gradient
            if (type === "gradient") {
                var grad = safeAddEffect(bgLayer, "ADBE 4ColorGradient", "4-Color Gradient");
                if (grad) {
                    var p1 = findProperty(grad, "Point 1") || grad.property(1);
                    var c1 = findProperty(grad, "Color 1") || grad.property(2);
                    var p2 = findProperty(grad, "Point 2") || grad.property(3);
                    var c2 = findProperty(grad, "Color 2") || grad.property(4);
                    var p3 = findProperty(grad, "Point 3") || grad.property(5);
                    var c3 = findProperty(grad, "Color 3") || grad.property(6);
                    var p4 = findProperty(grad, "Point 4") || grad.property(7);
                    var c4 = findProperty(grad, "Color 4") || grad.property(8);

                    safeSet(p1, [w * 0.15, h * 0.15]);
                    safeSet(c1, colPrimary || [0.08, 0.18, 0.48]);

                    safeSet(p2, [w * 0.85, h * 0.2]);
                    safeSet(c2, colSecondary || [0.55, 0.15, 0.65]);

                    safeSet(p3, [w * 0.2, h * 0.85]);
                    safeSet(c3, colAccent || [0.1, 0.75, 0.8]);

                    safeSet(p4, [w * 0.85, h * 0.85]);
                    safeSet(c4, colBg || [0.03, 0.04, 0.12]);

                    if (animated) {
                        try { if (p1) p1.expression = 'value + [Math.sin(time * 0.45) * 90, Math.cos(time * 0.35) * 70];'; } catch (eExp1) {}
                        try { if (p2) p2.expression = 'value + [Math.cos(time * 0.4) * 85, Math.sin(time * 0.5) * 95];'; } catch (eExp2) {}
                        try { if (p3) p3.expression = 'value + [Math.sin(time * 0.38 + 1) * 75, Math.cos(time * 0.42 + 1) * 80];'; } catch (eExp3) {}
                        try { if (p4) p4.expression = 'value + [Math.cos(time * 0.32 + 2) * 80, Math.sin(time * 0.36 + 2) * 70];'; } catch (eExp4) {}
                    }
                    applied.push(grad.name);
                }
            }

            // 2. Radial Glow
            else if (type === "radialglow") {
                var ramp = safeAddEffect(bgLayer, "ADBE Ramp", "Gradient Ramp");
                if (ramp) {
                    var sPoint = ramp.property(1) || ramp.property("Start of Ramp");
                    var sColor = ramp.property(2) || ramp.property("Start Color");
                    var ePoint = ramp.property(3) || ramp.property("End of Ramp");
                    var eColor = ramp.property(4) || ramp.property("End Color");
                    var rShape = ramp.property(5) || ramp.property("Ramp Shape");

                    safeSet(sPoint, [w / 2, h / 2]);
                    safeSet(sColor, colPrimary || [0.22, 0.45, 0.95]);
                    safeSet(ePoint, [w / 2, h * 0.95]);
                    safeSet(eColor, colBg || [0.02, 0.025, 0.04]);
                    safeSet(rShape, 2); // Radial Ramp

                    if (animated && sPoint) {
                        try { sPoint.expression = 'value + [Math.sin(time * 0.5) * 25, Math.cos(time * 0.4) * 25];'; } catch (eRamp) {}
                    }
                    applied.push(ramp.name);
                }
            }

            // 3. Fractal Clouds
            else if (type === "fractalclouds") {
                var fn = safeAddEffect(bgLayer, "ADBE Fractal Noise", "Fractal Noise");
                if (fn) {
                    safeSet(fn.property("ADBE Fractal Noise-0001") || fn.property("Fractal Type"), 1); // Soft Linear
                    safeSet(fn.property("ADBE Fractal Noise-0002") || fn.property("Noise Type"), 1); // Spline
                    safeSet(fn.property("ADBE Fractal Noise-0006") || fn.property("Contrast"), 110);
                    safeSet(fn.property("ADBE Fractal Noise-0007") || fn.property("Brightness"), -10);
                    safeSet(fn.property("ADBE Fractal Noise-0009") || fn.property("Complexity"), 5);
                    if (animated) {
                        var evo = fn.property("ADBE Fractal Noise-0010") || fn.property("Evolution");
                        if (evo) {
                            try { evo.expression = 'time * 28;'; } catch (eEvo) {}
                        }
                    }
                    applied.push(fn.name);
                }

                var tri = safeAddEffect(bgLayer, "ADBE Tritone", "Tritone");
                if (tri) {
                    safeSet(tri.property(1) || tri.property("Highlights"), colPrimary || [0.85, 0.92, 1.0]);
                    safeSet(tri.property(2) || tri.property("Midtones"), colSecondary || [0.25, 0.4, 0.65]);
                    safeSet(tri.property(3) || tri.property("Shadows"), colBg || [0.03, 0.05, 0.1]);
                    applied.push(tri.name);
                }
            }

            // 4. Liquid
            else if (type === "liquid") {
                var lFn = safeAddEffect(bgLayer, "ADBE Fractal Noise", "Fractal Noise");
                if (lFn) {
                    safeSet(lFn.property("ADBE Fractal Noise-0006") || lFn.property("Contrast"), 140);
                    safeSet(lFn.property("ADBE Fractal Noise-0007") || lFn.property("Brightness"), -5);
                    safeSet(lFn.property("ADBE Fractal Noise-0009") || lFn.property("Complexity"), 3);
                    if (animated) {
                        var lEvo = lFn.property("ADBE Fractal Noise-0010") || lFn.property("Evolution");
                        if (lEvo) {
                            try { lEvo.expression = 'time * 40;'; } catch (eL1) {}
                        }
                    }
                    applied.push(lFn.name);
                }

                var turb = safeAddEffect(bgLayer, "ADBE Turbulent Displace", "Turbulent Displace");
                if (turb) {
                    safeSet(turb.property("ADBE Turbulent Displace-0002") || turb.property("Amount"), 75);
                    safeSet(turb.property("ADBE Turbulent Displace-0003") || turb.property("Size"), 90);
                    if (animated) {
                        var tEvo = turb.property("ADBE Turbulent Displace-0006") || turb.property("Evolution");
                        if (tEvo) {
                            try { tEvo.expression = 'time * 65;'; } catch (eL2) {}
                        }
                    }
                    applied.push(turb.name);
                }

                var lTri = safeAddEffect(bgLayer, "ADBE Tritone", "Tritone");
                if (lTri) {
                    safeSet(lTri.property(1) || lTri.property("Highlights"), colAccent || [0.1, 0.95, 0.85]);
                    safeSet(lTri.property(2) || lTri.property("Midtones"), colPrimary || [0.35, 0.15, 0.85]);
                    safeSet(lTri.property(3) || lTri.property("Shadows"), colBg || [0.02, 0.03, 0.08]);
                    applied.push(lTri.name);
                }
            }

            // 5. Grid
            else if (type === "grid") {
                var grid = safeAddEffect(bgLayer, "ADBE Grid", "Grid");
                if (grid) {
                    safeSet(grid.property(1) || grid.property("Size From"), 2); // Width Slider
                    safeSet(grid.property(3) || grid.property("Width"), 80);
                    safeSet(grid.property(5) || grid.property("Border"), 1.5);
                    safeSet(grid.property(6) || grid.property("Invert Grid"), 0);
                    safeSet(grid.property(7) || grid.property("Color"), colPrimary || [0.15, 0.55, 0.95]);

                    if (animated) {
                        var anc = grid.property(2) || grid.property("Anchor");
                        if (anc) {
                            try { anc.expression = 'value + [time * 25, time * 25];'; } catch (eGrid) {}
                        }
                    }
                    applied.push(grid.name);
                }
            }

            // 6. Stripes
            else if (type === "stripes") {
                // Secondary solid beneath to create 2-color stripe pattern
                var subSolid = comp.layers.addSolid(colSecondary || [0.08, 0.1, 0.15], "Stripes Secondary", w, h, 1, Math.max(1, duration));
                subSolid.moveToEnd();

                var blinds = safeAddEffect(bgLayer, "ADBE Venetian Blinds", "Venetian Blinds");
                if (blinds) {
                    safeSet(blinds.property("ADBE Venetian Blinds-0001") || blinds.property("Transition Completion"), 50);
                    safeSet(blinds.property("ADBE Venetian Blinds-0002") || blinds.property("Direction"), 45);
                    safeSet(blinds.property("ADBE Venetian Blinds-0003") || blinds.property("Width"), 60);
                    safeSet(blinds.property("ADBE Venetian Blinds-0004") || blinds.property("Feather"), 0);
                    applied.push(blinds.name);
                }
            }

            // 7. Noise Texture
            else if (type === "noisetexture") {
                var nFn = safeAddEffect(bgLayer, "ADBE Fractal Noise", "Fractal Noise");
                if (nFn) {
                    safeSet(nFn.property("ADBE Fractal Noise-0001") || nFn.property("Fractal Type"), 4); // Dynamic Progressive
                    safeSet(nFn.property("ADBE Fractal Noise-0006") || nFn.property("Contrast"), 95);
                    safeSet(nFn.property("ADBE Fractal Noise-0007") || nFn.property("Brightness"), -15);
                    var nScale = nFn.property("ADBE Fractal Noise-0008") || nFn.property("Transform");
                    if (nScale) {
                        var sc = nScale.property("ADBE Fractal Noise-0012") || nScale.property("Scale");
                        if (sc) safeSet(sc, 35);
                    }
                    if (animated) {
                        var nEvo = nFn.property("ADBE Fractal Noise-0010") || nFn.property("Evolution");
                        if (nEvo) {
                            try { nEvo.expression = 'time * 120;'; } catch (eNoise) {}
                        }
                    }
                    applied.push(nFn.name);
                }
            }

            // 8. Aurora
            else if (type === "aurora") {
                var aGrad = safeAddEffect(bgLayer, "ADBE 4ColorGradient", "4-Color Gradient");
                if (aGrad) {
                    safeSet(aGrad.property(1) || aGrad.property("Point 1"), [w * 0.2, h * 0.3]);
                    safeSet(aGrad.property(2) || aGrad.property("Color 1"), colPrimary || [0.0, 0.95, 0.65]); // Aurora green

                    safeSet(aGrad.property(3) || aGrad.property("Point 2"), [w * 0.8, h * 0.25]);
                    safeSet(aGrad.property(4) || aGrad.property("Color 2"), colSecondary || [0.1, 0.65, 0.95]); // Cyan

                    safeSet(aGrad.property(5) || aGrad.property("Point 3"), [w * 0.3, h * 0.75]);
                    safeSet(aGrad.property(6) || aGrad.property("Color 3"), colAccent || [0.75, 0.1, 0.85]); // Magenta

                    safeSet(aGrad.property(7) || aGrad.property("Point 4"), [w * 0.7, h * 0.8]);
                    safeSet(aGrad.property(8) || aGrad.property("Color 4"), colBg || [0.02, 0.04, 0.12]);

                    applied.push(aGrad.name);
                }

                var aTurb = safeAddEffect(bgLayer, "ADBE Turbulent Displace", "Turbulent Displace");
                if (aTurb) {
                    safeSet(aTurb.property("ADBE Turbulent Displace-0002") || aTurb.property("Amount"), 130);
                    safeSet(aTurb.property("ADBE Turbulent Displace-0003") || aTurb.property("Size"), 160);
                    if (animated) {
                        var aEvo = aTurb.property("ADBE Turbulent Displace-0006") || aTurb.property("Evolution");
                        if (aEvo) {
                            try { aEvo.expression = 'time * 45;'; } catch (eAur) {}
                        }
                    }
                    applied.push(aTurb.name);
                }

                var aBlur = safeAddEffect(bgLayer, "ADBE Gaussian Blur 2", "Gaussian Blur");
                if (aBlur) {
                    safeSet(aBlur.property("ADBE Gaussian Blur 2-0001") || aBlur.property("Blurriness"), 45);
                    safeSet(aBlur.property("ADBE Gaussian Blur 2-0003") || aBlur.property("Repeat Edge Pixels"), 1);
                    applied.push(aBlur.name);
                }
            }

            else {
                throw new Error("Unknown background type: '" + type + "'. Valid types: 'gradient', 'radialGlow', 'fractalClouds', 'liquid', 'grid', 'stripes', 'noiseTexture', 'aurora'.");
            }

            return {
                compName: comp.name,
                layerName: bgLayer.name,
                type: type,
                animated: animated,
                duration: duration,
                appliedEffects: applied
            };
        });
    }

    function findProperty(group, name) {
        if (!group) return null;
        try {
            var direct = group.property(name);
            if (direct) return direct;
        } catch (e) {}
        if (group.numProperties !== undefined) {
            for (var i = 1; i <= group.numProperties; i++) {
                var p = group.property(i);
                if (p && p.name === name) return p;
            }
        }
        return null;
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_create_background = createBackground;
    h.createBackground = createBackground;
})();
