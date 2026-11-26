(function () {
    var csInterface = new CSInterface();
    var statusEl = document.getElementById("status");
    var logEl = document.getElementById("log");
    var ws = null;
    var commandLogs = [];
    var isAuthenticated = false;
    var reconnectDelay = 500;
    var heartbeatInterval = null;

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
                var homeDir = (typeof process !== "undefined" && process.env && process.env.AE_BRIDGE_HOME)
                    ? process.env.AE_BRIDGE_HOME
                    : path.join(os.homedir(), ".ae-bridge");
                var tokenPath = path.join(homeDir, "token");
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
    csInterface.evalScript('$.evalFile(File("' + cleanPath + '"))', function (res) {
        addLog("Loaded dispatcher: " + cleanPath);
    });

    function scheduleReconnect() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }

        // Exponential backoff with +/- 20% random jitter
        var jitter = 0.8 + Math.random() * 0.4;
        var actualDelay = Math.round(reconnectDelay * jitter);
        addLog("Reconnecting in " + actualDelay + "ms...");
        setTimeout(connect, actualDelay);
        reconnectDelay = Math.min(5000, reconnectDelay * 2);
    }

    function connect() {
        isAuthenticated = false;
        updateStatus("Connecting...", "#ff9800");

        try {
            ws = new WebSocket("ws://127.0.0.1:8765");
        } catch (e) {
            updateStatus("Disconnected — retrying", "#f44336");
            scheduleReconnect();
            return;
        }

        ws.onopen = function () {
            var token = getAuthToken();
            if (!token) {
                updateStatus("Auth failed: token missing", "#f44336");
                addLog("Auth token missing at ~/.ae-bridge/token");
                try { ws.close(); } catch (e) {}
                scheduleReconnect();
                return;
            }

            updateStatus("Authenticating...", "#ff9800");
            addLog("Sending protocol v2 handshake...");
            try {
                ws.send(JSON.stringify({
                    type: "auth",
                    token: token,
                    protocolVersion: 2,
                    panelVersion: "1.3.0",
                    capabilities: ["executeScript", "ping", "batch", "progress", "cancel"]
                }));
            } catch (eSend) {
                updateStatus("Auth failed: send error", "#f44336");
            }
        };

        ws.onclose = function (evt) {
            if (!isAuthenticated) {
                updateStatus("Disconnected / Auth failed", "#f44336");
            } else {
                updateStatus("Disconnected — retrying", "#f44336");
            }
            isAuthenticated = false;
            addLog("WebSocket closed (" + evt.code + ").");
            scheduleReconnect();
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
                    reconnectDelay = 500; // Reset backoff on success
                    updateStatus("Connected (v" + (data.protocolVersion || 2) + ")", "#4caf50");
                    addLog("✓ Authenticated with server (v" + (data.serverVersion || "1.3.0") + ")");
                    return;
                }

                if (data.type === "auth_failed") {
                    isAuthenticated = false;
                    updateStatus("Auth failed", "#f44336");
                    addLog("✗ Authentication failed: " + (data.error || "Invalid token"));
                    try { ws.close(); } catch (e) {}
                    return;
                }

                // Handle heartbeat ping from server
                if (data.type === "heartbeat_ping") {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(JSON.stringify({
                                type: "heartbeat_pong",
                                timestamp: data.timestamp
                            }));
                        } catch (ePong) {}
                    }
                    return;
                }

                var id = data.id;
                var method = data.method;
                var params = data.params || {};

                addLog("Command: " + method);

                var callStr = 'aeBridge.dispatch("' + method + '","' + encodeURIComponent(JSON.stringify(params)) + '")';

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
                                error: parsed.error,
                                errorName: parsed.errorName,
                                line: parsed.line,
                                file: parsed.file,
                                stack: parsed.stack
                            }));
                        }
                    } catch (e) {
                        addLog("JSON error: " + e.message);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                id: id,
                                ok: false,
                                error: "Failed to parse ExtendScript response: " + e.message
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
