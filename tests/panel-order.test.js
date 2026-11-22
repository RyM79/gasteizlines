"use strict";
// Pruebas de la lógica pura de reordenación de paneles (bloque PANEL_ORDER_LOGIC de index.html)
// y comprobaciones estáticas del marcado/CSS del asa. Sin dependencias: node --test.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function loadPanelOrder() {
  const start = HTML.indexOf("/* ===== PANEL_ORDER_LOGIC:BEGIN");
  const end = HTML.indexOf("/* ===== PANEL_ORDER_LOGIC:END");
  assert.ok(start >= 0 && end > start, "No se encuentra el bloque PANEL_ORDER_LOGIC en index.html");
  const code = HTML.slice(start, end);
  return vm.runInContext(code + "\n;PanelOrder;", vm.createContext({}));
}

const PO = loadPanelOrder();
// Los arrays creados en el contexto vm tienen otro prototipo: se normalizan antes de comparar.
const plain = (v) => JSON.parse(JSON.stringify(v));

test("isValidId acepta los formatos de uid() y rechaza valores peligrosos", () => {
  assert.equal(PO.isValidId("1b9d6bcd-bbfd-4b2d"), true);
  assert.equal(PO.isValidId("id-1700000000000-a"), true);
  assert.equal(PO.isValidId(""), false);
  assert.equal(PO.isValidId(null), false);
  assert.equal(PO.isValidId(123), false);
  assert.equal(PO.isValidId('x"><img src=x>'), false);
  assert.equal(PO.isValidId("a b"), false);
  assert.equal(PO.isValidId("a".repeat(65)), false);
});

test("sanitize descarta desconocidos y duplicados y añade los que faltan al final (RF23)", () => {
  const existing = ["A", "B", "C", "D"];
  assert.deepEqual(plain(PO.sanitize(["C", "X", "A", "C", 7, null], existing)), ["C", "A", "B", "D"]);
  assert.deepEqual(plain(PO.sanitize(null, existing)), existing);
  assert.deepEqual(plain(PO.sanitize("basura", existing)), existing);
  assert.deepEqual(plain(PO.sanitize(["A"], [])), []);
});

test("readStoredOrder admite el formato versionado y un array simple", () => {
  assert.deepEqual(plain(PO.readStoredOrder({ v: 1, ids: ["A", "B"] })), ["A", "B"]);
  assert.deepEqual(plain(PO.readStoredOrder(["B", "A"])), ["B", "A"]);
  assert.equal(PO.readStoredOrder(null), null);
  assert.equal(PO.readStoredOrder({}), null);
  assert.equal(PO.readStoredOrder("x"), null);
  assert.equal(PO.readStoredOrder({ ids: "x" }), null);
});

test("groupByPinned mantiene los fijados arriba conservando el orden relativo", () => {
  assert.deepEqual(plain(PO.groupByPinned(["A", "B", "C", "D"], ["D", "B"])), ["B", "D", "A", "C"]);
  assert.deepEqual(plain(PO.groupByPinned(["A", "B"], null)), ["A", "B"]);
});

test("legacyOrder reproduce el orden de la versión anterior (migración RF20)", () => {
  const codes = { a: "L9", b: "G1", c: "TG1", d: "E1" };
  // Fijados en el orden de pinned_instances (ignorando ids obsoletos), el resto por código de línea.
  const out = PO.legacyOrder(["a", "b", "c", "d"], ["stale", "c", "a"], (id) => codes[id]);
  assert.deepEqual(plain(out), ["c", "a", "d", "b"]);
  // Sin fijados: todos por código.
  assert.deepEqual(plain(PO.legacyOrder(["a", "b"], [], (id) => codes[id])), ["b", "a"]);
});

test("computeTargetIndex cuenta los puntos medios por encima del centro (RF9)", () => {
  const mids = [50, 150, 250];
  assert.equal(PO.computeTargetIndex(10, mids), 0);
  assert.equal(PO.computeTargetIndex(100, mids), 1);
  assert.equal(PO.computeTargetIndex(200, mids), 2);
  assert.equal(PO.computeTargetIndex(999, mids), 3);
  assert.equal(PO.computeTargetIndex(10, []), 0);
});

