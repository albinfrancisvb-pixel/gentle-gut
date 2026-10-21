// Gentle Gut sign-in and sync (Supabase).
// The app stays local-first: everything is saved on the device as before. When signed in, changes are
// merged with the user's cloud copy record by record, so two devices never overwrite each other.

/* ---------- Merge core (pure, no browser APIs; unit-tested in Node) ---------- */
const SyncCore = (() => {
  // "list" collections are arrays of {id, ...}; "map" collections are plain objects keyed by date or name.
  const COLLECTIONS = { moods: "map", water: "map", foodStats: "map", foodCleared: "map", meals: "list", entries: "list", journal: "list", cookies: "list" };

  const toMap = (kind, v) =>
    kind === "list" ? Object.fromEntries((v || []).map((x) => [String(x.id), x])) : { ...(v || {}) };
  const fromMap = (kind, m) =>
    kind === "list" ? Object.values(m).sort((a, b) => Number(a.id) - Number(b.id)) : m;
  // Key order doesn't matter (Postgres reorders JSON keys), so compare with keys sorted.
  const stable = (v) => JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);
  const same = (a, b) => stable(a) === stable(b);

  // Record which items changed or disappeared between two saves of one collection.
  function stamp(meta, coll, before, after, now) {
    const kind = COLLECTIONS[coll];
    const prev = toMap(kind, before);
    const next = toMap(kind, after);
    const stamps = (meta.stamps[coll] ||= {});
    const tomb = (meta.tomb[coll] ||= {});
    for (const k in next) {
      if (!(k in prev) || !same(prev[k], next[k])) {
        stamps[k] = now;
        delete tomb[k];
      }
    }
    for (const k in prev) {
      if (!(k in next)) {
        tomb[k] = now;
        delete stamps[k];
      }
    }
  }

  // Merge two snapshots {collections, stamps, tomb}. Newest edit wins per item; a deletion wins over older edits.
  function merge(local, remote) {
    const out = { collections: {}, stamps: {}, tomb: {} };
    for (const coll in COLLECTIONS) {
      const kind = COLLECTIONS[coll];
      const L = toMap(kind, local.collections?.[coll]);
      const R = toMap(kind, remote.collections?.[coll]);
      const ls = local.stamps?.[coll] || {}, rs = remote.stamps?.[coll] || {};
      const lt = local.tomb?.[coll] || {}, rt = remote.tomb?.[coll] || {};
      const items = {}, stamps = {}, tomb = {};
      const keys = new Set([...Object.keys(L), ...Object.keys(R), ...Object.keys(lt), ...Object.keys(rt)]);
      for (const k of keys) {
        const deletedAt = Math.max(lt[k] || 0, rt[k] || 0);
        const a = ls[k] || 0, b = rs[k] || 0;
        let item, t;
        if (k in L && (!(k in R) || a >= b)) { item = L[k]; t = a; }
        else if (k in R) { item = R[k]; t = b; }
        if (item !== undefined && (deletedAt === 0 || t > deletedAt)) {
          items[k] = item;
          if (t) stamps[k] = t;
        } else if (deletedAt) {
          tomb[k] = deletedAt;
        }
      }
      out.collections[coll] = fromMap(kind, items);
      out.stamps[coll] = stamps;
      out.tomb[coll] = tomb;
    }
    return out;
  }

  // Cookie photos referenced by a snapshot (to upload new ones and clean up deleted ones).
  const photoIds = (snap) => new Set((snap.collections?.cookies || []).flatMap((c) => c.photoIds || []));

  return { COLLECTIONS, stamp, merge, same, photoIds };
})();
if (typeof module !== "undefined") module.exports = SyncCore;

