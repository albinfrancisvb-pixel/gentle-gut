// Gentle Gut — all data stays in this browser (localStorage).

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("gg:" + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("gg:" + key, JSON.stringify(value)); } catch {}
  },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => dayKey(new Date());
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// In-app "Are you sure?" pop-up. The browser's confirm() is blocked in some app views (it silently
// answers "no"), so this one is used everywhere instead. Resolves true/false.
function askConfirm(text, okLabel = "OK") {
  const d = $("#confirmDialog");
  $("#confirmText").textContent = text;
  $("#confirmYes").textContent = okLabel;
  d.showModal();
  return new Promise((resolve) => {
    const done = (answer) => {
      d.close();
      $("#confirmYes").onclick = $("#confirmNo").onclick = d.oncancel = null;
      resolve(answer);
    };
    $("#confirmYes").onclick = () => done(true);
    $("#confirmNo").onclick = () => done(false);
    d.oncancel = (e) => { e.preventDefault(); done(false); };
  });
}

// Set once every screen's code has loaded; early renders skip parts that depend on later sections.
var appReady = false;

/* ---------- Theme ---------- */
const themeBtn = $("#themeToggle");
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  themeBtn.textContent = dark ? "☀️" : "🌙";
}
applyTheme(store.get("theme", null));
themeBtn.addEventListener("click", () => {
  const isDark = themeBtn.textContent === "☀️";
  const next = isDark ? "light" : "dark";
  store.set("theme", next);
  applyTheme(next);
});

/* ---------- Navigation ---------- */
// Screens that aren't bottom tabs light up their parent tab and get a Back button.
const parentTab = { meal: "home", sos: "home", breathe: "home", log: "food" };
let currentView = "home";
let previousViews = [];

function go(view, { back = false } = {}) {
  if (view === currentView) return window.scrollTo({ top: 0, behavior: "smooth" });
  if (!back) previousViews = (parentTab[view] ? previousViews.concat(currentView) : []).slice(-10);
  currentView = view;
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  const tab = parentTab[view] || view;
  $$(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.go === tab));
  if (view !== "breathe") stopBreathing();
  if (view === "home" && appReady) renderToday();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goBack() {
  go(previousViews.pop() || parentTab[currentView] || "home", { back: true });
}
$$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
$$("[data-back]").forEach((b) => b.addEventListener("click", goBack));

/* ---------- Home ---------- */
const affirmations = [
  "Your body is not your enemy. It's asking for a little extra care today.",
  "A hard gut day is not a failure. You're doing the best you can.",
  "You've gotten through every flare so far. This one will pass too.",
  "Rest is productive. Healing isn't a straight line.",
  "You are allowed to cancel plans to take care of yourself.",
  "Small, gentle steps count. Every single one.",
  "You're not 'too sensitive'. You're managing something real.",
];
const hour = new Date().getHours();
$("#greeting").textContent = hour < 12 ? "Good morning ☀️" : hour < 18 ? "Good afternoon 🌤️" : "Good evening 🌙";
$("#affirmation").textContent = "“" + affirmations[new Date().getDate() % affirmations.length] + "”";

const moodReplies = {
  1: "I'm sorry it's a rough one. Try the Flare-up help. You don't have to push through alone. 💚",
  2: "Meh days are valid. A warm drink and a few slow breaths might help.",
  3: "Okay is good enough. Keep being gentle with yourself.",
  4: "Love that! Maybe note what went well in your log today.",
  5: "Wonderful! 🌞 Enjoy it. Logging good days helps you find what works.",
};
function renderMood(m) {
  $$(".mood").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mood == m)));
  $("#checkinReply").textContent = m ? moodReplies[m] : "";
}
const moods = store.get("moods", {});
renderMood(moods[todayKey()]);
$$(".mood").forEach((b) =>
  b.addEventListener("click", () => {
    moods[todayKey()] = Number(b.dataset.mood);
    store.set("moods", moods);
    renderMood(b.dataset.mood);
  })
);

const water = store.get("water", {});
function renderWater() {
  const n = water[todayKey()] || 0;
  $("#waterCups").innerHTML = Array.from({ length: 8 }, (_, i) =>
    `<button class="cup ${i < n ? "full" : ""}" data-i="${i}" aria-label="Glass ${i + 1}"></button>`
  ).join("");
}
$("#waterCups").addEventListener("click", (e) => {
  const cup = e.target.closest(".cup");
  if (!cup) return;
  const i = Number(cup.dataset.i);
  const n = water[todayKey()] || 0;
  water[todayKey()] = i + 1 === n ? i : i + 1;
  store.set("water", water);
  renderWater();
  if (water[todayKey()] === 8) toast("8 glasses! Nicely done 💧");
});
renderWater();

/* ---------- Flare-up SOS ---------- */
const sosSteps = [
  ["Pause and find somewhere comfy", "Sit or lie down. Loosen anything tight around your waist."],
  ["Take 5 slow belly breaths", "In through your nose for 4, out through your mouth for 6. Let your belly rise and soften."],
  ["Add gentle warmth", "A heat pad or warm water bottle on your tummy can relax cramping muscles."],
  ["Sip something soothing", "Warm water, peppermint tea (if reflux isn't an issue), or ginger tea."],
  ["Try a gentle tummy massage", "Small clockwise circles with your palm, following the path of the colon."],
  ["Try a comfort position", "Child's pose, or lying on your left side with knees bent, can ease gas and bloating."],
  ["Take any medication your doctor suggested", "Use only what's been recommended for you."],
  ["Be kind to yourself", "This is not your fault. When you feel better, log what happened. No judgement."],
];
let sosDone = new Set();
function renderSos() {
  $("#sosSteps").innerHTML = sosSteps.map(([t, b], i) => `
    <li class="${sosDone.has(i) ? "done" : ""}">
      <button class="step-check" data-i="${i}" aria-label="Mark step ${i + 1} done">${sosDone.has(i) ? "✓" : i + 1}</button>
      <div><span class="step-title">${t}</span><span class="step-body">${b}</span></div>
    </li>`).join("");
}
$("#sosSteps").addEventListener("click", (e) => {
  const btn = e.target.closest(".step-check");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  sosDone.has(i) ? sosDone.delete(i) : sosDone.add(i);
  renderSos();
  if (sosDone.size === sosSteps.length) toast("You did every step. Proud of you 💚");
});
renderSos();

/* ---------- Breathing ---------- */
const patterns = {
  calm: [["Breathe in", 4, 1.45], ["Breathe out", 6, 1]],
  box: [["Breathe in", 4, 1.45], ["Hold", 4, 1.45], ["Breathe out", 4, 1], ["Hold", 4, 1]],
  sleep: [["Breathe in", 4, 1.45], ["Hold", 7, 1.45], ["Breathe out", 8, 1]],
};
let pattern = "calm";
let breathTimer = null;
let rounds = 0;
const circle = $("#breathCircle");

function stopBreathing() {
  clearTimeout(breathTimer);
  breathTimer = null;
  circle.style.transitionDuration = "0.6s";
  circle.style.transform = "scale(1)";
  $("#breathText").textContent = "Ready";
  $("#breathCount").textContent = "";
  $("#breathBtn").textContent = "Start";
}

function runPhase(idx, first = false) {
  const steps = patterns[pattern];
  if (idx === 0 && !first) {
    rounds++;
    $("#breathRounds").textContent = `${rounds} round${rounds > 1 ? "s" : ""} done. Lovely.`;
  }
  const [label, secs, scale] = steps[idx];
  $("#breathText").textContent = label;
  circle.style.transitionDuration = secs + "s";
  circle.style.transform = `scale(${scale})`;
  let left = secs;
  $("#breathCount").textContent = left;
  const tick = () => {
    left--;
    if (left > 0) {
      $("#breathCount").textContent = left;
      breathTimer = setTimeout(tick, 1000);
    } else {
      breathTimer = setTimeout(() => runPhase((idx + 1) % steps.length), 0);
    }
  };
  breathTimer = setTimeout(tick, 1000);
}

$("#breathBtn").addEventListener("click", () => {
  if (breathTimer) return stopBreathing();
  rounds = 0;
  $("#breathRounds").textContent = "";
  $("#breathBtn").textContent = "Stop";
  runPhase(0, true);
});

$$("[data-pattern]").forEach((b) =>
  b.addEventListener("click", () => {
    $$("[data-pattern]").forEach((x) => x.classList.toggle("active", x === b));
    pattern = b.dataset.pattern;
    stopBreathing();
  })
);

/* ---------- Food data (for meal check-in timing only) ---------- */
// General low-FODMAP guidance; serving sizes matter. Not a substitute for a dietitian.
const foods = [
  ["Rice", "low", "White or brown, a great safe base.", "grain"],
  ["Oats", "low", "About ½ cup is usually well tolerated.", "grain"],
  ["Potatoes", "low", "Boiled, baked or mashed (use lactose-free milk).", "grain"],
  ["Quinoa", "low", "", "grain"],
  ["Sourdough spelt bread", "low", "Long fermentation breaks down fructans.", "grain"],
  ["Carrots", "low", "", "veg"],
  ["Zucchini", "low", "Moderate portions.", "veg"],
  ["Spinach", "low", "", "veg"],
  ["Cucumber", "low", "", "veg"],
  ["Tomato", "low", "Common tomatoes are fine; sun-dried are higher.", "veg"],
  ["Red bell pepper", "low", "", "veg"],
  ["Green beans", "low", "", "veg"],
  ["Firm banana", "low", "Firm or slightly green. Ripe bananas are higher.", "fruit"],
  ["Blueberries", "low", "", "fruit"],
  ["Strawberries", "low", "", "fruit"],
  ["Oranges", "low", "One fruit at a time.", "fruit"],
  ["Kiwi", "low", "May even help with constipation.", "fruit"],
  ["Grapes", "low", "", "fruit"],
  ["Eggs", "low", "", "protein"],
  ["Chicken", "low", "Plain. Watch garlic/onion marinades.", "protein"],
  ["Fish", "low", "", "protein"],
  ["Firm tofu", "low", "Silken tofu is higher.", "protein"],
  ["Lactose-free milk", "low", "", "dairy"],
  ["Cheddar / hard cheese", "low", "Aged cheeses are naturally low in lactose.", "dairy"],
  ["Peanut butter", "low", "About 2 tablespoons.", "nuts"],
  ["Maple syrup", "low", "A good swap for honey.", "sweet"],
  ["Garlic-infused oil", "low", "Flavour without the fructans. A great garlic swap.", "fat"],
  ["Spring onion (green part)", "low", "The green tops only. A great onion swap.", "veg"],
  ["Avocado", "mod", "A small slice is fine; larger portions are high in sorbitol.", "veg"],
  ["Sweet potato", "mod", "About ½ cup is usually okay.", "grain"],
  ["Broccoli", "mod", "Heads are gentler than stalks.", "veg"],
  ["Almonds", "mod", "Around 10 nuts is usually fine.", "nuts"],
  ["Ripe banana", "mod", "Firmer bananas are gentler.", "fruit"],
  ["Canned chickpeas", "mod", "Rinse well; about ¼ cup.", "legume"],
  ["Canned lentils", "mod", "Rinse well; small portions.", "legume"],
  ["Coffee", "mod", "Low in FODMAPs, but caffeine can speed up the gut.", "drink"],
  ["Garlic", "high", "Try garlic-infused oil instead.", "veg"],
  ["Onion", "high", "Try the green part of spring onions or chives.", "veg"],
  ["Wheat bread", "high", "Try sourdough spelt or gluten-free bread.", "grain"],
  ["Apples", "high", "High in fructose and sorbitol.", "fruit"],
  ["Pears", "high", "", "fruit"],
  ["Mango", "high", "High in excess fructose.", "fruit"],
  ["Watermelon", "high", "", "fruit"],
  ["Honey", "high", "Try maple syrup instead.", "sweet"],
  ["Regular milk", "high", "Try lactose-free milk instead.", "dairy"],
  ["Ice cream", "high", "Lactose-free versions exist.", "dairy"],
  ["Kidney beans", "high", "", "legume"],
  ["Cauliflower", "high", "", "veg"],
  ["Mushrooms", "high", "Oyster mushrooms are a gentler option.", "veg"],
  ["Asparagus", "high", "", "veg"],
  ["Cashews", "high", "Try macadamias or peanuts.", "nuts"],
  ["Pistachios", "high", "", "nuts"],
  ["Agave syrup", "high", "", "sweet"],
  ["Inulin / chicory root", "high", "Often hidden in 'high fibre' bars.", "sweet"],
  ["Sugar-free gum (sorbitol, xylitol)", "high", "Polyols often cause bloating.", "sweet"],
];
// (The list above is never shown. It only tells meal check-ins how long each kind of food takes.)

