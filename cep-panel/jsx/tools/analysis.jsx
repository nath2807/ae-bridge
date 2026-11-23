// Asset Inspection, Video Sampling, and Beat Detection Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading analysis.jsx");
    }

    // 1. ae_analyze_assets (ExtendScript side: collects metadata and frame capture targets)
    function analyzeAssets(params) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }

        var targetItems = [];
        var folderName = params && params.folderName ? String(params.folderName) : null;
        var itemIdsMap = {};

        if (params && params.itemIds && params.itemIds.length) {
            for (var k = 0; k < params.itemIds.length; k++) {
                itemIdsMap[Number(params.itemIds[k])] = true;
            }
        }

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.items[i];
            if (item instanceof FolderItem) continue;

            if (folderName) {
                if (!item.parentFolder || item.parentFolder.name !== folderName) {
                    continue;
                }
            }

            if (params && params.itemIds && params.itemIds.length) {
                if (!itemIdsMap[item.id]) continue;
            }

            if (item instanceof FootageItem || item instanceof CompItem) {
                var isComp = item instanceof CompItem;
                var isSolid = !isComp && item.mainSource && item.mainSource instanceof SolidSource;
                if (isSolid) continue;

                var isAudioOnly = !isComp && item.hasAudio && !item.hasVideo;
                var isStill = !isComp && (item.duration === 0 || (item.file && /\.(png|jpg|jpeg|psd|ai|tiff|tif|svg)$/i.test(item.file.name)));

                var midTime = item.duration > 0 ? (item.duration / 2.0) : 0;

                targetItems.push({
                    id: item.id,
                    name: item.name,
                    kind: isComp ? "comp" : (isAudioOnly ? "audio" : (isStill ? "image" : "video")),
                    duration: item.duration,
                    width: item.width,
                    height: item.height,
                    frameRate: item.frameRate,
                    hasAudio: !!item.hasAudio,
                    hasVideo: !!item.hasVideo,
                    midTime: midTime,
                    filePath: (!isComp && item.file) ? cleanPath(item.file.fsName) : null
                });
            }
        }

        return {
            totalAssets: targetItems.length,
            assets: targetItems
        };
    }

    // 2. ae_detect_beats
    function detectBeats(params) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }

        var sensitivity = (params && params.sensitivity !== undefined) ? Number(params.sensitivity) : 0.5;
        var minGap = (params && params.minGap !== undefined) ? Number(params.minGap) : 0.25;
        var addMarkers = params && params.addMarkers !== false;

        var targetComp = null;
        var audioLayer = null;
        var createdTempComp = false;

        if (params && params.itemId) {
            var audioItem = findItem(params.itemId);
            if (!(audioItem instanceof FootageItem) || !audioItem.hasAudio) {
                throw new Error("Specified project item is not an audio media asset.");
            }
            targetComp = app.project.items.addComp(
                "__tmp_beat_detect__",
                100,
                100,
                1,
                Math.max(1, audioItem.duration),
                30
            );
            createdTempComp = true;
            audioLayer = targetComp.layers.add(audioItem);
        } else {
            targetComp = findComp(params ? params.compRef : null);
            audioLayer = findLayer(targetComp, params ? params.layerRef : null);
        }

        var ampLayer = null;
        var beatTimes = [];
        var estimatedBPM = 120;

        try {
            // Select only the audio layer for keyframe extraction
            for (var l = 1; l <= targetComp.numLayers; l++) {
                targetComp.layer(l).selected = false;
            }
            audioLayer.selected = true;

            var cmdId = app.findMenuCommandId("Convert Audio to Keyframes");
            if (!cmdId || cmdId === 0) {
                cmdId = 5029; // standard After Effects menu ID fallback
            }

            app.executeCommand(cmdId);

            // Locate the generated "Audio Amplitude" layer
            for (var a = 1; a <= targetComp.numLayers; a++) {
                var testL = targetComp.layer(a);
                if (/Audio Amplitude/i.test(testL.name)) {
                    ampLayer = testL;
                    break;
                }
            }

            if (!ampLayer) {
                throw new Error("Could not generate or locate 'Audio Amplitude' layer from audio.");
            }

            var bothChannelsProp = null;
            try {
                bothChannelsProp = ampLayer.property("Effects").property("Both Channels").property("Slider");
            } catch (eProp) {
                throw new Error("Could not access 'Both Channels' amplitude slider.");
            }

            var duration = Math.min(targetComp.duration, 300); // sample up to 5 min
            var frameDuration = targetComp.frameDuration || (1.0 / 30.0);
            var numFrames = Math.floor(duration / frameDuration);

            // 1. Gather all volume points
            var values = [];
            var sum = 0;

            for (var f = 0; f < numFrames; f++) {
                var t = f * frameDuration;
                var v = bothChannelsProp.valueAtTime(t, false);
                values.push({ time: t, val: v });
                sum += v;
            }

            var mean = sum / (values.length || 1);
            var varianceSum = 0;
            for (var vIdx = 0; vIdx < values.length; vIdx++) {
                var diff = values[vIdx].val - mean;
                varianceSum += diff * diff;
            }
            var stdDev = Math.sqrt(varianceSum / (values.length || 1));

            // Dynamic threshold inversely proportional to sensitivity (higher sensitivity = lower threshold)
            var multiplier = 0.5 + (1.0 - sensitivity) * 1.5;
            var threshold = mean + multiplier * stdDev;

            // 2. Peak detection with minGap suppression
            var lastBeatT = -minGap;

            for (var p = 1; p < values.length - 1; p++) {
                var cur = values[p];
                var prev = values[p - 1];
                var next = values[p + 1];

                if (cur.val >= threshold && cur.val > prev.val && cur.val >= next.val) {
                    if (cur.time - lastBeatT >= minGap) {
                        beatTimes.push(Number(cur.time.toFixed(3)));
                        lastBeatT = cur.time;
                    }
                }
            }

            // 3. Estimate BPM from median beat intervals
            if (beatTimes.length >= 2) {
                var intervals = [];
                for (var b = 1; b < beatTimes.length; b++) {
                    intervals.push(beatTimes[b] - beatTimes[b - 1]);
                }
                intervals.sort(function (x, y) { return x - y; });
                var medianInterval = intervals[Math.floor(intervals.length / 2)];
                if (medianInterval > 0) {
                    estimatedBPM = Math.round(60.0 / medianInterval);
                    // Normalise into standard 60-180 BPM range if doubled or halved
                    while (estimatedBPM > 180) estimatedBPM = Math.round(estimatedBPM / 2);
                    while (estimatedBPM < 65) estimatedBPM = Math.round(estimatedBPM * 2);
                }
            }

            // 4. Optionally add comp markers
            if (addMarkers && !createdTempComp) {
                withUndo("Add Beat Markers", function () {
                    for (var m = 0; m < beatTimes.length; m++) {
                        var bTime = beatTimes[m];
                        var markerVal = new MarkerValue("Beat " + (m + 1));
                        targetComp.markerProperty.setValueAtTime(bTime, markerVal);
                    }
                });
            }

            return {
                detectedBeats: beatTimes.length,
                estimatedBPM: estimatedBPM,
                sensitivity: sensitivity,
                minGap: minGap,
                beatTimes: beatTimes,
                markersAdded: addMarkers && !createdTempComp
            };
        } finally {
            if (ampLayer) {
                try { ampLayer.remove(); } catch (eAmp) {}
            }
            if (createdTempComp && targetComp) {
                try { targetComp.remove(); } catch (eTc) {}
            }
        }
    }

    // 3. ae_sample_asset_frames
    function sampleAssetFrames(params) {
        if (!app.project) {
            throw new Error("No active After Effects project found.");
        }
        if (!params || !params.samples || !params.samples.length) {
            return { rendered: 0 };
        }

        var samples = params.samples;
        var rendered = 0;

        // Group samples by itemId to reuse temporary comps efficiently
        var itemMap = {};
        for (var i = 0; i < samples.length; i++) {
            var s = samples[i];
            var key = String(s.itemId);
            if (!itemMap[key]) {
                itemMap[key] = [];
            }
            itemMap[key].push(s);
        }

        for (var idStr in itemMap) {
            if (!itemMap.hasOwnProperty(idStr)) continue;
            var sList = itemMap[idStr];
            var item = findItem(Number(idStr));
            var tempComp = null;
            var compToRender = null;

            try {
                if (item instanceof CompItem) {
                    compToRender = item;
                } else if (item instanceof FootageItem) {
                    var w = Math.max(16, item.width || 1920);
                    var h = Math.max(16, item.height || 1080);
                    var dur = Math.max(item.duration || 1, 1);
                    var fps = item.frameRate || 30;
                    tempComp = app.project.items.addComp(
                        "__tmp_asset_sample__",
                        w,
                        h,
                        1,
                        dur,
                        fps
                    );
                    tempComp.layers.add(item);
                    compToRender = tempComp;
                }

                if (compToRender) {
                    for (var j = 0; j < sList.length; j++) {
                        var sample = sList[j];
                        var time = (sample.time !== undefined && !isNaN(Number(sample.time)))
                            ? Number(sample.time)
                            : (compToRender.duration / 2);
                        var maxTime = Math.max(0, compToRender.duration - (compToRender.frameDuration || 0.033));
                        time = Math.max(0, Math.min(maxTime, time));

                        var targetFile = new File(cleanPath(sample.outputPath));
                        if (targetFile.parent && !targetFile.parent.exists) {
                            targetFile.parent.create();
                        }

                        var saved = false;
                        if (typeof compToRender.saveFrameToPng === "function") {
                            try {
                                compToRender.saveFrameToPng(time, targetFile);
                                saved = true;
                                rendered++;
                            } catch (eSave) {
                                saved = false;
                            }
                        }

                        if (!saved && app.project.renderQueue) {
                            var rqItem = app.project.renderQueue.items.add(compToRender);
                            try {
                                rqItem.timeSpanStart = time;
                                rqItem.timeSpanDuration = compToRender.frameDuration || (1.0 / 30.0);
                                var om = rqItem.outputModule(1);
                                for (var t = 0; t < om.templates.length; t++) {
                                    if (/png/i.test(om.templates[t])) {
                                        try { om.applyTemplate(om.templates[t]); } catch (eT) {}
                                        break;
                                    }
                                }
                                om.file = targetFile;
                                app.project.renderQueue.render();
                                rendered++;
                            } finally {
                                try { rqItem.remove(); } catch (eR) {}
                            }
                        }
                    }
                }
            } finally {
                if (tempComp) {
                    try { tempComp.remove(); } catch (eRem) {}
                }
            }
        }

        return { rendered: rendered };
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_analyze_assets = analyzeAssets;
    h.analyzeAssets = analyzeAssets;
    h.ae_detect_beats = detectBeats;
    h.detectBeats = detectBeats;
    h.ae_sample_asset_frames = sampleAssetFrames;
    h.sampleAssetFrames = sampleAssetFrames;
})();