test("moveWithinGroup: arrastrar D a la mitad superior de B da A, D, B, C (CA5/CA6)", () => {
  const order = ["A", "B", "C", "D"];
  // Hermanos sin D: A, B, C. Centro de D sobre la mitad superior de B -> índice 1.
  const target = PO.computeTargetIndex(140, [50, 150, 250]);
  assert.equal(target, 1);
  assert.deepEqual(plain(PO.moveWithinGroup(order, [], "D", target)), ["A", "D", "B", "C"]);
});

test("moveWithinGroup: mover hacia abajo, al principio y fuera de rango (se limita)", () => {
  const order = ["A", "B", "C"];
  assert.deepEqual(plain(PO.moveWithinGroup(order, [], "A", 2)), ["B", "C", "A"]);
  assert.deepEqual(plain(PO.moveWithinGroup(order, [], "C", 0)), ["C", "A", "B"]);
  assert.deepEqual(plain(PO.moveWithinGroup(order, [], "B", 99)), ["A", "C", "B"]);
  assert.deepEqual(plain(PO.moveWithinGroup(order, [], "B", -5)), ["B", "A", "C"]);
  // Misma posición: mismo orden (RF15 se basa en esto).
  assert.ok(PO.sameOrder(PO.moveWithinGroup(order, [], "B", 1), order));
  // Id desconocido: no cambia nada.
  assert.deepEqual(plain(PO.moveWithinGroup(order, [], "Z", 0)), order);
});

test("moveWithinGroup nunca saca un panel de su grupo de fijación (RF24)", () => {
  const order = ["P1", "P2", "U1", "U2"];
  const pinned = ["P1", "P2"];
  assert.deepEqual(plain(PO.moveWithinGroup(order, pinned, "U2", 0)), ["P1", "P2", "U2", "U1"]);
  assert.deepEqual(plain(PO.moveWithinGroup(order, pinned, "P1", 5)), ["P2", "P1", "U1", "U2"]);
});

test("sameOrder", () => {
  assert.equal(PO.sameOrder(["A", "B"], ["A", "B"]), true);
  assert.equal(PO.sameOrder(["A", "B"], ["B", "A"]), false);
  assert.equal(PO.sameOrder(["A"], ["A", "B"]), false);
  assert.equal(PO.sameOrder(null, []), false);
});

test("normalizeSnapshot conserva los widgets de la versión anterior y sanea entradas no fiables", () => {
  let n = 0;
  const makeId = () => "gen-" + (++n);
  const raw = [
    { id: "A", lineCode: "L1", pinned: true, stop: { id: "123", name: "Parada 1" }, favorite: { id: "123", name: "Parada 1" } },
    { id: "A", lineCode: "G2", pinned: false, stop: null, favorite: null },       // id duplicado
    { id: "<x>", lineCode: "TG1", pinned: "yes" },                                 // id inválido
    { lineCode: "L3" },                                                            // sin id (formato antiguo)
    null, 5, { id: "B" },                                                          // basura / sin lineCode
  ];
  const out = plain(PO.normalizeSnapshot(raw, makeId));
  assert.equal(out.length, 4);
  assert.deepEqual(out[0], {
    id: "A", lineCode: "L1", pinned: true,
    stop: { id: "123", name: "Parada 1" }, favorite: { id: "123", name: "Parada 1" },
  });
  assert.equal(out[1].id, "gen-1");
  assert.equal(out[1].lineCode, "G2");
  assert.equal(out[2].id, "gen-2");
  assert.equal(out[2].pinned, false);
  assert.equal(out[3].id, "gen-3");
  assert.equal(out[3].stop, null);
  assert.equal(new Set(out.map((x) => x.id)).size, out.length);
  assert.deepEqual(plain(PO.normalizeSnapshot("no-array", makeId)), []);
});

