(function () {
    var csInterface = new CSInterface();
    var statusEl = document.getElementById("status");
    var logEl = document.getElementById("log");
    var ws = null;
    var commandLogs = [];

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

    function updateStatus(connected) {
        if (!statusEl) return;
        if (connected) {
            statusEl.textContent = "Connected";
            statusEl.style.color = "#4caf50";
        } else {
            statusEl.textContent = "Disconnected — retrying";
            statusEl.style.color = "#f44336";
        }
    }

    // Load ExtendScript dispatcher
    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var cleanPath = extPath.replace(/\\/g, "/") + "/jsx/dispatcher.jsx";
    csInterface.evalScript('$.evalFile(File("' + cleanPath + '"))', function (res) {
        addLog("Loaded dispatcher: " + cleanPath);
    });

    function connect() {
        updateStatus(false);
        try {
            ws = new WebSocket("ws://127.0.0.1:8765");
        } catch (e) {
            setTimeout(connect, 3000);
            return;
        }

        ws.onopen = function () {
            updateStatus(true);
            addLog("WebSocket connected to MCP server");
        };

        ws.onclose = function () {
            updateStatus(false);
            addLog("WebSocket closed. Reconnecting in 3s...");
            setTimeout(connect, 3000);
        };

        ws.onerror = function () {
            updateStatus(false);
        };

        ws.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);
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
                                error: parsed.error
                            }));
                        }
                    } catch (err) {
                        addLog("Parse error on: " + method);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                id: id,
                                ok: false,
                                error: "Failed to parse ExtendScript response: " + err.message
                            }));
                        }
                    }
                });
            } catch (err) {
                addLog("Invalid message: " + err.message);
            }
        };
    }

    connect();
})();
