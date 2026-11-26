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
        var source = String(str);
        var index = 0;

        function skipWhitespace() {
            while (index < source.length && /[\t\n\r ]/.test(source.charAt(index))) index++;
        }

        function parseString() {
            if (source.charAt(index++) !== '"') throw new Error("Expected string");
            var value = "";
            while (index < source.length) {
                var ch = source.charAt(index++);
                if (ch === '"') return value;
                if (ch === "\\") {
                    if (index >= source.length) throw new Error("Unterminated escape");
                    var escaped = source.charAt(index++);
                    if (escaped === '"' || escaped === "\\" || escaped === "/") value += escaped;
                    else if (escaped === "b") value += "\b";
                    else if (escaped === "f") value += "\f";
                    else if (escaped === "n") value += "\n";
                    else if (escaped === "r") value += "\r";
                    else if (escaped === "t") value += "\t";
                    else if (escaped === "u") {
                        var hex = source.substr(index, 4);
                        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("Invalid unicode escape");
                        value += String.fromCharCode(parseInt(hex, 16));
                        index += 4;
                    } else {
                        throw new Error("Invalid escape");
                    }
                } else {
                    if (ch.charCodeAt(0) < 32) throw new Error("Unescaped control character");
                    value += ch;
                }
            }
            throw new Error("Unterminated string");
        }

        function parseValue() {
            skipWhitespace();
            var ch = source.charAt(index);

            if (ch === '"') return parseString();
            if (ch === "{") {
                index++;
                var objectValue = {};
                skipWhitespace();
                if (source.charAt(index) === "}") {
                    index++;
                    return objectValue;
                }
                while (index < source.length) {
                    skipWhitespace();
                    if (source.charAt(index) !== '"') throw new Error("Expected object key");
                    var key = parseString();
                    if (key === "__proto__") throw new Error("Unsupported object key");
                    skipWhitespace();
                    if (source.charAt(index++) !== ":") throw new Error("Expected colon");
                    objectValue[key] = parseValue();
                    skipWhitespace();
                    var objectSeparator = source.charAt(index++);
                    if (objectSeparator === "}") return objectValue;
                    if (objectSeparator !== ",") throw new Error("Expected comma or closing brace");
                }
                throw new Error("Unterminated object");
            }
            if (ch === "[") {
                index++;
                var arrayValue = [];
                skipWhitespace();
                if (source.charAt(index) === "]") {
                    index++;
                    return arrayValue;
                }
                while (index < source.length) {
                    arrayValue.push(parseValue());
                    skipWhitespace();
                    var arraySeparator = source.charAt(index++);
                    if (arraySeparator === "]") return arrayValue;
                    if (arraySeparator !== ",") throw new Error("Expected comma or closing bracket");
                }
                throw new Error("Unterminated array");
            }
            if (source.substr(index, 4) === "true") {
                index += 4;
                return true;
            }
            if (source.substr(index, 5) === "false") {
                index += 5;
                return false;
            }
            if (source.substr(index, 4) === "null") {
                index += 4;
                return null;
            }

            var numberMatch = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.substr(index));
            if (!numberMatch) throw new Error("Invalid value");
            index += numberMatch[0].length;
            return Number(numberMatch[0]);
        }

        var value = parseValue();
        skipWhitespace();
        if (index !== source.length) throw new Error("Unexpected trailing content");
        return value;
    } catch (e) {
        throw new Error("ExtendScript JSON parse error: " + e.toString());
    }
}

$.global.aeStringify = aeStringify;
$.global.aeParse = aeParse;
