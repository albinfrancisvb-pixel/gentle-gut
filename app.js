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
function go(view) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  $$(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.go === view));
  if (view !== "breathe") stopBreathing();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));

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

/* ---------- Food guide ---------- */
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
const badgeText = { low: "Usually gentle", mod: "Portion matters", high: "Common trigger", mine: "" };
let foodFilter = "all";

// Personal history per food: { key: { name, hurt, good } }. 2+ painful check-ins = personal trigger.
const TRIGGER_THRESHOLD = 2;
const foodStats = store.get("foodStats", {});
const foodKey = (name) => name.trim().toLowerCase();
const isTrigger = (name) => (foodStats[foodKey(name)]?.hurt || 0) >= TRIGGER_THRESHOLD;

// Base list plus any foods the person typed in themselves.
function allFoods() {
  const known = new Set(foods.map(([n]) => foodKey(n)));
  const custom = Object.values(foodStats)
    .filter((s) => !known.has(foodKey(s.name)))
    .map((s) => [s.name, "mine", "Added by you", "custom"]);
  return foods.concat(custom);
}

function renderFoods() {
  const q = $("#foodSearch").value.trim().toLowerCase();
  const list = allFoods()
    .filter(([name, lvl]) => {
      const match = foodFilter === "all" || (foodFilter === "mine" ? isTrigger(name) : lvl === foodFilter);
      return match && name.toLowerCase().includes(q);
    })
    .sort((a, b) => isTrigger(b[0]) - isTrigger(a[0]));
  $("#foodList").innerHTML = list.length
    ? list.map(([name, lvl, tip]) => {
        const s = foodStats[foodKey(name)];
        const trig = isTrigger(name);
        const history = s && (s.hurt || s.good)
          ? `<span class="food-tip">Your history: 😣 ${s.hurt || 0} painful · 😊 ${s.good || 0} fine</span>` : "";
        return `
        <li class="${trig ? "trigger" : ""}">
          <div><span class="food-name">${escapeHtml(name)}</span>${tip ? `<span class="food-tip">${tip}</span>` : ""}${history}</div>
          <div class="food-actions">
            ${trig ? `<span class="badge mine">🚩 Hurt you ${s.hurt}×</span>` : ""}
            ${lvl !== "mine" ? `<span class="badge ${lvl}">${badgeText[lvl]}</span>` : ""}
            ${s && s.hurt ? `<button class="link-btn" data-reset="${escapeHtml(foodKey(name))}">Reset my history</button>` : ""}
          </div>
        </li>`;
      }).join("")
    : `<li><span class="muted">${foodFilter === "mine"
        ? "No personal triggers yet. When a food hurts you more than once, it shows up here."
        : "Not in the list yet. When in doubt, try a small portion and log how you feel."}</span></li>`;
}
$("#foodList").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-reset]");
  if (!btn) return;
  const s = foodStats[btn.dataset.reset];
  if (s) { s.hurt = 0; s.good = 0; }
  store.set("foodStats", foodStats);
  renderFoods();
  toast("History cleared for " + (s?.name || "that food"));
});
$("#foodSearch").addEventListener("input", renderFoods);
$$("[data-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    $$("[data-filter]").forEach((x) => x.classList.toggle("active", x === b));
    foodFilter = b.dataset.filter;
    renderFoods();
  })
);
renderFoods();

/* ---------- Log ---------- */
const symptoms = ["Bloating", "Cramps", "Gas", "Diarrhoea", "Constipation", "Nausea", "Urgency", "Fatigue"];
let selectedSymptoms = new Set();
let entries = store.get("entries", []);

function renderSymptomChips() {
  $("#symptomChips").innerHTML = symptoms.map((s) =>
    `<button type="button" class="chip ${selectedSymptoms.has(s) ? "active" : ""}" data-sym="${s}">${s}</button>`
  ).join("");
}
$("#symptomChips").addEventListener("click", (e) => {
  const c = e.target.closest("[data-sym]");
  if (!c) return;
  const s = c.dataset.sym;
  selectedSymptoms.has(s) ? selectedSymptoms.delete(s) : selectedSymptoms.add(s);
  renderSymptomChips();
});
renderSymptomChips();

$("#pain").addEventListener("input", (e) => ($("#painVal").textContent = e.target.value));

