// Video timeline editing and assembly tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading editing.jsx");
    }

    function applyLayerFit(comp, layer, mode) {
        if (!mode || mode === "none" || !layer.source) return;
        var sW = layer.source.width;
        var sH = layer.source.height;
        if (!sW || !sH) return;

        var scX = (comp.width / sW) * 100;
        var scY = (comp.height / sH) * 100;

        var tr = layer.property("ADBE Transform Group");
        var scProp = tr.property("ADBE Scale");

        if (mode === "fit") {
            var uniformFit = Math.min(scX, scY);
            scProp.setValue([uniformFit, uniformFit]);
        } else if (mode === "fill") {
            var uniformFill = Math.max(scX, scY);
            scProp.setValue([uniformFill, uniformFill]);
        } else if (mode === "stretch") {
            scProp.setValue([scX, scY]);
        }

        var posProp = tr.property("ADBE Position");
        posProp.setValue([comp.width / 2, comp.height / 2]);
    }

    function addFootageToComp(params) {
        return withUndo("Add Footage to Comp", function () {
            if (!params || params.itemId === undefined) {
                throw new Error("itemId is required for addFootageToComp.");
            }
            var comp = findComp(params.compRef);
            var item = findItem(params.itemId);

            var layer = comp.layers.add(item);
            var st = params.startTime !== undefined ? Number(params.startTime) : 0;
            layer.startTime = st;

            if (params.inPoint !== undefined) {
                layer.inPoint = Number(params.inPoint);
            }
            if (params.outPoint !== undefined) {
                layer.outPoint = Number(params.outPoint);
            }

            if (params.fit) {
                applyLayerFit(comp, layer, params.fit);
            }

            return {
                compId: comp.id,
                layerIndex: layer.index,
                layerName: layer.name,
                startTime: layer.startTime,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                duration: layer.outPoint - layer.inPoint
            };
        });
    }

    function trimLayer(params) {
        return withUndo("Trim Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for trimLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            if (params.inPoint !== undefined) {
                layer.inPoint = Number(params.inPoint);
            }
            if (params.outPoint !== undefined) {
                layer.outPoint = Number(params.outPoint);
            }

            return layerSummary(layer);
        });
    }

    function splitLayer(params) {
        return withUndo("Split Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for splitLayer.");
            }
            if (params.time === undefined) {
                throw new Error("time parameter is required for splitLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var splitTime = Number(params.time);

            if (splitTime <= layer.inPoint || splitTime >= layer.outPoint) {
                throw new Error("Split time " + splitTime + " must be between layer inPoint (" + layer.inPoint + ") and outPoint (" + layer.outPoint + ").");
            }

            var dup = layer.duplicate();
            layer.outPoint = splitTime;
            dup.inPoint = splitTime;
            try {
                dup.moveAfter(layer);
            } catch (e) {}

            return {
                splitTime: splitTime,
                originalLayer: layerSummary(layer),
                splitLayer: layerSummary(dup)
            };
        });
    }

    function sequenceLayers(params) {
        return withUndo("Sequence Layers", function () {
            if (!params || !params.layerRefs || !(params.layerRefs instanceof Array) || params.layerRefs.length === 0) {
                throw new Error("layerRefs array is required for sequenceLayers.");
            }
            var comp = findComp(params.compRef);
            var curTime = params.startTime !== undefined ? Number(params.startTime) : 0;
            var gap = params.gap !== undefined ? Number(params.gap) : 0;
            var sequenced = [];

            for (var i = 0; i < params.layerRefs.length; i++) {
                var layer = findLayer(comp, params.layerRefs[i]);
                var clipDuration = layer.outPoint - layer.inPoint;
                var inOffset = layer.inPoint - layer.startTime;

                layer.startTime = curTime - inOffset;
                layer.inPoint = curTime;
                layer.outPoint = curTime + clipDuration;

                sequenced.push({
                    index: layer.index,
                    name: layer.name,
                    startTime: layer.startTime,
                    inPoint: layer.inPoint,
                    outPoint: layer.outPoint,
                    duration: clipDuration
                });

                curTime = layer.outPoint + gap;
            }

            return {
                compName: comp.name,
                count: sequenced.length,
                totalDuration: curTime - gap,
                layers: sequenced
            };
        });
    }

    function rippleDelete(params) {
        return withUndo("Ripple Delete Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for rippleDelete.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);

            var delIn = layer.inPoint;
            var delOut = layer.outPoint;
            var gap = delOut - delIn;
            var delIndex = layer.index;
            var delName = layer.name;

            layer.remove();

            var shifted = 0;
            for (var i = 1; i <= comp.numLayers; i++) {
                var other = comp.layer(i);
                if (other.startTime >= delIn) {
                    other.startTime = Math.max(0, other.startTime - gap);
                    shifted++;
                }
            }

            return {
                deletedLayer: delName,
                deletedDuration: gap,
                shiftedLayersCount: shifted
            };
        });
    }

    function fitLayer(params) {
        return withUndo("Fit Layer", function () {
            if (!params || !params.layerRef) {
                throw new Error("layerRef is required for fitLayer.");
            }
            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var mode = params.mode || "fit";

            applyLayerFit(comp, layer, mode);

            var tr = layer.property("ADBE Transform Group");
            return {
                layerName: layer.name,
                mode: mode,
                scale: tr.property("ADBE Scale").value,
                position: tr.property("ADBE Position").value
            };
        });
    }

    function buildEdit(params) {
        return withUndo("Build Timeline Edit", function () {
            if (!params || !params.clips || !(params.clips instanceof Array) || params.clips.length === 0) {
                throw new Error("clips array is required for buildEdit.");
            }
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var comp = null;
            if (params.compRef) {
                comp = findComp(params.compRef);
            } else {
                var compName = params.name ? String(params.name) : "AI Master Edit";
                var width = params.width !== undefined ? Number(params.width) : 1920;
                var height = params.height !== undefined ? Number(params.height) : 1080;
                var fps = params.frameRate !== undefined ? Number(params.frameRate) : 30;

                // Preliminary duration calculation
                var estDur = 0;
                for (var c = 0; c < params.clips.length; c++) {
                    var clipDef = params.clips[c];
                    var item = findItem(clipDef.itemId);
                    var sIn = clipDef.sourceIn !== undefined ? Number(clipDef.sourceIn) : 0;
                    var sOut = clipDef.sourceOut !== undefined ? Number(clipDef.sourceOut) : (item.duration > 0 ? item.duration : 5);
                    var sp = clipDef.speed !== undefined ? Number(clipDef.speed) : 100;
                    var clipLen = (sOut - sIn) * (100 / Math.abs(sp));
                    estDur += clipLen;
                }
                estDur = Math.max(10, estDur + 5);

                comp = app.project.items.addComp(compName, width, height, 1, estDur, fps);
            }

            var placedLayers = [];
            var curTime = 0;

            for (var i = 0; i < params.clips.length; i++) {
                var clip = params.clips[i];
                var media = findItem(clip.itemId);
                var layer = comp.layers.add(media);

                var speed = clip.speed !== undefined ? Number(clip.speed) : 100;
                if (speed !== 100 && speed !== 0) {
                    layer.stretch = (100 / speed) * 100;
                }

                var sIn = clip.sourceIn !== undefined ? Number(clip.sourceIn) : 0;
                var sOut = clip.sourceOut !== undefined ? Number(clip.sourceOut) : (media.duration > 0 ? media.duration : 5);
                var speedMultiplier = 100 / Math.abs(speed);
                var netDur = (sOut - sIn) * speedMultiplier;

                layer.startTime = curTime - (sIn * speedMultiplier);
                layer.inPoint = curTime;
                layer.outPoint = curTime + netDur;

                applyLayerFit(comp, layer, "fit");

                // Transition with previous clip if requested
                if (clip.transition && placedLayers.length > 0) {
                    var prevLayer = placedLayers[placedLayers.length - 1];
                    var transType = clip.transition.type || "crossDissolve";
                    var transDur = clip.transition.duration !== undefined ? Number(clip.transition.duration) : 0.5;

                    try {
                        if ($.global.aeBridge && $.global.aeBridge.handlers && $.global.aeBridge.handlers.addTransition) {
                            $.global.aeBridge.handlers.addTransition({
                                compRef: { compId: comp.id },
                                layerA: { layerIndex: prevLayer.index },
                                layerB: { layerIndex: layer.index },
                                type: transType,
                                duration: transDur
                            });
                        }
                    } catch (transErr) {}
                }

                placedLayers.push(layer);
                curTime = layer.outPoint;
            }

            // Optional background music track
            var musicLayer = null;
            if (params.musicItemId !== undefined) {
                try {
                    var musicItem = findItem(params.musicItemId);
                    musicLayer = comp.layers.add(musicItem);
                    musicLayer.startTime = 0;
                    musicLayer.inPoint = 0;
                    musicLayer.outPoint = curTime;
                    musicLayer.moveToEnd();
                } catch (mErr) {}
            }

            // Adjust final comp duration to fit edit
            comp.duration = Math.max(1, curTime);
            comp.openInViewer();

            return {
                compId: comp.id,
                compName: comp.name,
                duration: comp.duration,
                clipsCount: placedLayers.length,
                hasMusic: !!musicLayer
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_add_footage_to_comp = addFootageToComp;
    h.addFootageToComp = addFootageToComp;
    h.ae_trim_layer = trimLayer;
    h.trimLayer = trimLayer;
    h.ae_split_layer = splitLayer;
    h.splitLayer = splitLayer;
    h.ae_sequence_layers = sequenceLayers;
    h.sequenceLayers = sequenceLayers;
    h.ae_ripple_delete = rippleDelete;
    h.rippleDelete = rippleDelete;
    h.ae_fit_layer = fitLayer;
    h.fitLayer = fitLayer;
    h.ae_build_edit = buildEdit;
    h.buildEdit = buildEdit;
})();
