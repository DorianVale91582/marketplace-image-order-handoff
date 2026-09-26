import assert from "node:assert/strict";
import test from "node:test";
import { decideHandoffState } from "../src/marketplace_asset.js";

test("an order becomes reviewable only after a seller asset is saved", () => {
  assert.equal(decideHandoffState(0), "awaiting_asset");
  assert.equal(decideHandoffState(1), "ready_for_buyer_review");
});