function renderEntries() {
  $("#entries").innerHTML = entries.length
    ? entries.slice().reverse().map((e) => `
      <li>
        <div>
          <strong>${e.pain}/10</strong> ${e.symptoms.length ? "· " + e.symptoms.join(", ") : ""}
          <div class="entry-meta">${new Date(e.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          · stress ${e.stress}${e.meal ? " · ate: " + escapeHtml(e.meal) : ""}</div>
          ${e.notes ? `<div class="entry-meta">${escapeHtml(e.notes)}</div>` : ""}
        </div>
        <button class="del" data-id="${e.id}" aria-label="Delete entry">×</button>
      </li>`).join("")
    : `<li class="muted">No entries yet. Your first one is just a tap away.</li>`;
  renderChart();
}

function renderChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  $("#weekChart").innerHTML = days.map((d) => {
    const key = dayKey(d);
    const dayEntries = entries.filter((e) => dayKey(new Date(e.time)) === key);
    const avg = dayEntries.length ? dayEntries.reduce((a, e) => a + e.pain, 0) / dayEntries.length : null;
    const h = avg === null ? 4 : Math.max(6, (avg / 10) * 100);
    return `<div class="bar-wrap" title="${avg === null ? "No entries" : "Avg " + avg.toFixed(1) + "/10"}">
      <div class="bar ${avg === null ? "empty" : ""}" style="height:${h}%"></div>
      <span class="bar-label">${d.toLocaleDateString([], { weekday: "short" })}</span>
    </div>`;
  }).join("");
  $("#insight").textContent = buildInsight();
}

function buildInsight() {
  if (entries.length < 3) return "Log a few more days and I'll point out patterns here.";
  const avg = (arr) => arr.reduce((a, e) => a + e.pain, 0) / arr.length;
  const high = entries.filter((e) => e.stress === "high");
  const low = entries.filter((e) => e.stress === "low");
  if (high.length >= 2 && low.length >= 2 && avg(high) - avg(low) >= 2) {
    return "💡 Your discomfort tends to be higher on stressful days. Breathing breaks might really help you.";
  }
  const counts = {};
  entries.forEach((e) => e.symptoms.forEach((s) => (counts[s] = (counts[s] || 0) + 1)));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `💡 Your most common symptom is ${top[0].toLowerCase()} (${top[1]} times). Worth mentioning to your doctor.` : "";
}

$("#logForm").addEventListener("submit", (e) => {
  e.preventDefault();
  entries.push({
    id: Date.now(),
    time: new Date().toISOString(),
    pain: Number($("#pain").value),
    symptoms: [...selectedSymptoms],
    meal: $("#meal").value.trim(),
    stress: $("#stress").value,
    notes: $("#notes").value.trim(),
  });
  store.set("entries", entries);
  selectedSymptoms.clear();
  renderSymptomChips();
  e.target.reset();
  $("#painVal").textContent = "3";
  renderEntries();
  toast("Saved. Thanks for checking in with yourself 💚");
});

$("#entries").addEventListener("click", (e) => {
  const del = e.target.closest(".del");
  if (!del) return;
  entries = entries.filter((x) => String(x.id) !== del.dataset.id);
  store.set("entries", entries);
  renderEntries();
});