/* ---------- My bad foods ---------- */
// The Food tab shows only foods the person has logged as Bad or Worst, from the Log tab or meal check-ins.
const foodKey = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");
const prettyName = (s) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1);
const levelInfo = { bad: { emoji: "😣", label: "Bad" }, worst: { emoji: "😖", label: "Worst" } };

let entries = store.get("entries", []);
let foodCleared = store.get("foodCleared", {}); // food key → when it was removed from the list

// Older entries used a 0–10 scale and a free-text "What did you eat?" box; read both formats.
function entryLevel(e) {
  if (e.level) return e.level;
  return e.pain >= 7 ? "worst" : e.pain >= 4 ? "bad" : null;
}
function entryFoods(e) {
  if (e.foods) return e.foods;
  return (e.meal || "").split(/,|;|\n|\band\b|&|\+/i).map((s) => s.trim()).filter(Boolean);
}

function badFoods() {
  const byKey = new Map();
  for (const e of entries) {
    const level = entryLevel(e);
    if (!level) continue;
    const t = new Date(e.time).getTime();
    for (const name of entryFoods(e)) {
      const k = foodKey(name);
      if (!k || (foodCleared[k] && t <= foodCleared[k])) continue;
      const f = byKey.get(k) || { key: k, name: prettyName(name), bad: 0, worst: 0, last: 0 };
      f[level]++;
      f.last = Math.max(f.last, t);
      byKey.set(k, f);
    }
  }
  return [...byKey.values()].map((f) => ({ ...f, level: f.worst ? "worst" : "bad", count: f.bad + f.worst }));
}
const isTrigger = (name) => badFoods().some((f) => f.key === foodKey(name));

// Every food name the person has typed anywhere, used for suggestions and consistent spelling.
function knownFoodNames() {
  const names = new Map();
  const add = (n) => { const k = foodKey(n); if (k && !names.has(k)) names.set(k, prettyName(n)); };
  entries.forEach((e) => entryFoods(e).forEach(add));
  meals.forEach((m) => m.foods.forEach(add));
  return [...names.values()];
}

/* Forgiving search: exact and starts-with matches first, then near spellings ("garlik" → Garlic). */
const normText = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
function matchScore(query, name) {
  const q = normText(query), n = normText(name);
  if (!q) return 1;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  const words = n.split(" ");
  if (words.some((w) => w.startsWith(q))) return 80;
  if (n.includes(q)) return 70;
  let best = 0;
  for (const qw of q.split(" ")) {
    if (qw.length < 3) continue;
    const allowed = qw.length <= 4 ? 1 : qw.length <= 7 ? 2 : 3;
    for (const w of words) {
      if (w[0] !== qw[0]) continue; // typos rarely hit the first letter; this stops "rice" matching "ice"
      // Compare with the whole word and with its start (a letter shorter or longer, for a skipped or
      // doubled letter), so half-typed words with a typo still match: "aple" → Apples.
      const d = Math.min(
        editDistance(qw, w),
        ...[-1, 0, 1].map((k) => editDistance(qw, w.slice(0, qw.length + k)))
      );
      if (d <= allowed) best = Math.max(best, 60 - d * 10);
    }
  }
  return best;
}

let foodFilter = "all";
const fmtAgoDays = (t) => {
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
};
const worstFirst = (a, b) => (b.level === "worst") - (a.level === "worst") || b.count - a.count || b.last - a.last;

function renderFoods() {
  const q = $("#foodSearch").value.trim();
  let list = badFoods().filter((f) => foodFilter === "all" || f.level === foodFilter);
  list = q
    ? list.map((f) => ({ ...f, score: matchScore(q, f.name) })).filter((f) => f.score > 0).sort((a, b) => b.score - a.score || worstFirst(a, b))
    : list.sort(worstFirst);

  // Exact / starts-with / contains matches are real hits. Typo matches are only suggestions, so they
  // never hide the "not on your list" answer.
  const STRONG = 70;
  const strong = q ? list.filter((f) => f.score >= STRONG) : list;
  const similar = q ? list.filter((f) => f.score < STRONG) : [];

  const item = (f) => `
    <li class="${f.level}">
      <div>
        <span class="food-name">${escapeHtml(f.name)}</span>
        <span class="food-tip">Logged ${f.count}× (${f.worst ? `😖 ${f.worst} worst` : ""}${f.worst && f.bad ? " · " : ""}${f.bad ? `😣 ${f.bad} bad` : ""}) · last ${fmtAgoDays(f.last)}</span>
      </div>
      <div class="food-actions">
        <span class="badge ${f.level}">${levelInfo[f.level].emoji} ${levelInfo[f.level].label}</span>
        <button class="link-btn" data-retry="${escapeHtml(f.name)}">🥄 Try again slowly</button>
        <button class="link-btn" data-clear="${escapeHtml(f.key)}">Remove</button>
      </div>
    </li>`;

  let html = strong.map(item).join("");
  if (q && !strong.length && similar.length) {
    // A near spelling of a bad food is most likely a typo for it, so the warning comes first.
    html = `<li class="similar-head">Did you mean…?</li>` + similar.map(item).join("") +
      `<li class="similar-head muted">If not, “${escapeHtml(q)}” isn't on your bad list.
        <button class="link-btn" data-log-this="${escapeHtml(q)}">It upset me: log it</button></li>`;
  } else if (q && !strong.length) {
    html = `<li class="safe">✅ <b>${escapeHtml(q)}</b> isn't on your bad list. You haven't logged any trouble with it.
      <br><button class="btn ghost small" data-log-this="${escapeHtml(q)}">It upset me: log it</button></li>`;
  } else if (similar.length) {
    html += `<li class="similar-head">Similar</li>` + similar.map(item).join("");
  }
  if (!html) {
    html = `<li class="muted">${foodFilter === "all"
      ? "Nothing here yet. When a food upsets your stomach, log it as Bad or Worst and it shows up here."
      : `No ${levelInfo[foodFilter].label.toLowerCase()} foods logged.`}</li>`;
  }
  $("#foodList").innerHTML = html;
}

$("#foodList").addEventListener("click", async (e) => {
  const clear = e.target.closest("[data-clear]");
  if (clear) {
    const f = badFoods().find((x) => x.key === clear.dataset.clear);
    if (!(await askConfirm(`Remove ${f.name} from your bad foods? It comes back if you log it again.`, "Remove"))) return;
    foodCleared[f.key] = Date.now();
    store.set("foodCleared", foodCleared);
    renderFoods();
    return;
  }
  const logThis = e.target.closest("[data-log-this]");
  if (logThis) {
    go("log");
    addLogFood(logThis.dataset.logThis);
  }
});
$("#foodSearch").addEventListener("input", renderFoods);
$$("[data-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    $$("[data-filter]").forEach((x) => x.classList.toggle("active", x === b));
    foodFilter = b.dataset.filter;
    renderFoods();
  })
);

/* ---------- Log: type the food, tap Bad or Worst ---------- */
let logFoods = [];

function canonicalName(name) {
  const known = knownFoodNames().find((n) => foodKey(n) === foodKey(name));
  return known || prettyName(name);
}
function addLogFood(raw) {
  raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => {
    const name = canonicalName(n);
    if (!logFoods.some((x) => foodKey(x) === foodKey(name))) logFoods.push(name);
  });
  $("#logFood").value = "";
  renderLogForm();
}
function renderLogForm() {
  $("#logChips").innerHTML = logFoods.map((n, i) =>
    `<button type="button" class="chip active" data-rmlog="${i}">${escapeHtml(n)}<span class="x">×</span></button>`).join("");
  // Suggestions from foods typed before, closest spelling first.
  const q = $("#logFood").value.trim();
  const picked = new Set(logFoods.map(foodKey));
  const sugg = q
    ? knownFoodNames().filter((n) => !picked.has(foodKey(n)))
        .map((n) => ({ n, s: matchScore(q, n) })).filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s).slice(0, 5).map((x) => x.n)
    : [];
  $("#logSuggest").innerHTML = sugg.map((n) => `<button type="button" class="chip" data-sug="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("");
}
$("#logFood").addEventListener("input", renderLogForm);
$("#logFood").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); if (e.target.value.trim()) addLogFood(e.target.value); }
});
$("#logAddBtn").addEventListener("click", () => $("#logFood").value.trim() && addLogFood($("#logFood").value));
$("#logSuggest").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sug]");
  if (b) addLogFood(b.dataset.sug);
});
$("#logChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rmlog]");
  if (!b) return;
  logFoods.splice(Number(b.dataset.rmlog), 1);
  renderLogForm();
});

function logBadFood(level, foodsList, source) {
  entries.push({ id: Date.now(), time: new Date().toISOString(), level, foods: [...foodsList], ...(source ? { source } : {}) });
  store.set("entries", entries);
  // Logging a food again after removing it puts it back on the list.
  let cleared = false;
  foodsList.forEach((n) => { if (foodCleared[foodKey(n)]) { delete foodCleared[foodKey(n)]; cleared = true; } });
  if (cleared) store.set("foodCleared", foodCleared);
  renderEntries();
  renderFoods();
}

$$(".level-btn").forEach((b) => b.addEventListener("click", () => {
  if ($("#logFood").value.trim()) addLogFood($("#logFood").value);
  if (!logFoods.length) {
    toast("Type what you ate first");
    $("#logFood").focus();
    return;
  }
  const level = b.dataset.level;
  logBadFood(level, logFoods);
  toast(`${levelInfo[level].emoji} ${logFoods.join(", ")} added to your bad foods`);
  logFoods = [];
  renderLogForm();
}));

function renderEntries() {
  const shown = entries.slice().reverse();
  $("#entries").innerHTML = shown.length
    ? shown.map((e) => {
        const level = entryLevel(e);
        const foodsTxt = entryFoods(e).join(", ");
        return `<li>
          <div>
            <span class="lvl">${level ? `${levelInfo[level].emoji} ${levelInfo[level].label}` : "🙂 Okay"}</span>
            ${foodsTxt ? ` · ${escapeHtml(foodsTxt)}` : ""}
            <div class="entry-meta">${new Date(e.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${e.source === "meal" || e.notes === "From meal check-in" ? " · from meal check-in" : ""}</div>
          </div>
          <button class="del" data-id="${e.id}" aria-label="Delete entry">×</button>
        </li>`;
      }).join("")
    : `<li class="muted">Nothing logged yet.</li>`;
  renderChart();
}

function renderChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const perDay = days.map((d) => entries.filter((e) => entryLevel(e) && dayKey(new Date(e.time)) === dayKey(d)));
  const max = Math.max(3, ...perDay.map((l) => l.length));
  $("#weekChart").innerHTML = days.map((d, i) => {
    const list = perDay[i];
    const worst = list.some((e) => entryLevel(e) === "worst");
    return `<div class="bar-wrap" title="${list.length} bad food log${list.length === 1 ? "" : "s"}">
      <div class="bar ${list.length ? (worst ? "worst" : "bad") : "empty"}" style="height:${list.length ? Math.max(8, (list.length / max) * 100) : 4}%"></div>
      <span class="bar-label">${d.toLocaleDateString([], { weekday: "short" })}</span>
    </div>`;
  }).join("");
  const top = badFoods().sort((a, b) => b.count - a.count)[0];
  $("#insight").textContent = top && top.count > 1
    ? `💡 ${top.name} is your most common trouble food (${top.count} times).`
    : "Red bars are days with a Worst reaction.";
}

$("#entries").addEventListener("click", async (e) => {
  const del = e.target.closest(".del");
  if (!del || !(await askConfirm("Delete this log entry?", "Delete"))) return;
  entries = entries.filter((x) => String(x.id) !== del.dataset.id);
  store.set("entries", entries);
  renderEntries();
  renderFoods();
});

$("#exportBtn").addEventListener("click", () => {
  const rows = entries.filter((e) => entryLevel(e));
  if (!rows.length) return toast("Nothing to export yet");
  const csv = [["Date", "How bad", "Foods"]]
    .concat(rows.map((e) => [new Date(e.time).toLocaleString(), levelInfo[entryLevel(e)].label, entryFoods(e).join("; ")]))
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "gentle-gut-bad-foods.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- Meals & tummy check-ins ---------- */
// Rough hours after eating when IBS symptoms from each food group tend to show up.
// Fast-moving sugars and drinks act sooner; FODMAPs that ferment in the colon take longer.
const checkHours = { drink: 1, sweet: 2, fruit: 2, dairy: 2, veg: 3, grain: 3, nuts: 3, fat: 3, protein: 4, legume: 4, custom: 3 };
const catLabel = {
  drink: "drinks", sweet: "sugars", fruit: "fruit", dairy: "dairy", veg: "vegetables", grain: "grains",
  nuts: "nuts", fat: "fats", protein: "protein", legume: "beans and lentils", custom: "most foods",
};
const SNOOZE_MS = 30 * 60 * 1000;

let meals = store.get("meals", []);
let mealFoods = [];

function categoryOf(name) {
  const f = foods.find(([n]) => foodKey(n) === foodKey(name));
  return f ? f[3] : "custom";
}
// The slowest food in the meal decides when we ask.
function autoDelay(names) {
  if (!names.length) return { hours: 3, cat: "custom" };
  return names.map((n) => ({ hours: checkHours[categoryOf(n)], cat: categoryOf(n) }))
    .sort((a, b) => b.hours - a.hours)[0];
}
function mealLabel(time) {
  const h = new Date(time).getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "your snack" : "dinner";
}
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (t) => new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
function fmtLeft(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
function localInputValue(d) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 16);
}

function renderFoodNames() {
  $("#foodNames").innerHTML = knownFoodNames().map((n) => `<option value="${escapeHtml(n)}">`).join("");
}

function renderMealForm() {
  $("#mealChips").innerHTML = mealFoods.map((n, i) =>
    `<button type="button" class="chip active" data-rm="${i}">${escapeHtml(n)}${isTrigger(n) ? " 🚩" : ""}<span class="x">×</span></button>`
  ).join("");
  const eaten = new Date($("#mealTime").value || Date.now());
  const sel = $("#mealDelay").value;
  const { hours, cat } = sel === "auto" ? autoDelay(mealFoods) : { hours: Number(sel) };
  const at = new Date(eaten.getTime() + hours * 3600000);
  const why = sel === "auto" && mealFoods.length ? `, when symptoms from ${catLabel[cat]} usually show up` : "";
  const warn = mealFoods.filter(isTrigger);
  $("#mealPreview").innerHTML = (mealFoods.length
    ? `I'll check in around <b>${fmtTime(at)}</b> (about ${hours}h after eating${why}).`
    : "Add at least one food.") +
    (warn.length ? `<br>🚩 Heads up: ${warn.map(escapeHtml).join(", ")} has upset your stomach before.` : "");
}

function addMealFood() {
  const input = $("#mealFood");
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => {
    const name = canonicalName(n);
    if (!mealFoods.some((x) => foodKey(x) === foodKey(name))) mealFoods.push(name);
  });
  input.value = "";
  input.focus();
  renderMealForm();
}
$("#addFoodBtn").addEventListener("click", addMealFood);
$("#mealFood").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addMealFood(); }
});
$("#mealChips").addEventListener("click", (e) => {
  const c = e.target.closest("[data-rm]");
  if (!c) return;
  mealFoods.splice(Number(c.dataset.rm), 1);
  renderMealForm();
});
$("#mealTime").addEventListener("input", renderMealForm);
$("#mealDelay").addEventListener("change", renderMealForm);

