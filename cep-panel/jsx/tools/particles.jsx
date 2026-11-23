// Particle Systems and Atmospheric Simulation Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading particles.jsx");
    }

    var PARTICLE_CATALOG = [
        {
            preset: "dust",
            description: "Cinematic suspended atmospheric micro-dust floating lazily through light shafts",
            particleType: "Faded Sphere",
            physics: "Low-velocity organic drift, zero gravity"
        },
        {
            preset: "sparks",
            description: "High-energy electrical or pyrotechnic sparks bursting and bouncing with bright trails",
            particleType: "Line / Star",
            physics: "High velocity, gravity falloff, explosive trajectory"
        },
        {
            preset: "snow",
            description: "Gentle falling winter snowflakes drifting downward with soft air resistance",
            particleType: "Faded Sphere",
            physics: "Downward directional axis, low velocity, slight turbulence"
        },
        {
            preset: "rain",
            description: "High-speed vertical rain streaks with subtle velocity slant and dense distribution",
            particleType: "Line streaks",
            physics: "High vertical velocity, rapid lifecycle"
        },
        {
            preset: "bokeh",
            description: "Dreamy out-of-focus optical bokeh orbs floating gently in shallow depth of field",
            particleType: "Lens Convex / Bubble",
            physics: "Slow buoyant upward drift, soft opacity blending"
        },
        {
            preset: "embers",
            description: "Rising campfire / furnace embers floating upward with thermal draft turbulence",
            particleType: "Shaded Sphere / Star",
            physics: "Negative gravity (upward draft), fire animation, warm glow"
        },
        {
            preset: "confetti",
            description: "Celebratory multi-colored festive paper flakes tumbling under gravity and air flutter",
            particleType: "QuadPolygon / Cube",
            physics: "Explosive upward launch tumbling down with drag"
        },
        {
            preset: "magicTrail",
            description: "Enchanted particle emitter that dynamically follows a target leader layer",
            particleType: "Star / Shaded Sphere",
            physics: "Position linked via expression to options.followLayer"
        },
        {
            preset: "explosion",
            description: "Shockwave burst of high-velocity fragments exploding outward at a specified keyframe time",
            particleType: "TriPolygon / Star",
            physics: "Burst keyframed at options.time with explosive dispersal"
        },
        {
            preset: "starfield",
            description: "Hyperspace sci-fi warp starfield traveling in 3D Z-depth toward the viewer",
            particleType: "Faded Sphere / Star",
            physics: "High Z-axis velocity, infinite cosmos depth"
        }
    ];

    function safeSet(prop, val) {
        if (!prop) return;
        try {
            prop.setValue(val);
        } catch (e) {}
    }

    function findChild(parent, nameOrMatch) {
        if (!parent) return null;
        try {
            var direct = parent.property(nameOrMatch);
            if (direct) return direct;
        } catch (e1) {}
        if (parent.numProperties !== undefined) {
            for (var i = 1; i <= parent.numProperties; i++) {
                var c = parent.property(i);
                if (c && (c.name === nameOrMatch || c.matchName === nameOrMatch ||
                    c.name.toLowerCase() === nameOrMatch.toLowerCase() ||
                    c.matchName.toLowerCase() === nameOrMatch.toLowerCase())) {
                    return c;
                }
            }
        }
        return null;
    }

    function isEffectInstalled(query) {
        if (!app.effects) return false;
        var q = String(query).toLowerCase();
        for (var i = 0; i < app.effects.length; i++) {
            var fx = app.effects[i];
            if ((fx.displayName && fx.displayName.toLowerCase().indexOf(q) !== -1) ||
                (fx.matchName && fx.matchName.toLowerCase().indexOf(q) !== -1)) {
                return true;
            }
        }
        return false;
    }

    function addParticles(params) {
        return withUndo("Add Particle System", function () {
            if (!params || !params.preset) {
                throw new Error("preset parameter is required for addParticles.");
            }

            var comp = findComp(params.compRef);
            var preset = String(params.preset).toLowerCase();
            var amount = (params.amount !== undefined && !isNaN(Number(params.amount))) ? Number(params.amount) : 1.0;
            amount = Math.max(0.1, Math.min(20.0, amount));
            var startTime = (params.startTime !== undefined && !isNaN(Number(params.startTime))) ? Number(params.startTime) : 0;
            var duration = (params.duration !== undefined && !isNaN(Number(params.duration))) ? Number(params.duration) : (comp.duration - startTime);
            var options = params.options || {};
            var customColor = params.color ? toColor(params.color) : null;

            // Create solid layer dedicated to particles
            var pLayer = comp.layers.addSolid([0, 0, 0], "Particles — " + params.preset, comp.width, comp.height, 1, Math.max(1, duration));
            pLayer.startTime = startTime;
            pLayer.blendingMode = BlendingMode.SCREEN;

            var engineUsed = "CC Particle World";

            // Check if user requested Trapcode Particular and it is installed
            var useParticular = options.preferPlugin === true && (isEffectInstalled("Particular") || isEffectInstalled("TC Particular"));
            var fx = null;

            if (useParticular) {
                try {
                    fx = pLayer.property("ADBE Effect Parade").addProperty("TC Particular");
                    if (!fx) fx = pLayer.property("ADBE Effect Parade").addProperty("Particular");
                    engineUsed = "Trapcode Particular";
                } catch (ePart) {
                    fx = null;
                }
            }

            // Fallback to built-in CC Particle World or CC Particle Systems II
            if (!fx) {
                try {
                    fx = pLayer.property("ADBE Effect Parade").addProperty("CC Particle World");
                    engineUsed = "CC Particle World";
                } catch (ePw) {
                    try {
                        fx = pLayer.property("ADBE Effect Parade").addProperty("CC Particle Systems II");
                        engineUsed = "CC Particle Systems II";
                    } catch (ePs) {
                        throw new Error("Neither CC Particle World nor CC Particle Systems II could be added. Please verify standard CC effects are installed.");
                    }
                }
            }

            // Configure CC Particle World parameters
            if (engineUsed === "CC Particle World") {
                var birthRate = findChild(fx, "Birth Rate");
                var longevity = findChild(fx, "Longevity (sec)");
                var producer = findChild(fx, "Producer");
                var physics = findChild(fx, "Physics");
                var particle = findChild(fx, "Particle");

                // Default birth & longevity
                safeSet(birthRate, 2.0 * amount);
                safeSet(longevity, 3.0);

                if (producer) {
                    safeSet(findChild(producer, "Radius X"), 0.5);
                    safeSet(findChild(producer, "Radius Y"), 0.5);
                    safeSet(findChild(producer, "Radius Z"), 0.5);
                }

                // 1. Dust
                if (preset === "dust") {
                    safeSet(birthRate, 0.4 * amount);
                    safeSet(longevity, 6.0);
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 4); // Viscous
                        safeSet(findChild(physics, "Velocity"), 0.06);
                        safeSet(findChild(physics, "Gravity"), 0.0);
                        safeSet(findChild(physics, "Resistance"), 2.0);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 4); // Faded Sphere
                        safeSet(findChild(particle, "Birth Size"), 0.035);
                        safeSet(findChild(particle, "Death Size"), 0.02);
                        safeSet(findChild(particle, "Birth Color"), customColor || [0.95, 0.92, 0.85]);
                        safeSet(findChild(particle, "Death Color"), [0.8, 0.75, 0.7]);
                    }
                }

                // 2. Sparks
                else if (preset === "sparks") {
                    safeSet(birthRate, 7.0 * amount);
                    safeSet(longevity, 0.5);
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 1); // Explosive
                        safeSet(findChild(physics, "Velocity"), 1.8);
                        safeSet(findChild(physics, "Gravity"), 0.7);
                        safeSet(findChild(physics, "Resistance"), 0.5);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 1); // Line
                        safeSet(findChild(particle, "Birth Size"), 0.08);
                        safeSet(findChild(particle, "Death Size"), 0.01);
                        safeSet(findChild(particle, "Birth Color"), customColor || [1.0, 0.85, 0.3]);
                        safeSet(findChild(particle, "Death Color"), [1.0, 0.25, 0.05]);
                    }
                }

                // 3. Snow
                else if (preset === "snow") {
                    safeSet(birthRate, 3.5 * amount);
                    safeSet(longevity, 5.5);
                    if (producer) {
                        safeSet(findChild(producer, "Position Y"), -0.5); // Spawn from top
                        safeSet(findChild(producer, "Radius X"), 0.8);
                    }
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 2); // Direction Axis
                        safeSet(findChild(physics, "Velocity"), 0.2);
                        safeSet(findChild(physics, "Gravity"), 0.12);
                        safeSet(findChild(physics, "Resistance"), 1.0);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 4); // Faded Sphere
                        safeSet(findChild(particle, "Birth Size"), 0.05);
                        safeSet(findChild(particle, "Death Size"), 0.03);
                        safeSet(findChild(particle, "Birth Color"), customColor || [0.98, 0.98, 1.0]);
                        safeSet(findChild(particle, "Death Color"), [0.9, 0.95, 1.0]);
                    }
                }

                // 4. Rain
                else if (preset === "rain") {
                    safeSet(birthRate, 14.0 * amount);
                    safeSet(longevity, 1.2);
                    if (producer) {
                        safeSet(findChild(producer, "Position Y"), -0.5);
                        safeSet(findChild(producer, "Radius X"), 0.9);
                    }
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 2); // Direction Axis
                        safeSet(findChild(physics, "Velocity"), 2.8);
                        safeSet(findChild(physics, "Gravity"), 3.2);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 1); // Line streaks
                        safeSet(findChild(particle, "Birth Size"), 0.02);
                        safeSet(findChild(particle, "Death Size"), 0.01);
                        safeSet(findChild(particle, "Birth Color"), customColor || [0.75, 0.85, 0.95]);
                        safeSet(findChild(particle, "Death Color"), [0.55, 0.7, 0.9]);
                    }
                }

                // 5. Bokeh
                else if (preset === "bokeh") {
                    safeSet(birthRate, 0.9 * amount);
                    safeSet(longevity, 4.5);
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 4); // Viscous
                        safeSet(findChild(physics, "Velocity"), 0.08);
                        safeSet(findChild(physics, "Gravity"), -0.02); // Buoyant
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 13); // Lens Convex / Bubble
                        safeSet(findChild(particle, "Birth Size"), 0.32);
                        safeSet(findChild(particle, "Death Size"), 0.42);
                        safeSet(findChild(particle, "Max Opacity"), 45);
                        safeSet(findChild(particle, "Birth Color"), customColor || [1.0, 0.8, 0.6]);
                        safeSet(findChild(particle, "Death Color"), [0.7, 0.3, 0.9]);
                    }
                }

                // 6. Embers
                else if (preset === "embers") {
                    safeSet(birthRate, 3.0 * amount);
                    safeSet(longevity, 3.5);
                    if (producer) {
                        safeSet(findChild(producer, "Position Y"), 0.45); // Spawn from bottom
                        safeSet(findChild(producer, "Radius X"), 0.6);
                    }
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 8); // Fire
                        safeSet(findChild(physics, "Velocity"), 0.35);
                        safeSet(findChild(physics, "Gravity"), -0.22); // Rising thermal draft
                        safeSet(findChild(physics, "Resistance"), 1.2);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 5); // Shaded Sphere
                        safeSet(findChild(particle, "Birth Size"), 0.07);
                        safeSet(findChild(particle, "Death Size"), 0.015);
                        safeSet(findChild(particle, "Birth Color"), customColor || [1.0, 0.65, 0.1]);
                        safeSet(findChild(particle, "Death Color"), [0.85, 0.12, 0.02]);
                    }
                }

                // 7. Confetti
                else if (preset === "confetti") {
                    safeSet(birthRate, 5.0 * amount);
                    safeSet(longevity, 4.0);
                    if (producer) {
                        safeSet(findChild(producer, "Position Y"), -0.4);
                        safeSet(findChild(producer, "Radius X"), 0.8);
                    }
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 7); // Vortex / tumbling
                        safeSet(findChild(physics, "Velocity"), 0.9);
                        safeSet(findChild(physics, "Gravity"), 0.35);
                        safeSet(findChild(physics, "Resistance"), 1.5);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 9); // QuadPolygon
                        safeSet(findChild(particle, "Birth Size"), 0.14);
                        safeSet(findChild(particle, "Death Size"), 0.12);
                        safeSet(findChild(particle, "Birth Color"), customColor || [0.95, 0.25, 0.45]);
                        safeSet(findChild(particle, "Death Color"), [0.2, 0.75, 1.0]);
                    }
                }

                // 8. Magic Trail
                else if (preset === "magictrail") {
                    safeSet(birthRate, 5.5 * amount);
                    safeSet(longevity, 1.4);
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 5); // Twirl
                        safeSet(findChild(physics, "Velocity"), 0.15);
                        safeSet(findChild(physics, "Gravity"), 0.0);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 2); // Star
                        safeSet(findChild(particle, "Birth Size"), 0.08);
                        safeSet(findChild(particle, "Death Size"), 0.01);
                        safeSet(findChild(particle, "Birth Color"), customColor || [0.2, 0.95, 1.0]);
                        safeSet(findChild(particle, "Death Color"), [0.85, 0.2, 1.0]);
                    }

                    // Link emitter to options.followLayer if provided
                    if (options.followLayer && producer) {
                        var leader = findLayer(comp, { layerName: options.followLayer });
                        var posX = findChild(producer, "Position X");
                        var posY = findChild(producer, "Position Y");
                        if (posX && leader) {
                            try {
                                posX.expression = 'var tgt = thisComp.layer("' + leader.name + '"); var p = tgt.toComp(tgt.anchorPoint); (p[0] - thisComp.width/2) / thisComp.width;';
                            } catch (eX) {}
                        }
                        if (posY && leader) {
                            try {
                                posY.expression = 'var tgt = thisComp.layer("' + leader.name + '"); var p = tgt.toComp(tgt.anchorPoint); (p[1] - thisComp.height/2) / thisComp.width;';
                            } catch (eY) {}
                        }
                    }
                }

                // 9. Explosion
                else if (preset === "explosion") {
                    var burstTime = options.time !== undefined ? Number(options.time) : startTime;
                    if (birthRate) {
                        try {
                            birthRate.setValueAtTime(Math.max(0, burstTime - 0.05), 0);
                            birthRate.setValueAtTime(burstTime, 45.0 * amount);
                            birthRate.setValueAtTime(burstTime + 0.25, 0);
                        } catch (eExp) {}
                    }
                    safeSet(longevity, 1.5);
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 1); // Explosive
                        safeSet(findChild(physics, "Velocity"), 3.2);
                        safeSet(findChild(physics, "Gravity"), 0.45);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 8); // TriPolygon
                        safeSet(findChild(particle, "Birth Size"), 0.12);
                        safeSet(findChild(particle, "Death Size"), 0.02);
                        safeSet(findChild(particle, "Birth Color"), customColor || [1.0, 0.9, 0.3]);
                        safeSet(findChild(particle, "Death Color"), [0.95, 0.15, 0.05]);
                    }
                }

                // 10. Starfield
                else if (preset === "starfield") {
                    safeSet(birthRate, 6.0 * amount);
                    safeSet(longevity, 4.0);
                    if (producer) {
                        safeSet(findChild(producer, "Radius X"), 0.8);
                        safeSet(findChild(producer, "Radius Y"), 0.8);
                        safeSet(findChild(producer, "Radius Z"), 1.2);
                    }
                    if (physics) {
                        safeSet(findChild(physics, "Animation"), 2); // Direction Axis
                        safeSet(findChild(physics, "Velocity"), 1.8);
                        safeSet(findChild(physics, "Gravity"), 0.0);
                    }
                    if (particle) {
                        safeSet(findChild(particle, "Particle Type"), 4); // Faded Sphere
                        safeSet(findChild(particle, "Birth Size"), 0.02);
                        safeSet(findChild(particle, "Death Size"), 0.06);
                        safeSet(findChild(particle, "Birth Color"), customColor || [0.9, 0.95, 1.0]);
                        safeSet(findChild(particle, "Death Color"), [1.0, 1.0, 1.0]);
                    }
                }

                else {
                    throw new Error("Unknown particle preset: '" + preset + "'. Valid presets: 'dust', 'sparks', 'snow', 'rain', 'bokeh', 'embers', 'confetti', 'magicTrail', 'explosion', 'starfield'.");
                }
            }

            return {
                compName: comp.name,
                layerName: pLayer.name,
                preset: preset,
                engine: engineUsed,
                amount: amount,
                startTime: startTime,
                duration: duration
            };
        });
    }

    function listParticlePresets() {
        return PARTICLE_CATALOG;
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_add_particles = addParticles;
    h.addParticles = addParticles;
    h.ae_list_particle_presets = listParticlePresets;
    h.listParticlePresets = listParticlePresets;
})();
