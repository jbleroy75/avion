// Vigie LFMN — Worker Cloudflare « avion-vigie » : même contrat que vigie-server.py.
//   GET /, /vigie-lfmn.html  → page (asset statique vigie-lfmn.html)
//   GET /api/traffic         → adsb.lol, repli airplanes.live (JSON du fournisseur + "_source")
//   GET /api/weather         → Open-Meteo (JSON + "_source")
//   GET /healthz             → "ok"
// Erreur des sources : 503 {"error": "nom: cause / nom: cause"}.
// Cache court : mémoire de l'isolat + Cache API (8 s trafic, 300 s météo), requêtes simultanées regroupées.

export const WX = "https://api.open-meteo.com/v1/forecast?latitude=43.6584&longitude=7.21587&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kn&forecast_days=2&timezone=GMT";
export const FEEDS = [
  ["adsb.lol", "https://api.adsb.lol/v2/lat/43.6584/lon/7.21587/dist/60"],
  ["airplanes.live", "https://api.airplanes.live/v2/point/43.6584/7.21587/60"],
];
export const TTL = { traffic: 8, weather: 300 }; // secondes
const UA = "VigieLFMN/2.0 (personal aviation observatory)";

const memo = new Map();     // kind -> { at, body }
const inflight = new Map(); // kind -> Promise<body>

const json = (body, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function fetchSource(kind, now = Date.now()) {
  const errors = [];
  for (const [name, base] of kind === "traffic" ? FEEDS : [["Open-Meteo", WX]]) {
    try {
      const url = kind === "traffic" ? `${base}?_=${Math.floor(now / 15000)}` : base;
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP Error ${r.status}: ${r.statusText}`);
      const data = await r.json();
      if (kind === "traffic") {
        if (!Array.isArray("ac" in data ? data.ac : data.aircraft)) throw new Error("Invalid traffic payload");
        if (!(Math.abs(Date.now() - Number(data.now ?? 0)) <= 60000)) throw new Error("Outdated traffic payload");
      } else if (!data.current) throw new Error("Invalid weather payload");
      data._source = name;
      return JSON.stringify(data);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
  }
  throw new Error(errors.join(" / "));
}

async function retrieve(kind, request, ctx) {
  const ttl = TTL[kind] * 1000;
  const m = memo.get(kind);
  if (m && Date.now() - m.at < ttl) return m.body;

  const cache = globalThis.caches?.default;
  const key = new Request(new URL(`/__cache/${kind}`, request.url).toString());
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) {
      const at = Number(hit.headers.get("x-fetched-at") || 0);
      if (Date.now() - at < ttl) {
        const body = await hit.text();
        memo.set(kind, { at, body });
        return body;
      }
    }
  }

  if (!inflight.has(kind)) {
    const p = fetchSource(kind).then((body) => {
      const at = Date.now();
      memo.set(kind, { at, body });
      if (cache) {
        const put = cache.put(key, new Response(body, {
          headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${TTL[kind]}`, "x-fetched-at": String(at) },
        })).catch(() => {});
        ctx?.waitUntil?.(put);
      }
      return body;
    }).finally(() => inflight.delete(kind));
    inflight.set(kind, p);
  }
  return inflight.get(kind);
}

export function _reset() { memo.clear(); inflight.clear(); }

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method !== "GET") return new Response("Unsupported method", { status: 501, headers: { "Content-Type": "text/plain" } });
    if (pathname === "/api/traffic" || pathname === "/api/weather") {
      try { return json(await retrieve(pathname.slice(5), request, ctx)); }
      catch (e) { return json(JSON.stringify({ error: e.message }), 503); }
    }
    if (pathname === "/healthz") return new Response("ok", { headers: { "Content-Type": "text/plain" } });
    if (pathname === "/" || pathname === "/vigie-lfmn.html") {
      const r = await env.ASSETS.fetch(new Request(new URL("/vigie-lfmn.html", request.url), request));
      const res = new Response(r.body, r);
      res.headers.set("Content-Type", "text/html; charset=utf-8");
      return res;
    }
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  },
};