$("#mealForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("#mealFood").value.trim()) addMealFood();
  if (!mealFoods.length) return toast("Add at least one food first");
  const eatenAt = new Date($("#mealTime").value || Date.now()).getTime();
  const sel = $("#mealDelay").value;
  const hours = sel === "auto" ? autoDelay(mealFoods).hours : Number(sel);
  meals.push({ id: Date.now(), foods: [...mealFoods], eatenAt, checkAt: eatenAt + hours * 3600000, answer: null });
  store.set("meals", meals);
  mealFoods = [];
  $("#mealDelay").value = "auto";
  $("#mealTime").value = localInputValue(new Date());
  renderMeals();
  toast(`Saved! I'll ask about your tummy around ${fmtTime(meals.at(-1).checkAt)} ⏰`);
  askNotificationPermission();
});

const dueMeals = () => meals.filter((m) => !m.answer && m.checkAt <= Date.now() && (!m.snoozeUntil || m.snoozeUntil <= Date.now()));

function renderMeals() {
  renderMealForm();
  const pending = meals.filter((m) => !m.answer).sort((a, b) => a.checkAt - b.checkAt);
  $("#pendingMeals").innerHTML = pending.length
    ? pending.map((m) => {
        const due = m.checkAt <= Date.now();
        return `<li>
          <div><strong>${m.foods.map(escapeHtml).join(", ")}</strong>
          <div class="entry-meta">Ate ${fmtDay(m.eatenAt)} · ${due ? "ready to check in" : "check-in in " + fmtLeft(m.checkAt - Date.now())}</div></div>
          <button class="btn ${due ? "primary" : "ghost"} small answer-btn" data-answer-meal="${m.id}">${due ? "Answer" : "Answer now"}</button>
        </li>`;
      }).join("")
    : `<li class="muted">Nothing waiting. Log a meal and I'll check on you later.</li>`;

  const done = meals.filter((m) => m.answer).sort((a, b) => b.eatenAt - a.eatenAt).slice(0, 10);
  const face = { good: "😊", off: "😣", hurt: "😖" };
  $("#recentMeals").innerHTML = done.length
    ? done.map((m) => `<li>
        <div><strong>${m.foods.map(escapeHtml).join(", ")}</strong>
        <div class="entry-meta">${fmtDay(m.eatenAt)}${m.symptoms?.length ? " · " + m.symptoms.join(", ") : ""}</div></div>
        <span class="when">${face[m.answer]}</span>
      </li>`).join("")
    : `<li class="muted">Answered check-ins show up here.</li>`;

  if (appReady) renderToday(); // a waiting check-in shows on Home's Today card
}
$("#pendingMeals").addEventListener("click", (e) => {
  const b = e.target.closest("[data-answer-meal]");
  if (b) openCheckin(meals.find((m) => String(m.id) === b.dataset.answerMeal));
});

/* Check-in dialog: one tap. Bad and Worst add the meal's foods to the bad-foods list. */
const dialog = $("#checkinDialog");
let activeMeal = null;

function openCheckin(meal) {
  if (!meal || dialog.open) return;
  activeMeal = meal;
  $("#checkinTitle").textContent = `How's your tummy after ${mealLabel(meal.eatenAt)}?`;
  $("#checkinFoods").textContent = `You had ${meal.foods.join(", ")} at ${fmtTime(meal.eatenAt)}.`;
  dialog.showModal();
}
$$(".answer").forEach((b) => b.addEventListener("click", () => saveCheckin(b.dataset.answer)));
function snoozeActive() {
  activeMeal.snoozeUntil = Date.now() + SNOOZE_MS;
  store.set("meals", meals);
  renderMeals();
}
$("#checkinLater").addEventListener("click", () => {
  snoozeActive();
  dialog.close();
  toast("Okay, I'll ask again in 30 minutes");
});
dialog.addEventListener("cancel", snoozeActive); // Esc = snooze, so the question isn't lost

function saveCheckin(answer) {
  const meal = activeMeal;
  meal.answer = answer;
  meal.answeredAt = Date.now();
  store.set("meals", meals);
  const level = { off: "bad", hurt: "worst" }[answer];
  if (level) logBadFood(level, meal.foods, "meal");
  dialog.close();
  renderMeals();
  renderFoodNames();
  toast(level ? `${levelInfo[level].emoji} ${meal.foods.join(", ")} added to your bad foods` : "Great to hear! 😊");
  setTimeout(checkDue, 2500); // next waiting check-in, if any
}

/* Reminders: in-app popup while open, plus a system notification if the tab is in the background */
function askNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
function checkDue() {
  const due = dueMeals();
  renderMeals();
  if (!due.length) return;
  const meal = due[0];
  if (document.hidden && "Notification" in window && Notification.permission === "granted" && !meal.notified) {
    meal.notified = true;
    store.set("meals", meals);
    showReminder(meal);
  }
  if (!document.hidden) openCheckin(meal);
}
setInterval(checkDue, 30000);
document.addEventListener("visibilitychange", () => !document.hidden && checkDue());

$("#mealTime").value = localInputValue(new Date());
renderFoodNames();
renderMeals();
renderEntries();
renderFoods();
renderLogForm();
setTimeout(checkDue, 800);

/* ---------- Installable app (PWA) ---------- */
let swReg = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((r) => (swReg = r)).catch(() => {});
  // A tapped notification asks the open app to show that meal's check-in.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type !== "open-checkin") return;
    go("meal");
    openCheckin(meals.find((m) => m.id === e.data.mealId) || dueMeals()[0]);
  });
}

// Android requires notifications to go through the service worker; desktop accepts either.
function showReminder(meal) {
  const title = "Gentle Gut 🌿";
  const opts = {
    body: `How's your tummy after ${meal.foods.join(", ")}?`,
    tag: "meal-" + meal.id,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { mealId: meal.id },
  };
  if (swReg) return swReg.showNotification(title, opts).catch(() => {});
  try {
    const n = new Notification(title, opts);
    n.onclick = () => { window.focus(); openCheckin(meal); };
  } catch {}
}

// Install button: Chrome/Edge/Android give us a prompt; iPhone needs Share → Add to Home Screen.
let installPrompt = null;
const installBtn = $("#installBtn");
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
});
if (isIos && !isStandalone) installBtn.hidden = false;
installBtn.addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") installBtn.hidden = true;
    installPrompt = null;
  } else if (isIos) {
    $("#iosInstall").showModal();
  }
});
$("#iosClose").addEventListener("click", () => $("#iosInstall").close());
window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  toast("Gentle Gut is installed 🌿");
});

// Home-screen shortcuts open straight to a tab (e.g. ./#meal).
function openFromHash() {
  const view = location.hash.slice(1);
  if (["home", "meal", "journal", "jar", "brave", "sos", "breathe", "food", "log"].includes(view)) go(view);
}
openFromHash();
window.addEventListener("hashchange", openFromHash);

/* ---------- Journal: guided "talk it out" chat ---------- */
// A scripted, CBT-inspired companion. Runs fully on-device: no AI service, nothing is sent anywhere.

const jMoods = [
  { v: "anxious", e: "😟", label: "Anxious" },
  { v: "stressed", e: "😣", label: "Stressed" },
  { v: "sad", e: "😢", label: "Sad" },
  { v: "angry", e: "😠", label: "Angry" },
  { v: "overwhelmed", e: "😵‍💫", label: "Overwhelmed" },
  { v: "okay", e: "🙂", label: "Okay" },
  { v: "grateful", e: "🥰", label: "Grateful" },
];
const moodEmoji = Object.fromEntries(jMoods.map((m) => [m.v, m.e]));
const positiveMoods = new Set(["okay", "grateful"]);
const moodReply = {
  anxious: "Anxiety can make your whole body feel on alert. You're safe right here, and we can slow things down together.",
  stressed: "Stress is exhausting, and it often shows up in the gut too. Thank you for taking a moment for yourself.",
  sad: "I'm sorry you're feeling low. You don't have to fix anything right now. Let's just look at it gently.",
  angry: "Anger usually means something mattered to you. It's okay to feel it here.",
  overwhelmed: "When everything piles up, it's hard to know where to start. We'll take it one small piece at a time.",
  okay: "Okay is a good place to be. Writing on calmer days helps too.",
  grateful: "That's lovely to hear. Let's make the most of that feeling.",
};