test("normalizeSnapshot sanea parada y favorita (solo id escalar y nombre de texto)", () => {
  const out = plain(PO.normalizeSnapshot([
    { id: "A", lineCode: "L1", stop: { id: 42, name: "P" }, favorite: { id: 42, name: "P", extra: "<script>" } },
    { id: "B", lineCode: "L1", stop: { id: { x: 1 }, name: "P" }, favorite: { id: ["1"], name: 5 } },
    { id: "C", lineCode: "L1", stop: { id: "7", name: { evil: 1 } }, favorite: "7" },
  ], () => "gen"));
  // El tipo del id se conserva (comparaciones estrictas con idParada).
  assert.deepEqual(out[0].stop, { id: 42, name: "P" });
  assert.deepEqual(out[0].favorite, { id: 42, name: "P" });
  assert.equal(out[1].stop, null);
  assert.equal(out[1].favorite, null);
  assert.deepEqual(out[2].stop, { id: "7", name: null });
  assert.equal(out[2].favorite, null);
});

test("refreshPanel no toca el panel (ni la cuenta atrás) si empieza durante un arrastre (RF12, RF13)", () => {
  const body = fnBody("refreshPanel");
  const guard = body.indexOf("if (isDragActive()){ pendingRefreshAfterDrag = true; return; }");
  assert.ok(guard >= 0);
  assert.ok(guard < body.indexOf("clearInterval"), "la guarda debe ir antes de parar la cuenta atrás");
  assert.ok(guard < body.indexOf("setStatus(instanceId"), "la guarda debe ir antes de cambiar el estado");
});

test("finalizar un gesto es idempotente frente a lostpointercapture (sin reentrada)", () => {
  for (const name of ["finishPanelDrag", "endPendingGesture"]) {
    const body = fnBody(name);
    assert.match(body, /if \(!s \|\| s\.ending\) return;\s*s\.ending = true;/, name + " sin protección de reentrada");
    assert.ok(body.indexOf("s.ending = true") < body.indexOf("releasePointerCapture"), name);
  }
  assert.match(fnBody("onDragPointerCancel"), /s\.ending/);
});

test("normalizeSnapshot no entra en bucle si el generador de ids falla", () => {
  const out = plain(PO.normalizeSnapshot([{ lineCode: "L1" }, { lineCode: "L2" }], () => "dup"));
  assert.equal(out.length, 2);
  assert.notEqual(out[0].id, out[1].id);
  assert.ok(out.every((x) => PO.isValidId(x.id)));
});

test("flujo completo: migración, reordenación, recarga con orden manipulado (CA7, CA12, CA14)", () => {
  // Configuración antigua sin panel_order.
  const legacy = PO.normalizeSnapshot([
    { id: "a", lineCode: "L1", pinned: false },
    { id: "b", lineCode: "G1", pinned: false },
    { id: "c", lineCode: "L5", pinned: false },
    { id: "d", lineCode: "E1", pinned: false },
  ], () => "x");
  const ids = legacy.map((i) => i.id);
  const codeOf = Object.fromEntries(legacy.map((i) => [i.id, i.lineCode]));
  let order = PO.legacyOrder(ids, [], (id) => codeOf[id]);
  assert.deepEqual(plain(order), ["d", "b", "a", "c"]);

  // Reordenar y "guardar".
  order = PO.moveWithinGroup(order, [], "c", 0);
  const stored = { v: 1, ids: plain(order) };
  // Recarga: se recupera el mismo orden.
  assert.deepEqual(plain(PO.sanitize(PO.readStoredOrder(stored), ids)), ["c", "d", "b", "a"]);

  // Orden manipulado con un id inexistente y otro duplicado.
  const tampered = { v: 1, ids: ["c", "zzz", "d", "c", "b"] };
  assert.deepEqual(plain(PO.sanitize(PO.readStoredOrder(tampered), ids)), ["c", "d", "b", "a"]);
});

/* ---- Comprobaciones estáticas del marcado y estilos ---- */

function cssRule(selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = HTML.match(re);
  return m ? m[1] : null;
}

