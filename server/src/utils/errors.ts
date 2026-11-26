/**
 * Structured error returned from After Effects ExtendScript runtime execution.
 */
export class BridgeError extends Error {
  public readonly code?: string;
  public readonly errorName?: string;
  public readonly line?: number;
  public readonly file?: string;
  public readonly stackTrace?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    options?: {
      code?: string;
      errorName?: string;
      line?: number;
      file?: string;
      stackTrace?: string;
      details?: unknown;
    }
  ) {
    const loc = options?.file || options?.line ? ` (${options?.file || "ExtendScript"}:${options?.line || "?"})` : "";
    super(`${message}${loc}`);
    this.name = "BridgeError";
    this.code = options?.code;
    this.errorName = options?.errorName;
    this.line = options?.line;
    this.file = options?.file;
    this.stackTrace = options?.stackTrace;
    this.details = options?.details;

    Object.setPrototypeOf(this, BridgeError.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      errorName: this.errorName,
      line: this.line,
      file: this.file,
      stackTrace: this.stackTrace,
      details: this.details
    };
  }
}