const crisisRe = /\b(kill(ing)? myself|suicid\w*|end (it all|my life)|want to die|wanna die|(don['’]?t|do not) want to (live|be here|exist)|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|no reason to live|better off (dead|without me))\b/i;

const distortions = [
  { re: /\b(i['’]?m|i am) (so |such |just |really |a |an )*(useless|stupid|failure|worthless|pathetic|weak|broken|burden|disgusting|idiot|hopeless|loser)\b/i,
    name: "harsh self-labels",
    tip: "You'd never call a friend that. A hard day, or a body that's struggling, doesn't define who you are." },
  { re: /\b(ruin(ed|s)?|disaster|worst|terrible|can['’]?t (cope|handle|take)|falling apart|what if|everything is going wrong)\b/i,
    name: "catastrophising",
    tip: "Your mind may be jumping to the worst-case outcome. Worry is very good at predicting disasters that rarely happen." },
  { re: /\b(always|never|every ?time|nothing ever|everyone|no ?one|nobody)\b/i,
    name: "all-or-nothing thinking",
    tip: "Words like “always” and “never” can make a hard moment feel permanent. Is it truly every time, or does it just feel that way right now?" },
  { re: /\b(they|he|she|everyone|people|others) (think|thinks|must think|probably think|will think|hate|judge)\b/i,
    name: "mind reading",
    tip: "We can't really know what others think. Often they're far more caught up in their own lives than we imagine." },
  { re: /\b(i )?(should(n['’]?t)?|must|have to|supposed to)\b/i,
    name: "“should” statements",
    tip: "“Should” can turn into a heavy rule. What if you swapped it for “I'd like to” or “it would be nice if”?" },
];

const themes = [
  { re: /\b(stomach|tummy|gut|ibs|bloat\w*|cramp\w*|flare\w*|toilet|bathroom|diarr\w*|constipat\w*|nause\w*|pain|food|ate|eat\w*)\b/i,
    reply: "Your gut and your mind are closely connected. Stress can make IBS symptoms worse, and symptoms can make you more stressed. It's a loop, not a weakness.",
    action: { label: "Open flare-up help", go: "sos" } },
  { re: /\b(work|job|boss|exam\w*|stud(y|ies|ying)|college|school|deadline\w*|office|assignment\w*|interview)\b/i,
    reply: "Work and study pressure can pile up fast, especially when your body isn't feeling great." },
  { re: /\b(friend\w*|family|mom|mum|dad|parents?|partner|boyfriend|girlfriend|husband|wife|relationship|alone|lonely)\b/i,
    reply: "Things with people we care about can weigh heavily. It makes sense that this is on your mind." },
  { re: /\b(sleep\w*|tired|exhausted|insomnia|awake|can['’]?t rest)\b/i,
    reply: "Being tired makes everything feel heavier, including worries and gut symptoms." },
  { re: /\b(money|rent|bills?|debt|loan|salary|afford)\b/i,
    reply: "Money stress is real and draining. It can help to separate the parts you can act on from the parts you can't." },
];

const validations = [
  "That sounds really hard. Thank you for putting it into words.",
  "It makes sense that you feel this way.",
  "Thank you for sharing that. Just writing it down can loosen its grip a little.",
];

const chatEl = $("#chat");
const chatChips = $("#chatChips");
const chatForm = $("#chatInputRow");
const chatText = $("#chatText");
const CANCELLED = Symbol("cancelled");
let chatRun = 0;
let chatStarted = false;
let replyHandler = null;
let lastBotText = "";
let jSession = null;
let journal = store.get("journal", []);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scale = (from = 0) => Array.from({ length: 11 - from }, (_, i) => String(i + from));

function bubble(cls, html) {
  const d = document.createElement("div");
  d.className = "bubble " + cls;
  d.innerHTML = html;
  chatEl.appendChild(d);
  d.scrollIntoView({ behavior: "smooth", block: "end" });
  return d;
}

// Bot message with a short "typing" pause so it feels like a conversation.
async function say(html, delay) {
  const run = chatRun;
  const typing = bubble("bot typing", "<span></span><span></span><span></span>");
  await sleep(delay ?? Math.min(1500, 400 + html.replace(/<[^>]+>/g, "").length * 10));
  typing.remove();
  if (run !== chatRun) throw CANCELLED;
  lastBotText = html.replace(/<[^>]+>/g, "");
  return bubble("bot", html);
}

// Waits for the person to tap a chip or type a reply. Chips: strings or {label, value}.
function ask({ chips = [], text = false, placeholder = "Type here…" } = {}) {
  const run = chatRun;
  const question = lastBotText;
  const opts = chips.map((c) => (typeof c === "string" ? { label: c, value: c } : c));
  chatChips.innerHTML = opts.map((c, i) => `<button type="button" class="chip" data-i="${i}">${escapeHtml(c.label)}</button>`).join("");
  chatForm.hidden = !text;
  chatText.placeholder = placeholder;
  chatText.value = "";
  if (text) setTimeout(() => chatText.focus({ preventScroll: true }), 50);
  return new Promise((resolve) => {
    replyHandler = (value, label, typed) => {
      if (run !== chatRun) return;
      replyHandler = null;
      chatChips.innerHTML = "";
      chatForm.hidden = true;
      bubble("me", escapeHtml(label));
      if (typed) {
        jSession.entries.push({ q: question, a: value });
        saveJournal(jSession); // saved as they go, so closing the app mid-chat loses nothing
        if (crisisRe.test(value)) showCrisis();
      }
      resolve(value);
    };
    chatChips.onclick = (e) => {
      const b = e.target.closest("[data-i]");
      if (b && replyHandler) replyHandler(opts[b.dataset.i].value, opts[b.dataset.i].label, false);
    };
  });
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = chatText.value.trim();
  if (v && replyHandler) replyHandler(v, v, true);
});
chatText.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit(); }
});
chatText.addEventListener("input", () => {
  chatText.style.height = "auto";
  chatText.style.height = chatText.scrollHeight + "px";
});

// Shown once per chat, the moment anything suggests self-harm, without waiting for the script.
function showCrisis() {
  if (jSession.crisisShown) return;
  jSession.crisisShown = true;
  bubble("bot crisis", `
    <strong>I'm really glad you told me. You deserve support from a real person right now.</strong>
    <ul>
      <li>If you might act on these thoughts, call your local emergency number (<a href="tel:112">112</a> in India and Europe, <a href="tel:911">911</a> in the US).</li>
      <li>India: Tele-MANAS <a href="tel:14416">14416</a> (free, 24/7)</li>
      <li>US: call or text <a href="tel:988">988</a></li>
      <li>UK &amp; Ireland: Samaritans <a href="tel:116123">116 123</a></li>
      <li>Anywhere else: <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a></li>
    </ul>
    <p>Reaching out to someone you trust right now is a strong thing to do. I'm still here if you want to keep writing.</p>`);
}

function goButton(label, view) {
  return `<br><button class="btn ghost small" data-chat-go="${view}">${label}</button>`;
}
chatEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-chat-go]");
  if (b) go(b.dataset.chatGo);
});

/* Conversation */
async function runChat() {
  chatRun++;
  chatStarted = true;
  replyHandler = null;
  chatEl.innerHTML = "";
  chatChips.innerHTML = "";
  chatForm.hidden = true;
  jSession = { id: Date.now(), start: Date.now(), type: "chat", mood: null, before: null, after: null, entries: [], tools: [], steps: [] };
  try {
    const h = new Date().getHours();
    await say(`${h < 12 ? "Good morning" : h < 18 ? "Hi there" : "Good evening"} 🌿 This is your safe space. Nothing you write here leaves your phone.`);
    await say("How are you feeling right now?");
    jSession.mood = await ask({ chips: jMoods.map((m) => ({ label: `${m.e} ${m.label}`, value: m.v })) });
    await say(moodReply[jSession.mood]);

    if (positiveMoods.has(jSession.mood)) {
      await gratitude();
      await say("Is anything on your mind that you'd like to write about?");
      const more = await ask({ chips: ["Yes, something's bugging me", "No, that's all"] });
      if (more.startsWith("No")) return await finish();
    }

    await say("How strong is that feeling right now, from 0 (barely there) to 10 (overwhelming)?");
    jSession.before = Number(await ask({ chips: scale() }));

    await say("What's on your mind? Write as much or as little as you like.");
    const text = await ask({ text: true, placeholder: "I'm feeling this way because…" });
    await reflect(text);
    await toolLoop();
    await finish();
  } catch (err) {
    if (err !== CANCELLED) throw err;
  }
}

async function reflect(text) {
  const theme = themes.find((t) => t.re.test(text));
  const distortion = distortions.find((d) => d.re.test(text));
  await say(theme ? theme.reply : validations[text.length % validations.length]);
  if (theme?.action) await say("If your stomach is hurting right now, the flare-up steps might help." + goButton(theme.action.label, theme.action.go));
  if (distortion) {
    jSession.distortion = distortion.name;
    await say(`I noticed something in what you wrote that might be <b>${distortion.name}</b>. ${distortion.tip}`);
  }
}

async function toolLoop() {
  let first = true;
  for (;;) {
    await say(first ? "Would you like to try something that might help?" : "Would you like to try something else, or shall we wrap up?");
    const tool = await ask({
      chips: [
        { label: "🔄 See the thought differently", value: "reframe" },
        { label: "🫁 Calm my body", value: "breathe" },
        { label: "🌍 Ground me in the moment", value: "ground" },
        { label: "🎯 Can I control this?", value: "control" },
        ...(cookies.length ? [{ label: "🍪 Open my cookie jar", value: "jar" }] : []),
        first ? { label: "💬 I just needed to vent", value: "vent" } : { label: "✅ Wrap up", value: "done" },
      ],
    });
    if (tool === "vent") {
      await say("Thank you for letting it out. Putting feelings into words moves them out of your head and onto the page, and that alone can lighten the load.");
      return;
    }
    if (tool === "done") return;
    jSession.tools.push(tool);
    await tools[tool]();
    first = false;
  }
}

const tools = {
  async jar() {
    await say("Let's open your cookie jar. These are things you've already achieved, starting with your proudest.");
    await new Promise((resolve) => openBoost(null, resolve));
    await say(`That's ${cookies.length} reminder${cookies.length > 1 ? "s" : ""} of what you can do. The person who did all that is the same person facing this today. 💚`);
  },

  async reframe() {
    await say("Let's look at the thought itself. In one sentence, what's the thought that's bothering you most?");
    const thought = await ask({ text: true, placeholder: "e.g. I'll embarrass myself if my stomach acts up" });
    await say("How much do you believe that thought right now, 0 to 10?");
    const beliefBefore = Number(await ask({ chips: scale() }));
    await say("What makes this thought feel true?");
    await ask({ text: true, placeholder: "The evidence for it…" });
    await say("Now, what doesn't fit? Is there anything that shows it might not be the whole story?");
    const against = await ask({ text: true, chips: ["I can't think of anything"], placeholder: "The evidence against it…" });
    if (against === "I can't think of anything") {
      await say("That's okay, it's hard when we're upset. Has there ever been a time this didn't happen, or turned out better than you expected?");
      await ask({ text: true, placeholder: "One time it went better…" });
    }
    await say("If your best friend told you they had this thought, what would you say to them?");
    await ask({ text: true, placeholder: "I'd tell them…" });
    await say("Now try writing a kinder, more balanced version of your original thought.");
    const reframe = await ask({ text: true, placeholder: "A fairer way to see it is…" });
    await say(`Here's your new thought. Come back to it whenever you need it:<blockquote>${escapeHtml(reframe)}</blockquote>`);
    await say(`Looking at the original thought again (“${escapeHtml(thought)}”), how much do you believe it now, 0 to 10?`);
    const beliefAfter = Number(await ask({ chips: scale() }));
    jSession.reframe = { thought, reframe, beliefBefore, beliefAfter };
    await say(beliefAfter < beliefBefore
      ? `It went from ${beliefBefore} to ${beliefAfter}. That's your mind loosening its grip on that thought. Well done. 💚`
      : "That's okay. Thoughts can be sticky, and practising this makes it easier each time. Just questioning a thought is a big step.");
  },

  async breathe() {
    await say("Let's take three slow breaths together. Breathe into your belly, so it rises as you breathe in.");
    const b = await say(`<div class="mini-breath" id="miniBreath"></div><span id="miniBreathText">Get comfortable…</span>`, 600);
    const circle = b.querySelector(".mini-breath");
    const label = b.querySelector("span");
    const run = chatRun;
    await sleep(1500);
    for (let i = 1; i <= 3; i++) {
      if (run !== chatRun) throw CANCELLED;
      label.textContent = `Breathe in slowly… (${i} of 3)`;
      circle.style.transitionDuration = "4s";
      circle.style.transform = "scale(1.6)";
      await sleep(4000);
      label.textContent = "And breathe out gently…";
      circle.style.transitionDuration = "6s";
      circle.style.transform = "scale(1)";
      await sleep(6000);
    }
    label.textContent = "Lovely. 🌿";
    await say("How does your body feel now?");
    const felt = await ask({ chips: ["A bit calmer", "About the same", "Still tense"] });
    jSession.steps.push("Breathing: " + felt.toLowerCase());
    await say(felt === "A bit calmer"
      ? "I'm glad. Slow breathing tells your nervous system, and your gut, that you're safe."
      : "That's okay. Sometimes it takes a few minutes. The Breathe screen has a longer guided session." + goButton("Open Breathe", "breathe"));
  },

  async ground() {
    await say("Let's bring your attention back to right now with 5-4-3-2-1. You can type them, or just notice them and tap Done.");
    const senses = [
      "Name <b>5 things you can see</b> around you.",
      "Now <b>4 things you can feel</b>: your feet on the floor, your clothes, the air…",
      "<b>3 things you can hear</b>, near or far.",
      "<b>2 things you can smell</b>, or two smells you like.",
      "And <b>1 thing you can taste</b>, or one kind thing about yourself.",
    ];
    for (const s of senses) {
      await say(s, 700);
      await ask({ text: true, chips: ["Done ✓"], placeholder: "Type or tap Done" });
    }
    await say("Nicely done. You just brought your mind back to the present moment, where you're safe. Worries live in the future, and you're here now.");
  },

  async control() {
    await say("Let's sort this worry. Is any part of it something you can actually do something about?");
    const ans = await ask({ chips: ["Yes, some of it", "Not really", "I'm not sure"] });
    if (ans === "Not really") {
      await say("Then holding on tightly won't change it, but it will keep hurting you. Try this: picture writing the worry on a leaf and placing it on a stream. Watch it float away. You can always pick it back up later.");
      const r = await ask({ chips: ["🍃 I let it float away", "It's still there"] });
      await say(r.startsWith("🍃")
        ? "Beautiful. Come back to that image whenever this worry returns."
        : "That's okay. Worries often come back, and each time you can gently set them down again. It gets easier with practice.");
      return;
    }
    await say(ans === "I'm not sure"
      ? "Let's split it up. Which part could you influence, even a tiny bit?"
      : "What's one tiny step you could take, something that would take 5 minutes or less?");
    const step = await ask({ text: true, placeholder: "One small step…" });
    jSession.steps.push("Next step: " + step);
    await say("That's a great step. Small actions shrink big worries. For the parts you can't control, it's okay to let them be for now.");
  },
};

async function gratitude() {
  await say("Let's hold onto that. Name three small things that went okay today. They can be tiny, like a good cup of tea.");
  const g = await ask({ text: true, placeholder: "1. … 2. … 3. …" });
  jSession.gratitude = g;
  await say("Lovely. Noticing good moments trains your brain to spot them more often, even on harder days.");
}

async function finish() {
  if (jSession.before !== null) {
    await say("Before we finish: how strong is that feeling now, 0 to 10?");
    jSession.after = Number(await ask({ chips: scale() }));
    const { before, after } = jSession;
    await say(after < before
      ? `That's a drop from <b>${before}</b> to <b>${after}</b>. You did that. 💚`
      : after === before
        ? "Feelings don't always shift right away, and that's okay. You showed up for yourself, and that counts."
        : "Thank you for being honest. If things keep getting harder, please talk to someone you trust or a professional. You don't have to carry this alone.");
  }
  saveJournal(jSession);
  await say(`I've saved this to your journal. ${affirmations[Math.floor(Math.random() * affirmations.length)]}`);
  const again = await ask({ chips: ["💬 Talk again", "📖 See my journal"] });
  if (again.includes("journal")) showJTab("history");
  runChat();
}

function saveJournal(s) {
  s.updated = Date.now();
  journal = journal.filter((x) => x.id !== s.id).concat(s);
  store.set("journal", journal);
  renderJournal();
}

/* Free writing */
let freeMood = null;
$("#freeMoodChips").innerHTML = jMoods.map((m) => `<button type="button" class="chip" data-fmood="${m.v}">${m.e} ${m.label}</button>`).join("");
$("#freeMoodChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fmood]");
  if (!b) return;
  freeMood = b.dataset.fmood;
  $$("[data-fmood]").forEach((x) => x.classList.toggle("active", x === b));
});
$("#freeWriteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#freeText").value.trim();
  if (!text) return toast("Write a few words first");
  const s = { id: Date.now(), start: Date.now(), type: "free", mood: freeMood, entries: [{ q: "Free writing", a: text }] };
  saveJournal(s);
  const distortion = distortions.find((d) => d.re.test(text));
  const theme = themes.find((t) => t.re.test(text));
  const reply = $("#freeReply");
  reply.hidden = false;
  reply.innerHTML = crisisRe.test(text)
    ? `<strong>Thank you for writing this down. You deserve support from a real person.</strong> If you might hurt yourself, please call your local emergency number, or in India Tele-MANAS <a href="tel:14416">14416</a>, in the US <a href="tel:988">988</a>, or find a helpline at <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>.`
    : `<strong>Saved 💚</strong> ${theme ? theme.reply : "Getting it out of your head and onto the page is a real step."}
       ${distortion ? `<p>I noticed a hint of <b>${distortion.name}</b>. ${distortion.tip}</p>` : ""}
       <p><button class="btn ghost small" id="freeToHistory">📖 View in my journal</button>
       <button class="btn ghost small" id="freeToChat">💬 Talk it through</button></p>`;
  $("#freeToChat")?.addEventListener("click", () => { showJTab("chat"); runChat(); });
  $("#freeToHistory")?.addEventListener("click", () => showJTab("history"));
  e.target.reset();
  freeMood = null;
  $$("[data-fmood]").forEach((x) => x.classList.remove("active"));
});

/* History */
const toolNames = { jar: "Cookie jar", reframe: "Reframed a thought", breathe: "Breathing", ground: "Grounding", control: "Control check" };
function renderJournal() {
  const chats = journal.filter((s) => s.before != null && s.after != null);
  const eased = chats.filter((s) => s.after < s.before).length;
  const avgDrop = chats.length ? chats.reduce((a, s) => a + (s.before - s.after), 0) / chats.length : 0;
  $("#journalStats").innerHTML = `
    <h2>Your journal</h2>
    <div class="stat-row">
      <div class="stat"><b>${journal.length}</b>entries</div>
      <div class="stat"><b>${eased}</b>times you felt lighter</div>
      <div class="stat"><b>${avgDrop > 0 ? "−" + avgDrop.toFixed(1) : "–"}</b>average shift</div>
    </div>`;
  $("#journalList").innerHTML = journal.length
    ? journal.slice().reverse().map((s) => `
      <li><details>
        <summary>
          <span><strong>${s.mood ? moodEmoji[s.mood] + " " : ""}${new Date(s.start).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</strong>
          <span class="entry-meta">${s.type === "free" ? "Free writing" : (s.tools || []).map((t) => toolNames[t]).join(", ") || "Chat"}</span></span>
          ${s.before != null && s.after != null ? `<span class="shift">${s.before} → ${s.after}</span>` : ""}
        </summary>
        <dl class="qa">
          ${s.gratitude ? `<dt>Three good things</dt><dd>${escapeHtml(s.gratitude)}</dd>` : ""}
          ${s.entries.filter((x) => x.a !== "Done ✓").map((x) => `<dt>${escapeHtml(x.q)}</dt><dd>${escapeHtml(x.a)}</dd>`).join("")}
          ${s.reframe ? `<dt>🔄 New thought</dt><dd><b>${escapeHtml(s.reframe.reframe)}</b> (belief in the old thought: ${s.reframe.beliefBefore} → ${s.reframe.beliefAfter})</dd>` : ""}
          ${(s.steps || []).map((x) => `<dd>• ${escapeHtml(x)}</dd>`).join("")}
        </dl>
        <button class="link-btn" data-jdel="${s.id}">Delete entry</button>
      </details></li>`).join("")
    : `<li class="muted">Nothing here yet. Your chats and writing will appear here.</li>`;
}
$("#journalList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-jdel]");
  if (!b || !(await askConfirm("Delete this journal entry?", "Delete"))) return;
  journal = journal.filter((s) => String(s.id) !== b.dataset.jdel);
  store.set("journal", journal);
  renderJournal();
});