/* ---------- Browser side ---------- */
if (typeof window !== "undefined") (() => {
  const cfg = window.GG_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return; // not set up yet: app stays single-device

  const { COLLECTIONS, stamp, merge, same, photoIds } = SyncCore;
  const META_KEY = "gg:sync:meta";
  const BANNER_KEY = "gg:sync:bannerDismissed";
  const raw = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  let meta = raw.get(META_KEY, { stamps: {}, tomb: {}, lastSync: 0 });
  meta.stamps ||= {}; meta.tomb ||= {};
  const snapshotLocal = () => ({
    collections: Object.fromEntries(Object.keys(COLLECTIONS).map((c) => [c, store.get(c, COLLECTIONS[c] === "list" ? [] : {})])),
    stamps: meta.stamps,
    tomb: meta.tomb,
  });

  // Track every change the app saves so sync knows exactly what moved.
  const lastSaved = Object.fromEntries(Object.keys(COLLECTIONS).map((c) => [c, store.get(c, null)]));
  const plainSet = store.set.bind(store);
  store.set = (key, value) => {
    plainSet(key, value);
    if (!(key in COLLECTIONS)) return;
    stamp(meta, key, lastSaved[key], value, Date.now());
    lastSaved[key] = JSON.parse(JSON.stringify(value));
    raw.set(META_KEY, meta);
    scheduleSync();
  };

  let client;
  try {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch {
    return; // supabase library failed to load (offline on first open); the app works locally
  }

  let user = null;
  let status = "idle"; // idle | syncing | synced | offline | error
  let syncing = null;
  let again = false;
  let timer = null;
  let interacted = false;
  addEventListener("pointerdown", () => (interacted = true), { once: true });
  addEventListener("keydown", () => (interacted = true), { once: true });

  /* Sync */
  function scheduleSync(delay = 2500) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, delay);
  }

  async function syncNow({ reloadOnChange = false } = {}) {
    if (!user) return;
    if (syncing) { again = true; return syncing; }
    if (!navigator.onLine) return setStatus("offline");
    setStatus("syncing");
    syncing = (async () => {
      const { data: row, error } = await client.from("user_data").select("data").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      const remote = row?.data || { collections: {}, stamps: {}, tomb: {} };
      const local = snapshotLocal();
      const merged = merge(local, remote);

      // Bring this device up to date, but only right before a reload: the screens hold their data in
      // memory, and saving over newer data from stale screens would look like deletions.
      const localChanged = Object.keys(COLLECTIONS).some((c) => !same(merged.collections[c], local.collections[c]));
      const applyNow = !localChanged || reloadOnChange || !interacted;
      if (applyNow) {
        for (const c in COLLECTIONS) {
          if (same(merged.collections[c], local.collections[c])) continue;
          plainSet(c, merged.collections[c]); // written directly, so it isn't re-stamped as a local edit
          lastSaved[c] = merged.collections[c];
        }
        meta.stamps = merged.stamps;
        meta.tomb = merged.tomb;
      }

      await syncPhotos(merged);
      if (!same(merged, remote)) {
        const { error: upErr } = await client.from("user_data")
          .upsert({ user_id: user.id, data: merged, updated_at: new Date().toISOString() });
        if (upErr) throw upErr;
      }
      meta.lastSync = Date.now();
      raw.set(META_KEY, meta);
      setStatus("synced");
      if (localChanged) {
        if (applyNow) location.reload();
        else $("#syncRefresh").hidden = false;
      }
    })()
      .catch((err) => {
        console.warn("Sync failed", err);
        setStatus(navigator.onLine ? "error" : "offline");
      })
      .finally(() => {
        syncing = null;
        if (again) { again = false; scheduleSync(500); }
      });
    return syncing;
  }

  // Upload photos this device has that the cloud doesn't; remove cloud photos no cookie uses any more.
  async function syncPhotos(snap) {
    const wanted = photoIds(snap);
    const bucket = client.storage.from("photos");
    const { data: files, error } = await bucket.list(user.id, { limit: 1000 });
    if (error) throw error;
    const inCloud = new Set(files.map((f) => f.name.replace(/\.jpg$/, "")));
    for (const id of wanted) {
      if (inCloud.has(id)) continue;
      const blob = await photoDB.get(id).catch(() => null);
      if (blob) await bucket.upload(`${user.id}/${id}.jpg`, blob, { upsert: true, contentType: "image/jpeg" });
    }
    const unused = [...inCloud].filter((id) => !wanted.has(id)).map((id) => `${user.id}/${id}.jpg`);
    if (unused.length) await bucket.remove(unused);
  }

  // Called by the cookie jar when a photo isn't on this device yet.
  async function fetchPhoto(id) {
    if (!user || !navigator.onLine) return null;
    const { data, error } = await client.storage.from("photos").download(`${user.id}/${id}.jpg`);
    if (error || !data) return null;
    await photoDB.put(id, data).catch(() => {});
    return data;
  }

  addEventListener("online", () => scheduleSync(500));
  addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearTimeout(timer); syncNow(); } // save before the phone suspends the app
    else scheduleSync(500);
  });
  $("#syncRefresh").addEventListener("click", () => location.reload());

  /* Account UI */
  const dialog = $("#accountDialog");
  const accountBtn = $("#accountBtn");
  accountBtn.hidden = false;

  function showPane(name) {
    dialog.querySelectorAll(".acct-pane").forEach((p) => (p.hidden = p.dataset.pane !== name));
    dialog.querySelectorAll(".acct-msg").forEach((m) => { m.textContent = ""; m.className = "acct-msg"; });
  }
  function msg(form, text, kind = "error") {
    const m = form.querySelector(".acct-msg");
    m.textContent = text;
    m.className = "acct-msg " + kind;
  }
  function openAccount(pane) {
    showPane(pane || (user ? "account" : "signin"));
    renderStatus();
    if (!dialog.open) dialog.showModal();
  }
  accountBtn.addEventListener("click", () => openAccount());
  $("#accountClose").addEventListener("click", () => dialog.close());
  dialog.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => showPane(b.dataset.show)));

  function friendly(err) {
    const m = (err?.message || "").toLowerCase();
    if (m.includes("invalid login")) return "That email and password don't match. Try again or reset your password.";
    if (m.includes("not confirmed")) return "Please confirm your email first. Check your inbox for the link, then sign in here.";
    if (m.includes("already registered")) return "There's already an account with this email. Try signing in.";
    if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a few minutes.";
    if (m.includes("fetch") || !navigator.onLine) return "You seem to be offline. Connect to the internet and try again.";
    return err?.message || "Something went wrong. Please try again.";
  }
  async function busy(form, fn) {
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try { await fn(); } catch (err) { msg(form, friendly(err)); } finally { btn.disabled = false; }
  }
  // Links in sign-up and password-reset emails open the live app, even when testing on this PC
  // (a localhost link can't open on a phone).
  const appUrl = cfg.siteUrl || location.origin + location.pathname;

  $("#acctSignin").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, async () => {
      const { error } = await client.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if (error) throw error;
      msg(f, "Signed in! Syncing your data…", "ok");
    });
  });

  $("#acctSignup").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, async () => {
      const { data, error } = await client.auth.signUp({
        email: f.email.value.trim(), password: f.password.value, options: { emailRedirectTo: appUrl },
      });
      if (error) throw error;
      if (!data.session) {
        msg(f, "Almost there! We sent you an email. Tap the link in it, then come back and sign in.", "ok");
        $("#acctSignin").email.value = f.email.value.trim();
      }
    });
  });

  $("#acctForgot").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, async () => {
      const { error } = await client.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: appUrl });
      if (error) throw error;
      msg(f, "If that email has an account, a reset link is on its way.", "ok");
    });
  });

  $("#acctRecovery").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f, async () => {
      const { error } = await client.auth.updateUser({ password: f.password.value });
      if (error) throw error;
      msg(f, "Password updated. You're signed in.", "ok");
      setTimeout(() => showPane("account"), 1200);
    });
  });

  $("#syncNow").addEventListener("click", () => syncNow({ reloadOnChange: true }));

  // Signing out removes this person's data from the device (it stays safe in their account).
  $("#signOutBtn").addEventListener("click", async () => {
    if (!(await askConfirm("Sign out? Your data stays safe in your account, and it will be removed from this device until you sign in again.", "Sign out"))) return;
    if (navigator.onLine) await syncNow();
    if (status === "error" && !(await askConfirm("Your latest changes couldn't be synced and will be lost. Sign out anyway?", "Sign out anyway"))) return;
    await client.auth.signOut();
    for (const c in COLLECTIONS) raw.del("gg:" + c);
    raw.del(META_KEY);
    photoDB.db?.close();
    await new Promise((r) => { const q = indexedDB.deleteDatabase("gentle-gut"); q.onsuccess = q.onerror = q.onblocked = r; });
    location.reload();
  });

  // Gentle nudge on Home to sign in (dismissible).
  const banner = $("#signinBanner");
  $("#bannerSignin").addEventListener("click", () => openAccount("signin"));
  $("#bannerDismiss").addEventListener("click", () => { raw.set(BANNER_KEY, true); banner.hidden = true; });

  function setStatus(s) { status = s; renderStatus(); }
  function renderStatus() {
    const ago = meta.lastSync ? fmtAgo(Date.now() - meta.lastSync) : "never";
    $("#syncStatus").textContent = {
      idle: `Last synced ${ago}`,
      syncing: "Syncing…",
      synced: `✓ Synced ${ago}`,
      offline: "Offline. Changes will sync when you're back online.",
      error: "Couldn't sync just now. Will retry automatically.",
    }[status];
    accountBtn.textContent = user ? "☁️" : "👤";
    accountBtn.classList.toggle("signed-in", !!user);
    accountBtn.setAttribute("aria-label", user ? "Account (signed in)" : "Sign in");
    banner.hidden = !!user || raw.get(BANNER_KEY, false);
  }
  function fmtAgo(ms) {
    const m = Math.round(ms / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  }
  setInterval(renderStatus, 60000);

  client.auth.onAuthStateChange((event, session) => {
    const wasSignedIn = !!user;
    user = session?.user || null;
    $("#acctEmail").textContent = user?.email || "";
    renderStatus();
    if (event === "PASSWORD_RECOVERY") return openAccount("recovery");
    if (user && !wasSignedIn) {
      if (dialog.open) showPane("account");
      // A fresh sign-in reloads after merging so this device shows everything from the account.
      setTimeout(() => syncNow({ reloadOnChange: event === "SIGNED_IN" && dialog.open }), 0);
    }
  });

  window.Sync = { fetchPhoto, syncNow, get user() { return user; } };
  renderStatus();
})();
