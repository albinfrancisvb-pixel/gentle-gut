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
  if (["home", "meal", "journal", "jar", "sos", "breathe", "food", "log"].includes(view)) go(view);
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
$("#journalList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-jdel]");
  if (!b || !confirm("Delete this journal entry?")) return;
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
  $("#cookieDialogTitle").textContent = cookie ? "Edit cookie 🍪" : "Add a cookie 🍪";
  $("#cookieTitle").value = cookie?.title ?? "";
  $("#cookieStory").value = cookie?.story ?? "";
  $("#cookieDate").value = cookie?.date ?? todayKey();
  renderRating();
  renderFormPhotos();
  cookieDialog.showModal();
  if (cookie) {
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
  if (t.dataset.del && confirm("Remove this cookie from your jar?")) {
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
