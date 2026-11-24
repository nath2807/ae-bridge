// Director Layer: Automated Storyboard Assembly and Scene Rebuilding for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading director.jsx");
    }

    var TRANSITION_MAPPING = {
        "fade": "crossDissolve",
        "crossfade": "crossDissolve",
        "dissolve": "crossDissolve",
        "flash": "dipToWhite",
        "dipwhite": "dipToWhite",
        "black": "dipToBlack",
        "dipblack": "dipToBlack",
        "slideleft": "slideLeft",
        "slideright": "slideRight",
        "slideup": "pushUp",
        "slidedown": "pushUp",
        "push": "pushUp",
        "zoom": "zoomIn",
        "zoomin": "zoomIn",
        "zoomblur": "zoomBlur",
        "wipe": "linearWipe",
        "linearwipe": "linearWipe",
        "radialwipe": "radialWipe",
        "glitch": "glitchCut",
        "glitchcut": "glitchCut",
        "whip": "whipPan",
        "whippan": "whipPan",
        "pop": "zoomIn"
    };

    function mapTransition(typeStr) {
        if (!typeStr) return "crossDissolve";
        var norm = String(typeStr).toLowerCase().replace(/[^a-z]/g, "");
        return TRANSITION_MAPPING[norm] || "crossDissolve";
    }

    function buildStoryboard(params) {
        return withUndo("Build Storyboard Video", function () {
            if (!params || !params.storyboard) {
                throw new Error("Missing storyboard specification in parameters.");
            }
            if (!app.project) {
                throw new Error("No active After Effects project found.");
            }

            var sb = params.storyboard;
            var width = sb.width !== undefined ? Number(sb.width) : 1920;
            var height = sb.height !== undefined ? Number(sb.height) : 1080;
            var frameRate = sb.frameRate !== undefined ? Number(sb.frameRate) : 30;
            var scenes = (sb.scenes && sb.scenes instanceof Array) ? sb.scenes : [];

            if (scenes.length === 0) {
                throw new Error("Storyboard must contain at least one scene in 'scenes' array.");
            }

            var compName = params.compName ? String(params.compName) : (sb.title || "Storyboard Comp");
            var brandKit = params.brandKit || null;
            var h = $.global.aeBridge.handlers;

            // 1. Calculate approximate timeline duration
            var totalDuration = 0;
            for (var d = 0; d < scenes.length; d++) {
                var sDur = Number(scenes[d].duration) || 5;
                var tDur = (d > 0 && scenes[d].transitionIn && scenes[d].transitionIn.duration)
                    ? Number(scenes[d].transitionIn.duration)
                    : 0;
                totalDuration += Math.max(0.5, sDur - tDur);
            }
            totalDuration = Math.max(2.0, totalDuration + 1.0);

            // 2. Create Master Timeline Composition
            var mainComp = app.project.items.addComp(compName, width, height, 1, totalDuration, frameRate);
            mainComp.openInViewer();

            var scenesFolder = findFolder("Scenes", true);
            var sceneMap = [];
            var sceneLayers = [];
            var currentTime = 0;

            // 3. Construct each scene precomp and arrange on main timeline
            for (var i = 0; i < scenes.length; i++) {
                var scene = scenes[i];
                var sDuration = Number(scene.duration) || 5.0;
                var sType = String(scene.type || "title");
                var sIndexPadded = ("0" + (i + 1)).slice(-2);
                var sceneCompName = sIndexPadded + " — " + sType.charAt(0).toUpperCase() + sType.slice(1);
                var content = scene.content || {};

                var sceneComp = null;

                // Re-use existing JSX handlers by scene type
                if (sType === "blender3d") {
                    sceneComp = app.project.items.addComp(sceneCompName, width, height, 1, sDuration, frameRate);
                    if (content.colorFirstFrame && h.ae_import_blender_render) {
                        try {
                            h.ae_import_blender_render({
                                compRef: { compId: sceneComp.id },
                                colorFirstFrame: content.colorFirstFrame,
                                depthFirstFrame: content.depthFirstFrame,
                                cameraData: content.cameraData,
                                fps: frameRate,
                                addDepthPass: content.addDepthPass !== false,
                                syncCamera: content.syncCamera !== false
                            });
                        } catch (eBld) {}
                    }
                } else if ((sType === "title" || sType === "quote" || sType === "endCard") && h.ae_create_title_card) {
                    var cardRes = h.ae_create_title_card({
                        compName: sceneCompName,
                        width: width,
                        height: height,
                        duration: sDuration,
                        frameRate: frameRate,
                        title: content.text || (sType === "quote" ? "Inspiring Quote" : "Title"),
                        subtitle: content.subtitle || "",
                        preset: content.preset || "blurReveal",
                        style: content.style || (brandKit ? brandKit.style : "minimal"),
                        bgColor: brandKit ? brandKit.colors.background : undefined,
                        titleColor: brandKit ? brandKit.colors.text : undefined,
                        accentColor: brandKit ? brandKit.colors.accent : undefined
                    });
                    sceneComp = findItem(cardRes.compId);
                } else if (sType === "lowerThird" && h.ae_create_lower_third) {
                    var ltRes = h.ae_create_lower_third({
                        compName: sceneCompName,
                        width: width,
                        height: height,
                        duration: sDuration,
                        frameRate: frameRate,
                        name: content.text || "Full Name",
                        title: content.subtitle || "Title / Role",
                        preset: content.preset || "cleanBox",
                        style: content.style || "tech",
                        primaryColor: brandKit ? brandKit.colors.text : undefined,
                        accentColor: brandKit ? brandKit.colors.accent : undefined
                    });
                    sceneComp = findItem(ltRes.compId);
                } else if (sType === "3dText" && h.ae_create_3d_text) {
                    var t3dRes = h.ae_create_3d_text({
                        compName: sceneCompName,
                        width: width,
                        height: height,
                        duration: sDuration,
                        frameRate: frameRate,
                        text: content.text || "3D TITLE",
                        color: brandKit ? brandKit.colors.primary : undefined,
                        lighting: "dramatic",
                        cameraMove: "pushIn"
                    });
                    sceneComp = findItem(t3dRes.compId);
                } else if (sType === "3dScene" && h.ae_create_3d_scene) {
                    var s3dRes = h.ae_create_3d_scene({
                        compName: sceneCompName,
                        width: width,
                        height: height,
                        duration: sDuration,
                        frameRate: frameRate,
                        preset: content.style || content.preset || "infiniteTunnel"
                    });
                    sceneComp = findItem(s3dRes.compId);
                } else if (sType === "background" && h.ae_create_background) {
                    sceneComp = app.project.items.addComp(sceneCompName, width, height, 1, sDuration, frameRate);
                    h.ae_create_background({
                        compRef: { compId: sceneComp.id },
                        type: content.style || content.preset || "aurora",
                        duration: sDuration,
                        colors: brandKit ? {
                            primary: brandKit.colors.primary,
                            secondary: brandKit.colors.secondary,
                            accent: brandKit.colors.accent,
                            background: brandKit.colors.background
                        } : undefined
                    });
                } else if (sType === "footage") {
                    sceneComp = app.project.items.addComp(sceneCompName, width, height, 1, sDuration, frameRate);
                    if (content.itemId && h.ae_add_footage_to_comp) {
                        h.ae_add_footage_to_comp({
                            compRef: { compId: sceneComp.id },
                            itemId: Number(content.itemId),
                            startTime: 0,
                            inPoint: content.sourceIn || 0,
                            duration: sDuration,
                            fit: "fill"
                        });
                    } else if (content.path && h.ae_import_files && h.ae_add_footage_to_comp) {
                        var impRes = h.ae_import_files({ paths: [cleanPath(content.path)] });
                        if (impRes && impRes.files && impRes.files.length) {
                            h.ae_add_footage_to_comp({
                                compRef: { compId: sceneComp.id },
                                itemId: impRes.files[0].id,
                                duration: sDuration,
                                fit: "fill"
                            });
                        }
                    }
                } else if (sType === "counter") {
                    sceneComp = app.project.items.addComp(sceneCompName, width, height, 1, sDuration, frameRate);
                    var bgC = brandKit ? toColor(brandKit.colors.background) : [0.03, 0.03, 0.05];
                    sceneComp.layers.addSolid(bgC, "BG Solid", width, height, 1, sDuration);
                    var cntLayer = sceneComp.layers.addText(content.text || "0");
                    cntLayer.name = "Counter Display";
                    if (h.ae_apply_rig) {
                        try {
                            h.ae_apply_rig({
                                compRef: { compId: sceneComp.id },
                                layerRef: { layerIndex: cntLayer.index },
                                name: "counter",
                                options: { endValue: 1000000, duration: sDuration * 0.8, prefix: "$" }
                            });
                        } catch (eCnt) {}
                    }
                } else {
                    // Generic default text / title scene
                    sceneComp = app.project.items.addComp(sceneCompName, width, height, 1, sDuration, frameRate);
                    var bgDef = brandKit ? toColor(brandKit.colors.background) : [0.02, 0.025, 0.04];
                    sceneComp.layers.addSolid(bgDef, "BG Canvas", width, height, 1, sDuration);
                    var defTxt = sceneComp.layers.addText(content.text || sceneCompName);
                    if (content.preset && h.ae_apply_title_preset) {
                        try {
                            h.ae_apply_title_preset({
                                compRef: { compId: sceneComp.id },
                                layerRef: { layerIndex: defTxt.index },
                                presetName: content.preset
                            });
                        } catch (ePres) {}
                    }
                }

                if (!sceneComp) {
                    sceneComp = app.project.items.addComp(sceneCompName, width, height, 1, sDuration, frameRate);
                }

                sceneComp.parentFolder = scenesFolder;

                // 4. Apply scene effects (particles, looks, light sweeps, rigs, distortions)
                if (scene.effects && scene.effects instanceof Array) {
                    for (var e = 0; e < scene.effects.length; e++) {
                        var eff = scene.effects[e];
                        try {
                            if (eff.kind === "look" && h.ae_apply_look) {
                                h.ae_apply_look({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                            } else if (eff.kind === "particles" && h.ae_add_particles) {
                                h.ae_add_particles({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                            } else if (eff.kind === "lightEffect" && h.ae_add_light_effect) {
                                h.ae_add_light_effect({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                            } else if (eff.kind === "rig" && h.ae_apply_rig) {
                                h.ae_apply_rig({ compRef: { compId: sceneComp.id }, layerRef: { layerIndex: 1 }, name: eff.name, options: eff.options });
                            } else if (eff.kind === "distortion" && h.ae_apply_distortion) {
                                h.ae_apply_distortion({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                            }
                        } catch (eEff) {}
                    }
                }

                // 5. Add scene precomp layer onto master composition timeline
                var sceneLayer = mainComp.layers.add(sceneComp);
                sceneLayer.name = sceneCompName;
                sceneLayer.startTime = currentTime;
                sceneLayer.inPoint = currentTime;
                sceneLayer.outPoint = currentTime + sDuration;

                // 6. Handle Transition In between consecutive scenes
                var transOverlap = 0;
                if (i > 0 && scene.transitionIn && sceneLayers.length > 0) {
                    var prevLayer = sceneLayers[sceneLayers.length - 1];
                    var transDur = scene.transitionIn.duration !== undefined
                        ? Number(scene.transitionIn.duration)
                        : 0.5;

                    transOverlap = Math.min(transDur, Math.min(sDuration * 0.5, prevLayer.outPoint - prevLayer.inPoint));
                    if (transOverlap > 0) {
                        sceneLayer.startTime = Math.max(0, sceneLayer.startTime - transOverlap);
                        sceneLayer.inPoint = sceneLayer.startTime;
                        sceneLayer.outPoint = sceneLayer.startTime + sDuration;

                        var transType = mapTransition(scene.transitionIn.type);
                        if (h.ae_add_transition) {
                            try {
                                h.ae_add_transition({
                                    compRef: { compId: mainComp.id },
                                    layerA: { layerIndex: prevLayer.index },
                                    layerB: { layerIndex: sceneLayer.index },
                                    type: transType,
                                    duration: transOverlap
                                });
                            } catch (eTr) {}
                        }
                    }
                }

                currentTime = sceneLayer.outPoint;
                sceneLayers.push(sceneLayer);

                sceneMap.push({
                    index: i,
                    type: sType,
                    compName: sceneComp.name,
                    compId: sceneComp.id,
                    duration: sDuration,
                    startTime: sceneLayer.startTime,
                    outPoint: sceneLayer.outPoint
                });
            }

            // Adjust main comp duration to fit exact final scene outPoint
            mainComp.duration = Math.max(1.0, currentTime);

            // 7. Add Sound / Music & Beat Sync if requested
            if (sb.music) {
                var musicItem = null;
                if (sb.music.itemId) {
                    try { musicItem = findItem(sb.music.itemId); } catch (eM1) {}
                } else if (sb.music.path && h.ae_import_files) {
                    try {
                        var impM = h.ae_import_files({ paths: [cleanPath(sb.music.path)] });
                        if (impM && impM.files && impM.files.length) {
                            musicItem = findItem(impM.files[0].id);
                        }
                    } catch (eM2) {}
                }

                if (musicItem) {
                    var musicLayer = mainComp.layers.add(musicItem);
                    musicLayer.moveToEnd();
                    musicLayer.startTime = 0;
                    musicLayer.inPoint = 0;
                    musicLayer.outPoint = mainComp.duration;

                    if (sb.music.beatSync && h.ae_detect_beats) {
                        try {
                            h.ae_detect_beats({
                                compRef: { compId: mainComp.id },
                                layerRef: { layerIndex: musicLayer.index },
                                addMarkers: true
                            });
                        } catch (eBeat) {}
                    }

                    if (sb.music.fadeOut && h.ae_fade_audio) {
                        try {
                            h.ae_fade_audio({
                                compRef: { compId: mainComp.id },
                                layerRef: { layerIndex: musicLayer.index },
                                type: "out",
                                duration: Number(sb.music.fadeOut)
                            });
                        } catch (eFade) {}
                    }
                }
            }

            // 8. Apply Global Composition Look
            if (sb.look && h.ae_apply_look) {
                try {
                    h.ae_apply_look({ compRef: { compId: mainComp.id }, name: sb.look });
                } catch (eLook) {}
            }

            // Apply broadcast quality defaults across master comp and scene precomps
            if ($.global.applyQualityDefaults) {
                try {
                    $.global.applyQualityDefaults(mainComp);
                    for (var sIdx = 0; sIdx < sceneMap.length; sIdx++) {
                        var sc = findComp({ compId: sceneMap[sIdx].compId });
                        if (sc) $.global.applyQualityDefaults(sc);
                    }
                } catch (eQd) {}
            }

            // 9. Automated QA Check
            var qaSummary = null;
            if (h.ae_qa_check) {
                try {
                    qaSummary = h.ae_qa_check({ compRef: { compId: mainComp.id } });
                } catch (eQa) {}
            }

            // 10. Persist Project Checkpoint / Save
            if (h.ae_save_project) {
                try { h.ae_save_project(); } catch (eSave) {}
            }

            return {
                compId: mainComp.id,
                compName: mainComp.name,
                width: mainComp.width,
                height: mainComp.height,
                duration: mainComp.duration,
                frameRate: mainComp.frameRate,
                numScenes: scenes.length,
                sceneMap: sceneMap,
                qa: qaSummary
            };
        });
    }

    function updateScene(params) {
        return withUndo("Update Storyboard Scene", function () {
            if (!params || params.sceneIndex === undefined) {
                throw new Error("sceneIndex is required for updateScene.");
            }
            if (!params.changes) {
                throw new Error("changes object is required for updateScene.");
            }

            var comp = findComp(params.compRef);
            var sceneIndex = Number(params.sceneIndex);
            var changes = params.changes;

            // Search for target scene layer in comp (1-based index: 01, 02...)
            var padIndex = ("0" + (sceneIndex + 1)).slice(-2);
            var targetSceneLayer = null;

            for (var i = 1; i <= comp.numLayers; i++) {
                var l = comp.layer(i);
                if (l.name.indexOf(padIndex) === 0 || l.name.indexOf(" " + padIndex) !== -1) {
                    targetSceneLayer = l;
                    break;
                }
            }

            if (!targetSceneLayer) {
                if (sceneIndex >= 0 && sceneIndex < comp.numLayers) {
                    targetSceneLayer = comp.layer(comp.numLayers - sceneIndex);
                }
            }

            if (!targetSceneLayer || !targetSceneLayer.source || !(targetSceneLayer.source instanceof CompItem)) {
                throw new Error("Could not locate scene precomp layer for sceneIndex " + sceneIndex);
            }

            var sceneComp = targetSceneLayer.source;
            var h = $.global.aeBridge.handlers;

            if (changes.content) {
                if (changes.content.text) {
                    for (var t = 1; t <= sceneComp.numLayers; t++) {
                        var ly = sceneComp.layer(t);
                        if (ly instanceof TextLayer) {
                            var srcText = ly.property("Source Text");
                            if (srcText) srcText.setValue(changes.content.text);
                            break;
                        }
                    }
                }
            }

            if (changes.effects && changes.effects instanceof Array) {
                for (var e = 0; e < changes.effects.length; e++) {
                    var eff = changes.effects[e];
                    try {
                        if (eff.kind === "look" && h.ae_apply_look) {
                            h.ae_apply_look({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                        } else if (eff.kind === "particles" && h.ae_add_particles) {
                            h.ae_add_particles({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                        } else if (eff.kind === "lightEffect" && h.ae_add_light_effect) {
                            h.ae_add_light_effect({ compRef: { compId: sceneComp.id }, name: eff.name, options: eff.options });
                        }
                    } catch (eEff) {}
                }
            }

            return {
                updated: true,
                sceneIndex: sceneIndex,
                sceneCompId: sceneComp.id,
                sceneCompName: sceneComp.name
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_build_storyboard = buildStoryboard;
    h.buildStoryboard = buildStoryboard;
    h.ae_update_scene = updateScene;
    h.updateScene = updateScene;
})();
