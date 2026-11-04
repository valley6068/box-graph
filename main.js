// Box Graph: every folder is a square, every note is a dot inside it.
// Only the square you are in gets links, labels and previews; the rest is just dots.
let obsidian = null;
try { obsidian = require("obsidian"); } catch (e) { /* plain node: self-test only */ }

const BOX = 1000;   // a folder with more notes than this is split into boxes of BOX
const GROUP = 5;    // more than GROUP of those boxes -> every GROUP go into one bigger box (repeats)
const CELL = 7;     // dot spacing inside a closed square
const PAD = 8, HEAD = 22, GAP = 24, SP = 22; // SP = dot spacing for the open box's own notes
const VIEW = "box-graph";
// own icon (100x100): a box of linked dots with a smaller box inside it
const ICON = `<rect x="6" y="6" width="88" height="88" rx="14" fill="none" stroke="currentColor" stroke-width="8"/>
<rect x="50" y="50" width="34" height="34" rx="6" fill="none" stroke="currentColor" stroke-width="6"/>
<path d="M27 27 L51 27 M27 27 L27 51 M27 51 L59 59 M51 27 L67 67" stroke="currentColor" stroke-width="4" fill="none"/>
<circle cx="27" cy="27" r="9" fill="currentColor"/><circle cx="51" cy="27" r="6" fill="currentColor"/>
<circle cx="73" cy="27" r="6" fill="currentColor"/><circle cx="27" cy="51" r="6" fill="currentColor"/>
<circle cx="27" cy="73" r="6" fill="currentColor"/><circle cx="67" cy="67" r="7" fill="currentColor"/>`;

function buildTree(files) {
  const root = { name: "Vault", kids: [], notes: [], count: 0 };
  const byPath = Object.assign(Object.create(null), { "": root }); // no built-in keys: a folder named "constructor" must not match one
  for (const f of files) {
    let folder = "", node = root;
    for (const part of f.folder ? f.folder.split("/") : []) {
      folder = folder ? folder + "/" + part : part;
      if (!byPath[folder]) {
        byPath[folder] = { name: part, kids: [], notes: [], count: 0 };
        node.kids.push(byPath[folder]);
      }
      node = byPath[folder];
    }
    node.notes.push(f);
  }
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }); // "Box 2" before "Box 10"
  (function finish(n) {
    n.kids.sort(byName);
    n.notes.sort(byName);
    if (n.notes.length > BOX) {
      let boxes = [];
      for (let i = 0; i < n.notes.length; i += BOX) {
        const part = n.notes.slice(i, i + BOX);
        boxes.push({ name: `Box ${i / BOX + 1} (${part[0].name} – ${part[part.length - 1].name})`, kids: [], notes: part, count: 0 });
      }
      for (let level = 2; boxes.length > GROUP; level++) { // every GROUP boxes go into one bigger box, again and again
        const big = [];
        for (let i = 0; i < boxes.length; i += GROUP) {
          big.push({ name: `Level ${level} box ${i / GROUP + 1} (${Math.min(GROUP, boxes.length - i)} boxes)`, kids: boxes.slice(i, i + GROUP), notes: [], count: 0 });
        }
        boxes = big;
      }
      n.kids.push(...boxes);
      n.notes = [];
    }
    n.count = n.notes.length;
    for (const k of n.kids) n.count += finish(k);
    return n.count;
  })(root);
  (function link(n, parent) { // so search can jump from a note to its box
    n.parent = parent;
    for (const f of n.notes) f.node = n;
    for (const k of n.kids) link(k, n);
  })(root, null);
  return root;
}

function allNotes(n) {
  if (!n._all) n._all = n.notes.concat(...n.kids.map(allNotes));
  return n._all;
}

