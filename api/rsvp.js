/*
 * RSVP endpoint: the page posts here. This function registers the guest in the CRM (BrokerDesk, Event
 * Management), then emails the guest a confirmation with the calendar invite attached.
 *
 * To connect the CRM, set these in Vercel (Project > Settings > Environment Variables) and redeploy:
 *   CRM_API_URL   https://<the CRM's address>/api/v1/public/intake/leads
 *   CRM_API_KEY   the event's registration key (Company > Event Management > the event > Registration key).
 *                 The key belongs to that one event; it never reaches the browser.
 *
 * Until CRM_API_URL is set, a valid submission is accepted but NOT stored anywhere,
 * and the page says so on its confirmation screen.
 *
 * What the CRM answers, and what the guest is told (see forward() below):
 *   201  registered                          thank-you, and the confirmation email
 *   200  this phone is already registered    the same thank-you, no second email
 *   400  a field was refused                 asked to check the mobile number
 *   409  registration_full / _closed         told so
 *   429, 503  busy                           one retry for 503, then asked to try again shortly
 *   401  the key is wrong or was revoked     generic error; the cause is in the function log
 *
 * An agent's invite link is the page address with ?ref=<their code>. The page sends that code here and it
 * is passed on, so the guest's lead is assigned to that agent.
 *
 * The confirmation email needs RESEND_API_KEY; see lib/email.js. It is sent only once the guest has been
 * newly registered, and a failed email never fails the RSVP.
 *
 *   ALLOWED_ORIGINS   optional, comma-separated extra sites allowed to post here (e.g. another domain that
 *                     proxies this one). The site's own address, blackoak-re.com (which serves this site at
 *                     /aldar-openhouse) and localhost are always allowed.
 */

const { buildIcs } = require('../lib/ics');
const { sendConfirmation } = require('../lib/email');

const LOCATIONS = ['Abu Dhabi', 'Dubai', 'Egypt', 'Open to all'];
const ARRIVALS = ['10am-1pm', '1pm-3pm', '3pm-6pm'];
const TYPES = ['Apartment', 'Townhouse', 'Villa', 'Penthouse'];

/* How this event is named in what the CRM stores about a guest. */
const EVENT_LABEL = 'Aldar Openday Event';

/* The CRM's limits: a name of 120 characters, 200 for short fields, 2000 for free text. */
function cut(v, max) {
  return Array.from(String(v || '')).slice(0, max).join('');
}

/*
 * The guest as the CRM's registration endpoint expects it. Only these names are read there; anything else
 * is ignored. "budget" is a number in the CRM, so the page's budget text goes into the summary instead.
 *
 * The CRM keeps a registration in two places: the guest on the event (name, phone, party size, note) and
 * the lead (requirements, preferred locations, property type, note). So that nobody has to open both to
 * see what a guest answered, every answer goes into one summary and the summary goes to both: as the note,
 * which the event's guest list shows under the guest's name, and as the lead's requirements. Location and
 * residence type are also sent in their own fields, where the CRM can filter on them.
 */
function toCrmPayload(lead) {
  const answers = [];
  answers.push('Guests: ' + lead.guests);
  if (lead.arrival) answers.push('Preferred arrival: ' + lead.arrival);
  if (lead.location) answers.push('Would like to live in: ' + lead.location);
  if (lead.propertyTypes.length) answers.push('Residence of interest: ' + lead.propertyTypes.join(', '));
  if (lead.purpose) answers.push('Interested in: ' + lead.purpose);
  if (lead.interestedIn) answers.push('Project: ' + lead.interestedIn);
  if (lead.budget) answers.push('Budget: ' + lead.budget);

  const tags = Object.keys(lead.utm).map((k) => k + '=' + lead.utm[k]);
  const note = [EVENT_LABEL + ' registration'].concat(answers);
  if (tags.length) note.push('Campaign: ' + tags.join(', '));

  const payload = {
    name: cut(lead.firstName + ' ' + lead.lastName, 120),
    phone: lead.phone,
    email: lead.email,
    partySize: lead.guests,
    preferredLocations: cut(lead.location, 200),
    propertyType: cut(lead.propertyTypes.join(', '), 200),
    requirements: cut(EVENT_LABEL + '. ' + answers.join('. '), 2000),
    note: cut(note.join('\n'), 2000)
  };
  if (lead.ref) payload.ref = lead.ref;
  return payload;
}

/* Auth and content headers for the CRM call. */
function crmHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.CRM_API_KEY) headers.Authorization = 'Bearer ' + process.env.CRM_API_KEY;
  return headers;
}

/*
 * The mobile number in international form, or '' when it cannot be one.
 *
 * The form shows a fixed +971 and the guest types the rest, so what arrives is "+971 " followed by whatever
 * was typed. People type the leading 0 ("050 123 4567"), repeat the country code, or type a number from
 * another country with its own "+". Sent on as it is, the first two would be stored as a different, wrong
 * number: reminders would not reach the guest, and the one-registration-per-phone rule would not see a repeat.
 */
