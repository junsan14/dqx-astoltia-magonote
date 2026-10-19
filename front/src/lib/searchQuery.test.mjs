import test from "node:test";
import assert from "node:assert/strict";
import { updateSearchQuery } from "./searchQuery.mjs";

test("Japanese keywords and reserved characters round-trip without altering other parameters", () => {
  const path = updateSearchQuery("https://example.com/ja/tools/craft-profit?campaign=home#search", { q: "はやぶさ & + # ?" });
  const url = new URL(path, "https://example.com");
  assert.equal(url.searchParams.get("q"), "はやぶさ & + # ?");
  assert.equal(url.searchParams.get("campaign"), "home");
  assert.equal(url.hash, "#search");
});

test("clearing the keyword removes the query without a trailing question mark", () => {
  assert.equal(updateSearchQuery("https://example.com/ja/tools/craft-profit?q=test", { q: "" }), "/ja/tools/craft-profit");
});

test("switching monster search types updates type and clears keyword atomically", () => {
  const path = updateSearchQuery("https://example.com/en/tools/monster-search?q=slime&other=1", { type: "orb", q: null });
  const params = new URL(path, "https://example.com").searchParams;
  assert.equal(params.get("type"), "orb");
  assert.equal(params.has("q"), false);
  assert.equal(params.get("other"), "1");
  assert.equal(updateSearchQuery(`https://example.com${path}`, { type: null }), "/en/tools/monster-search?other=1");
});
