// 3D Camera control, cinematography rigs, and camera motion tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading camera.jsx");
    }

    function findOrCreateCamera(comp, cameraRef) {
        if (cameraRef) {
            return findLayer(comp, cameraRef);
        }
        // Look for existing camera in comp
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (l instanceof CameraLayer) {
                return l;
            }
        }
        // Create standard 50mm 3D camera
        var cam = comp.layers.addCamera("Cinema Camera", [comp.width / 2, comp.height / 2]);
        var tr = cam.property("ADBE Transform Group");
        tr.property("ADBE Position").setValue([comp.width / 2, comp.height / 2, -1500]);
        var poi = tr.property("ADBE Point of Interest");
        if (poi) {
            poi.setValue([comp.width / 2, comp.height / 2, 0]);
        }
        return cam;
    }

    function easeKeys(prop, inf) {
        if (!prop || prop.numKeys < 2) return;
        var dim = (prop.isSpatial) ? 1 : ((prop.value instanceof Array) ? prop.value.length : 1);
        var influence = inf !== undefined ? Number(inf) : 75;
        influence = Math.max(0.1, Math.min(100, influence));

        for (var k = 1; k <= prop.numKeys; k++) {
            var inEases = [];
            var outEases = [];
            for (var d = 0; d < dim; d++) {
                inEases.push(new KeyframeEase(0, influence));
                outEases.push(new KeyframeEase(0, influence));
            }
            try {
                prop.setTemporalEaseAtKey(k, inEases, outEases);
            } catch (e) { }
        }
    }

    function createCameraRig(params) {
        return withUndo("Create Camera Rig", function () {
            var comp = findComp(params ? params.compRef : null);
            var cam = findOrCreateCamera(comp, params ? params.cameraRef : null);
            var type = (params && params.type) ? String(params.type).toLowerCase() : "orbitnull";

            var cX = comp.width / 2;
            var cY = comp.height / 2;

            // Create 3D Null controller at center
            var nullLayer = comp.layers.addNull();
            nullLayer.name = "Camera Control (" + cam.name + ")";
            nullLayer.threeDLayer = true;

            var nTr = nullLayer.property("ADBE Transform Group");
            nTr.property("ADBE Position").setValue([cX, cY, 0]);

            // Parent camera to null controller
            cam.parent = nullLayer;

            return {
                compName: comp.name,
                cameraName: cam.name,
                rigControlName: nullLayer.name,
                rigType: type
            };
        });
    }

    function cameraMove(params) {
        return withUndo("Camera Move", function () {
            if (!params || !params.move) {
                throw new Error("move parameter is required (e.g. 'orbit', 'pushIn', 'flyThrough', etc.).");
            }
            var comp = findComp(params.compRef);
            var cam = findOrCreateCamera(comp, params.cameraRef);
            var move = String(params.move).toLowerCase();

            var t0 = params.startTime !== undefined ? Number(params.startTime) : 0;
            var dur = params.duration !== undefined ? Number(params.duration) : 4.0;
            var t1 = t0 + dur;
            var amount = params.amount !== undefined ? Number(params.amount) : 1.0;

            var cX = comp.width / 2;
            var cY = comp.height / 2;

            var camTr = cam.property("ADBE Transform Group");
            var posProp = camTr.property("ADBE Position");
            var poiProp = camTr.property("ADBE Point of Interest");

            var curPos = posProp.value;
            var curX = curPos[0];
            var curY = curPos[1];
            var curZ = curPos[2];

            // 1. Orbit (360 degrees around POI)
            if (move === "orbit" || move === "orbithalf") {
                // If camera has a parent null, rotate the null!
                var rotTarget = (cam.parent && cam.parent.threeDLayer) ? cam.parent.property("ADBE Transform Group") : camTr;
                var rotProp = rotTarget.property("ADBE Rotate Y") || rotTarget.property("ADBE Y Rotation");
                var startRot = rotProp.value;
                var totalDeg = (move === "orbit" ? 360 : 180) * amount;

                rotProp.setValueAtTime(t0, startRot);
                rotProp.setValueAtTime(t1, startRot + totalDeg);
                easeKeys(rotProp, 75);
                return { move: move, target: rotTarget.name, degrees: totalDeg, startTime: t0, duration: dur };
            }

            // 2. Dolly In / Dolly Out
            if (move === "dollyin" || move === "dollyout") {
                var deltaZ = (move === "dollyin" ? 800 : -800) * amount;
                posProp.setValueAtTime(t0, curPos);
                posProp.setValueAtTime(t1, [curX, curY, curZ + deltaZ]);
                easeKeys(posProp, 80);
                return { move: move, camera: cam.name, deltaZ: deltaZ, duration: dur };
            }

            // 3. Truck Left / Truck Right
            if (move === "truckleft" || move === "truckright") {
                var deltaX = (move === "truckleft" ? -600 : 600) * amount;
                posProp.setValueAtTime(t0, curPos);
                posProp.setValueAtTime(t1, [curX + deltaX, curY, curZ]);
                if (poiProp) {
                    var pVal = poiProp.value;
                    poiProp.setValueAtTime(t0, pVal);
                    poiProp.setValueAtTime(t1, [pVal[0] + deltaX, pVal[1], pVal[2]]);
                    easeKeys(poiProp, 75);
                }
                easeKeys(posProp, 75);
                return { move: move, camera: cam.name, deltaX: deltaX, duration: dur };
            }

            // 4. Crane Up / Crane Down
            if (move === "craneup" || move === "cranedown") {
                var deltaY = (move === "craneup" ? -500 : 500) * amount;
                posProp.setValueAtTime(t0, curPos);
                posProp.setValueAtTime(t1, [curX, curY + deltaY, curZ]);
                if (poiProp) {
                    var curPoi = poiProp.value;
                    poiProp.setValueAtTime(t0, curPoi);
                    poiProp.setValueAtTime(t1, [curPoi[0], curPoi[1] + (deltaY * 0.3), curPoi[2]]);
                    easeKeys(poiProp, 75);
                }
                easeKeys(posProp, 75);
                return { move: move, camera: cam.name, deltaY: deltaY, duration: dur };
            }

            // 5. Push In (Slow cinematic subtle push)
            if (move === "pushin") {
                var pushZ = 350 * amount;
                posProp.setValueAtTime(t0, curPos);
                posProp.setValueAtTime(t1, [curX, curY, curZ + pushZ]);
                easeKeys(posProp, 60);
                return { move: "pushIn", camera: cam.name, deltaZ: pushZ, duration: dur };
            }

            // 6. Fly Through (z travel passing through layers)
            if (move === "flythrough") {
                var startZ = -2000 * amount;
                var endZ = 3000 * amount;
                posProp.setValueAtTime(t0, [curX, curY, startZ]);
                posProp.setValueAtTime(t1, [curX, curY, endZ]);
                if (poiProp) {
                    poiProp.setValueAtTime(t0, [curX, curY, startZ + 1500]);
                    poiProp.setValueAtTime(t1, [curX, curY, endZ + 1500]);
                    easeKeys(poiProp, 75);
                }
                easeKeys(posProp, 75);
                return { move: "flyThrough", camera: cam.name, rangeZ: [startZ, endZ], duration: dur };
            }

            // 7. Spiral (Orbit + Dolly + Crane)
            if (move === "spiral") {
                var steps = 12;
                var sRadius = 1500 * amount;
                for (var s = 0; s <= steps; s++) {
                    var frac = s / steps;
                    var tStep = t0 + frac * dur;
                    var angle = frac * Math.PI * 2 * amount;
                    var rNow = sRadius * (1 - frac * 0.4);
                    var sX = cX + Math.sin(angle) * rNow;
                    var sZ = Math.cos(angle) * rNow;
                    var sY = cY - (frac - 0.5) * 400 * amount;
                    posProp.setValueAtTime(tStep, [sX, sY, sZ]);
                }
                if (poiProp) {
                    poiProp.setValue([cX, cY, 0]);
                }
                easeKeys(posProp, 70);
                return { move: "spiral", camera: cam.name, duration: dur };
            }

            // 8. Parallax Drift (Subtle organic float)
            if (move === "parallaxdrift") {
                posProp.setValueAtTime(t0, curPos);
                posProp.setValueAtTime(t0 + dur * 0.4, [curX + 45 * amount, curY - 25 * amount, curZ + 60 * amount]);
                posProp.setValueAtTime(t0 + dur * 0.7, [curX - 30 * amount, curY + 20 * amount, curZ + 120 * amount]);
                posProp.setValueAtTime(t1, [curX + 15 * amount, curY - 10 * amount, curZ + 180 * amount]);
                easeKeys(posProp, 60);
                return { move: "parallaxDrift", camera: cam.name, duration: dur };
            }

            // 9. Dutch Roll (Z-rotation tilt)
            if (move === "dutchroll") {
                var rotZ = camTr.property("ADBE Rotate Z") || camTr.property("ADBE Z Rotation") || camTr.property("Rotation");
                var rollDeg = 15 * amount;
                rotZ.setValueAtTime(t0, -rollDeg);
                rotZ.setValueAtTime(t1, rollDeg);
                easeKeys(rotZ, 75);
                return { move: "dutchRoll", camera: cam.name, tilt: rollDeg, duration: dur };
            }

            // 10. Whip To Target Layer
            if (move === "whipto") {
                var target = null;
                if (params.options && params.options.targetLayer) {
                    target = findLayer(comp, params.options.targetLayer);
                }
                if (!target) {
                    throw new Error("options.targetLayer is required for 'whipTo' camera move.");
                }

                var tgtPos = target.property("ADBE Transform Group").property("ADBE Position").value;
                var tgtZ = tgtPos.length >= 3 ? tgtPos[2] : 0;
                var endCamPos = [tgtPos[0], tgtPos[1], tgtZ - 600];

                posProp.setValueAtTime(t0, curPos);
                posProp.setValueAtTime(t1, endCamPos);
                easeKeys(posProp, 85);

                if (poiProp) {
                    poiProp.setValueAtTime(t0, poiProp.value);
                    poiProp.setValueAtTime(t1, [tgtPos[0], tgtPos[1], tgtZ]);
                    easeKeys(poiProp, 85);
                }
                return { move: "whipTo", camera: cam.name, target: target.name, duration: dur };
            }

            throw new Error("Unknown camera move: '" + params.move + "'. Valid moves: 'orbit', 'orbitHalf', 'dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'craneUp', 'craneDown', 'pushIn', 'flyThrough', 'spiral', 'parallaxDrift', 'dutchRoll', 'whipTo'.");
        });
    }

    function cameraLookAt(params) {
        return withUndo("Camera Look At Target", function () {
            if (!params || !params.targetLayer) {
                throw new Error("targetLayer is required for cameraLookAt.");
            }
            var comp = findComp(params.compRef);
            var cam = findOrCreateCamera(comp, params.cameraRef);
            var target = findLayer(comp, params.targetLayer);

            var poiProp = cam.property("ADBE Transform Group").property("ADBE Point of Interest");
            if (!poiProp) {
                throw new Error("Camera '" + cam.name + "' is a one-node camera and has no Point of Interest.");
            }

            poiProp.expression = "thisComp.layer(" + quoteExpressionString(target.name) + ").transform.position";

            return {
                cameraName: cam.name,
                targetLayer: target.name,
                expression: poiProp.expression
            };
        });
    }

    function setDepthOfField(params) {
        return withUndo("Set Depth of Field", function () {
            var comp = findComp(params ? params.compRef : null);
            var cam = findOrCreateCamera(comp, params ? params.cameraRef : null);

            var camOpts = cam.property("ADBE Camera Options Group") || cam.property("Camera Options");
            if (!camOpts) {
                throw new Error("Camera '" + cam.name + "' has no Camera Options Group.");
            }

            var enabled = params && params.enabled !== undefined ? !!params.enabled : true;
            var dofProp = camOpts.property("ADBE Camera Depth of Field");
            if (dofProp) {
                try { dofProp.setValue(enabled ? 1 : 0); } catch (eDof) {}
            }

            var result = {
                cameraName: cam.name,
                depthOfField: enabled
            };

            // Link focus distance to target layer
            if (params && params.focusLayer) {
                var target = findLayer(comp, params.focusLayer);
                var focusProp = camOpts.property("ADBE Camera Focus Distance");
                if (focusProp) {
                    try {
                        focusProp.expression = "length(transform.position, thisComp.layer(" + quoteExpressionString(target.name) + ").transform.position)";
                        result.focusLayer = target.name;
                        result.focusExpression = focusProp.expression;
                    } catch (eFocus) {}
                }
            }

            // Aperture (controls blur amount)
            if (params && params.aperture !== undefined) {
                var apProp = camOpts.property("ADBE Camera Aperture");
                if (apProp) {
                    try { apProp.setValue(Number(params.aperture)); result.aperture = Number(params.aperture); } catch (eAp) {}
                }
            }

            // Blur level percentage
            if (params && params.blurLevel !== undefined) {
                var blurProp = camOpts.property("ADBE Camera Blur Level");
                if (blurProp) {
                    try { blurProp.setValue(Number(params.blurLevel)); result.blurLevel = Number(params.blurLevel); } catch (eBlur) {}
                }
            }

            return result;
        });
    }

    function addCameraShake(params) {
        return withUndo("Add Camera Shake", function () {
            var comp = findComp(params ? params.compRef : null);
            var cam = findOrCreateCamera(comp, params ? params.cameraRef : null);

            var freq = (params && params.frequency !== undefined) ? Number(params.frequency) : 1.5;
            var amt = (params && params.amount !== undefined) ? Number(params.amount) : 5.0;

            // Apply to parent null if exists, otherwise apply to camera position
            var target = (cam.parent && cam.parent.threeDLayer) ? cam.parent : cam;
            var posProp = target.property("ADBE Transform Group").property("ADBE Position");

            posProp.expression = 'wiggle(' + freq + ', ' + amt + ');';

            return {
                targetName: target.name,
                frequency: freq,
                amount: amt,
                expression: posProp.expression
            };
        });
    }

    // Register on aeBridge.handlers
    var h = $.global.aeBridge.handlers;
    h.ae_camera_rig = createCameraRig;
    h.createCameraRig = createCameraRig;
    h.ae_camera_move = cameraMove;
    h.cameraMove = cameraMove;
    h.ae_camera_look_at = cameraLookAt;
    h.cameraLookAt = cameraLookAt;
    h.ae_set_depth_of_field = setDepthOfField;
    h.setDepthOfField = setDepthOfField;
    h.ae_add_camera_shake = addCameraShake;
    h.addCameraShake = addCameraShake;
})();
