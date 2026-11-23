// Social Media Format Variations and Smart Auto-Reframing Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading formats.jsx");
    }

    var ASPECT_RESOLUTIONS = {
        "16:9": [1920, 1080],
        "9:16": [1080, 1920],
        "1:1": [1080, 1080],
        "4:5": [1080, 1350],
        "4:3": [1440, 1080],
        "21:9": [2560, 1080]
    };

    var PLATFORM_PRESETS = {
        "youtube": { aspect: "16:9", width: 1920, height: 1080, label: "YouTube Landscape (16:9)" },
        "shorts": { aspect: "9:16", width: 1080, height: 1920, label: "YouTube Shorts (9:16)" },
        "reels": { aspect: "9:16", width: 1080, height: 1920, label: "Instagram Reels (9:16)" },
        "tiktok": { aspect: "9:16", width: 1080, height: 1920, label: "TikTok (9:16)" },
        "instagramFeed": { aspect: "1:1", width: 1080, height: 1080, label: "Instagram Square (1:1)" },
        "instagramPortrait": { aspect: "4:5", width: 1080, height: 1350, label: "Instagram Portrait (4:5)" },
        "x": { aspect: "16:9", width: 1920, height: 1080, label: "X Landscape (16:9)" },
        "linkedin": { aspect: "1:1", width: 1080, height: 1080, label: "LinkedIn Square (1:1)" }
    };

    // 1. ae_create_format_variant
    function createFormatVariant(params) {
        return withUndo("Create Format Variant", function () {
            if (!params || !params.aspect) {
                throw new Error("aspect parameter is required ('16:9', '9:16', '1:1', '4:5', '4:3', '21:9').");
            }

            var origComp = findComp(params.compRef);
            var aspect = String(params.aspect);
            var method = params.method || "smartReframe";

            var targetDim = ASPECT_RESOLUTIONS[aspect] || [1920, 1080];
            if (params.resolution && params.resolution.length >= 2) {
                targetDim = [Number(params.resolution[0]), Number(params.resolution[1])];
            }

            var targetW = targetDim[0];
            var targetH = targetDim[1];
            var variantName = params.name || (origComp.name + " — " + aspect + " (" + method + ")");

            if (method === "smartReframe") {
                // Duplicate the composition and all its layers
                var dupComp = origComp.duplicate();
                dupComp.name = variantName;

                var origW = origComp.width;
                var origH = origComp.height;

                dupComp.width = targetW;
                dupComp.height = targetH;

                var dx = (targetW - origW) / 2.0;
                var dy = (targetH - origH) / 2.0;

                var adjusted = [];
                var safeW = targetW * 0.8;
                var safeH = targetH * 0.8;

                for (var i = 1; i <= dupComp.numLayers; i++) {
                    var lyr = dupComp.layer(i);
                    var lType = getLayerType(lyr);
                    var lName = lyr.name;

                    // A. Background layers (solids or layers named BG/Background)
                    if (lType === "solid" || /bg|background/i.test(lName)) {
                        var bgScaleX = (targetW / origW) * 100.0;
                        var bgScaleY = (targetH / origH) * 100.0;
                        var maxBgScale = Math.max(bgScaleX, bgScaleY);

                        try {
                            var scProp = lyr.property("Transform").property("Scale");
                            var curSc = scProp.value;
                            scProp.setValue([curSc[0] * (maxBgScale / 100.0), curSc[1] * (maxBgScale / 100.0)]);

                            var posProp = lyr.property("Transform").property("Position");
                            posProp.setValue([targetW / 2.0, targetH / 2.0]);
                            adjusted.push(lName + " (scaled background to cover " + targetW + "x" + targetH + ")");
                        } catch (eBg) {}
                    }
                    // B. Text layers: ensure they fit inside title-safe
                    else if (lType === "text") {
                        try {
                            var txtPosProp = lyr.property("Transform").property("Position");
                            var curTxtPos = txtPosProp.value;

                            // Re-center horizontally if centered, or shift
                            var newPosX = curTxtPos[0] + dx;
                            var newPosY = curTxtPos[1] + dy;
                            txtPosProp.setValue([newPosX, newPosY]);

                            // Check width via sourceRectAtTime
                            var sRect = lyr.sourceRectAtTime(dupComp.time, false);
                            var curScale = lyr.property("Transform").property("Scale").value;
                            var curW = sRect.width * (Math.abs(curScale[0]) / 100.0);

                            if (curW > safeW && curW > 0) {
                                var ratio = safeW / curW;
                                lyr.property("Transform").property("Scale").setValue([curScale[0] * ratio, curScale[1] * ratio]);
                                adjusted.push(lName + " (scaled down by " + Math.round((1 - ratio) * 100) + "% to fit title-safe)");
                            } else {
                                adjusted.push(lName + " (re-centered at [" + Math.round(newPosX) + ", " + Math.round(newPosY) + "])");
                            }
                        } catch (eTxt) {}
                    }
                    // C. Other layers (unparented elements)
                    else if (!lyr.parent) {
                        try {
                            var pProp = lyr.property("Transform").property("Position");
                            if (pProp && !pProp.numKeys) {
                                var cP = pProp.value;
                                if (cP && cP.length >= 2) {
                                    pProp.setValue([cP[0] + dx, cP[1] + dy]);
                                    adjusted.push(lName + " (repositioned by [" + Math.round(dx) + ", " + Math.round(dy) + "])");
                                }
                            }
                        } catch (eOth) {}
                    }
                }

                return {
                    compId: dupComp.id,
                    compName: dupComp.name,
                    aspect: aspect,
                    width: targetW,
                    height: targetH,
                    method: "smartReframe",
                    adjustedLayers: adjusted
                };
            }

            // Methods: "fit", "fill", "fitBlurBackground" (nesting original comp)
            var newComp = app.project.items.addComp(variantName, targetW, targetH, origComp.pixelAspect, origComp.duration, origComp.frameRate);
            newComp.bgColor = origComp.bgColor;

            var scaleFit = Math.min(targetW / origComp.width, targetH / origComp.height) * 100.0;
            var scaleFill = Math.max(targetW / origComp.width, targetH / origComp.height) * 100.0;

            if (method === "fitBlurBackground") {
                // Bottom: Blurred & darkened background layer
                var bgNest = newComp.layers.add(origComp);
                bgNest.name = "Background (Blurred)";
                bgNest.property("Transform").property("Scale").setValue([scaleFill, scaleFill]);
                bgNest.property("Transform").property("Position").setValue([targetW / 2, targetH / 2]);

                var blurFx = null;
                try {
                    blurFx = bgNest.property("Effects").addProperty("ADBE Gaussian Blur 2");
                } catch (eG1) {
                    try { blurFx = bgNest.property("Effects").addProperty("Gaussian Blur"); } catch (eG2) {}
                }
                if (blurFx) {
                    try { blurFx.property(1).setValue(60); } catch (eB) {}
                }

                // Darken solid overlay
                var darkSolid = newComp.layers.addSolid([0, 0, 0], "Darken Overlay", targetW, targetH, 1, origComp.duration);
                darkSolid.property("Transform").property("Opacity").setValue(45);

                // Top: Main content scaled to fit
                var fgNest = newComp.layers.add(origComp);
                fgNest.name = "Main Content (Fit)";
                fgNest.property("Transform").property("Scale").setValue([scaleFit, scaleFit]);
                fgNest.property("Transform").property("Position").setValue([targetW / 2, targetH / 2]);

                return {
                    compId: newComp.id,
                    compName: newComp.name,
                    aspect: aspect,
                    width: targetW,
                    height: targetH,
                    method: "fitBlurBackground"
                };
            } else if (method === "fill") {
                var fillNest = newComp.layers.add(origComp);
                fillNest.name = "Main Content (Fill)";
                fillNest.property("Transform").property("Scale").setValue([scaleFill, scaleFill]);
                fillNest.property("Transform").property("Position").setValue([targetW / 2, targetH / 2]);

                return {
                    compId: newComp.id,
                    compName: newComp.name,
                    aspect: aspect,
                    width: targetW,
                    height: targetH,
                    method: "fill"
                };
            } else {
                // "fit"
                var fitNest = newComp.layers.add(origComp);
                fitNest.name = "Main Content (Fit)";
                fitNest.property("Transform").property("Scale").setValue([scaleFit, scaleFit]);
                fitNest.property("Transform").property("Position").setValue([targetW / 2, targetH / 2]);

                return {
                    compId: newComp.id,
                    compName: newComp.name,
                    aspect: aspect,
                    width: targetW,
                    height: targetH,
                    method: "fit"
                };
            }
        });
    }

    // 2. ae_create_all_social_variants
    function createAllSocialVariants(params) {
        return withUndo("Create Social Variants", function () {
            var origComp = findComp(params ? params.compRef : null);
            var method = (params && params.method) ? params.method : "smartReframe";
            var platforms = (params && params.platforms && params.platforms.length)
                ? params.platforms
                : ["youtube", "shorts", "reels", "tiktok", "instagramFeed", "instagramPortrait", "x", "linkedin"];

            var socialFolder = findFolder("Social Variants", true);
            var results = [];

            // Prevent duplicating identical aspects if requested
            var createdKeys = {};

            for (var p = 0; p < platforms.length; p++) {
                var pKey = platforms[p];
                if (!PLATFORM_PRESETS.hasOwnProperty(pKey)) continue;

                var conf = PLATFORM_PRESETS[pKey];
                var uniqueKey = conf.width + "x" + conf.height;

                var vName = origComp.name + " — " + pKey + " [" + conf.aspect + "]";
                var res = createFormatVariant({
                    compRef: { compId: origComp.id },
                    aspect: conf.aspect,
                    resolution: [conf.width, conf.height],
                    method: method,
                    name: vName
                });

                // Move new comp into "Social Variants" folder
                var createdComp = findComp({ compId: res.compId });
                createdComp.parentFolder = socialFolder;

                results.push({
                    platform: pKey,
                    label: conf.label,
                    compId: res.compId,
                    compName: res.compName,
                    aspect: conf.aspect,
                    resolution: [conf.width, conf.height],
                    method: method
                });
            }

            return {
                folder: "Social Variants",
                folderId: socialFolder.id,
                totalCreated: results.length,
                variants: results
            };
        });
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_create_format_variant = createFormatVariant;
    h.createFormatVariant = createFormatVariant;
    h.ae_create_all_social_variants = createAllSocialVariants;
    h.createAllSocialVariants = createAllSocialVariants;
})();