$("#exportBtn").addEventListener("click", () => {
  if (!entries.length) return toast("Nothing to export yet");
  const rows = [["Date", "Discomfort", "Symptoms", "Food", "Stress", "Notes"]].concat(
    entries.map((e) => [new Date(e.time).toLocaleString(), e.pain, e.symptoms.join("; "), e.meal, e.stress, e.notes])
  );
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "gentle-gut-log.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

renderEntries();

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
function canonicalName(name) {
  const f = allFoods().find(([n]) => foodKey(n) === foodKey(name));
  return f ? f[0] : name.trim();
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
  $("#foodNames").innerHTML = allFoods().map(([n]) => `<option value="${escapeHtml(n)}">`).join("");
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
  const face = { good: "😊", off: "😕", hurt: "😣" };
  $("#recentMeals").innerHTML = done.length
    ? done.map((m) => `<li>
        <div><strong>${m.foods.map(escapeHtml).join(", ")}</strong>
        <div class="entry-meta">${fmtDay(m.eatenAt)}${m.symptoms?.length ? " · " + m.symptoms.join(", ") : ""}</div></div>
        <span class="when">${face[m.answer]}</span>
      </li>`).join("")
    : `<li class="muted">Answered check-ins show up here.</li>`;

  const due = dueMeals().length;
  const banner = $("#dueBanner");
  banner.hidden = !due;
  banner.textContent = `🔔 ${due} tummy check-in${due > 1 ? "s" : ""} waiting. Tap to answer.`;
}
$("#pendingMeals").addEventListener("click", (e) => {
  const b = e.target.closest("[data-answer-meal]");
  if (b) openCheckin(meals.find((m) => String(m.id) === b.dataset.answerMeal));
});
$("#dueBanner").addEventListener("click", () => dueMeals()[0] && openCheckin(dueMeals()[0]));

/* Check-in dialog */
const dialog = $("#checkinDialog");
let activeMeal = null;
let checkinAnswer = null;
let checkinSyms = new Set();

function openCheckin(meal) {
  if (!meal || dialog.open) return;
  activeMeal = meal;
  checkinAnswer = null;
  checkinSyms = new Set();
  $("#checkinTitle").textContent = `How's your tummy after ${mealLabel(meal.eatenAt)}?`;
  $("#checkinFoods").textContent = `You had ${meal.foods.join(", ")} at ${fmtTime(meal.eatenAt)}.`;
  $$(".answer").forEach((b) => b.classList.remove("active"));
  $("#checkinSymptomsBox").hidden = true;
  renderCheckinSyms();
  dialog.showModal();
}
function renderCheckinSyms() {
  $("#checkinSymptoms").innerHTML = symptoms.map((s) =>
    `<button type="button" class="chip ${checkinSyms.has(s) ? "active" : ""}" data-csym="${s}">${s}</button>`
  ).join("");
}
$("#checkinSymptoms").addEventListener("click", (e) => {
  const c = e.target.closest("[data-csym]");
  if (!c) return;
  checkinSyms.has(c.dataset.csym) ? checkinSyms.delete(c.dataset.csym) : checkinSyms.add(c.dataset.csym);
  renderCheckinSyms();
});
$$(".answer").forEach((b) => b.addEventListener("click", () => {
  checkinAnswer = b.dataset.answer;
  $$(".answer").forEach((x) => x.classList.toggle("active", x === b));
  if (checkinAnswer === "good") return saveCheckin();
  $("#checkinSymptomsBox").hidden = false; // ask what they feel before saving
}));
$("#checkinSave").addEventListener("click", saveCheckin);
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

function saveCheckin() {
  const meal = activeMeal;
  meal.answer = checkinAnswer;
  meal.symptoms = [...checkinSyms];
  meal.answeredAt = Date.now();

  // Update each food's history; foods that hurt twice or more become personal triggers.
  const newlyFlagged = [];
  meal.foods.forEach((name) => {
    const k = foodKey(name);
    const s = (foodStats[k] ||= { name, hurt: 0, good: 0 });
    const was = isTrigger(name);
    if (checkinAnswer === "hurt") s.hurt++;
    if (checkinAnswer === "good") s.good++;
    if (!was && isTrigger(name)) newlyFlagged.push(name);
  });
  store.set("foodStats", foodStats);
  store.set("meals", meals);

  // Discomfort also goes into the symptom log so it appears in the weekly chart.
  if (checkinAnswer !== "good") {
    entries.push({
      id: Date.now(),
      time: new Date().toISOString(),
      pain: checkinAnswer === "hurt" ? 7 : 4,
      symptoms: meal.symptoms,
      meal: meal.foods.join(", "),
      stress: "mid",
      notes: "From meal check-in",
    });
    store.set("entries", entries);
    renderEntries();
  }

  dialog.close();
  renderMeals();
  renderFoods();
  renderFoodNames();

  if (newlyFlagged.length) {
    toast(`🚩 ${newlyFlagged.join(", ")} added to your triggers`);
  } else if (checkinAnswer === "hurt") {
    toast("Sorry it hurts 💚 The Flare tab has steps that can help.");
  } else {
    toast(checkinAnswer === "good" ? "Great to hear! 😊" : "Noted. Be gentle with yourself 💚");
  }
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
  if (["home", "meal", "sos", "breathe", "food", "log"].includes(view)) go(view);
}
openFromHash();
window.addEventListener("hashchange", openFromHash);
