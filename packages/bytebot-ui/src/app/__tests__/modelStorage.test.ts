import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { selectInitialModel } from "../modelStorage";

const models = [
  { name: "model-a", title: "Model A" },
  { name: "model-b", title: "Model B" },
];

describe("selectInitialModel", () => {
  it("returns the stored model when it exists", () => {
    const result = selectInitialModel(models, "model-b");
    assert.equal(result, models[1]);
  });

  it("falls back to the first model when stored name is missing", () => {
    const result = selectInitialModel(models, "model-c");
    assert.equal(result, models[0]);
  });

  it("returns null when there are no models", () => {
    const result = selectInitialModel([], "model-a");
    assert.equal(result, null);
  });
});
