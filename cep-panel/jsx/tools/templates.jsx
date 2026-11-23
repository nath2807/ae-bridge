// Essential Graphics, MOGRT Export, and Batch Versioning Tools for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading templates.jsx");
    }

    // 1. ae_add_to_essential_graphics
    function addToEssentialGraphics(params) {
        return withUndo("Add to Essential Graphics", function () {
            if (!params || !params.layerRef || !params.path) {
                throw new Error("layerRef and property path are required for ae_add_to_essential_graphics.");
            }

            var comp = findComp(params.compRef);
            var layer = findLayer(comp, params.layerRef);
            var prop = resolveProperty(layer, params.path);
            var label = params.label ? String(params.label) : prop.name;

            if (typeof prop.canAddToMotionGraphicsTemplate === "function") {
                if (!prop.canAddToMotionGraphicsTemplate(comp)) {
                    throw new Error("Property '" + prop.name + "' cannot be added to Essential Graphics for comp '" + comp.name + "'.");
                }
            }

            if (typeof prop.addToMotionGraphicsTemplateAs === "function") {
                prop.addToMotionGraphicsTemplateAs(comp, label);
            } else if (typeof prop.addToMotionGraphicsTemplate === "function") {
                prop.addToMotionGraphicsTemplate(comp);
            } else {
                throw new Error("Motion Graphics Template API (addToMotionGraphicsTemplate) is not available in this version of After Effects.");
            }

            return {
                added: true,
                property: prop.name,
                matchName: prop.matchName,
                label: label,
                layerName: layer.name,
                compName: comp.name
            };
        });
    }

    // 2. ae_export_mogrt
    function exportMogrt(params) {
        if (!params || !params.outputPath) {
            throw new Error("outputPath parameter is required for ae_export_mogrt.");
        }

        var comp = findComp(params.compRef);
        var targetFile = new File(cleanPath(params.outputPath));

        if (targetFile.parent && !targetFile.parent.exists) {
            targetFile.parent.create();
        }

        if (typeof comp.exportAsMotionGraphicsTemplate !== "function") {
            throw new Error("exportAsMotionGraphicsTemplate is not supported in this version of After Effects.");
        }

        // Export MOGRT (true = overwrite existing)
        comp.exportAsMotionGraphicsTemplate(true, targetFile);

        return {
            exported: true,
            path: cleanPath(targetFile.fsName),
            compName: comp.name,
            compId: comp.id
        };
    }

    // 3. ae_replace_text_batch
    function replaceTextBatch(params) {
        return withUndo("Batch Replace Text", function () {
            if (!params || !params.replacements || !params.replacements.length) {
                throw new Error("replacements array is required for ae_replace_text_batch.");
            }

            var comp = findComp(params.compRef);
            var updated = [];

            for (var i = 0; i < params.replacements.length; i++) {
                var item = params.replacements[i];
                var layer = findLayer(comp, item.layerRef);

                var sourceTextProp = null;
                try {
                    sourceTextProp = layer.property("Text").property("Source Text");
                } catch (eT) {
                    throw new Error("Layer '" + layer.name + "' is not a text layer or has no Source Text property.");
                }

                if (sourceTextProp) {
                    var doc = sourceTextProp.value;
                    doc.text = String(item.text);
                    sourceTextProp.setValue(doc);

                    updated.push({
                        layerIndex: layer.index,
                        layerName: layer.name,
                        newText: item.text
                    });
                }
            }

            return {
                updated: true,
                count: updated.length,
                compName: comp.name,
                items: updated
            };
        });
    }

    // 4. ae_generate_versions
    function generateVersions(params) {
        return withUndo("Data-Driven Version Generation", function () {
            if (!params || !params.rows || !params.rows.length) {
                throw new Error("rows array is required for ae_generate_versions.");
            }

            var origComp = findComp(params.compRef);
            var versionsFolder = findFolder("Versions — " + origComp.name, true);
            var results = [];

            for (var r = 0; r < params.rows.length; r++) {
                var row = params.rows[r];
                var suffix = row.suffix ? String(row.suffix) : ("v" + (r + 1));
                var dupComp = origComp.duplicate();
                dupComp.name = origComp.name + "_" + suffix;
                dupComp.parentFolder = versionsFolder;

                var changesApplied = [];

                // 1. Apply Text Replacements
                if (row.texts) {
                    for (var lName in row.texts) {
                        if (!row.texts.hasOwnProperty(lName)) continue;
                        try {
                            var tLayer = findLayer(dupComp, { layerName: lName });
                            var stProp = tLayer.property("Text").property("Source Text");
                            var doc = stProp.value;
                            doc.text = String(row.texts[lName]);
                            stProp.setValue(doc);
                            changesApplied.push("Text '" + lName + "' -> '" + row.texts[lName] + "'");
                        } catch (eTxtRow) {}
                    }
                }

                // 2. Apply Color Overrides
                if (row.colors) {
                    for (var cName in row.colors) {
                        if (!row.colors.hasOwnProperty(cName)) continue;
                        try {
                            var cLayer = findLayer(dupComp, { layerName: cName });
                            var newRgb = toColor(row.colors[cName]);

                            if (getLayerType(cLayer) === "text") {
                                var stProp2 = cLayer.property("Text").property("Source Text");
                                var doc2 = stProp2.value;
                                doc2.fillColor = newRgb;
                                doc2.applyFill = true;
                                stProp2.setValue(doc2);
                                changesApplied.push("Color '" + cName + "' -> text fill");
                            } else if (cLayer.source && cLayer.source.mainSource && cLayer.source.mainSource instanceof SolidSource) {
                                cLayer.source.mainSource.color = newRgb;
                                changesApplied.push("Color '" + cName + "' -> solid color");
                            }
                        } catch (eClrRow) {}
                    }
                }

                results.push({
                    suffix: suffix,
                    compId: dupComp.id,
                    compName: dupComp.name,
                    changes: changesApplied
                });
            }

            return {
                folder: versionsFolder.name,
                folderId: versionsFolder.id,
                totalGenerated: results.length,
                versions: results
            };
        });
    }

    // Register handlers
    var h = $.global.aeBridge.handlers;
    h.ae_add_to_essential_graphics = addToEssentialGraphics;
    h.addToEssentialGraphics = addToEssentialGraphics;
    h.ae_export_mogrt = exportMogrt;
    h.exportMogrt = exportMogrt;
    h.ae_replace_text_batch = replaceTextBatch;
    h.replaceTextBatch = replaceTextBatch;
    h.ae_generate_versions = generateVersions;
    h.generateVersions = generateVersions;
})();
