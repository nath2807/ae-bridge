// Render Quality Management and Standards Engine for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading quality.jsx");
    }

    /**
     * Shared helper to apply high-end broadcast quality defaults to a composition.
     * Called automatically by builders (titles, scenes, storyboard, recipes).
     */
    function applyQualityDefaults(comp) {
        if (!comp || !(comp instanceof CompItem)) return;

        try {
            // Full resolution preview
            comp.resolutionFactor = [1, 1];

            // Cinematic standard shutter parameters
            comp.shutterAngle = 180;
            comp.shutterPhase = -90;

            // Comp-level motion blur switch
            comp.motionBlur = true;

            // Try setting high-sampling limits if available
            try { comp.motionBlurSamplesPerFrame = 16; } catch (e) {}
            try { comp.motionBlurAdaptiveSampleLimit = 16; } catch (e) {}

            var has3D = false;

            // Iterate through layers
            for (var i = 1; i <= comp.numLayers; i++) {
                var l = comp.layer(i);
                if (!l) continue;

                if (l.threeDLayer) {
                    has3D = true;
                }

                // Enable motion blur on animated video layers
                if (l.hasVideo && !l.nullLayer) {
                    var isAnimated = false;
                    try {
                        if (l.transform) {
                            if ((l.transform.position && l.transform.position.numKeys > 0) ||
                                (l.transform.scale && l.transform.scale.numKeys > 0) ||
                                (l.transform.opacity && l.transform.opacity.numKeys > 0) ||
                                (l.transform.rotation && l.transform.rotation.numKeys > 0) ||
                                (l.transform.xRotation && l.transform.xRotation.numKeys > 0) ||
                                (l.transform.yRotation && l.transform.yRotation.numKeys > 0)) {
                                isAnimated = true;
                            }
                        }
                    } catch (err) {}

                    if (isAnimated) {
                        try { l.motionBlur = true; } catch (e) {}
                    }
                }
            }

            // If 3D layers are present, select Advanced 3D renderer (ADBE Ernst / ADBE Calder)
            if (has3D) {
                try {
                    var renderers = comp.renderers;
                    for (var r = 0; r < renderers.length; r++) {
                        if (renderers[r] === "ADBE Ernst" || renderers[r] === "ADBE Calder" || /advanced/i.test(renderers[r])) {
                            comp.renderer = renderers[r];
                            break;
                        }
                    }
                } catch (e3d) {}
            }
        } catch (e) {}
    }

    // 1. ae_set_quality_mode
    function setQualityMode(params) {
        return withUndo("Set Quality Mode", function () {
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var mode = params && params.mode ? String(params.mode).toLowerCase() : "final";
            var compsUpdated = 0;

            if (mode === "draft") {
                // Draft mode: fast previews
                try {
                    app.project.bitsPerChannel = ChannelDepth.EIGHT_BIT_PER_CHANNEL;
                } catch (e1) {
                    try { app.project.bitsPerChannel = 8; } catch (e2) {}
                }

                for (var i = 1; i <= app.project.numItems; i++) {
                    var item = app.project.items[i];
                    if (item instanceof CompItem) {
                        try {
                            item.resolutionFactor = [2, 2]; // Half resolution
                            item.motionBlur = false; // Disable motion blur for fast scrubbing
                            compsUpdated++;
                        } catch (ed) {}
                    }
                }

                return {
                    mode: "draft",
                    bitsPerChannel: 8,
                    resolution: "half (1/2)",
                    motionBlur: false,
                    compsUpdated: compsUpdated
                };
            } else {
                // Final mode: full fidelity broadcast rendering
                var bpcSet = 32;
                try {
                    app.project.bitsPerChannel = ChannelDepth.THIRTY_TWO_BIT_PER_CHANNEL;
                } catch (e32) {
                    try {
                        app.project.bitsPerChannel = ChannelDepth.SIXTEEN_BIT_PER_CHANNEL;
                        bpcSet = 16;
                    } catch (e16) {
                        try {
                            app.project.bitsPerChannel = 32;
                        } catch (eFallback) {
                            try { app.project.bitsPerChannel = 16; bpcSet = 16; } catch (eLast) { bpcSet = 8; }
                        }
                    }
                }

                // Enable linear blending where safe
                try {
                    app.project.linearBlending = true;
                } catch (eLin) {}

                for (var j = 1; j <= app.project.numItems; j++) {
                    var cItem = app.project.items[j];
                    if (cItem instanceof CompItem) {
                        applyQualityDefaults(cItem);
                        compsUpdated++;
                    }
                }

                return {
                    mode: "final",
                    bitsPerChannel: bpcSet,
                    linearBlending: true,
                    resolution: "full (1/1)",
                    motionBlur: true,
                    shutterAngle: 180,
                    shutterPhase: -90,
                    samplesPerFrame: 16,
                    compsUpdated: compsUpdated
                };
            }
        });
    }

    // Register globally
    $.global.applyQualityDefaults = applyQualityDefaults;

    var h = $.global.aeBridge.handlers;
    h.ae_set_quality_mode = setQualityMode;
    h.setQualityMode = setQualityMode;

    if ($.global.aeBridge.helpers) {
        $.global.aeBridge.helpers.applyQualityDefaults = applyQualityDefaults;
    }
})();