/* Tabs */
function showJTab(tab) {
  $$("[data-jtab]").forEach((b) => b.classList.toggle("active", b.dataset.jtab === tab));
  $$(".jpane").forEach((p) => (p.hidden = p.id !== "jpane-" + tab));
  $("#newChatBtn").hidden = tab !== "chat";
}
$$("[data-jtab]").forEach((b) => b.addEventListener("click", () => showJTab(b.dataset.jtab)));
$("#newChatBtn").addEventListener("click", runChat);

// Start the chat the first time the Journal tab opens.
$$('[data-go="journal"]').forEach((b) => b.addEventListener("click", () => { if (!chatStarted) runChat(); }));
window.addEventListener("hashchange", () => { if (location.hash === "#journal" && !chatStarted) runChat(); });
if (location.hash === "#journal") runChat();
renderJournal();

/* ---------- Cookie jar ---------- */
// Achievements live in localStorage; photos are too big for it, so they go in IndexedDB as resized JPEGs.
const photoDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("gentle-gut", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("photos");
      req.onsuccess = () => resolve((this.db = req.result));
      req.onerror = () => reject(req.error);
    });
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("photos", mode);
      const req = fn(tx.objectStore("photos"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
  get: (id) => photoDB.run("readonly", (s) => s.get(id)),
  put: (id, blob) => photoDB.run("readwrite", (s) => s.put(blob, id)),
  del: (id) => photoDB.run("readwrite", (s) => s.delete(id)),
};

const photoUrls = new Map();
async function photoUrl(id) {
  if (!photoUrls.has(id)) {
    // Not on this device yet (e.g. added on another phone): fetch it from the account if signed in.
    const blob = (await photoDB.get(id).catch(() => null)) || (await window.Sync?.fetchPhoto(id));
    if (!blob) return "";
    photoUrls.set(id, URL.createObjectURL(blob));
  }
  return photoUrls.get(id);
}
function loadPhotos(root) {
  root.querySelectorAll("img[data-pid]").forEach(async (img) => {
    img.src = await photoUrl(img.dataset.pid);
  });
}

// Phone photos can be 5–10 MB; shrink them so dozens fit comfortably on the device.
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error("decode")); };
    img.src = src;
  });
}

const MAX_PHOTOS = 6;
let cookies = store.get("cookies", []);
let cForm = { id: null, rating: null, photos: [], removed: [] };
const cookieDialog = $("#cookieDialog");

const byRating = (a, b) => b.rating - a.rating || b.date.localeCompare(a.date);
const fmtCookieDate = (d) => new Date(d + "T12:00").toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

