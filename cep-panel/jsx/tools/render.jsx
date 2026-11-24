// Rendering, Template Management, and Export Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading render.jsx");
    }

    var PRESET_PATTERNS = {
        "mp4High": [/match.*source.*high/i, /h\.?264.*high/i, /h\.?264/i, /high.*quality/i, /mp4/i, /lossless/i],
        "mp4Web": [/web/i, /youtube/i, /vimeo/i, /medium/i, /h\.?264/i, /mp4/i],
        "prores422": [/prores.*422/i, /apple prores.*422/i, /apple prores/i, /prores/i],
        "proresProxy": [/prores.*proxy/i, /proxy/i],
        "prores4444Alpha": [/prores.*4444/i, /lossless.*alpha/i, /with alpha/i, /alpha/i],
        "pngSequence": [/png.*sequence/i, /png/i],
        "pngAlphaSequence": [/png.*alpha/i, /png.*sequence/i, /png/i],
        "wav": [/wav/i, /audio.*only/i, /aiff/i]
    };

    function extractMbps(name) {
        if (!name) return null;
        var match = String(name).match(/(\d+(?:\.\d+)?)\s*mbps/i);
        if (match) {
            return parseFloat(match[1]);
        }
        return null;
    }

    function findTemplateForPreset(om, presetName) {
        if (!om || !om.templates) return null;
        var templates = om.templates;
        var preset = String(presetName);

        // 1. Template lookup order: templates whose name starts with "AE Bridge" matching the preset
        if (preset === "mp4High" || preset === "mp4Web") {
            var targetExact = preset === "mp4High" ? "AE Bridge H264 High" : "AE Bridge H264 Web";
            var targetKeyword = preset === "mp4High" ? "high" : "web";

            // Check exact name first
            for (var i = 0; i < templates.length; i++) {
                var tExact = templates[i];
                if (tExact && tExact.toLowerCase() === targetExact.toLowerCase()) {
                    return {
                        name: tExact,
                        isAeBridge: true,
                        mbps: extractMbps(tExact)
                    };
                }
            }

            // Check if name starts with "AE Bridge" and contains the preset keyword
            for (var j = 0; j < templates.length; j++) {
                var tPrefix = templates[j];
                if (tPrefix && tPrefix.toLowerCase().indexOf("ae bridge") === 0 && tPrefix.toLowerCase().indexOf(targetKeyword) !== -1) {
                    return {
                        name: tPrefix,
                        isAeBridge: true,
                        mbps: extractMbps(tPrefix)
                    };
                }
            }
        }

        // 2. Fallback keyword search:
        // choosing the HIGHEST Mbps number found in the template name for mp4High and the lowest for mp4Web
        var patterns = PRESET_PATTERNS[preset] || [new RegExp(preset, "i")];

        if (preset === "mp4High" || preset === "mp4Web") {
            var candidatesWithMbps = [];
            var candidatesWithoutMbps = [];
            var seen = {};

            for (var p = 0; p < patterns.length; p++) {
                var regex = patterns[p];
                for (var t = 0; t < templates.length; t++) {
                    var candidate = templates[t];
                    if (!seen[candidate] && regex.test(candidate)) {
                        seen[candidate] = true;
                        var mbpsVal = extractMbps(candidate);
                        if (mbpsVal !== null) {
                            candidatesWithMbps.push({ name: candidate, mbps: mbpsVal, patternIndex: p });
                        } else {
                            candidatesWithoutMbps.push({ name: candidate, patternIndex: p });
                        }
                    }
                }
            }

            if (candidatesWithMbps.length > 0) {
                if (preset === "mp4High") {
                    // Sort descending: highest Mbps first
                    candidatesWithMbps.sort(function (a, b) { return b.mbps - a.mbps; });
                } else {
                    // Sort ascending: lowest Mbps first
                    candidatesWithMbps.sort(function (a, b) { return a.mbps - b.mbps; });
                }
                return {
                    name: candidatesWithMbps[0].name,
                    isAeBridge: false,
                    mbps: candidatesWithMbps[0].mbps
                };
            }

            if (candidatesWithoutMbps.length > 0) {
                // Preserves pattern priority
                candidatesWithoutMbps.sort(function (a, b) { return a.patternIndex - b.patternIndex; });
                return {
                    name: candidatesWithoutMbps[0].name,
                    isAeBridge: false,
                    mbps: null
                };
            }

            return null;
        }

        // Other presets (prores, pngSequence, wav, etc.)
        for (var p2 = 0; p2 < patterns.length; p2++) {
            var regex2 = patterns[p2];
            for (var t2 = 0; t2 < templates.length; t2++) {
                if (regex2.test(templates[t2])) {
                    return {
                        name: templates[t2],
                        isAeBridge: false,
                        mbps: null
                    };
                }
            }
        }
        return null;
    }

    // 1. ae_list_output_templates
    function listOutputTemplates(params) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }

        var dummyComp = null;
        var createdDummy = false;

        for (var i = 1; i <= app.project.numItems; i++) {
            if (app.project.items[i] instanceof CompItem) {
                dummyComp = app.project.items[i];
                break;
            }
        }

        if (!dummyComp) {
            dummyComp = app.project.items.addComp("__tmp_tpl_check__", 100, 100, 1, 1, 24);
            createdDummy = true;
        }

        var rqItem = null;
        try {
            rqItem = app.project.renderQueue.items.add(dummyComp);
            var om = rqItem.outputModule(1);
            var omTemplates = [];
            for (var o = 0; o < om.templates.length; o++) {
                omTemplates.push(om.templates[o]);
            }
            var rsTemplates = [];
            for (var r = 0; r < rqItem.templates.length; r++) {
                rsTemplates.push(rqItem.templates[r]);
            }
            return {
                outputModuleTemplates: omTemplates,
                renderSettingsTemplates: rsTemplates,
                supportedPresets: [
                    "mp4High",
                    "mp4Web",
                    "prores422",
                    "proresProxy",
                    "prores4444Alpha",
                    "pngSequence",
                    "pngAlphaSequence",
                    "wav"
                ]
            };
        } finally {
            if (rqItem) {
                try { rqItem.remove(); } catch (eR) {}
            }
            if (createdDummy && dummyComp) {
                try { dummyComp.remove(); } catch (eD) {}
            }
        }
    }

    // 2. ae_render
    function renderComp(params) {
        if (!params || !params.preset) {
            throw new Error("preset parameter is required for ae_render ('mp4High', 'mp4Web', 'prores422', 'proresProxy', 'prores4444Alpha', 'pngSequence', 'pngAlphaSequence', 'wav').");
        }
        if (!params.outputPath) {
            throw new Error("outputPath parameter is required for ae_render.");
        }

        var comp = findComp(params.compRef);
        var preset = String(params.preset);
        var mode = params.mode === "ae" ? "ae" : "ame";
        var workAreaOnly = params.workAreaOnly !== false;

        var targetFile = new File(cleanPath(params.outputPath));
        if (targetFile.parent && !targetFile.parent.exists) {
            targetFile.parent.create();
        }

        var rqItem = app.project.renderQueue.items.add(comp);
        var matchedTemplate = null;

        try {
            if (workAreaOnly) {
                rqItem.timeSpanStart = comp.workAreaStart;
                rqItem.timeSpanDuration = comp.workAreaDuration;
            } else {
                rqItem.timeSpanStart = 0;
                rqItem.timeSpanDuration = comp.duration;
            }

            var om = rqItem.outputModule(1);
            var matchResult = findTemplateForPreset(om, preset);
            matchedTemplate = matchResult ? matchResult.name : null;
            var warningMsg = null;

            if (preset === "mp4High" && matchResult && !matchResult.isAeBridge) {
                if (matchResult.mbps === null || matchResult.mbps < 20) {
                    warningMsg = "Render template '" + matchedTemplate + "' " +
                        (matchResult.mbps !== null ? "is " + matchResult.mbps + " Mbps, which is under 20 Mbps" : "has no high bitrate specified") +
                        ". For optimal broadcast quality, please create the 'AE Bridge H264 High' output module template. See docs/troubleshooting.md#8-creating-custom-h264-render-templates-ae-bridge-h264-high for step-by-step instructions.";
                }
            }

            if (matchedTemplate) {
                try {
                    om.applyTemplate(matchedTemplate);
                } catch (eTpl) {}
            }

            om.file = targetFile;

            var resultPayload = {
                compId: comp.id,
                compName: comp.name,
                preset: preset,
                matchedTemplate: matchedTemplate,
                templateName: matchedTemplate,
                mode: mode,
                status: mode === "ame" ? "queued_in_ame" : "completed",
                outputPath: cleanPath(targetFile.fsName),
                workAreaOnly: workAreaOnly,
                duration: workAreaOnly ? comp.workAreaDuration : comp.duration
            };
            if (warningMsg) {
                resultPayload.warning = warningMsg;
            }

            if (mode === "ame") {
                app.project.renderQueue.queueInAME(true);
                // Remove from AE queue since it was transferred to AME
                rqItem.remove();
                rqItem = null;

                return resultPayload;
            } else {
                // Mode "ae" - synchronous in-AE render
                app.project.renderQueue.render();
                return resultPayload;
            }
        } finally {
            if (rqItem) {
                try { rqItem.remove(); } catch (eClean) {}
            }
        }
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_list_output_templates = listOutputTemplates;
    h.listOutputTemplates = listOutputTemplates;
    h.ae_render = renderComp;
    h.renderComp = renderComp;
})();
