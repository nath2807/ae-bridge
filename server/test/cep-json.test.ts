import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function createParser(): (value: string) => unknown {
  const context: { $: { global: Record<string, unknown> } } = { $: { global: {} } };
  const source = readFileSync(new URL("../../cep-panel/jsx/json.jsx", import.meta.url), "utf8");
  runInNewContext(source, context);
  return context.$.global.aeParse as (value: string) => unknown;
}

describe("CEP JSON parser", () => {
  it("parses JSON data while preserving script-looking string values", () => {
    const parse = createParser();
    const scriptLikeValue = '"); app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); //';
    expect(parse(JSON.stringify({ value: scriptLikeValue }))).toEqual({ value: scriptLikeValue });
  });

  it("rejects executable JavaScript instead of evaluating it", () => {
    const parse = createParser();
    expect(() => parse('{"value": (function(){ return 1; })()}')).toThrow(/JSON parse error/);
  });
});