function renderRating() {
  $("#cookieRating").innerHTML = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return `<button type="button" role="radio" aria-checked="${n === cForm.rating}" data-rate="${n}"
      class="${cForm.rating && n <= cForm.rating ? "on" : ""} ${n === cForm.rating ? "picked" : ""}">${n}</button>`;
  }).join("");
  $("#cookieRatingVal").textContent = cForm.rating ?? "–";
}
$("#cookieRating").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rate]");
  if (!b) return;
  cForm.rating = Number(b.dataset.rate);
  renderRating();
});

function renderFormPhotos() {
  $("#cookiePhotos").innerHTML = cForm.photos.map((p, i) =>
    `<div class="photo-thumb"><img src="${p.url}" alt=""><button type="button" data-rmphoto="${i}" aria-label="Remove photo">✕</button></div>`
  ).join("");
}
$("#cookiePhotos").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rmphoto]");
  if (!b) return;
  const [p] = cForm.photos.splice(Number(b.dataset.rmphoto), 1);
  if (p.isNew) URL.revokeObjectURL(p.url);
  else cForm.removed.push(p.id);
  renderFormPhotos();
});

$("#cookiePhotoInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  const room = MAX_PHOTOS - cForm.photos.length;
  if (files.length > room) toast(`Up to ${MAX_PHOTOS} photos per cookie`);
  for (const file of files.slice(0, Math.max(0, room))) {
    try {
      const blob = await resizeImage(file);
      cForm.photos.push({ id: `p${Date.now()}${Math.random().toString(36).slice(2, 7)}`, blob, url: URL.createObjectURL(blob), isNew: true });
      renderFormPhotos();
    } catch {
      toast("Couldn't read that photo");
    }
  }
});

async function openCookieForm(cookie = null) {
  cForm = { id: cookie?.id ?? null, rating: cookie?.rating ?? null, photos: [], removed: [] };
  $("#cookieDialogTitle").textContent = cookie?.id ? "Edit cookie 🍪" : "Add a cookie 🍪";
  $("#cookieTitle").value = cookie?.title ?? "";
  $("#cookieStory").value = cookie?.story ?? "";
  $("#cookieDate").value = cookie?.date ?? todayKey();
  renderRating();
  renderFormPhotos();
  cookieDialog.showModal();
  if (cookie?.photoIds?.length) {
    for (const id of cookie.photoIds) cForm.photos.push({ id, url: await photoUrl(id), isNew: false });
    renderFormPhotos();
  }
}
function closeCookieForm() {
  cForm.photos.filter((p) => p.isNew).forEach((p) => URL.revokeObjectURL(p.url));
  cookieDialog.close();
}
$("#addCookieBtn").addEventListener("click", () => openCookieForm());
$("#cookieCancel").addEventListener("click", closeCookieForm);
cookieDialog.addEventListener("cancel", (e) => { e.preventDefault(); closeCookieForm(); });

$("#cookieForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#cookieTitle").value.trim();
  if (!title) return toast("Give your cookie a name");
  if (!cForm.rating) return toast("Pick how proud you are, 1 to 10");
  try {
    for (const p of cForm.photos.filter((p) => p.isNew)) {
      await photoDB.put(p.id, p.blob);
      photoUrls.set(p.id, p.url); // reuse the preview URL
    }
    for (const id of cForm.removed) {
      await photoDB.del(id);
      URL.revokeObjectURL(photoUrls.get(id));
      photoUrls.delete(id);
    }
  } catch {
    return toast("Couldn't save the photos. Your phone's storage may be full.");
  }
  const data = {
    title,
    story: $("#cookieStory").value.trim(),
    rating: cForm.rating,
    date: $("#cookieDate").value || todayKey(),
    photoIds: cForm.photos.map((p) => p.id),
  };
  const isNew = !cForm.id;
  if (isNew) cookies.push({ id: Date.now(), created: Date.now(), ...data });
  else Object.assign(cookies.find((c) => c.id === cForm.id), data);
  store.set("cookies", cookies);
  cForm.photos.forEach((p) => (p.isNew = false)); // now owned by photoUrls, don't revoke
  cookieDialog.close();
  renderJar();
  toast(isNew ? "🍪 Into the jar! Well done." : "Cookie updated");
  navigator.storage?.persist?.().catch(() => {}); // ask the browser not to clear the jar when space is low
});

function renderJar() {
  const n = cookies.length;
  $("#jarCookies").innerHTML = '<span class="cookie-dot"></span>'.repeat(Math.min(n, 15));
  $("#jarCount").textContent = n ? `${n} cookie${n > 1 ? "s" : ""} in your jar` : "Your jar is empty. Add your first win!";
  $("#boostBtn").disabled = !n;

  const sorted = cookies.slice().sort($("#jarSort").value === "date" ? (a, b) => b.date.localeCompare(a.date) || b.id - a.id : byRating);
  $("#cookieList").innerHTML = n
    ? sorted.map((c) => `
      <li class="cookie-card">
        ${c.photoIds.length ? `<div class="cookie-photos">${c.photoIds.slice(0, 3).map((id) => `<img data-pid="${id}" data-open="${c.id}" alt="">`).join("")}</div>` : ""}
        <div class="cookie-body">
          <div class="cookie-head">
            <span class="cookie-title">${escapeHtml(c.title)}</span>
            <span class="cookie-rating">🍪 ${c.rating}/10</span>
          </div>
          <span class="entry-meta">${fmtCookieDate(c.date)}${c.photoIds.length > 3 ? ` · ${c.photoIds.length} photos` : ""}</span>
          ${c.story ? `<p class="cookie-story">${escapeHtml(c.story)}</p>` : ""}
          <div class="cookie-actions">
            <button class="link-btn" data-edit="${c.id}">Edit</button>
            <button class="link-btn" data-del="${c.id}">Delete</button>
          </div>
        </div>
      </li>`).join("")
    : `<li class="muted">Small wins count too: a good day at work, eating out without a flare, asking for help, getting out of bed on a hard day.</li>`;
  loadPhotos($("#cookieList"));
}
$("#jarSort").addEventListener("change", renderJar);
$("#cookieList").addEventListener("click", async (e) => {
  const find = (id) => cookies.find((c) => String(c.id) === id);
  const t = e.target;
  if (t.dataset.edit) return openCookieForm(find(t.dataset.edit));
  if (t.dataset.open) return openBoost(Number(t.dataset.open));
  if (t.dataset.del && (await askConfirm("Remove this cookie from your jar?", "Remove"))) {
    const c = find(t.dataset.del);
    for (const id of c.photoIds) {
      await photoDB.del(id).catch(() => {});
      URL.revokeObjectURL(photoUrls.get(id));
      photoUrls.delete(id);
    }
    cookies = cookies.filter((x) => x !== c);
    store.set("cookies", cookies);
    renderJar();
  }
});

/* Boost: walk through the jar from proudest (10) down to 1 */
const boostDialog = $("#boostDialog");
const youLines = ["You did this.", "That was all you.", "Remember how that felt?", "You've done hard things before.", "Proof that you keep going."];
let boost = { slides: [], i: 0, photo: 0, onClose: null };

function openBoost(startId = null, onClose = null) {
  if (!cookies.length) return toast("Add a cookie first");
  const order = cookies.slice().sort(byRating);
  boost = { slides: ["intro", ...order, "end"], i: 0, photo: 0, onClose };
  if (startId) boost.i = boost.slides.findIndex((s) => s.id === startId);
  renderBoost();
  boostDialog.showModal();
}

function renderBoost() {
  const s = boost.slides[boost.i];
  const total = boost.slides.length - 2;
  const stage = $("#boostStage");
  if (s === "intro") {
    stage.innerHTML = `<div class="boost-intro"><div class="big">🍪</div>
      <h2>You have ${total} cookie${total > 1 ? "s" : ""} in your jar</h2>
      <p class="boost-story">Hard days make us forget what we're capable of. Let's look back, starting with your proudest moment.</p></div>`;
  } else if (s === "end") {
    stage.innerHTML = `<div class="boost-end"><div class="big">💪</div>
      <h2>Every one of these was you.</h2>
      <p class="boost-story">The person who did all that is the same person facing today. You can do hard things again. 💚</p></div>`;
  } else {
    const p = s.photoIds;
    stage.innerHTML = `
      ${p.length ? `<div class="boost-photo">
        <img data-pid="${p[boost.photo]}" alt="">
        ${p.length > 1 ? `<button class="photo-step prev" data-step="-1" aria-label="Previous photo"></button>
        <button class="photo-step next" data-step="1" aria-label="Next photo"></button>
        <div class="photo-dots">${p.map((_, j) => `<i class="${j === boost.photo ? "on" : ""}"></i>`).join("")}</div>` : ""}
      </div>` : ""}
      <div class="boost-rating">${"🍪".repeat(Math.ceil(s.rating / 2))} ${s.rating}/10 proud</div>
      <h2>${escapeHtml(s.title)}</h2>
      ${s.story ? `<p class="boost-story">${escapeHtml(s.story)}</p>` : ""}
      <div class="boost-date">${fmtCookieDate(s.date)}</div>
      <div class="boost-you">${youLines[boost.i % youLines.length]}</div>`;
    loadPhotos(stage);
  }
  $("#boostPrev").disabled = boost.i === 0;
  $("#boostNext").textContent = s === "end" ? "Close" : s === "intro" ? "Start ›" : "Next ›";
  $("#boostPos").textContent = typeof s === "object" ? `${boost.i} of ${total}` : "";
  stage.scrollTop = 0;
}
function stepBoost(d) {
  const next = boost.i + d;
  if (next >= boost.slides.length) return closeBoost();
  if (next < 0) return;
  boost.i = next;
  boost.photo = 0;
  renderBoost();
}
function closeBoost() {
  boostDialog.close();
  const cb = boost.onClose;
  boost.onClose = null;
  cb?.();
}
$("#boostNext").addEventListener("click", () => stepBoost(1));
$("#boostPrev").addEventListener("click", () => stepBoost(-1));
$("#boostClose").addEventListener("click", closeBoost);
boostDialog.addEventListener("cancel", (e) => { e.preventDefault(); closeBoost(); });
$("#boostStage").addEventListener("click", (e) => {
  const b = e.target.closest("[data-step]");
  if (!b) return;
  const n = boost.slides[boost.i].photoIds.length;
  boost.photo = (boost.photo + Number(b.dataset.step) + n) % n;
  renderBoost();
});
boostDialog.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") stepBoost(1);
  if (e.key === "ArrowLeft") stepBoost(-1);
});
let touchX = null;
boostDialog.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
boostDialog.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60) stepBoost(dx < 0 ? 1 : -1);
});
$("#boostBtn").addEventListener("click", () => openBoost());

renderJar();

/* ---------- Brave steps: facing fears little by little ---------- */
// Graded exposure, as used in CBT for IBS: pick something you avoid, break it into small steps,
// repeat each step until it feels okay, then move up.
const ladderTemplates = [
  { key: "eatout", icon: "🍽️", title: "Eating out", steps: [
    "Buy a takeaway drink and have it outside",
    "Sit in a café for 15 minutes with a drink",
    "Eat a small snack at a café",
    "Eat a meal at a quiet restaurant at a quiet time",
    "Eat out with a friend you trust",
    "Eat at a busy restaurant",
  ] },
  { key: "travel", icon: "🚌", title: "Travel & journeys", steps: [
    "Take a 10-minute trip by bus, train or car",
    "Take a 30-minute journey you know well",
    "Go on a journey without checking where the toilets are first",
    "Take a 1-hour journey",
    "Go on a day trip somewhere new",
  ] },
  { key: "toilet", icon: "🚻", title: "Being away from a toilet", steps: [
    "Go for a 10-minute walk away from home",
    "Spend 20 minutes in a shop or park",
    "Watch a whole film at a cinema or a friend's place",
    "Spend an hour somewhere you don't know where the toilet is",
    "Spend a whole morning out",
  ] },
  { key: "social", icon: "👥", title: "Social plans", steps: [
    "Message a friend to say hi",
    "Meet a friend for a short walk",
    "Have a coffee or tea with a friend",
    "Say yes to an invitation you'd usually turn down",
    "Go to a gathering or party for an hour",
    "Tell a trusted friend about your IBS",
  ] },
  { key: "work", icon: "💼", title: "Work or college", steps: [
    "Sit through a whole class or meeting",
    "Eat lunch with classmates or coworkers",
    "Speak up once in a class or meeting",
    "Go in without your usual backup plan",
    "Go on a work or study trip",
  ] },
];
const foodChallengeSteps = [
  "A tiny taste (about 1 teaspoon)",
  "A small portion (about a quarter of a normal serving)",
  "Half a normal serving",
  "A normal serving",
];
const CHALLENGE_GAP_DAYS = 2;

