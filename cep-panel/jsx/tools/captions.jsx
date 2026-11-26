// Kinetic Typography & Caption Generator for AE Bridge

(function () {
    if (!$.global.aeBridge) {
        throw new Error("aeBridge not initialized before loading captions.jsx");
    }

    function createKineticCaptions(params) {
        if (!params || !params.captions || !(params.captions instanceof Array)) {
            throw new Error("Missing 'captions' array for ae_kinetic_captions.");
        }

        var comp = findComp(params.compRef);
        var captions = params.captions;
        var style = params.style || "word_pop";
        var fontSize = params.fontSize !== undefined ? Number(params.fontSize) : 72;
        var position = (params.position && params.position instanceof Array) ? params.position : [comp.width / 2, comp.height * 0.8];
        var defaultColor = params.fillColor ? toColor(params.fillColor) : [1, 1, 1];
        var highlightColor = params.highlightColor ? toColor(params.highlightColor) : [1, 0.85, 0.2];

        return withUndo("Create Kinetic Captions", function () {
            var createdLayerIndices = [];

            for (var i = 0; i < captions.length; i++) {
                var item = captions[i];
                if (!item || !item.text) continue;

                var textStr = String(item.text).replace(/^\s+|\s+$/g, "");
                var tStart = Number(item.start || 0);
                var tEnd = Number(item.end || (tStart + 1));
                var dur = Math.max(0.1, tEnd - tStart);

                var txtLayer = comp.layers.addText(textStr);
                txtLayer.name = "Caption " + (i + 1) + ": " + textStr.slice(0, 15);
                txtLayer.inPoint = tStart;
                txtLayer.outPoint = tEnd;
                txtLayer.startTime = tStart;

                // Format document
                var textProp = txtLayer.property("Source Text");
                var doc = textProp.value;
                doc.fontSize = fontSize;
                doc.justification = ParagraphJustification.CENTER_JUSTIFY;
                doc.fillColor = item.highlight ? highlightColor : defaultColor;
                textProp.setValue(doc);

                // Set position
                if (txtLayer.transform && txtLayer.transform.position) {
                    txtLayer.transform.position.setValue(position);
                }

                // Apply style animation
                if (style === "word_pop") {
                    // Pop in scale from 0 to 110% to 100%
                    var scaleProp = txtLayer.transform.scale;
                    scaleProp.setValueAtTime(tStart, [0, 0, 100]);
                    scaleProp.setValueAtTime(tStart + 0.1, [115, 115, 100]);
                    scaleProp.setValueAtTime(tStart + 0.2, [100, 100, 100]);
                } else if (style === "bounce") {
                    // Y-bounce down
                    var posProp = txtLayer.transform.position;
                    posProp.setValueAtTime(tStart, [position[0], position[1] - 40]);
                    posProp.setValueAtTime(tStart + 0.15, [position[0], position[1] + 10]);
                    posProp.setValueAtTime(tStart + 0.25, [position[0], position[1]]);
                } else if (style === "typewriter") {
                    // Typewriter range selector
                    var animators = txtLayer.property("Text").property("Animators");
                    var anim = animators.addProperty("ADBE Text Animator");
                    var opac = anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
                    opac.setValue(0);
                    var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
                    var startP = sel.property("ADBE Text Percent Start");
                    startP.setValueAtTime(tStart, 0);
                    startP.setValueAtTime(tStart + Math.min(0.5, dur * 0.8), 100);
                }

                createdLayerIndices.push(txtLayer.index);
            }

            return {
                compName: comp.name,
                captionCount: createdLayerIndices.length,
                style: style,
                createdLayers: createdLayerIndices
            };
        });
    }

    var h = $.global.aeBridge.handlers;
    h.ae_kinetic_captions = createKineticCaptions;
    h.createKineticCaptions = createKineticCaptions;
})();