// shelf-pack: the box's own notes first, then one square per sub-box
function layout(node) {
  const items = [];
  if (node.notes.length) {
    const cols = Math.ceil(Math.sqrt(node.notes.length));
    items.push({ kind: "notes", notes: node.notes, cols, w: cols * SP, h: Math.ceil(node.notes.length / cols) * SP });
  }
  for (const k of node.kids) {
    const n = allNotes(k).length, cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const side = Math.max(110, cols * CELL + 2 * PAD);
    items.push({ kind: "box", node: k, notes: allNotes(k), cols, w: side, h: side + HEAD });
  }
  const area = items.reduce((s, it) => s + (it.w + GAP) * (it.h + GAP), 0);
  const limit = Math.max(...items.map((it) => it.w), Math.sqrt(area) * 1.5);
  let x = 0, y = 0, rowH = 0;
  for (const it of items) {
    if (x > 0 && x + it.w > limit) { x = 0; y += rowH + GAP; rowH = 0; }
    it.x = x; it.y = y; x += it.w + GAP; rowH = Math.max(rowH, it.h);
  }
  return items;
}

// world point -> {item, note?}
function hit(items, wx, wy) {
  for (const it of items) {
    if (wx < it.x || wy < it.y || wx > it.x + it.w || wy > it.y + it.h) continue;
    if (it.kind === "notes") {
      const c = Math.floor((wx - it.x) / SP), r = Math.floor((wy - it.y) / SP), i = r * it.cols + c;
      return c < it.cols && it.notes[i] ? { item: it, note: it.notes[i] } : null;
    }
    const cell = (it.w - 2 * PAD) / it.cols;
    const c = Math.floor((wx - it.x - PAD) / cell), r = Math.floor((wy - it.y - HEAD - PAD) / cell);
    const i = r * it.cols + c;
    return { item: it, note: c >= 0 && r >= 0 && c < it.cols ? it.notes[i] : undefined };
  }
  return null;
}

function notePos(it, i) {
  if (it.kind === "notes") return [it.x + (i % it.cols) * SP + SP / 2, it.y + Math.floor(i / it.cols) * SP + SP / 2];
  const cell = (it.w - 2 * PAD) / it.cols;
  return [it.x + PAD + (i % it.cols) * cell + cell / 2, it.y + HEAD + PAD + Math.floor(i / it.cols) * cell + cell / 2];
}

