(function () {
    var csInterface = new CSInterface();
    var statusEl = document.getElementById("status");
    var logEl = document.getElementById("log");
    var ws = null;
    var commandLogs = [];
    var isAuthenticated = false;

    function addLog(text) {
        var time = new Date().toLocaleTimeString();
        commandLogs.unshift("[" + time + "] " + text);
        if (commandLogs.length > 10) {
            commandLogs.pop();
        }

        if (logEl) {
            logEl.innerHTML = "";
            for (var i = 0; i < commandLogs.length; i++) {
                var li = document.createElement("li");
                li.textContent = commandLogs[i];
                logEl.appendChild(li);
            }
        }
    }

    function updateStatus(statusText, color) {
        if (!statusEl) return;
        statusEl.textContent = statusText;
        statusEl.style.color = color || "#ffffff";
    }

    function getAuthToken() {
        try {
            if (typeof require === "function") {
                var fs = require("fs");
                var os = require("os");
                var path = require("path");
                var tokenPath = path.join(os.homedir(), ".ae-bridge", "token");
                if (fs.existsSync(tokenPath)) {
                    return fs.readFileSync(tokenPath, "utf-8").trim();
                }
            }
        } catch (e) {
            console.error("[ae-bridge] Error reading auth token:", e);
        }
        return null;
    }

    // Load ExtendScript dispatcher
    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var cleanPath = extPath.replace(/\\/g, "/") + "/jsx/dispatcher.jsx";
    csInterface.evalScript("$.evalFile(File(" + JSON.stringify(cleanPath) + "))", function (res) {
        addLog("Loaded dispatcher: " + cleanPath);
    });

    function connect() {
        isAuthenticated = false;
        updateStatus("Connecting...", "#ff9800");

        try {
            ws = new WebSocket("ws://127.0.0.1:8765");
        } catch (e) {
            updateStatus("Disconnected — retrying", "#f44336");
            setTimeout(connect, 3000);
            return;
        }

        ws.onopen = function () {
            var token = getAuthToken();
            if (!token) {
                updateStatus("Auth failed: token missing", "#f44336");
                addLog("Auth token missing at ~/.ae-bridge/token");
                try { ws.close(); } catch (e) {}
                setTimeout(connect, 5000);
                return;
            }

            updateStatus("Authenticating...", "#ff9800");
            addLog("Sending auth token to server");
            try {
                ws.send(JSON.stringify({ type: "auth", token: token }));
            } catch (eSend) {
                updateStatus("Auth failed: send error", "#f44336");
            }
        };

        ws.onclose = function () {
            if (!isAuthenticated) {
                updateStatus("Disconnected / Auth failed", "#f44336");
            } else {
                updateStatus("Disconnected — retrying", "#f44336");
            }
            isAuthenticated = false;
            addLog("WebSocket closed. Reconnecting in 3s...");
            setTimeout(connect, 3000);
        };

        ws.onerror = function () {
            updateStatus("Connection error", "#f44336");
        };

        ws.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);

                // Handle authentication handshake response
                if (data.type === "auth_ok") {
                    isAuthenticated = true;
                    updateStatus("Connected", "#4caf50");
                    addLog("✓ Authenticated with server");
                    return;
                }

                if (data.type === "auth_failed") {
                    isAuthenticated = false;
                    updateStatus("Auth failed", "#f44336");
                    addLog("✗ Authentication failed: " + (data.error || "Invalid token"));
                    try { ws.close(); } catch (e) {}
                    return;
                }

                var id = data.id;
                var method = data.method;
                var params = data.params || {};

                addLog("Command: " + method);

                var callStr = "aeBridge.dispatch(" +
                    JSON.stringify(method) + "," +
                    JSON.stringify(encodeURIComponent(JSON.stringify(params))) +
                    ")";

                csInterface.evalScript(callStr, function (rawResult) {
                    if (rawResult === "EvalScript error." || !rawResult) {
                        addLog("EvalScript error on: " + method);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                id: id,
                                ok: false,
                                error: "EvalScript error."
                            }));
                        }
                        return;
                    }

                    try {
                        var parsed = JSON.parse(rawResult);
                        addLog((parsed.ok ? "✓ " : "✗ ") + method);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                id: id,
                                ok: !!parsed.ok,
                                result: parsed.result,
                                error: parsed.error
                            }));
                        }
                    } catch (e) {
                        addLog("JSON error: " + e.message);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                id: id,
                                ok: false,
                                error: "Failed to parse ExtendScript response"
                            }));
                        }
                    }
                });
            } catch (err) {
                addLog("Parse error: " + err.message);
            }
        };
    }

    connect();
})();
