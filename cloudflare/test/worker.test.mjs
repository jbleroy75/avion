import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { _reset, FEEDS, WX } from "../relay.js";
import worker from "../worker.js";

let calls, realFetch, routes;
const env = { ASSETS: { fetch: async (req) => new Response(`<html>${new URL(req.url).pathname}</html>`, { headers: { "Content-Type": "text/html" } }) } };
const get = (p, method = "GET") => worker.fetch(new Request(`https://vigie.example${p}`, { method }), env, { waitUntil() {} });

beforeEach(() => {
  _reset(); calls = []; routes = {}; realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const h = Object.entries(routes).find(([k]) => String(url).startsWith(k));
    return h ? h[1]() : new Response("nope", { status: 404, statusText: "Not Found" });
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const ok = (o) => () => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });

test("trafic : adsb.lol en priorité, _source ajouté, cache court", async () => {
  routes[FEEDS[0][1]] = ok({ ac: [{ hex: "abc" }], now: Date.now(), total: 1 });
  const r = await get("/api/traffic");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/json");
  assert.equal(r.headers.get("cache-control"), "no-store");
  const j = await r.json();
  assert.equal(j._source, "adsb.lol");
  assert.deepEqual(j.ac, [{ hex: "abc" }]);
  assert.match(calls[0], /\?_=\d+$/);
  await get("/api/traffic");
  assert.equal(calls.length, 1, "2e appel servi par le cache");
});

test("trafic : repli airplanes.live si adsb.lol périmé ou en erreur", async () => {
  routes[FEEDS[0][1]] = ok({ ac: [], now: Date.now() - 120000 });
  routes[FEEDS[1][1]] = ok({ ac: [], now: Date.now() });
  const j = await (await get("/api/traffic")).json();
  assert.equal(j._source, "airplanes.live");
  assert.equal(calls.length, 2);
});

test("trafic : 503 avec les deux causes", async () => {
  routes[FEEDS[1][1]] = ok({ foo: 1, now: Date.now() });
  const r = await get("/api/traffic");
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "adsb.lol: HTTP Error 404: Not Found / airplanes.live: Invalid traffic payload" });
});

test("météo : Open-Meteo, _source, 503 si incomplète", async () => {
  routes[WX] = ok({ current: { time: "2026-10-26T00:00" }, hourly: {} });
  const j = await (await get("/api/weather")).json();
  assert.equal(j._source, "Open-Meteo");
  _reset(); routes[WX] = ok({ hourly: {} });
  const r = await get("/api/weather");
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "Open-Meteo: Invalid weather payload" });
});

test("page, healthz, 404, méthode", async () => {
  for (const p of ["/", "/vigie-lfmn.html"]) {
    const r = await get(p);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(await r.text(), "<html>/vigie-lfmn.html</html>");
  }
  assert.equal(await (await get("/healthz")).text(), "ok");
  assert.equal((await get("/autre")).status, 404);
  assert.equal((await get("/api/traffic", "POST")).status, 501);
});
