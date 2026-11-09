// Tests for the sync merge logic in sync.js. Run with:  node tests/merge.test.js
const assert = require("assert");
const path = require("path");
const { stamp, merge, same, photoIds } = require(path.join(__dirname, "..", "sync.js"));

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("ok -", name); };
const dev = (cols = {}) => ({ collections: JSON.parse(JSON.stringify(cols)), stamps: {}, tomb: {} });
const save = (d, coll, value, now) => {
  stamp(d, coll, d.collections[coll], value, now);
  d.collections[coll] = JSON.parse(JSON.stringify(value));
};
// Postgres stores JSON with its keys in a different order.
const reorder = (v) => JSON.parse(JSON.stringify(v, (_, x) =>
  x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).reverse().map((k) => [k, x[k]])) : x));

t("edits to different items on two devices are both kept", () => {
  const base = { cookies: [{ id: 1, title: "A" }], moods: { "2026-10-01": 3 } };
  const a = dev(base), b = dev(base);
  save(a, "cookies", [{ id: 1, title: "A" }, { id: 2, title: "from phone A" }], 100);
  save(b, "moods", { "2026-10-01": 3, "2026-10-02": 5 }, 200);
  const m = merge(b, merge(a, dev()));
  assert.deepStrictEqual(m.collections.cookies.map((c) => c.title), ["A", "from phone A"]);
  assert.deepStrictEqual(m.collections.moods, { "2026-10-01": 3, "2026-10-02": 5 });
});

t("same item edited on both devices: newest edit wins", () => {
  const base = { cookies: [{ id: 1, title: "old", rating: 5 }] };
  const a = dev(base), b = dev(base);
  save(a, "cookies", [{ id: 1, title: "phone A edit", rating: 7 }], 100);
  save(b, "cookies", [{ id: 1, title: "phone B edit", rating: 9 }], 300);
  assert.strictEqual(merge(a, b).collections.cookies[0].title, "phone B edit");
  assert.strictEqual(merge(b, a).collections.cookies[0].title, "phone B edit");
});

t("deleting on one device removes it everywhere", () => {
  const base = { journal: [{ id: 1, a: "x" }, { id: 2, a: "y" }] };
  const a = dev(base), b = dev(base);
  save(a, "journal", [{ id: 2, a: "y" }], 100);
  const m = merge(b, merge(a, dev()));
  assert.deepStrictEqual(m.collections.journal.map((j) => j.id), [2]);
  assert.ok(m.tomb.journal["1"], "tombstone kept so other devices also delete it");
});

t("an edit made after a deletion brings the item back", () => {
  const base = { cookies: [{ id: 1, title: "x" }] };
  const a = dev(base), b = dev(base);
  save(a, "cookies", [], 100);
  save(b, "cookies", [{ id: 1, title: "edited later" }], 200);
  assert.strictEqual(merge(a, b).collections.cookies[0].title, "edited later");
});

t("existing data with no history is kept, and merging is stable", () => {
  const phone = dev({ meals: [{ id: 5, foods: ["Rice"] }], foodCleared: { garlic: 10 } });
  const m1 = merge(phone, dev());
  assert.strictEqual(m1.collections.meals.length, 1);
  assert.deepStrictEqual(m1.collections.foodCleared, { garlic: 10 });
  assert.ok(same(merge(m1, m1), m1), "merging a snapshot with itself changes nothing");
});

t("Postgres key reordering is not seen as a change (no reload loop)", () => {
  const phone = dev({ cookies: [{ id: 1, title: "A", rating: 9, photoIds: ["p1"] }] });
  save(phone, "water", { "2026-10-19": 4 }, 50);
  const cloud = reorder(merge(phone, dev()));
  const m = merge(phone, cloud);
  for (const c of ["cookies", "water"]) assert.ok(same(m.collections[c], phone.collections[c]), c);
  assert.ok(same(m, cloud));
});

t("brave ladders sync, and progress made on another phone wins when newer", () => {
  const ladder = { id: 7, title: "Eating out", steps: [{ id: 1, text: "Café drink", done: false, tries: [] }] };
  const a = dev({ brave: [ladder] }), b = dev({ brave: [ladder] });
  const progressed = JSON.parse(JSON.stringify(ladder));
  progressed.steps[0].done = true;
  progressed.steps[0].tries.push({ time: 1, feared: "no" });
  save(b, "brave", [progressed], 500);
  const m = merge(a, merge(b, dev()));
  assert.strictEqual(m.collections.brave[0].steps[0].done, true);
});

t("list order stays chronological by id", () => {
  const a = dev({ entries: [{ id: 30 }, { id: 10 }] }), b = dev({ entries: [{ id: 20 }] });
  assert.deepStrictEqual(merge(a, b).collections.entries.map((e) => e.id), [10, 20, 30]);
});

t("photo ids are collected from cookies", () => {
  const s = dev({ cookies: [{ id: 1, photoIds: ["a", "b"] }, { id: 2, photoIds: [] }] });
  assert.deepStrictEqual([...photoIds(s)], ["a", "b"]);
});

console.log(`\n${pass} passed`);
