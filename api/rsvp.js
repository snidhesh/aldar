/*
 * RSVP endpoint: the page posts here. This function forwards the lead to the CRM, then emails the guest a
 * confirmation with the calendar invite attached.
 *
 * To connect the CRM, set these in Vercel (Project > Settings > Environment Variables):
 *   CRM_API_URL   the CRM endpoint that accepts a lead (required to switch forwarding on)
 *   CRM_API_KEY   the API key or token, if the CRM needs one
 * then adjust toCrmPayload() and crmHeaders() below to match the CRM's API.
 *
 * Until CRM_API_URL is set, a valid submission is accepted but NOT stored anywhere,
 * and the page says so on its confirmation screen.
 *
 * The confirmation email needs RESEND_API_KEY; see lib/email.js. It is sent only once the lead has been
 * accepted, and a failed email never fails the RSVP.
 *
 *   ALLOWED_ORIGINS   optional, comma-separated extra sites allowed to post here (e.g. a custom domain that
 *                     proxies this one). The site's own address and localhost are always allowed.
 */

const { buildIcs } = require('../lib/ics');
const { sendConfirmation } = require('../lib/email');

const LOCATIONS = ['Abu Dhabi', 'Dubai', 'Egypt', 'Open to all'];
const ARRIVALS = ['10am-1pm', '1pm-3pm', '3pm-6pm'];
const TYPES = ['Apartment', 'Townhouse', 'Villa', 'Penthouse'];

/* Map the site's lead to the shape the CRM expects. Edit this when the API spec arrives. */
function toCrmPayload(lead) {
  return {
    source: 'All Doors Open RSVP',
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    guests: lead.guests,
    preferred_arrival: lead.arrival,
    preferred_location: lead.location,
    interested_in: lead.interestedIn,
    property_types: lead.propertyTypes,
    budget_aed: lead.budget,
    purpose: lead.purpose,
    consent: true,
    submitted_at: lead.submittedAt,
    page_url: lead.pageUrl,
    utm: lead.utm
  };
}

/* Auth and content headers for the CRM call. Edit if the CRM uses a different scheme. */
function crmHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.CRM_API_KEY) headers.Authorization = 'Bearer ' + process.env.CRM_API_KEY;
  return headers;
}

/* Trimmed, single-line, length-capped text. Line breaks are removed so nothing typed can add mail headers. */
function text(v, max) {
  return typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : '';
}

/*
 * Because a successful RSVP sends an email, the form must not be usable to mail arbitrary people.
 * These checks are deliberately simple: same-site requests only, a short minimum time on the page, and a
 * per-visitor rate limit (best effort: it is kept in memory, per server instance).
 */
function hostOf(u) {
  try { return new URL(u).host.toLowerCase(); } catch (e) { return ''; }
}

function allowedOrigin(req) {
  const from = hostOf(req.headers.origin || '') || hostOf(req.headers.referer || '');
  if (!from) return false;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(from)) return true;
  const own = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (from === own) return true;
  return String(process.env.ALLOWED_ORIGINS || '').split(',').some((o) => hostOf(o.trim()) === from);
}

const hits = new Map();
function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

/* Returns { lead } or { error }. Never trust what the browser sends. */
function parseLead(body) {
  const b = body && typeof body === 'object' ? body : {};
  const lead = {
    firstName: text(b.firstName, 80),
    lastName: text(b.lastName, 80),
    email: text(b.email, 160).toLowerCase(),
    phone: text(b.phone, 30),
    guests: Math.min(4, Math.max(1, parseInt(b.guests, 10) || 1)),
    arrival: ARRIVALS.indexOf(b.arrival) >= 0 ? b.arrival : '',
    location: LOCATIONS.indexOf(b.location) >= 0 ? b.location : '',
    interestedIn: text(b.interestedIn, 80),
    propertyTypes: Array.isArray(b.propertyTypes) ? b.propertyTypes.filter((t) => TYPES.indexOf(t) >= 0) : [],
    budget: text(b.budget, 40),
    purpose: text(b.purpose, 40),
    pageUrl: text(b.pageUrl, 300),
    utm: {},
    submittedAt: new Date().toISOString()
  };
  const utm = b.utm && typeof b.utm === 'object' ? b.utm : {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
    const v = text(utm[k], 120);
    if (v) lead.utm[k] = v;
  });

  if (!lead.firstName || !lead.lastName) return { error: 'Please add your full name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return { error: 'Please add a valid email.' };
  const digits = lead.phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return { error: 'Please add a valid mobile number.' };
  if (b.consent !== true) return { error: 'Please agree to be contacted.' };
  return { lead: lead };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  if (!allowedOrigin(req)) return res.status(403).json({ ok: false, error: 'This form can only be sent from the event page.' });
  if (rateLimited(req)) return res.status(429).json({ ok: false, error: 'Too many attempts. Please wait a minute and try again.' });

  /* Bots: real visitors never fill the hidden "hp" field, and never submit within two seconds of the page loading.
     Pretend it worked. A missing time is allowed, so a page left open from before this check existed still works. */
  const tooFast = !!body && typeof body.elapsed === 'number' && body.elapsed < 2000;
  if ((body && typeof body.hp === 'string' && body.hp.trim()) || tooFast) {
    return res.status(200).json({ ok: true, delivered: true, emailed: false });
  }

  const parsed = parseLead(body);
  if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error });

  /* Once the lead is accepted, email the guest. The result is reported but never turns a good RSVP into an error. */
  async function finish(delivered) {
    const lead = parsed.lead;
    let emailed = false;
    try {
      emailed = (await sendConfirmation(lead, buildIcs({ slot: lead.arrival, email: lead.email }))).ok;
    } catch (e) {
      console.error('[email] could not prepare the confirmation');
    }
    return res.status(200).json({ ok: true, delivered: delivered, emailed: emailed });
  }

  const url = process.env.CRM_API_URL;
  if (!url) return finish(false);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: crmHeaders(),
      body: JSON.stringify(toCrmPayload(parsed.lead)),
      signal: ctrl.signal
    });
    if (!r.ok) {
      console.error('CRM rejected the RSVP: status ' + r.status);
      return res.status(502).json({ ok: false, error: 'We could not record your RSVP. Please try again.' });
    }
    clearTimeout(timer);
    return await finish(true);
  } catch (e) {
    console.error('CRM request failed: ' + (e && e.name === 'AbortError' ? 'timed out' : 'network error'));
    return res.status(502).json({ ok: false, error: 'We could not record your RSVP. Please try again.' });
  } finally {
    clearTimeout(timer);
  }
};
