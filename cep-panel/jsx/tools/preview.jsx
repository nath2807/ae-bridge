// Visual Preview, Frame Capture, and Playhead Controls for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading preview.jsx");
    }

    function renderFrameToFile(comp, time, targetFile) {
        var cleanTarget = new File(cleanPath(targetFile.fsName || targetFile));

        // Primary method: comp.saveFrameToPng
        if (typeof comp.saveFrameToPng === "function") {
            try {
                comp.saveFrameToPng(time, cleanTarget);
                return {
                    method: "saveFrameToPng",
                    filePath: cleanPath(cleanTarget.fsName)
                };
            } catch (eSave) {
                // Fall through to Render Queue fallback
            }
        }

        // Fallback: Render Queue single-frame export
        if (!app.project.renderQueue) {
            throw new Error("Render queue not accessible for frame fallback.");
        }

        var rqItem = app.project.renderQueue.items.add(comp);
        try {
            rqItem.timeSpanStart = Math.max(0, Math.min(comp.duration - comp.frameDuration, time));
            rqItem.timeSpanDuration = comp.frameDuration;

            var om = rqItem.outputModule(1);
            var templates = om.templates;
            var pngTemplate = null;

            for (var t = 0; t < templates.length; t++) {
                if (/png/i.test(templates[t])) {
                    pngTemplate = templates[t];
                    break;
                }
            }

            if (pngTemplate) {
                try {
                    om.applyTemplate(pngTemplate);
                } catch (eTemp) {}
            }

            om.file = cleanTarget;
            app.project.renderQueue.render();

            return {
                method: "renderQueue",
                filePath: cleanPath(cleanTarget.fsName)
            };
        } finally {
            try {
                rqItem.remove();
            } catch (eRemove) {}
        }
    }

    // 1. ae_preview_frame / captureFrame
    function captureFrame(params) {
        if (!params || !params.outputPath) {
            throw new Error("outputPath is required for frame capture.");
        }

        var comp = findComp(params.compRef);
        var time = (params.time !== undefined && !isNaN(Number(params.time)))
            ? Number(params.time)
            : comp.time;

        time = Math.max(0, Math.min(comp.duration, time));
        var targetFile = new File(cleanPath(params.outputPath));

        var captureResult = renderFrameToFile(comp, time, targetFile);

        return {
            compName: comp.name,
            compId: comp.id,
            time: time,
            width: comp.width,
            height: comp.height,
            outputPath: captureResult.filePath,
            method: captureResult.method
        };
    }

    // 2. ae_preview_layer_isolated / captureLayerIsolated
    function captureLayerIsolated(params) {
        if (!params || !params.outputPath) {
            throw new Error("outputPath is required for isolated layer preview.");
        }
        if (!params.layerRef) {
            throw new Error("layerRef is required for isolated layer preview.");
        }

        var comp = findComp(params.compRef);
        var targetLayer = findLayer(comp, params.layerRef);
        var time = (params.time !== undefined && !isNaN(Number(params.time)))
            ? Number(params.time)
            : comp.time;
        time = Math.max(0, Math.min(comp.duration, time));

        var targetFile = new File(cleanPath(params.outputPath));

        // Save existing solo states for exact restoration in try/finally
        var prevSolos = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            prevSolos.push(comp.layer(i).solo);
            comp.layer(i).solo = false;
        }

        var captureResult = null;
        try {
            targetLayer.solo = true;
            captureResult = renderFrameToFile(comp, time, targetFile);
        } finally {
            for (var j = 1; j <= comp.numLayers; j++) {
                comp.layer(j).solo = prevSolos[j - 1];
            }
        }

        return {
            compName: comp.name,
            compId: comp.id,
            layerName: targetLayer.name,
            layerIndex: targetLayer.index,
            time: time,
            width: comp.width,
            height: comp.height,
            outputPath: captureResult.filePath,
            method: captureResult.method
        };
    }

    // 3. ae_set_preview_time / setPreviewTime
    function setPreviewTime(params) {
        if (!params || params.time === undefined || isNaN(Number(params.time))) {
            throw new Error("time parameter (number in seconds) is required for setPreviewTime.");
        }

        var comp = findComp(params.compRef);
        var newTime = Math.max(0, Math.min(comp.duration, Number(params.time)));
        comp.time = newTime;

        return {
            compName: comp.name,
            compId: comp.id,
            time: comp.time,
            duration: comp.duration
        };
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_preview_frame = captureFrame;
    h.captureFrame = captureFrame;
    h.ae_preview_layer_isolated = captureLayerIsolated;
    h.captureLayerIsolated = captureLayerIsolated;
    h.ae_set_preview_time = setPreviewTime;
    h.setPreviewTime = setPreviewTime;
})();
