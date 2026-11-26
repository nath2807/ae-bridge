import fs from "fs";
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

      case "batch":
      case "ae_batch": {
        const calls = params.calls || [];
        const results = [];
        let successful = 0;
        for (let i = 0; i < calls.length; i++) {
          const item = calls[i];
          const methodName = item.tool || item.method;
          const itemArgs = item.args || item.params || {};
          try {
            const res = this.executeMockMethod(methodName, itemArgs);
            results.push({ tool: methodName, ok: true, result: res });
            successful++;
          } catch (err: any) {
            results.push({ tool: methodName, ok: false, error: err.message });
          }
        }
        return {
          total: results.length,
          successful,
          failed: results.length - successful,
          results
        };
      }

      case "preview_frame":
      case "ae_preview_frame": {
        if (params.outputPath) {
          const dummyPng = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "base64"
          );
          fs.writeFileSync(params.outputPath, dummyPng);
        }
        return {
          outputPath: params.outputPath || "/tmp/preview.png",
          width: 1920,
          height: 1080,
          time: params.time || 0
        };
      }

      case "qa_check":
      case "ae_qa_check":
        return {
          passed: true,
          score: 95,
          issues: [],
          checkedTimes: [0, 2, 4, 6, 8]
        };

      case "undo":
      case "ae_undo":
        return {
          success: true,
          stepsUndone: params.steps || 1
        };

      case "describePropertyTree":
      case "ae_describe_property_tree":
        return {
          layerName: params.layerRef?.layerName || "Mock Layer",
          layerIndex: 1,
          tree: {
            name: "Transform",
            matchName: "ADBE Transform Group",
            propertyType: "NAMED_GROUP",
            depth: 0,
            children: [
              {
                name: "Position",
                matchName: "ADBE Position",
                propertyType: "PROPERTY",
                depth: 1,
                value: [960, 540, 0],
                numKeys: 2,
                hasExpression: false
              }
            ]
          }
        };

      case "exportSceneGraph":
      case "ae_export_scene_graph":
        return {
          version: "1.3",
          comp: {
            id: 1,
            name: "Mock Comp",
            width: 1920,
            height: 1080,
            duration: 10,
            frameRate: 30,
            pixelAspect: 1,
            bgColor: [0, 0, 0],
            numLayers: 2
          },
          layers: [
            {
              index: 1,
              name: "Text Layer",
              type: "text",
              inPoint: 0,
              outPoint: 10,
              transform: { position: [960, 540, 0] },
              text: { content: "Sample Text", fontSize: 80 }
            }
          ]
        };

      case "applySceneGraph":
      case "ae_apply_scene_graph":
        return {
          compId: 42,
          compName: params.scene?.comp?.name || "Reconstructed",
          numLayers: params.scene?.layers?.length || 1,
          success: true
        };

      case "kineticCaptions":
      case "ae_kinetic_captions":
        return {
          compName: "Mock Comp",
          captionCount: params.captions?.length || 1,
          style: params.style || "word_pop",
          createdLayers: [1, 2]
        };

      case "exportMogrt":
      case "ae_export_mogrt":
        return {
          exported: true,
          path: params.outputPath || "mock.mogrt"
        };

      case "generateVersions":
      case "ae_generate_versions":
        return {
          folder: "Versions",
          folderId: 99,
          totalGenerated: params.rows?.length || 1,
          versions: (params.rows || [{ suffix: "v1" }]).map((r: any, idx: number) => ({
            compId: 100 + idx,
            compName: `Comp_${r.suffix}`,
            suffix: r.suffix
          }))
        };

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