function normalisePhone(raw) {
  let v = String(raw || '').trim();
  /* A number with its own country code typed after the fixed prefix: the prefix is not part of it. */
  const own = v.match(/^\+971[\s-]*((?:\+|00)[\s\S]*)$/);
  if (own) v = own[1];

  const international = /^(\+|00)/.test(v);
  let digits = v.replace(/\D/g, '');
  if (/^00/.test(v)) digits = digits.replace(/^00/, '');

  const uae = (national) => {
    let n = national.replace(/^0+/, '');
    if (n.length >= 11 && n.indexOf('971') === 0) n = n.slice(3).replace(/^0+/, '');
    /* UAE numbers have 8 or 9 digits after the country code. */
    return n.length === 8 || n.length === 9 ? '+971' + n : '';
  };

  if (!international) return uae(digits);
  if (digits.indexOf('971') === 0) return uae(digits.slice(3));
  return digits.length >= 8 && digits.length <= 15 && digits[0] !== '0' ? '+' + digits : '';
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

const MAIN_SITE_HOSTS = ['blackoak-re.com', 'www.blackoak-re.com'];

function allowedOrigin(req) {
  const from = hostOf(req.headers.origin || '') || hostOf(req.headers.referer || '');
  if (!from) return false;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(from)) return true;
  const own = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (from === own || MAIN_SITE_HOSTS.indexOf(from) >= 0) return true;
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
    phone: normalisePhone(text(b.phone, 40)),
    guests: Math.min(4, Math.max(1, parseInt(b.guests, 10) || 1)),
    arrival: ARRIVALS.indexOf(b.arrival) >= 0 ? b.arrival : '',
    location: LOCATIONS.indexOf(b.location) >= 0 ? b.location : '',
    interestedIn: text(b.interestedIn, 80),
    propertyTypes: Array.isArray(b.propertyTypes) ? b.propertyTypes.filter((t) => TYPES.indexOf(t) >= 0) : [],
    budget: text(b.budget, 40),
    purpose: text(b.purpose, 40),
    pageUrl: text(b.pageUrl, 300),
    /* The inviting agent's code from the page address. Anything that is not a plain code is dropped. */
    ref: /^[a-z0-9-]{1,120}$/.test(text(b.ref, 200).toLowerCase()) ? text(b.ref, 200).toLowerCase() : '',
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
  if (!lead.phone) return { error: 'Please add a valid mobile number.' };
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

  /* Once the guest is registered, email them. The result is reported but never turns a good RSVP into an error.
     A repeat registration gets the same thank-you without a second email, so the form cannot be used to
     send the same person the invitation again and again. */
  async function finish(delivered, sendEmail) {
    const lead = parsed.lead;
    let emailed = false;
    if (sendEmail) {
      try {
        emailed = (await sendConfirmation(lead, buildIcs({ slot: lead.arrival, email: lead.email }))).ok;
      } catch (e) {
        console.error('[email] could not prepare the confirmation');
      }
    }
    return res.status(200).json({ ok: true, delivered: delivered, emailed: emailed });
  }

  const url = process.env.CRM_API_URL;
  if (!url) return finish(false, true);

  const fail = (status, error) => res.status(status).json({ ok: false, error: error });
  const tryAgain = 'We could not record your RSVP. Please try again.';

  let answer = await forward(url, parsed.lead);
  /* The CRM handles one registration per event at a time and says so when it is busy. Once more, shortly. */
  if (answer.status === 503) {
    await new Promise((r) => setTimeout(r, 1500));
    answer = await forward(url, parsed.lead);
  }

  switch (answer.status) {
    case 201:
      return finish(true, true);
    case 200:
      return finish(true, false);
    case 409:
      if (answer.code === 'registration_full') return fail(409, 'Registration for this event is now full.');
      if (answer.code === 'registration_closed') return fail(409, 'Registration for this event has closed.');
      break;
    case 400:
      /* The fields were checked above; what is left for the CRM to refuse is a number it cannot place. */
      return fail(400, 'Please check your mobile number and try again.');
    case 429:
    case 503:
      return fail(503, 'The page is busy right now. Please try again in a minute.');
    case 401:
    case 403:
      console.error('CRM refused the registration key: status ' + answer.status + '. Check CRM_API_KEY, and that the key was not regenerated or revoked.');
      return fail(502, tryAgain);
    default:
      break;
  }
  console.error('CRM did not accept the RSVP: ' + (answer.problem || 'status ' + answer.status + (answer.code ? ' (' + answer.code + ')' : '')));
  return fail(502, tryAgain);
};

/* One call to the CRM. Returns { status, code } for an answer, or { status: 0, problem } when there was none. */
async function forward(url, lead) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: crmHeaders(),
      body: JSON.stringify(toCrmPayload(lead)),
      signal: ctrl.signal
    });
    let code = '';
    try { code = String((await r.json()).code || ''); } catch (e) { /* an answer without a body */ }
    return { status: r.status, code: code };
  } catch (e) {
    return { status: 0, problem: e && e.name === 'AbortError' ? 'timed out' : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}

/* For tests. */
module.exports.toCrmPayload = toCrmPayload;
module.exports.normalisePhone = normalisePhone;
module.exports.parseLead = parseLead;
