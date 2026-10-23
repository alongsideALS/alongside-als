// /logo/<domain> — serves an organization's site icon so cards can show it, fetched by Cloudflare (not the visitor's browser)
// from Google's public favicon service, cached at the edge for a week. Falls back to 404 so the page shows a letter badge.
export async function onRequestGet({ request, params }) {
  const domain = String(params.domain || "").toLowerCase().replace(/[^a-z0-9.-]/g, "");
  if (!domain || domain.length > 80) return new Response("", { status: 404 });
  const cache = caches.default; const key = new Request(new URL(request.url).origin + "/logo/" + domain);
  const hit = await cache.match(key); if (hit) return hit;
  let res;
  try { res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, { headers: { "user-agent": "alongside-als.org icon fetch" }, cf: { cacheTtl: 604800 } }); } catch { res = null; }
  if (!res || !res.ok) return new Response("", { status: 404, headers: { "cache-control": "public, max-age=3600" } });
  const body = await res.arrayBuffer();
  if (body.byteLength < 200) return new Response("", { status: 404, headers: { "cache-control": "public, max-age=3600" } });  // Google's generic globe is tiny
  const out = new Response(body, { headers: { "content-type": res.headers.get("content-type") || "image/png", "cache-control": "public, max-age=604800", "x-content-type-options": "nosniff" } });
  await cache.put(key, out.clone());
  return out;
}