let ladders = store.get("brave", []);
let openLadderId = null;
let editingLadder = false;
const braveDialog = $("#braveDialog");
const newId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

const nextStep = (l) => l.steps.find((st) => !st.done);
const stepsDone = (l) => l.steps.filter((st) => st.done).length;
const findLadder = (id) => ladders.find((l) => String(l.id) === String(id));

function saveLadders() {
  store.set("brave", ladders);
  renderBrave();
  renderToday();
}

function makeLadder({ key = null, icon, title, kind = "situation", food = null, steps }) {
  const l = { id: newId(), key, icon, title, kind, food, created: Date.now(),
    steps: steps.map((text) => ({ id: newId(), text, done: false, tries: [] })) };
  ladders.push(l);
  saveLadders();
  openLadder(l.id);
  toast("Ladder ready. Start with the first step 🧗");
}

/* List of ladders + templates */
function renderBrave() {
  $("#braveHome").hidden = !!openLadderId;
  $("#braveDetail").hidden = !openLadderId;
  if (openLadderId) return renderLadderDetail();

  const sorted = ladders.slice().sort((a, b) => !!a.finished - !!b.finished || b.created - a.created);
  $("#ladderList").innerHTML = sorted.length
    ? `<h2 class="section-title">My ladders</h2>` + sorted.map((l) => {
        const done = stepsDone(l), total = l.steps.length, next = nextStep(l);
        return `<button class="card ladder-card" data-open-ladder="${l.id}">
          <span class="ladder-icon">${l.icon}</span>
          <span class="ladder-info">
            <b>${escapeHtml(l.title)}</b>
            <span class="progress"><span style="width:${total ? (done / total) * 100 : 0}%"></span></span>
            <small>${next ? `Next: ${escapeHtml(next.text)}` : "🏆 Completed!"}</small>
          </span>
          <span class="ladder-count">${done}/${total}</span>
        </button>`;
      }).join("")
    : "";

  $("#templateGrid").innerHTML = ladderTemplates.map((t) =>
    `<button class="template" data-template="${t.key}"><span>${t.icon}</span>${t.title}</button>`).join("") +
    `<button class="template" data-new-food><span>🥄</span>Try a bad food again</button>
     <button class="template" data-new-custom><span>✏️</span>My own fear</button>`;
}

$("#ladderList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-open-ladder]");
  if (b) openLadder(b.dataset.openLadder);
});
$("#templateGrid").addEventListener("click", (e) => {
  const t = e.target.closest("[data-template]");
  if (t) {
    const tpl = ladderTemplates.find((x) => x.key === t.dataset.template);
    const existing = ladders.find((l) => l.key === tpl.key && !l.finished);
    if (existing) return openLadder(existing.id);
    return makeLadder({ key: tpl.key, icon: tpl.icon, title: tpl.title, steps: tpl.steps });
  }
  if (e.target.closest("[data-new-food]")) return openFoodChallenge();
  if (e.target.closest("[data-new-custom]")) return openCustomLadder();
});

function openLadder(id) {
  openLadderId = String(id);
  editingLadder = false;
  if (currentView !== "brave") go("brave");
  renderBrave();
  window.scrollTo({ top: 0 });
}

