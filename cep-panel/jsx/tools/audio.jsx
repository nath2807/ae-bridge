// Audio editing, ducking, marker syncing, and amplitude tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading audio.jsx");
    }

    function getAudioLevelsProp(layer) {
        var audioGroup = layer.property("ADBE Audio Group");
        if (!audioGroup) {
            throw new Error("Layer '" + layer.name + "' has no audio stream or Audio Group.");
        }
        var levels = audioGroup.property("ADBE Audio Levels");
        if (!levels) {
            throw new Error("Could not access ADBE Audio Levels on layer '" + layer.name + "'.");
        }
        return levels;
    }

    function easeAudioKeys(prop, inf) {
        if (!prop || prop.numKeys < 2) return;
        var influence = inf !== undefined ? Number(inf) : 75;
        influence = Math.max(0.1, Math.min(100, influence));

        for (var k = 1; k <= prop.numKeys; k++) {
            var inEases = [new KeyframeEase(0, influence), new KeyframeEase(0, influence)];
            var outEases = [new KeyframeEase(0, influence), new KeyframeEase(0, influence)];
            try {
                prop.setTemporalEaseAtKey(k, inEases, outEases);
            } catch (e) {}
        }
    }

    function setAudioLevel(params) {
        return withUndo("Set Audio Level", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for setAudioLevel.");
            }
            if (params.db === undefined) {
                throw new Error("db (decibel level) is required for setAudioLevel.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var levels = getAudioLevelsProp(layer);

            var dbVal = Number(params.db);
            levels.setValue([dbVal, dbVal]);

            return {
                layerName: layer.name,
                audioLevelDb: dbVal
            };
        });
    }

    function fadeAudio(params) {
        return withUndo("Fade Audio", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for fadeAudio.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var levels = getAudioLevelsProp(layer);

            var currentVal = [0, 0];
            try {
                if (levels.value instanceof Array && levels.value.length >= 2) {
                    currentVal = [levels.value[0], levels.value[1]];
                }
            } catch (e) {}

            var minDb = -48;
            var fadesApplied = [];

            if (params.fadeIn !== undefined && Number(params.fadeIn) > 0) {
                var fIn = Number(params.fadeIn);
                var t0 = layer.inPoint;
                var t1 = t0 + fIn;

                levels.setValueAtTime(t0, [minDb, minDb]);
                levels.setValueAtTime(t1, currentVal);
                fadesApplied.push("fadeIn (" + fIn + "s)");
            }

            if (params.fadeOut !== undefined && Number(params.fadeOut) > 0) {
                var fOut = Number(params.fadeOut);
                var tEnd = layer.outPoint;
                var tStart = tEnd - fOut;

                levels.setValueAtTime(tStart, currentVal);
                levels.setValueAtTime(tEnd, [minDb, minDb]);
                fadesApplied.push("fadeOut (" + fOut + "s)");
            }

            easeAudioKeys(levels, 75);

            return {
                layerName: layer.name,
                fades: fadesApplied,
                numKeys: levels.numKeys
            };
        });
    }

    function duckAudio(params) {
        return withUndo("Duck Audio", function () {
            if (!params || !params.musicLayer || !params.voiceLayer) {
                throw new Error("musicLayer and voiceLayer references are both required for duckAudio.");
            }
            var comp = findComp(params.compRef);
            var music = findLayer(comp, params.musicLayer);
            var voice = findLayer(comp, params.voiceLayer);
            var levels = getAudioLevelsProp(music);

            var duckDb = params.duckDb !== undefined ? Number(params.duckDb) : -12;
            var rampTime = 0.3;

            var vIn = voice.inPoint;
            var vOut = voice.outPoint;

            var t1 = Math.max(0, vIn - rampTime);
            var t2 = vIn + 0.1;
            var t3 = Math.max(t2, vOut - 0.1);
            var t4 = vOut + rampTime;

            var normalLevel = [0, 0];
            var duckedLevel = [duckDb, duckDb];

            levels.setValueAtTime(t1, normalLevel);
            levels.setValueAtTime(t2, duckedLevel);
            levels.setValueAtTime(t3, duckedLevel);
            levels.setValueAtTime(t4, normalLevel);

            easeAudioKeys(levels, 80);

            return {
                musicLayer: music.name,
                voiceLayer: voice.name,
                duckDb: duckDb,
                duckRange: [vIn, vOut]
            };
        });
    }

    function audioToKeyframes(params) {
        return withUndo("Convert Audio to Keyframes", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for audioToKeyframes.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            // Deselect all layers
            for (var i = 1; i <= comp.numLayers; i++) {
                comp.layer(i).selected = false;
            }
            layer.selected = true;

            var prevNumLayers = comp.numLayers;
            var cmdId = app.findMenuCommandId("Convert Audio to Keyframes");
            if (!cmdId) {
                throw new Error("Menu command 'Convert Audio to Keyframes' could not be resolved.");
            }

            app.executeCommand(cmdId);

            var createdLayer = null;
            if (comp.numLayers > prevNumLayers) {
                createdLayer = comp.layer(1); // AE places newly generated Audio Amplitude layer at index 1
            }

            return {
                sourceLayer: layer.name,
                createdLayer: createdLayer ? createdLayer.name : "Audio Amplitude",
                layerIndex: createdLayer ? createdLayer.index : 1
            };
        });
    }

    function addMarkers(params) {
        return withUndo("Add Markers", function () {
            if (!params || !params.markers || !(params.markers instanceof Array) || params.markers.length === 0) {
                throw new Error("markers array is required for addMarkers.");
            }
            var comp = findComp(params.compRef);
            var targetProp = null;
            var targetName = comp.name;

            if (params.layerRef) {
                var layer = findLayer(comp, params.layerRef);
                targetProp = layer.property("ADBE Marker");
                targetName = layer.name;
            } else {
                targetProp = comp.markerProperty;
            }

            if (!targetProp) {
                throw new Error("Could not access Marker property.");
            }

            var added = [];
            for (var i = 0; i < params.markers.length; i++) {
                var mDef = params.markers[i];
                var mTime = Number(mDef.time);
                var comment = mDef.comment ? String(mDef.comment) : "";
                var mv = new MarkerValue(comment);

                if (mDef.duration !== undefined && Number(mDef.duration) > 0) {
                    mv.duration = Number(mDef.duration);
                }

                targetProp.setValueAtTime(mTime, mv);
                added.push({ time: mTime, comment: comment });
            }

            return {
                target: targetName,
                count: added.length,
                markers: added
            };
        });
    }

    function cutToMarkers(params) {
        return withUndo("Cut Layers to Markers", function () {
            if (!params || !params.layerRefs || !(params.layerRefs instanceof Array) || params.layerRefs.length === 0) {
                throw new Error("layerRefs array is required for cutToMarkers.");
            }
            var comp = findComp(params.compRef);
            var mp = comp.markerProperty;
            if (!mp || mp.numKeys === 0) {
                throw new Error("Composition '" + comp.name + "' has no markers. Add beat or timeline markers first using ae_add_markers.");
            }

            // Collect and sort marker times
            var markerTimes = [];
            for (var k = 1; k <= mp.numKeys; k++) {
                markerTimes.push(mp.keyTime(k));
            }
            markerTimes.sort(function (a, b) { return a - b; });

            var synced = [];
            var numClips = params.layerRefs.length;

            for (var i = 0; i < numClips; i++) {
                var layer = findLayer(comp, params.layerRefs[i]);
                var cutIn = (i < markerTimes.length) ? markerTimes[i] : (synced.length > 0 ? synced[synced.length - 1].outPoint : 0);
                var cutOut = (i + 1 < markerTimes.length) ? markerTimes[i + 1] : (cutIn + 3.0);

                var clipLen = cutOut - cutIn;
                layer.startTime = cutIn;
                layer.inPoint = cutIn;
                layer.outPoint = cutOut;

                synced.push({
                    index: layer.index,
                    name: layer.name,
                    inPoint: cutIn,
                    outPoint: cutOut,
                    duration: clipLen
                });
            }

            return {
                compName: comp.name,
                markerCount: markerTimes.length,
                syncedLayersCount: synced.length,
                layers: synced
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_set_audio_level = setAudioLevel;
    h.setAudioLevel = setAudioLevel;
    h.ae_fade_audio = fadeAudio;
    h.fadeAudio = fadeAudio;
    h.ae_duck_audio = duckAudio;
    h.duckAudio = duckAudio;
    h.ae_audio_to_keyframes = audioToKeyframes;
    h.audioToKeyframes = audioToKeyframes;
    h.ae_add_markers = addMarkers;
    h.addMarkers = addMarkers;
    h.ae_cut_to_markers = cutToMarkers;
    h.cutToMarkers = cutToMarkers;
})();
