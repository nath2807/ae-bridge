// 3D Scene lighting, rigs, and environment lights tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading lighting.jsx");
    }

    function addLightToComp(comp, name, type, pos, color, intensity, castsShadows) {
        var light = comp.layers.addLight(name, [comp.width / 2, comp.height / 2]);
        light.lightType = type;

        var tr = light.property("ADBE Transform Group");
        if (pos) {
            tr.property("ADBE Position").setValue(pos);
        }

        var opts = light.property("ADBE Light Options Group");
        if (opts) {
            if (color) opts.property("ADBE Light Color").setValue(toColor(color));
            if (intensity !== undefined) opts.property("ADBE Light Intensity").setValue(Number(intensity));
            if (castsShadows !== undefined) {
                var csProp = opts.property("ADBE Casts Shadows");
                if (csProp) csProp.setValue(castsShadows ? 1 : 0);
            }
        }
        return light;
    }

    function setupLighting(params) {
        return withUndo("Setup 3D Lighting", function () {
            var comp = findComp(params ? params.compRef : null);
            var preset = (params && params.preset) ? String(params.preset).toLowerCase() : "threepoint";
            var shadows = (params && params.shadows !== undefined) ? !!params.shadows : true;

            var cX = comp.width / 2;
            var cY = comp.height / 2;
            var created = [];

            // 1. Three Point
            if (preset === "threepoint") {
                var key = addLightToComp(comp, "Key Light", LightType.SPOT, [cX + 650, cY - 550, -1100], [1.0, 0.97, 0.94], 115, shadows);
                var kOpts = key.property("ADBE Light Options Group");
                if (kOpts) {
                    kOpts.property("ADBE Light Cone Angle").setValue(65);
                    kOpts.property("ADBE Light Cone Feather 2").setValue(50);
                    if (shadows) kOpts.property("ADBE Light Shadow Diffusion").setValue(10);
                }
                created.push(key.name);

                var fill = addLightToComp(comp, "Fill Light", LightType.POINT, [cX - 700, cY - 200, -850], [0.85, 0.92, 1.0], 55, false);
                created.push(fill.name);

                var rim = addLightToComp(comp, "Rim / Back Light", LightType.SPOT, [cX - 300, cY - 600, 900], [1.0, 1.0, 1.0], 95, false);
                created.push(rim.name);
            }

            // 2. Dramatic
            else if (preset === "dramatic") {
                var hardKey = addLightToComp(comp, "Dramatic Key Light", LightType.SPOT, [cX + 750, cY - 750, -600], [1.0, 0.96, 0.9], 135, shadows);
                var hkOpts = hardKey.property("ADBE Light Options Group");
                if (hkOpts) {
                    hkOpts.property("ADBE Light Cone Angle").setValue(45);
                    hkOpts.property("ADBE Light Cone Feather 2").setValue(25);
                    if (shadows) hkOpts.property("ADBE Light Shadow Darkness").setValue(100);
                }
                created.push(hardKey.name);

                var lowRim = addLightToComp(comp, "Subtle Edge Rim", LightType.POINT, [cX - 600, cY + 350, 700], [0.55, 0.75, 1.0], 40, false);
                created.push(lowRim.name);
            }

            // 3. Neon
            else if (preset === "neon") {
                var cyanLight = addLightToComp(comp, "Neon Cyan Light", LightType.POINT, [cX - 650, cY - 150, -450], [0.0, 0.94, 1.0], 125, shadows);
                created.push(cyanLight.name);

                var magentaLight = addLightToComp(comp, "Neon Magenta Light", LightType.POINT, [cX + 650, cY + 150, -350], [1.0, 0.08, 0.55], 125, shadows);
                created.push(magentaLight.name);

                var topPurple = addLightToComp(comp, "Neon Top Accent", LightType.POINT, [cX, cY - 600, 500], [0.65, 0.25, 1.0], 85, false);
                created.push(topPurple.name);
            }

            // 4. Studio
            else if (preset === "studio") {
                var sKey = addLightToComp(comp, "Studio Key", LightType.SPOT, [cX + 500, cY - 450, -1200], [1.0, 1.0, 1.0], 100, shadows);
                var sOpts = sKey.property("ADBE Light Options Group");
                if (sOpts) {
                    sOpts.property("ADBE Light Cone Angle").setValue(75);
                    sOpts.property("ADBE Light Cone Feather 2").setValue(75);
                    if (shadows) sOpts.property("ADBE Light Shadow Diffusion").setValue(20);
                }
                created.push(sKey.name);

                var sFill = addLightToComp(comp, "Studio Fill", LightType.SPOT, [cX - 500, cY - 350, -1000], [0.95, 0.95, 1.0], 65, false);
                created.push(sFill.name);

                var sTop = addLightToComp(comp, "Studio Overhead Soft", LightType.POINT, [cX, cY - 800, -100], [1.0, 1.0, 1.0], 45, false);
                created.push(sTop.name);
            }

            // 5. Sunset
            else if (preset === "sunset") {
                var sunKey = addLightToComp(comp, "Golden Sunset Key", LightType.SPOT, [cX + 800, cY - 200, -700], [1.0, 0.62, 0.22], 130, shadows);
                var sunOpts = sunKey.property("ADBE Light Options Group");
                if (sunOpts) {
                    sunOpts.property("ADBE Light Cone Angle").setValue(60);
                    sunOpts.property("ADBE Light Cone Feather 2").setValue(45);
                }
                created.push(sunKey.name);

                var twilightFill = addLightToComp(comp, "Twilight Purple Fill", LightType.POINT, [cX - 600, cY - 400, -500], [0.45, 0.35, 0.72], 55, false);
                created.push(twilightFill.name);
            }

            // 6. Moody
            else if (preset === "moody") {
                var moodySpot = addLightToComp(comp, "Moody Tungsten Spot", LightType.SPOT, [cX + 400, cY - 700, -500], [1.0, 0.85, 0.7], 95, shadows);
                var mOpts = moodySpot.property("ADBE Light Options Group");
                if (mOpts) {
                    mOpts.property("ADBE Light Cone Angle").setValue(40);
                    mOpts.property("ADBE Light Cone Feather 2").setValue(40);
                    if (shadows) mOpts.property("ADBE Light Shadow Darkness").setValue(90);
                }
                created.push(moodySpot.name);
            }

            // 7. Soft
            else if (preset === "soft") {
                var soft1 = addLightToComp(comp, "Soft Key Point", LightType.POINT, [cX + 400, cY - 300, -900], [1.0, 0.98, 0.96], 80, shadows);
                var softOpts = soft1.property("ADBE Light Options Group");
                if (softOpts && shadows) softOpts.property("ADBE Light Shadow Diffusion").setValue(30);
                created.push(soft1.name);

                var soft2 = addLightToComp(comp, "Soft Fill Point", LightType.POINT, [cX - 400, cY - 200, -900], [0.95, 0.97, 1.0], 70, false);
                created.push(soft2.name);

                var amb = addLightToComp(comp, "Ambient Wash", LightType.AMBIENT, [cX, cY, 0], [1.0, 1.0, 1.0], 25, false);
                created.push(amb.name);
            }

            else {
                throw new Error("Unknown lighting preset: '" + preset + "'. Valid presets: 'threePoint', 'dramatic', 'neon', 'studio', 'sunset', 'moody', 'soft'.");
            }

            return {
                compName: comp.name,
                preset: preset,
                shadowsEnabled: shadows,
                createdLights: created
            };
        });
    }

    function setLight(params) {
        return withUndo("Set Light Parameters", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setLight.");
            }
            var comp = findComp(params.compRef);
            var light = findLayer(comp, params.layerRef);

            if (!(light instanceof LightLayer)) {
                throw new Error("Target layer '" + light.name + "' is not a LightLayer.");
            }

            var opts = light.property("ADBE Light Options Group");
            if (!opts) {
                throw new Error("Could not access ADBE Light Options Group on layer '" + light.name + "'.");
            }

            var applied = {};

            if (params.intensity !== undefined) {
                opts.property("ADBE Light Intensity").setValue(Number(params.intensity));
                applied.intensity = Number(params.intensity);
            }
            if (params.color !== undefined) {
                opts.property("ADBE Light Color").setValue(toColor(params.color));
                applied.color = params.color;
            }
            if (params.coneAngle !== undefined) {
                try {
                    opts.property("ADBE Light Cone Angle").setValue(Number(params.coneAngle));
                    applied.coneAngle = Number(params.coneAngle);
                } catch (e) {}
            }
            if (params.coneFeather !== undefined) {
                try {
                    opts.property("ADBE Light Cone Feather 2").setValue(Number(params.coneFeather));
                    applied.coneFeather = Number(params.coneFeather);
                } catch (e2) {}
            }
            if (params.castsShadows !== undefined) {
                var csProp = opts.property("ADBE Casts Shadows");
                if (csProp) {
                    csProp.setValue(params.castsShadows ? 1 : 0);
                    applied.castsShadows = !!params.castsShadows;
                }
            }
            if (params.shadowDarkness !== undefined) {
                try {
                    opts.property("ADBE Light Shadow Darkness").setValue(Number(params.shadowDarkness));
                    applied.shadowDarkness = Number(params.shadowDarkness);
                } catch (e3) {}
            }
            if (params.shadowDiffusion !== undefined) {
                try {
                    opts.property("ADBE Light Shadow Diffusion").setValue(Number(params.shadowDiffusion));
                    applied.shadowDiffusion = Number(params.shadowDiffusion);
                } catch (e4) {}
            }

            return {
                lightName: light.name,
                applied: applied
            };
        });
    }

    function addEnvironmentLight(params) {
        return withUndo("Add Environment Light", function () {
            var comp = findComp(params ? params.compRef : null);

            // Check if LightType.ENVIRONMENT is supported in this After Effects version
            if (typeof LightType.ENVIRONMENT === "undefined") {
                throw new Error("Environment Light (LightType.ENVIRONMENT) is only available in After Effects 2024+ (v24.0+) with Advanced 3D renderer.");
            }

            var envLight = comp.layers.addLight("Environment Light", [comp.width / 2, comp.height / 2]);
            try {
                envLight.lightType = LightType.ENVIRONMENT;
            } catch (eEnv) {
                throw new Error("Failed to set LightType.ENVIRONMENT on light layer: " + eEnv.message);
            }

            var intensity = (params && params.intensity !== undefined) ? Number(params.intensity) : 100;
            var opts = envLight.property("ADBE Light Options Group");
            if (opts) {
                opts.property("ADBE Light Intensity").setValue(intensity);
            }

            // If an HDRI footage item was provided, assign it if property exists
            var hdriItem = null;
            if (params && params.hdriItemId !== undefined) {
                try {
                    hdriItem = findItem(params.hdriItemId);
                    // Add HDRI item as layer in comp or set environment source
                    var hdriLayer = comp.layers.add(hdriItem);
                    hdriLayer.enabled = false; // often used as hidden environment source
                } catch (eHdri) {}
            }

            return {
                compName: comp.name,
                lightName: envLight.name,
                lightType: "Environment",
                intensity: intensity,
                hdriItem: hdriItem ? hdriItem.name : null
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_setup_lighting = setupLighting;
    h.setupLighting = setupLighting;
    h.ae_set_light = setLight;
    h.setLight = setLight;
    h.ae_add_environment_light = addEnvironmentLight;
    h.addEnvironmentLight = addEnvironmentLight;
})();
