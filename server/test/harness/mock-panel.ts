import { WebSocket } from "ws";

export interface MockComp {
  id: number;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  duration: number;
  numLayers: number;
  layers: any[];
}

export interface MockAEState {
  projectName: string;
  projectFile: string | null;
  aeVersion: string;
  comps: MockComp[];
  renderQueue: any[];
}

export class MockAEPanel {
  public ws: WebSocket | null = null;
  public state: MockAEState;
  public latencyMs = 0;
  public errorOverrides = new Map<string, { message: string; name?: string; line?: number; file?: string }>();
  public receivedCalls: Array<{ method: string; params: any }> = [];
  private isConnected = false;

  constructor() {
    this.state = this.getDefaultState();
  }

  public getDefaultState(): MockAEState {
    return {
      projectName: "MockProject.aep",
      projectFile: "C:/Projects/MockProject.aep",
      aeVersion: "24.5.0",
      comps: [
        {
          id: 1,
          name: "MainComp",
          width: 1920,
          height: 1080,
          frameRate: 30,
          duration: 10,
          numLayers: 2,
          layers: [
            { index: 1, name: "Title Layer", matchName: "ADBE Text Layer", enabled: true },
            { index: 2, name: "Background Solid", matchName: "ADBE AV Layer", enabled: true }
          ]
        }
      ],
      renderQueue: []
    };
  }

  public reset(): void {
    this.state = this.getDefaultState();
    this.errorOverrides.clear();
    this.receivedCalls = [];
    this.latencyMs = 0;
  }

  public setError(method: string, error: { message: string; name?: string; line?: number; file?: string }): void {
    this.errorOverrides.set(method, error);
  }

  public clearError(method: string): void {
    this.errorOverrides.delete(method);
  }

  public async connect(port = 8765, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${port}`);

      this.ws.on("open", () => {
        // Send protocol v2 handshake
        this.ws!.send(
          JSON.stringify({
            type: "auth",
            token,
            protocolVersion: 2,
            panelVersion: "1.3.0",
            capabilities: ["executeScript", "ping", "batch", "progress", "cancel"]
          })
        );
      });

      this.ws.on("message", (raw: string | Buffer) => {
        try {
          const payload = JSON.parse(raw.toString());

          if (payload.type === "auth_ok") {
            this.isConnected = true;
            resolve();
            return;
          }

          if (payload.type === "auth_failed") {
            reject(new Error(`Mock panel auth failed: ${payload.error}`));
            return;
          }

          // Handle server heartbeat ping
          if (payload.type === "heartbeat_ping") {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: "heartbeat_pong",
                timestamp: payload.timestamp
              }));
            }
            return;
          }

          // Handle ExtendScript RPC call
          if (payload.id && payload.method) {
            this.handleMethodCall(payload.id, payload.method, payload.params || {});
          }
        } catch (err) {
          console.error("[MockPanel] Error handling message:", err);
        }
      });

      this.ws.on("error", (err) => {
        if (!this.isConnected) reject(err);
      });

      this.ws.on("close", () => {
        this.isConnected = false;
      });
    });
  }

  private handleMethodCall(id: string, method: string, params: any): void {
    this.receivedCalls.push({ method, params });

    const respond = () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Check simulated error override (with or without 'ae_' prefix)
      const errorKey = this.errorOverrides.has(method)
        ? method
        : (method.startsWith("ae_") && this.errorOverrides.has(method.replace(/^ae_/, "")))
          ? method.replace(/^ae_/, "")
          : null;

      if (errorKey) {
        const err = this.errorOverrides.get(errorKey)!;
        this.ws.send(
          JSON.stringify({
            id,
            ok: false,
            error: err.message,
            errorName: err.name || "ExtendScriptError",
            line: err.line || 42,
            file: err.file || "mock.jsx"
          })
        );
        return;
      }

      // Execute mock method
      const result = this.executeMockMethod(method, params);
      this.ws.send(
        JSON.stringify({
          id,
          ok: true,
          result
        })
      );
    };

    if (this.latencyMs > 0) {
      setTimeout(respond, this.latencyMs);
    } else {
      respond();
    }
  }

  private executeMockMethod(method: string, params: any): any {
    switch (method) {
      case "ping":
      case "ae_ping":
        return {
          aeVersion: this.state.aeVersion,
          projectName: this.state.projectName,
          numItems: this.state.comps.length
        };

      case "getProjectInfo":
      case "get_project_info":
      case "ae_list_comps":
        return this.state.comps;

      case "getComp":
      case "get_comp":
      case "ae_get_comp": {
        const compRefName = params.compRef?.compName || (typeof params.compRef === "string" ? params.compRef : null);
        const compRefId = params.compRef?.compId || (typeof params.compRef === "number" ? params.compRef : null);
        const comp = this.state.comps.find((c) => (compRefName && c.name === compRefName) || (compRefId && c.id === compRefId)) || this.state.comps[0];
        return comp || { id: 1, name: "DefaultComp", width: 1920, height: 1080, frameRate: 30, duration: 10, numLayers: 0 };
      }

      case "createComp":
      case "create_comp":
      case "ae_create_comp": {
        const newComp: MockComp = {
          id: this.state.comps.length + 1,
          name: params.name || `Comp ${this.state.comps.length + 1}`,
          width: params.width || 1920,
          height: params.height || 1080,
          frameRate: params.frameRate || 30,
          duration: params.duration || 10,
          numLayers: 0,
          layers: []
        };
        this.state.comps.push(newComp);
        return newComp;
      }

      case "addLayer":
      case "createTextLayer":
      case "createSolidLayer": {
        const comp = this.state.comps[0];
        comp.numLayers += 1;
        const newLayer = {
          index: comp.numLayers,
          name: params.text || params.name || `Layer ${comp.numLayers}`,
          enabled: true
        };
        comp.layers.push(newLayer);
        return { success: true, layer: newLayer };
      }

      case "ae_render":
      case "renderComp":
        return {
          rendered: true,
          outputPath: params.outputPath || "C:/Renders/mock.mp4",
          preset: params.preset || "mp4High",
          duration: 10,
          templateUsed: "AE Bridge H264 High"
        };

      case "executeScript":
        return params.code ? `Mock execution of: ${params.code.slice(0, 30)}` : "ok";

      default:
        // Generic fallback returning mock success for all other ae_* tools
        return {
          success: true,
          method,
          params
        };
    }
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close(1000, "Mock panel shutdown");
      } catch {}
      this.ws = null;
      this.isConnected = false;
    }
  }
}