/* One ladder */
function renderLadderDetail() {
  const l = findLadder(openLadderId);
  if (!l) { openLadderId = null; return renderBrave(); }
  const next = nextStep(l);
  const isFood = l.kind === "food";
  const lastTry = (st) => st.tries[st.tries.length - 1];
  const waitUntil = (() => {
    if (!isFood || !next) return 0;
    const prevDone = l.steps.filter((st) => st.done).map(lastTry).filter(Boolean).pop();
    return prevDone ? prevDone.time + CHALLENGE_GAP_DAYS * 86400000 : 0;
  })();

  $("#braveDetail").innerHTML = `
    <button class="back-btn" data-ladders>‹ All ladders</button>
    <h1>${l.icon} ${escapeHtml(l.title)}</h1>
    <p class="muted">${stepsDone(l)} of ${l.steps.length} steps done${l.finished ? " · 🏆 completed" : ""}</p>
    ${isFood ? `<div class="card warn small-card">⚠️ Only for foods that upset your stomach. <b>Never</b> do this with a food you're allergic to. Leave ${CHALLENGE_GAP_DAYS}–3 days between steps, and stop if you feel unwell.</div>` : ""}
    <ol class="ladder-steps">
      ${l.steps.map((st, i) => {
        const state = st.done ? "done" : st === next ? "current" : "later";
        const tries = st.tries.length;
        return `<li class="${state}">
          <span class="rung">${st.done ? "✓" : i + 1}</span>
          <div class="rung-body">
            <span class="rung-text">${escapeHtml(st.text)}</span>
            ${tries ? `<small class="muted">Tried ${tries}×</small>` : ""}
            ${state === "current" ? `
              ${waitUntil > Date.now() ? `<small class="wait-note">Give your gut a rest: next try from ${new Date(waitUntil).toLocaleDateString([], { weekday: "long" })}.</small>` : ""}
              <div class="rung-actions">
                ${isFood ? "" : `<button class="btn ghost small" data-ready="${st.id}">💪 Get ready</button>`}
                <button class="btn primary small" data-tried="${st.id}">✓ I tried it</button>
              </div>` : ""}
            ${state === "done" && !isFood ? `<button class="link-btn" data-tried="${st.id}">Practise again</button>` : ""}
            ${editingLadder ? `<div class="rung-edit">
              <button class="link-btn" data-move="${st.id}" data-dir="-1" aria-label="Move up">↑</button>
              <button class="link-btn" data-move="${st.id}" data-dir="1" aria-label="Move down">↓</button>
              <button class="link-btn" data-del-step="${st.id}">Delete</button></div>` : ""}
          </div>
        </li>`;
      }).join("")}
    </ol>
    ${!next ? `<div class="card soft center">🏆 <b>You climbed the whole ladder!</b><br>That took real courage.
       <br><button class="btn ghost small" data-cookie-ladder>🍪 Add to cookie jar</button></div>` : ""}
    ${editingLadder ? `
      <form class="add-row" id="addStepForm">
        <input type="text" id="newStepText" placeholder="Add a step" maxlength="140">
        <button class="btn ghost" type="submit">Add</button>
      </form>
      <button class="btn ghost danger-btn" data-del-ladder>Delete this ladder</button>` : ""}
    ${isFood ? "" : `<button class="link-btn edit-toggle" data-edit-ladder>${editingLadder ? "Done editing" : "✏️ Edit steps"}</button>`}`;
}

$("#braveDetail").addEventListener("click", async (e) => {
  const l = findLadder(openLadderId);
  const t = e.target.closest("button");
  if (!t || !l) return;
  const step = (id) => l.steps.find((st) => String(st.id) === id);
  if (t.matches("[data-ladders]")) { openLadderId = null; return renderBrave(); }
  if (t.dataset.ready) return showReady(l, step(t.dataset.ready));
  if (t.dataset.tried) return openTry(l, step(t.dataset.tried));
  if (t.matches("[data-edit-ladder]")) { editingLadder = !editingLadder; return renderLadderDetail(); }
  if (t.dataset.move) {
    const i = l.steps.findIndex((st) => String(st.id) === t.dataset.move);
    const j = i + Number(t.dataset.dir);
    if (j < 0 || j >= l.steps.length) return;
    [l.steps[i], l.steps[j]] = [l.steps[j], l.steps[i]];
    return saveLadders();
  }
  if (t.dataset.delStep) {
    if (l.steps.length <= 1) return toast("A ladder needs at least one step");
    l.steps = l.steps.filter((st) => String(st.id) !== t.dataset.delStep);
    return saveLadders();
  }
  if (t.matches("[data-del-ladder]")) {
    if (!(await askConfirm(`Delete the “${l.title}” ladder?`, "Delete"))) return;
    ladders = ladders.filter((x) => x !== l);
    openLadderId = null;
    return saveLadders();
  }
  if (t.matches("[data-cookie-ladder]")) {
    return openCookieForm({ title: `Climbed my “${l.title}” ladder`, story: l.steps.map((st) => "✓ " + st.text).join("\n"), photoIds: [] });
  }
});
$("#braveDetail").addEventListener("submit", (e) => {
  if (e.target.id !== "addStepForm") return;
  e.preventDefault();
  const text = $("#newStepText").value.trim();
  if (!text) return;
  const l = findLadder(openLadderId);
  l.steps.push({ id: newId(), text, done: false, tries: [] });
  l.finished = null;
  saveLadders();
});

/* Dialog helpers */
function showBraveDialog(html) {
  $("#braveDialogBody").innerHTML = html;
  if (!braveDialog.open) braveDialog.showModal();
}
$("#braveDialogClose").addEventListener("click", () => braveDialog.close());

function showReady(l, st) {
  showBraveDialog(`
    <h2 id="braveDialogTitle">You've got this 💪</h2>
    <p class="muted">${escapeHtml(st.text)}</p>
    <ul class="ready-tips">
      <li>😟 <b>Feeling nervous is normal.</b> Worry rises, peaks, and then drops if you stay with it.</li>
      <li>🫧 <b>Breathe slowly</b> into your belly before and during.</li>
      <li>🎒 <b>Plan small comforts:</b> water, any medicine your doctor suggested, and the Flare-up steps on your phone.</li>
      <li>⏳ <b>Stay until the worry drops a little</b>, rather than leaving at its peak.</li>
      <li>✓ <b>Afterwards, come back</b> and tap “I tried it”, even if it was hard.</li>
    </ul>
    <div class="dialog-actions">
      <button class="btn ghost" data-dialog-go="breathe">🫧 Breathe first</button>
      <button class="btn primary" data-dialog-close>I'm ready</button>
    </div>`);
}
$("#braveDialogBody").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.dialogGo) { braveDialog.close(); go(b.dataset.dialogGo); }
  if (b.matches("[data-dialog-close]")) braveDialog.close();
});

/* Recording a try */
const tryQuestions = {
  situation: [
    { key: "before", q: "Before you started, how scary did it feel?", opts: [["calm", "😌", "Okay"], ["nervous", "😟", "Nervous"], ["scared", "😨", "Scared"]] },
    { key: "result", q: "How did it go?", opts: [["easier", "🙂", "Easier than I feared"], ["expected", "😐", "As I expected"], ["harder", "😣", "Harder than I feared"]] },
    { key: "feared", q: "Did what you feared actually happen?", opts: [["no", "🙌", "No"], ["little", "🤏", "A little"], ["yes", "😔", "Yes"]] },
  ],
  food: [
    { key: "stomach", q: "How was your stomach afterwards?", opts: [["fine", "😊", "Fine"], ["bad", "😣", "Bad"], ["worst", "😖", "Worst"]] },
  ],
};
let tryState = null;

function openTry(l, st) {
  tryState = { l, st, answers: {} };
  renderTry();
}
function renderTry() {
  const { l, st, answers } = tryState;
  const qs = tryQuestions[l.kind === "food" ? "food" : "situation"];
  const complete = qs.every((q) => answers[q.key]);
  showBraveDialog(`
    <h2 id="braveDialogTitle">Well done for trying 🌟</h2>
    <p class="muted">${escapeHtml(l.kind === "food" ? `${st.text} of ${l.food}` : st.text)}</p>
    ${qs.map((q) => `
      <p class="field-label">${q.q}</p>
      <div class="answer-row try-row">
        ${q.opts.map(([v, emo, label]) => `<button class="answer ${answers[q.key] === v ? "active" : ""}" data-q="${q.key}" data-v="${v}"><span>${emo}</span>${label}</button>`).join("")}
      </div>`).join("")}
    <button class="btn primary top-gap" id="trySave" ${complete ? "" : "disabled"}>Save</button>`);
}
$("#braveDialogBody").addEventListener("click", (e) => {
  const opt = e.target.closest("[data-q]");
  if (opt && tryState) {
    tryState.answers[opt.dataset.q] = opt.dataset.v;
    return renderTry();
  }
  if (e.target.closest("#trySave") && tryState) saveTry();
  const up = e.target.closest("[data-move-up]");
  if (up) moveUp();
  const ck = e.target.closest("[data-cookie-step]");
  if (ck) {
    const { l, st, answers } = tryState;
    braveDialog.close();
    openCookieForm({ title: `Brave step: ${st.text}`, story: braveStory(l, answers), photoIds: [] });
  }
  const rm = e.target.closest("[data-unlist]");
  if (rm) {
    foodCleared[foodKey(rm.dataset.unlist)] = Date.now();
    store.set("foodCleared", foodCleared);
    renderFoods();
    braveDialog.close();
    toast(`${rm.dataset.unlist} is off your bad-foods list 🎉`);
  }
});

function braveStory(l, a) {
  if (l.kind === "food") return `Tried ${l.food} again and my stomach felt ${a.stomach}.`;
  const words = { calm: "okay", nervous: "nervous", scared: "scared", easier: "easier than I feared", expected: "about as I expected", harder: "harder than I feared" };
  return `I felt ${words[a.before]} before. It went ${words[a.result]}.${a.feared === "no" ? " What I feared didn't happen." : ""}`;
}

function saveTry() {
  const { l, st, answers } = tryState;
  st.tries.push({ time: Date.now(), ...answers });
  const isFood = l.kind === "food";
  let html;

  if (isFood) {
    const ok = answers.stomach === "fine";
    if (!ok) logBadFood(answers.stomach, [l.food], "challenge");
    if (ok) st.done = true;
    const finished = ok && !nextStep(l);
    if (finished) l.finished = Date.now();
    html = ok
      ? finished
        ? `<h2>🎉 You can eat ${escapeHtml(l.food)} again!</h2>
           <p>Your gut handled a normal serving. That's a big win.</p>
           <div class="dialog-actions"><button class="btn primary" data-unlist="${escapeHtml(l.food)}">Remove it from my bad foods</button></div>
           <button class="btn ghost small top-gap" data-cookie-step>🍪 Add to cookie jar</button>`
        : `<h2>Your gut handled it 🎉</h2>
           <p>Wait ${CHALLENGE_GAP_DAYS}–3 days, then try the next amount: <b>${escapeHtml(nextStep(l).text.toLowerCase())}</b>.</p>
           <button class="btn ghost small top-gap" data-cookie-step>🍪 Add to cookie jar</button>`
      : `<h2>Thanks for trying 💚</h2>
         <p>Your gut isn't ready for this amount yet, and that's useful to know. Stick with the amount before this one, and try again in a few weeks.</p>
         <div class="dialog-actions"><button class="btn primary" data-dialog-close>Okay</button></div>`;
  } else {
    const praise = {
      no: "What you feared didn't happen. 🎉 Your brain just learned this is safer than it thought.",
      little: "Some of it happened, and you coped. That's real proof you can handle it.",
      yes: "It was hard, and you still did it. That takes courage, and each try makes the next one easier.",
    }[answers.feared];
    const readyToMove = answers.result !== "harder" && answers.before !== "scared";
    const isLast = st === l.steps[l.steps.length - 1];
    const already = st.done;
    html = `<h2>${answers.feared === "no" ? "You did it! 🎉" : "You showed up 💪"}</h2>
      <p>${praise}</p>
      ${already ? "" : readyToMove
        ? `<p><b>${isLast ? "Ready to call this ladder done?" : "Ready for the next step?"}</b></p>
           <div class="dialog-actions">
             <button class="btn ghost" data-dialog-close>Practise once more</button>
             <button class="btn primary" data-move-up>${isLast ? "🏆 Finish ladder" : "⬆ Move up"}</button>
           </div>`
        : `<p>Try this step again a few more times, until it feels more okay. That's how fear shrinks.</p>
           <div class="dialog-actions">
             <button class="btn primary" data-dialog-close>I'll practise again</button>
             <button class="btn ghost" data-move-up>Move up anyway</button>
           </div>`}
      <button class="btn ghost small top-gap" data-cookie-step>🍪 Add to cookie jar</button>`;
  }
  saveLadders();
  showBraveDialog(html);
}

function moveUp() {
  const { l, st } = tryState;
  st.done = true;
  if (!nextStep(l)) l.finished = Date.now();
  saveLadders();
  braveDialog.close();
  toast(l.finished ? "🏆 You climbed the whole ladder!" : "⬆ Next step unlocked");
}

/* New ladders: food re-challenge and your own fear */
function openFoodChallenge(preselect = null) {
  const list = badFoods();
  if (!list.length) return toast("Your bad-foods list is empty. Log a food first.");
  let chosen = (preselect && list.find((f) => f.key === foodKey(preselect)))?.name || null;
  const render = () => showBraveDialog(`
    <h2 id="braveDialogTitle">Try a bad food again 🥄</h2>
    <p class="muted">Sometimes a gut that reacted once can handle a food later, especially in small amounts. Go slowly: from a teaspoon up to a normal serving, a few days apart.</p>
    <p class="field-label">Which food?</p>
    <div class="chips">${list.map((f) => `<button class="chip ${chosen === f.name ? "active" : ""}" data-pick-food="${escapeHtml(f.name)}">${f.level === "worst" ? "😖" : "😣"} ${escapeHtml(f.name)}</button>`).join("")}</div>
    <label class="allergy-check top-gap"><input type="checkbox" id="notAllergy">
      <span>I'm <b>not allergic</b> to this food. It doesn't give me hives, swelling, or trouble breathing.</span></label>
    <p class="muted small">If you're unsure, check with your doctor or dietitian first.</p>
    <button class="btn primary top-gap" id="startChallenge">Start</button>`);
  render();
  const body = $("#braveDialogBody");
  body.onclick = (e) => {
    const pick = e.target.closest("[data-pick-food]");
    if (pick) { chosen = pick.dataset.pickFood; const ok = $("#notAllergy").checked; render(); $("#notAllergy").checked = ok; }
    if (e.target.closest("#startChallenge")) {
      if (!chosen) return toast("Pick a food first");
      if (!$("#notAllergy").checked) return toast("Please confirm it isn't an allergy");
      body.onclick = null;
      braveDialog.close();
      makeLadder({ icon: "🥄", title: `Try ${chosen} again`, kind: "food", food: chosen, steps: foodChallengeSteps });
    }
  };
  braveDialog.addEventListener("close", () => (body.onclick = null), { once: true });
}

function openCustomLadder() {
  showBraveDialog(`
    <h2 id="braveDialogTitle">My own fear ✏️</h2>
    <form id="customLadderForm">
      <label class="field"><span>What do you avoid because of IBS?</span>
        <input type="text" id="customTitle" required maxlength="80" placeholder="e.g. Going to the gym"></label>
      <label class="field"><span>Steps, from easiest to hardest (one per line)</span>
        <textarea id="customSteps" rows="5" placeholder="Walk past the gym&#10;Go in and look around&#10;Do a 10-minute workout&#10;Do a full workout"></textarea></label>
      <button class="btn primary" type="submit">Create ladder</button>
    </form>`);
}
$("#braveDialogBody").addEventListener("submit", (e) => {
  if (e.target.id !== "customLadderForm") return;
  e.preventDefault();
  const title = $("#customTitle").value.trim();
  const steps = $("#customSteps").value.split("\n").map((x) => x.trim()).filter(Boolean);
  if (steps.length < 2) return toast("Add at least two steps, one per line");
  braveDialog.close();
  makeLadder({ icon: "✏️", title, steps });
});

/* ---------- Home: the one next thing to do ---------- */
function renderToday() {
  const card = $("#todayCard");
  const due = dueMeals()[0];
  const active = ladders.filter((l) => !l.finished && nextStep(l)).sort((a, b) => b.created - a.created)[0];
  let html;
  if (due) {
    html = `<span class="today-label">🔔 Waiting for you</span>
      <b>How's your tummy after ${escapeHtml(due.foods.join(", "))}?</b>
      <button class="btn primary small" data-today="checkin">Answer now</button>`;
  } else if (active) {
    html = `<span class="today-label">🧗 Your next brave step</span>
      <b>${escapeHtml(nextStep(active).text)}</b>
      <small class="muted">${active.icon} ${escapeHtml(active.title)} · step ${stepsDone(active) + 1} of ${active.steps.length}</small>
      <button class="btn primary small" data-today="ladder" data-id="${active.id}">Open</button>`;
  } else if (!badFoods().length) {
    html = `<span class="today-label">👋 Start here</span>
      <b>Log a food that upsets your stomach, so you always know what to avoid.</b>
      <button class="btn primary small" data-today="log">Log a bad food</button>`;
  } else if (!ladders.length) {
    html = `<span class="today-label">🧗 Win something back</span>
      <b>Pick one thing IBS made you avoid, and take a tiny first step.</b>
      <button class="btn primary small" data-today="brave">Try Brave steps</button>`;
  } else {
    html = `<span class="today-label">🌟 Nice work</span>
      <b>You've finished your ladders. Start a new one, or add a win to your cookie jar.</b>
      <button class="btn primary small" data-today="brave">New ladder</button>`;
  }
  card.innerHTML = html;
}
$("#todayCard").addEventListener("click", (e) => {
  const b = e.target.closest("[data-today]");
  if (!b) return;
  const what = b.dataset.today;
  if (what === "checkin") return openCheckin(dueMeals()[0]);
  if (what === "ladder") return openLadder(b.dataset.id);
  go(what);
});

// Food tab shortcut: "Try again slowly" on a bad food starts a re-challenge for it.
$("#foodList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-retry]");
  if (!b) return;
  go("brave");
  openFoodChallenge(b.dataset.retry);
});

/* ---------- First-time welcome tour ---------- */
const welcomeSlides = [
  ["🌿", "Welcome to Gentle Gut", "A calm companion for living with IBS. Here's how it helps, in 30 seconds."],
  ["🥕", "Know your bad foods", "When something upsets your stomach, log it with one tap. Before you eat, search to check whether it's on your list."],
  ["🧗", "Win back your life, step by step", "Pick something IBS made you avoid, like eating out or travel, and face it in small, safe steps."],
  ["💚", "Calm on hard days", "Flare-up help, breathing, a journal to talk things out, and a cookie jar full of your wins. Everything stays on your phone unless you choose to sign in."],
];
let welcomeIndex = 0;
const welcomeDialog = $("#welcomeDialog");
function renderWelcome() {
  const [icon, title, text] = welcomeSlides[welcomeIndex];
  $("#welcomeSlide").innerHTML = `<div class="welcome-icon">${icon}</div><h2 id="welcomeTitle">${title}</h2><p>${text}</p>`;
  $("#welcomeDots").innerHTML = welcomeSlides.map((_, i) => `<i class="${i === welcomeIndex ? "on" : ""}"></i>`).join("");
  const last = welcomeIndex === welcomeSlides.length - 1;
  $("#welcomeNext").textContent = last ? "Let's start" : "Next";
  $("#welcomeSkip").hidden = last;
}
function closeWelcome() {
  store.set("welcomed", true);
  welcomeDialog.close();
}
$("#welcomeNext").addEventListener("click", () => {
  if (welcomeIndex === welcomeSlides.length - 1) return closeWelcome();
  welcomeIndex++;
  renderWelcome();
});
$("#welcomeSkip").addEventListener("click", closeWelcome);
welcomeDialog.addEventListener("cancel", () => store.set("welcomed", true));

// Tapping the Brave tab always lands on the list of ladders.
$('.bottom-nav [data-go="brave"]').addEventListener("click", () => {
  if (openLadderId) { openLadderId = null; renderBrave(); }
});

renderBrave();
appReady = true;
renderToday();
if (!store.get("welcomed", false)) {
  renderWelcome();
  setTimeout(() => !document.querySelector("dialog[open]") && welcomeDialog.showModal(), 400);
}