if (obsidian) {
  class BoxGraphView extends obsidian.ItemView {
    getViewType() { return VIEW; }
    getDisplayText() { return "Box Graph"; }
    getIcon() { return VIEW; }
    constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }

    async onOpen() {
      const root = this.containerEl.children[1];
      root.empty();
      root.style.cssText = "position:relative;padding:0;overflow:hidden;";
      const top = root.createDiv({ attr: { style: "position:absolute;top:8px;left:8px;z-index:2;display:flex;flex-direction:column;gap:6px;width:min(360px,calc(100% - 16px));" } });
      this.crumbs = top.createDiv({ attr: { style: "display:flex;gap:4px;flex-wrap:wrap;" } });
      this.search = top.createEl("input", { type: "search", attr: { placeholder: "Search the whole vault…", style: "width:100%;" } });
      this.results = top.createDiv({ attr: { style: "display:none;max-height:320px;overflow:auto;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);" } });
      this.canvas = root.createEl("canvas", { attr: { style: "width:100%;height:100%;display:block;cursor:grab;" } });
      this.tip = root.createDiv({ attr: { style: "position:absolute;z-index:3;display:none;max-width:320px;padding:8px 10px;border-radius:8px;pointer-events:none;font-size:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);box-shadow:0 4px 16px rgba(0,0,0,.3);" } });
      this.ctx = this.canvas.getContext("2d", { alpha: false }); // opaque canvas = sharper (LCD) text
      this.rebuild();
      this.reopen(this.plugin.data.path); // back into the box you were in last time
      this.registerEvents();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(root);
    }

    async onClose() { // stop everything that would keep running after the tab is closed
      this.ro.disconnect();
      clearTimeout(this.tipTimer); clearTimeout(this.rebuildTimer); clearTimeout(this.linkTimer);
      if (this.saveTimer) { clearTimeout(this.saveTimer); this.plugin.saveData(this.plugin.data); }
    }

    rebuild() {
      const files = this.app.vault.getMarkdownFiles().map((f) => ({ path: f.path, name: f.basename, folder: f.parent && f.parent.path !== "/" ? f.parent.path : "", file: f }));
      this.tree = buildTree(files);
      this.countLinks();
      this.stack = [this.tree];
      this.enter(this.tree);
      if (this.search) this.runSearch();
    }

    countLinks() {
      const links = this.app.metadataCache.resolvedLinks;
      this.incoming = Object.create(null); // no built-in keys, same reason as in buildTree
      for (const from in links) for (const to in links[from]) this.incoming[to] = (this.incoming[to] || 0) + 1;
    }

    // search note names + folders only, so nothing has to be read from disk
    runSearch() {
      const words = this.search.value.toLowerCase().split(/\s+/).filter(Boolean);
      this.results.empty();
      if (!words.length) { this.found = this.hits = null; this.results.style.display = "none"; this.draw(); return; }
      this.found = allNotes(this.tree).filter((n) => { const s = n.path.toLowerCase(); return words.every((w) => s.includes(w)); });
      this.hits = new Set(this.found);
      this.results.style.display = "block";
      this.results.createDiv({ text: `${this.found.length} found${this.found.length > 50 ? " (first 50 shown)" : ""}`, attr: { style: "padding:4px 8px;color:var(--text-faint);font-size:11px;" } });
      for (const n of this.found.slice(0, 50)) {
        const row = this.results.createDiv({ attr: { style: "padding:4px 8px;cursor:pointer;font-size:12px;" } });
        row.createSpan({ text: n.name });
        row.createSpan({ text: "  📁 " + (n.folder || "Vault root"), attr: { style: "color:var(--text-faint);" } });
        row.onmouseenter = () => (row.style.background = "var(--background-modifier-hover)");
        row.onmouseleave = () => (row.style.background = "");
        row.onclick = () => this.jump(n);
      }
      this.draw();
    }

    jump(n) { // go into the note's box and ring its dot
      const chain = [];
      for (let x = n.node; x; x = x.parent) chain.unshift(x);
      this.stack = chain;
      this.enter(n.node);
      this.focus = n;
      this.results.style.display = "none";
      this.draw();
    }

    enter(node) {
      this.focus = null;
      const i = this.stack.indexOf(node);
      if (i >= 0) this.stack.length = i + 1; else this.stack.push(node);
      this.node = node;
      this.items = layout(node);
      const own = this.items.find((it) => it.kind === "notes");
      this.ownIndex = new Map(own ? own.notes.map((n, j) => [n.path, j]) : []);
      this.crumbs.empty();
      for (const n of this.stack) {
        const b = this.crumbs.createEl("button", { text: n === this.tree ? `Vault (${n.count})` : `${n.name} (${n.count})` });
        b.onclick = () => this.enter(n);
      }
      this.remember(false);
      this.place();
    }

    key() { return this.stack.map((n) => n.name).join("/"); }

    // zoom + position per box, kept as the world point in the middle of the panel so a resize doesn't shift it
    place() {
      const v = this.plugin.data.views[this.key()], c = this.canvas;
      if (!v || !c.clientWidth) return this.fit();
      this.scale = v.s; this.ox = c.clientWidth / 2 - v.cx * v.s; this.oy = c.clientHeight / 2 - v.cy * v.s;
      this.draw();
    }

    remember(view = true) { // view=false: only the box you are in
      const d = this.plugin.data, c = this.canvas;
      d.path = this.stack.map((n) => n.name);
      if (view) d.views[this.key()] = { s: this.scale, cx: (c.clientWidth / 2 - this.ox) / this.scale, cy: (c.clientHeight / 2 - this.oy) / this.scale };
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { this.saveTimer = null; this.plugin.saveData(d); }, 500);
    }

    fit() {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width || !this.items.length) return;
      const w = Math.max(...this.items.map((it) => it.x + it.w)), h = Math.max(...this.items.map((it) => it.y + it.h));
      const top = 8 + this.search.offsetTop + this.search.offsetHeight + 24, side = 60; // keep clear of the breadcrumb + search bar
      this.scale = Math.min((r.width - 2 * side) / w, (r.height - top - side) / h, 3);
      this.ox = (r.width - w * this.scale) / 2;
      this.oy = top + (r.height - top - side - h * this.scale) / 2;
      this.draw();
    }

    resize() { this.place(); }

    // canvas pixels must match screen pixels exactly, or the browser stretches it and everything blurs.
    // Checked on every draw because Obsidian zoom / Windows scaling / another monitor change the ratio without a resize.
    sizeCanvas() {
      const d = window.devicePixelRatio || 1, c = this.canvas;
      const w = Math.round(c.clientWidth * d), h = Math.round(c.clientHeight * d);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      return d;
    }

    // text is drawn in screen pixels (fixed size, whole-pixel position), not scaled with the graph
    label(str, wx, wy, font, color, maxPx, suffix = "") { // str is shortened with … to fit; suffix always stays
      const ctx = this.ctx, d = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.font = font; ctx.fillStyle = color;
      if (maxPx !== undefined) {
        if (maxPx < 24) { ctx.restore(); return; }
        let t = str;
        while (t.length > 1 && ctx.measureText(t + suffix).width > maxPx) t = t.slice(0, -2) + "…";
        str = t !== str && t.length < 5 ? "" : t; // "0…" says nothing: show only the suffix (the count)
        if (!str) suffix = suffix.trim();
      }
      ctx.fillText(str + suffix, Math.round(this.ox + wx * this.scale), Math.round(this.oy + wy * this.scale));
      ctx.restore();
    }

    color(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() || "#888"; }

    draw() {
      const ctx = this.ctx, s = this.scale;
      if (!ctx || !s) return;
      const d = this.sizeCanvas();
      const accent = this.color("--interactive-accent"), muted = this.color("--text-muted"), text = this.color("--text-normal");
      const border = this.color("--background-modifier-border"), bg = this.color("--background-primary");
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(d * s, 0, 0, d * s, d * this.ox, d * this.oy);
      const own = this.items.find((it) => it.kind === "notes");
      if (own) { // links only between the open box's own notes
        const links = this.app.metadataCache.resolvedLinks;
        ctx.strokeStyle = border; ctx.lineWidth = 1 / s; ctx.beginPath();
        own.notes.forEach((n, i) => {
          for (const to in links[n.path] || {}) {
            const j = this.ownIndex.get(to);
            if (j === undefined) continue;
            const [ax, ay] = notePos(own, i), [bx, by] = notePos(own, j);
            ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          }
        });
        ctx.stroke();
        own.notes.forEach((n, i) => {
          const [x, y] = notePos(own, i), hot = this.hover && this.hover.note === n, found = this.hits && this.hits.has(n);
          ctx.globalAlpha = this.hits && !found ? 0.25 : 1;
          ctx.fillStyle = hot || found ? accent : text;
          ctx.beginPath(); ctx.arc(x, y, hot ? 6 : 3 + Math.min(3, Math.sqrt(this.incoming[n.path] || 0)), 0, 7); ctx.fill();
          if (s * SP > 44 || found) this.label(n.name, x - SP / 2 + 1, y + SP / 2 - 1, "11px sans-serif", found ? accent : muted, SP * s - 4);
          if (this.focus === n) { ctx.strokeStyle = accent; ctx.lineWidth = 2.5 / s; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke(); }
        });
        ctx.globalAlpha = 1;
      }
      for (const it of this.items) {
        if (it.kind !== "box") continue;
        const hot = this.hover && this.hover.item === it;
        const found = this.hits ? it.notes.filter((n) => this.hits.has(n)).length : 0;
        ctx.globalAlpha = this.hits && !found ? 0.35 : 1;
        ctx.strokeStyle = hot || found ? accent : border; ctx.lineWidth = (hot || found ? 2.5 : 1.2) / s;
        ctx.strokeRect(it.x, it.y, it.w, it.h);
        const head = Math.min(15, (HEAD - 4) * s + 2); // title baseline in screen px, stays inside the title strip
        this.label(it.node.name, it.x + PAD, it.y + head / s, "bold 12px sans-serif", text, (it.w - 2 * PAD) * s, `  ${it.notes.length}`);
        if (found) this.label(`${found} found`, it.x, it.y - 6 / s, "bold 12px sans-serif", accent);
        const cell = (it.w - 2 * PAD) / it.cols, r = Math.max(1, cell * 0.28);
        ctx.fillStyle = muted;
        for (let i = 0; i < it.notes.length; i++) { const [x, y] = notePos(it, i); ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
        if (found) {
          ctx.fillStyle = accent;
          it.notes.forEach((n, i) => { if (!this.hits.has(n)) return; const [x, y] = notePos(it, i); ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2); });
        }
        ctx.globalAlpha = 1;
        if (hot && this.hover.note) {
          const [x, y] = notePos(it, it.notes.indexOf(this.hover.note));
          ctx.fillStyle = accent; ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
        }
      }
    }

    world(e) {
      const r = this.canvas.getBoundingClientRect();
      return [(e.clientX - r.left - this.ox) / this.scale, (e.clientY - r.top - this.oy) / this.scale, e.clientX - r.left, e.clientY - r.top];
    }

    showTip(h, sx, sy) {
      clearTimeout(this.tipTimer);
      if (!h) { this.tip.style.display = "none"; return; }
      const t = this.tip;
      t.empty();
      if (h.note) {
        t.createEl("b", { text: h.note.name });
        t.createDiv({ text: "📁 " + (h.note.folder || "Vault root"), attr: { style: "color:var(--text-muted);margin:2px 0;" } });
        const out = Object.keys(this.app.metadataCache.resolvedLinks[h.note.path] || {}).length;
        t.createDiv({ text: `links out ${out} · links in ${this.incoming[h.note.path] || 0}`, attr: { style: "color:var(--text-faint);" } });
        const prev = t.createDiv({ attr: { style: "margin-top:6px;white-space:pre-wrap;color:var(--text-muted);" } });
        const note = h.note;
        this.tipTimer = setTimeout(async () => { // read the note only after the mouse rests on it
          const body = (await this.app.vault.cachedRead(note.file).catch(() => "")).replace(/^---[\s\S]*?---\s*/, ""); // "" if the note was just deleted
          if (this.hover && this.hover.note === note) prev.setText(body.slice(0, 220) + (body.length > 220 ? "…" : ""));
        }, 200);
        t.createDiv({ text: h.item.kind === "box" ? "click to go into box · Shift+click to open this note" : "click to open note", attr: { style: "color:var(--text-faint);margin-top:4px;" } });
      } else {
        t.createEl("b", { text: h.item.node.name });
        t.createDiv({ text: `${h.item.notes.length} notes · ${h.item.node.kids.length} boxes inside · click to open` });
      }
      t.style.display = "block";
      const r = this.canvas.getBoundingClientRect();
      t.style.left = Math.min(sx + 14, r.width - 330) + "px";
      t.style.top = Math.min(sy + 14, r.height - 160) + "px";
    }

    registerEvents() {
      const c = this.canvas;
      let drag = null;
      this.registerDomEvent(this.search, "input", () => this.runSearch());
      this.registerDomEvent(this.search, "focus", () => { if (this.found) this.results.style.display = "block"; });
      this.registerDomEvent(this.search, "keydown", (e) => {
        if (e.key === "Enter" && this.found && this.found[0]) this.jump(this.found[0]);
        if (e.key === "Escape") { this.search.value = ""; this.runSearch(); }
      });
      this.registerDomEvent(c, "mousedown", (e) => { drag = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy, moved: false }; c.style.cursor = "grabbing"; });
      this.registerDomEvent(window, "mouseup", (e) => {
        if (!drag) return;
        c.style.cursor = "grab";
        const wasClick = !drag.moved && e.target === c;
        if (drag.moved) this.remember();
        drag = null;
        if (!wasClick) return;
        const [wx, wy] = this.world(e), h = hit(this.items, wx, wy);
        if (!h) return;
        if (h.note && (h.item.kind === "notes" || e.shiftKey || e.ctrlKey || e.metaKey)) this.app.workspace.openLinkText(h.note.path, "", true);
        else if (h.item.kind === "box") { this.hover = null; this.showTip(null); this.enter(h.item.node); }
      });
      this.registerDomEvent(c, "mousemove", (e) => {
        if (drag) {
          if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
          this.ox = drag.ox + e.clientX - drag.x; this.oy = drag.oy + e.clientY - drag.y;
          this.showTip(null); this.draw(); return;
        }
        const [wx, wy, sx, sy] = this.world(e), h = hit(this.items, wx, wy);
        const same = h && this.hover && h.item === this.hover.item && h.note === this.hover.note;
        if (!same) { this.hover = h; this.showTip(h, sx, sy); this.draw(); }
        else if (h) { this.tip.style.left = Math.min(sx + 14, c.clientWidth - 330) + "px"; this.tip.style.top = Math.min(sy + 14, c.clientHeight - 160) + "px"; }
      });
      this.registerDomEvent(c, "mouseleave", () => { this.hover = null; this.showTip(null); this.draw(); });
      this.registerDomEvent(c, "wheel", (e) => {
        e.preventDefault();
        const [wx, wy, sx, sy] = this.world(e), k = Math.exp(-e.deltaY * 0.0007);
        this.scale *= k; this.ox = sx - wx * this.scale; this.oy = sy - wy * this.scale;
        this.draw(); this.remember();
      }, { passive: false });
      this.registerDomEvent(c, "dblclick", (e) => { const [wx, wy] = this.world(e); if (hit(this.items, wx, wy)) return; delete this.plugin.data.views[this.key()]; this.remember(false); this.fit(); }); // back to the whole box
      const later = () => { clearTimeout(this.rebuildTimer); this.rebuildTimer = setTimeout(() => { const path = this.stack.map((n) => n.name); this.rebuild(); this.reopen(path); }, 1500); };
      this.registerEvent(this.app.vault.on("create", later));
      this.registerEvent(this.app.vault.on("delete", later));
      this.registerEvent(this.app.vault.on("rename", later));
      this.registerEvent(this.app.workspace.on("css-change", () => this.draw()));
      // a note's links changed: recount links in and redraw lines, no rebuild needed
      this.registerEvent(this.app.metadataCache.on("resolved", () => { clearTimeout(this.linkTimer); this.linkTimer = setTimeout(() => { this.countLinks(); this.draw(); }, 1000); }));
    }

    reopen(names) { // after a rebuild, go back into the same box if it still exists
      let n = this.tree;
      for (const name of names.slice(1)) { n = n.kids.find((k) => k.name === name); if (!n) return; this.enter(n); }
    }
  }

  class BoxGraphPlugin extends obsidian.Plugin {
    async onload() {
      this.data = Object.assign({ path: [], views: {} }, await this.loadData()); // last box + zoom/position per box
      obsidian.addIcon(VIEW, ICON);
      this.registerView(VIEW, (leaf) => new BoxGraphView(leaf, this));
      this.addRibbonIcon(VIEW, "Open Box Graph", () => this.open());
      this.addCommand({ id: "open", name: "Open", callback: () => this.open() }); // Obsidian shows it as "Box Graph: Open"
    }
    async open() {
      const leaf = this.app.workspace.getLeavesOfType(VIEW)[0] || this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  module.exports = BoxGraphPlugin;
} else {
  module.exports = { buildTree, layout, hit, notePos, allNotes, BOX, GROUP, ICON };
}
