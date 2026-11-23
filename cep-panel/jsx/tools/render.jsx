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

    function findTemplateForPreset(om, presetName) {
        if (!om || !om.templates) return null;
        var templates = om.templates;
        var patterns = PRESET_PATTERNS[presetName] || [new RegExp(presetName, "i")];

        for (var p = 0; p < patterns.length; p++) {
            var regex = patterns[p];
            for (var t = 0; t < templates.length; t++) {
                if (regex.test(templates[t])) {
                    return templates[t];
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
            matchedTemplate = findTemplateForPreset(om, preset);

            if (matchedTemplate) {
                try {
                    om.applyTemplate(matchedTemplate);
                } catch (eTpl) {}
            }

            om.file = targetFile;

            if (mode === "ame") {
                app.project.renderQueue.queueInAME(true);
                // Remove from AE queue since it was transferred to AME
                rqItem.remove();
                rqItem = null;

                return {
                    compId: comp.id,
                    compName: comp.name,
                    preset: preset,
                    matchedTemplate: matchedTemplate,
                    mode: "ame",
                    status: "queued_in_ame",
                    outputPath: cleanPath(targetFile.fsName),
                    workAreaOnly: workAreaOnly,
                    duration: workAreaOnly ? comp.workAreaDuration : comp.duration
                };
            } else {
                // Mode "ae" - synchronous in-AE render
                app.project.renderQueue.render();

                return {
                    compId: comp.id,
                    compName: comp.name,
                    preset: preset,
                    matchedTemplate: matchedTemplate,
                    mode: "ae",
                    status: "completed",
                    outputPath: cleanPath(targetFile.fsName),
                    workAreaOnly: workAreaOnly,
                    duration: workAreaOnly ? comp.workAreaDuration : comp.duration
                };
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