test("el asa usa drag_indicator, es accesible y mide al menos 44x44 (RF1, RF27)", () => {
  assert.match(HTML, /class="drag-handle"[^>]*aria-roledescription="asa de reordenación"/);
  assert.match(HTML, /drag-handle[\s\S]{0,400}drag_indicator/);
  const rule = cssRule(".drag-handle");
  assert.ok(rule, "falta la regla .drag-handle");
  assert.match(rule, /width:44px/);
  assert.match(rule, /height:44px/);
  assert.match(rule, /cursor:grab/);
});

test("touch-action:none solo en el asa, nunca en el panel completo", () => {
  assert.match(cssRule(".drag-handle"), /touch-action:none/);
  const card = cssRule(".card");
  assert.ok(card, "falta la regla .card");
  assert.doesNotMatch(card, /touch-action:\s*none/);
});

test("existe una región aria-live para anunciar la nueva posición (RF28)", () => {
  assert.match(HTML, /id="reorderAnnouncer"[^>]*aria-live="polite"/);
});

test("el <head> no tiene etiquetas </style> sobrantes", () => {
  const opens = (HTML.match(/<style\b/g) || []).length;
  const closes = (HTML.match(/<\/style>/g) || []).length;
  assert.equal(closes, opens);
});

function fnBody(name) {
  const start = HTML.indexOf("function " + name + "(");
  assert.ok(start >= 0, "no existe la función " + name);
  const next = HTML.indexOf("\n  function ", start + 1);
  const nextAsync = HTML.indexOf("\n  async function ", start + 1);
  const ends = [next, nextAsync].filter((i) => i > start);
  return HTML.slice(start, ends.length ? Math.min(...ends) : undefined);
}

test("refreshPanel no repinta un panel si la respuesta llega durante un arrastre (RF12)", () => {
  const body = fnBody("refreshPanel");
  const guards = body.match(/if \(isDragActive\(\)\)\{ pendingRefreshAfterDrag = true; return; \}/g) || [];
  assert.ok(guards.length >= 2, "faltan las guardas de arrastre en refreshPanel (éxito y error)");
  assert.ok(body.indexOf("isDragActive()") < body.indexOf("setAlerts(instanceId, data"),
    "la guarda debe ir antes de repintar");
});

test("loadStopsForPanel conserva la parada restaurada al recargar (CA7)", () => {
  const body = fnBody("loadStopsForPanel");
  assert.match(body, /if \(panel\.currentStopId\)\{[\s\S]*?\} else if \(fav\)\{/);
});

test("la restauración no guarda listas parciales ni se detiene si falla un widget (RF20, RF23)", () => {
  const persist = fnBody("persistAllPanels");
  assert.ok(persist.indexOf("if (restoringPanels) return;") >= 0, "persistAllPanels debe ignorar las escrituras durante la restauración");
  assert.ok(persist.indexOf("if (restoringPanels) return;") < persist.indexOf("saveJSON("), "la guarda debe ir antes de escribir");

  const load = fnBody("loadInitialPanels");
  const on = load.indexOf("restoringPanels = true;");
  const loop = load.indexOf("items.forEach(");
  const off = load.indexOf("restoringPanels = false;");
  const finalPersist = load.lastIndexOf("persistAllPanels();");
  assert.ok(on >= 0 && on < loop, "hay que activar restoringPanels antes de recrear los paneles");
  assert.ok(off > loop && /finally\s*\{\s*restoringPanels = false;/.test(load), "restoringPanels debe desactivarse en un finally");
  assert.ok(finalPersist > off, "se guarda una sola vez al final, con todos los paneles");
  assert.match(load, /items\.forEach\(item=>\{\s*try\{[\s\S]*?\}catch\(err\)\{/, "cada widget se restaura de forma aislada");
});

test("se usan Pointer Events y no la API Drag & Drop de HTML5", () => {
  assert.match(HTML, /addEventListener\('pointerdown'/);
  assert.match(HTML, /"pointercancel"/);
  assert.doesNotMatch(HTML, /draggable="true"|addEventListener\(["']dragstart/);
});
