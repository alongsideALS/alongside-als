// Alongside ALS — contact form handler (Cloudflare Pages Function)
// POST /api/contact  → verifies the Turnstile token, then emails the message via Resend.
// Secrets (Pages project → Settings → Variables and secrets):
//   RESEND_API_KEY        required
//   TURNSTILE_SECRET_KEY  required (spam check)
// Optional plain variables:
//   CONTACT_TO    where messages go        (default alsalongside@gmail.com)
//   CONTACT_FROM  sender shown in inbox    (default "Alongside ALS <onboarding@resend.dev>";
//                 change to e.g. "Alongside ALS <form@alongside-als.org>" once the domain is verified in Resend)

const TO_DEFAULT = "alsalongside@gmail.com";
const FROM_DEFAULT = "Alongside ALS <onboarding@resend.dev>";
const MAX = { message: 4000, page: 300, email: 200, topic: 40 };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (v, max) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

export async function onRequestPost({ request, env }) {
  // Same-origin only (the form lives on this site).
  const origin = request.headers.get("origin") || "";
  const host = new URL(request.url).host;
  if (origin && new URL(origin).host !== host) return json({ ok: false, error: "Bad origin." }, 403);

  let data;
  try {
    const ct = request.headers.get("content-type") || "";
    data = ct.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json({ ok: false, error: "Could not read the form." }, 400);
  }

  // Honeypot: real people never fill this hidden field.
  if (clean(data.website, 50)) return json({ ok: true });

  const topic = clean(data.topic, MAX.topic) || "Comment";
  const page = clean(data.page, MAX.page);
  const message = clean(data.message, MAX.message);
  const email = clean(data.email, MAX.email);
  const token = clean(data["cf-turnstile-response"], 3000);

  if (message.length < 5) return json({ ok: false, error: "Please write a message." }, 400);
  if (email && !validEmail(email)) return json({ ok: false, error: "That email address doesn't look right." }, 400);

  // Turnstile (spam) check.
  if (!env.TURNSTILE_SECRET_KEY) return json({ ok: false, error: "The form isn't fully set up yet (missing spam-check key)." }, 500);
  if (!token) return json({ ok: false, error: "The spam check didn't finish. Please wait a moment and try again." }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "";
  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
  }).then((r) => r.json()).catch(() => ({ success: false }));
  if (!verify.success) return json({ ok: false, error: "The spam check failed. Please reload the page and try again." }, 400);

  if (!env.RESEND_API_KEY) return json({ ok: false, error: "The form isn't fully set up yet (missing email key)." }, 500);

  const to = env.CONTACT_TO || TO_DEFAULT;
  const from = env.CONTACT_FROM || FROM_DEFAULT;
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const subject = `[Alongside ALS] ${topic}${page ? ": " + page.slice(0, 60) : ""}`;

  const text = [
    `Topic: ${topic}`,
    `Page or listing: ${page || "(not given)"}`,
    `Reply to: ${email || "(no email given)"}`,
    `Received: ${when}`,
    "",
    message,
  ].join("\n");

  const html = `<div style="font:16px/1.5 Arial,sans-serif;color:#193252;max-width:640px">
  <p style="margin:0 0 4px"><b>Topic:</b> ${esc(topic)}</p>
  <p style="margin:0 0 4px"><b>Page or listing:</b> ${esc(page || "(not given)")}</p>
  <p style="margin:0 0 4px"><b>Reply to:</b> ${esc(email || "(no email given)")}</p>
  <p style="margin:0 0 16px;color:#53647a"><b>Received:</b> ${esc(when)}</p>
  <div style="white-space:pre-wrap;border-left:4px solid #d9912a;padding:8px 14px;background:#f8faff">${esc(message)}</div>
  <p style="margin:16px 0 0;font-size:13px;color:#53647a">Sent from the contact form at alongside-als.org/about</p>
</div>`;

  const payload = { from, to: [to], subject, text, html };
  if (email) payload.reply_to = email;

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!sent.ok) {
    const detail = await sent.text().catch(() => "");
    console.log("Resend error", sent.status, detail);
    return json({ ok: false, error: "The message couldn't be sent right now. Please try again later or email " + to + " directly." }, 502);
  }
  return json({ ok: true });
}

export const onRequestGet = () => json({ ok: false, error: "Use the form on the About page." }, 405);
