// Original minimal JSON serializer and parser for ExtendScript (ECMAScript 3)

function aeEscapeString(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        var code = str.charCodeAt(i);
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 32 || code >= 127) {
            var hex = code.toString(16);
            while (hex.length < 4) hex = "0" + hex;
            out += "\\u" + hex;
        } else {
            out += ch;
        }
    }
    return '"' + out + '"';
}

function aeStringify(value, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 20) return "null";

    if (value === null || value === undefined) {
        return "null";
    }

    var t = typeof value;
    if (t === "boolean") {
        return value ? "true" : "false";
    }
    if (t === "number") {
        if (isNaN(value) || !isFinite(value)) {
            return "null";
        }
        return String(value);
    }
    if (t === "string") {
        return aeEscapeString(value);
    }
    if (t === "function") {
        return undefined;
    }

    if (value instanceof Array) {
        var items = [];
        for (var i = 0; i < value.length; i++) {
            var itemStr = aeStringify(value[i], depth + 1);
            items.push(itemStr === undefined ? "null" : itemStr);
        }
        return "[" + items.join(",") + "]";
    }

    if (t === "object") {
        var entries = [];
        for (var key in value) {
            if (value.hasOwnProperty(key)) {
                var valStr = aeStringify(value[key], depth + 1);
                if (valStr !== undefined) {
                    entries.push(aeEscapeString(String(key)) + ":" + valStr);
                }
            }
        }
        return "{" + entries.join(",") + "}";
    }

    return "null";
}

function aeParse(str) {
    try {
        return eval("(" + str + ")");
    } catch (e) {
        throw new Error("ExtendScript JSON parse error: " + e.toString());
    }
}

$.global.aeStringify = aeStringify;
$.global.aeParse = aeParse;
