/*
 * Confirmation email to the guest, sent through Resend's HTTP API (no dependencies).
 *
 * Set these in Vercel (Project > Settings > Environment Variables) to switch it on:
 *   RESEND_API_KEY     the Resend API key. Without it no email is sent and the RSVP still succeeds.
 *   RESEND_FROM        optional sender, e.g. "Aldar Open House <invitation@blackoak-re.com>".
 *                      The domain must be verified in the Resend account.
 *   RESEND_REPLY_TO    optional reply address. Defaults to info@blackoak-re.com.
 *   PUBLIC_BASE_URL    optional site address used for the logo and calendar link in the email.
 */

const EVENT = require('./event');
const { ICS_FILENAME } = require('./ics');

const DEFAULT_FROM = 'Aldar Open House <invitation@blackoak-re.com>';
const DEFAULT_REPLY_TO = 'info@blackoak-re.com';
const DEFAULT_BASE_URL = 'https://aldar-lemon.vercel.app';

/* Strip line breaks so nothing a guest types can add mail headers. */
function oneLine(s) {
  return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function baseUrl() {
  return String(process.env.PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function view(lead) {
  const first = oneLine(lead.firstName) || 'Guest';
  const guests = Number(lead.guests) || 1;
  return {
    first: first,
    name: (first + ' ' + oneLine(lead.lastName)).trim(),
    party: guests === 1 ? '1 guest' : guests + ' guests',
    arrival: lead.arrival || EVENT.hoursLabel,
    icsUrl: baseUrl() + '/api/ics' + (lead.arrival ? '?slot=' + encodeURIComponent(lead.arrival) : ''),
    logoUrl: baseUrl() + '/img/email-logo.png'
  };
}

function renderText(v) {
  return [
    'Thank you, ' + v.first + '. We look forward to welcoming you.',
    '',
    'Our team will be in touch to confirm your visit and arrange your consultation.',
    '',
    'Guest:    ' + v.name,
    'Party:    ' + v.party,
    'Arrival:  ' + v.arrival,
    'Date:     ' + EVENT.dateLabel,
    'Hours:    ' + EVENT.hoursLabel,
    'Venue:    ' + EVENT.venue,
    'Map:      ' + EVENT.mapUrl,
    'Calendar: ' + v.icsUrl,
    '',
    'The calendar invite is also attached to this email.',
    '',
    EVENT.title,
    EVENT.host
  ].join('\n');
}

function renderHtml(v) {
  const green = '#172b28';
  const deep = '#0f1f1d';
  const line = '#2c4541';
  const champagne = '#cdb98f';
  const ivory = '#f3eee4';
  const mist = '#a9b5b0';
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const k = 'padding:14px 0;border-bottom:1px solid ' + line + ';font-family:' + sans + ';font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:' + mist + ';vertical-align:top';
  const val = 'padding:14px 0;border-bottom:1px solid ' + line + ';font-family:' + sans + ';font-size:15px;line-height:1.5;color:' + ivory;
  const row = (label, value) => '<tr><td width="120" style="' + k + '">' + label + '</td><td style="' + val + '">' + value + '</td></tr>';

  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="color-scheme" content="dark">\n<meta name="supported-color-schemes" content="dark">\n<title>' + escapeHtml(EVENT.title) + '</title>\n</head>\n' +
    '<body style="margin:0;padding:0;background:' + green + ';color:' + ivory + ';-webkit-font-smoothing:antialiased">\n' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your RSVP for the ' + escapeHtml(EVENT.title) + ' on ' + escapeHtml(EVENT.dateLabel) + '. Calendar invite attached.</div>\n' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="' + green + '" style="background:' + green + '">\n<tr><td align="center" style="padding:40px 16px">\n' +
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">\n' +

    '<tr><td align="center" style="padding:0 0 28px"><img src="' + v.logoUrl + '" width="240" alt="Aldar and BlackOak Real Estate" style="display:block;width:240px;max-width:70%;height:auto;border:0"></td></tr>\n' +

    '<tr><td bgcolor="' + deep + '" style="background:' + deep + ';border:1px solid ' + line + ';padding:36px 32px">\n' +
    '<p style="margin:0 0 18px;font-family:' + sans + ';font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:' + champagne + '">RSVP received</p>\n' +
    '<h1 style="margin:0 0 16px;font-family:' + serif + ';font-size:30px;font-weight:normal;line-height:1.2;color:' + ivory + '">Thank you, ' + escapeHtml(v.first) + '. <span style="font-style:italic;color:' + champagne + '">We look forward to welcoming you.</span></h1>\n' +
    '<p style="margin:0 0 26px;font-family:' + sans + ';font-size:15px;line-height:1.6;color:' + mist + '">Our team will be in touch to confirm your visit and arrange your consultation.</p>\n' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ' + line + '">\n' +
    row('Guest', escapeHtml(v.name)) +
    row('Party', escapeHtml(v.party)) +
    row('Arrival', escapeHtml(v.arrival)) +
    row('Date', escapeHtml(EVENT.dateLabel)) +
    row('Hours', escapeHtml(EVENT.hoursLabel)) +
    row('Venue', escapeHtml(EVENT.venue) + '<br><a href="' + EVENT.mapUrl + '" style="font-family:' + sans + ';font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:' + champagne + ';text-decoration:underline">View on map</a>') +
    '</table>\n' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:30px 0 0"><tr><td bgcolor="' + champagne + '" style="background:' + champagne + '">' +
    '<a href="' + v.icsUrl + '" style="display:inline-block;padding:15px 26px;font-family:' + sans + ';font-size:12px;font-weight:bold;letter-spacing:.24em;text-transform:uppercase;color:' + deep + ';text-decoration:none">Add to calendar</a>' +
    '</td></tr></table>\n' +
    '<p style="margin:14px 0 0;font-family:' + sans + ';font-size:12px;line-height:1.6;color:' + mist + '">The calendar invite is also attached to this email.</p>\n' +
    '</td></tr>\n' +

    '<tr><td align="center" style="padding:26px 16px 0"><p style="margin:0;font-family:' + sans + ';font-size:11px;letter-spacing:.24em;text-transform:uppercase;line-height:1.8;color:' + mist + '">' + escapeHtml(EVENT.title) + '<br>' + escapeHtml(EVENT.host) + '</p></td></tr>\n' +
    '</table>\n</td></tr>\n</table>\n</body>\n</html>';
}

/*
 * Sends the confirmation with the calendar invite attached.
 * Returns { ok: true } or { ok: false, error }. It never throws: a failed email must not fail the RSVP.
 */
async function sendConfirmation(lead, ics) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'not-configured' };

  const v = view(lead);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to: [oneLine(lead.email)],
        reply_to: process.env.RESEND_REPLY_TO || DEFAULT_REPLY_TO,
        subject: 'RSVP received: ' + EVENT.title + ', ' + EVENT.dateLabel,
        html: renderHtml(v),
        text: renderText(v),
        attachments: [{
          filename: ICS_FILENAME,
          content: Buffer.from(ics, 'utf8').toString('base64'),
          content_type: 'text/calendar; charset=utf-8; method=PUBLISH'
        }]
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      /* Status only: never put the guest's details in the logs. */
      console.error('[email] Resend rejected the message: status ' + r.status);
      return { ok: false, error: 'status-' + r.status };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] send failed: ' + (e && e.name === 'AbortError' ? 'timed out' : 'network error'));
    return { ok: false, error: 'send-failed' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendConfirmation: sendConfirmation, renderHtml: renderHtml, renderText: renderText, view: view };
