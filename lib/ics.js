/*
 * Builds the calendar invite (.ics) for the event. No dependencies.
 * Times are written in UTC; Dubai has a fixed UTC+4 offset, so every calendar app shows the right hours.
 */

const crypto = require('crypto');
const EVENT = require('./event');

const ICS_FILENAME = 'aldar-open-house-event.ics';
const pad = (n) => String(n).padStart(2, '0');

function stamp(t) {
  return '' + t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) +
    'T' + pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds()) + 'Z';
}

/* A Dubai-time hour on the event day, as a UTC stamp. */
function eventStamp(localHour) {
  const p = EVENT.dateIso.split('-').map(Number);
  return stamp(new Date(Date.UTC(p[0], p[1] - 1, p[2], localHour - EVENT.tzOffsetHours, 0, 0)));
}

/* RFC 5545: escape backslash, semicolon, comma and newlines in text values. */
function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/* RFC 5545: lines longer than 75 bytes are folded onto continuation lines that start with a space. */
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let i = 0;
  let first = true;
  while (i < bytes.length) {
    let end = Math.min(i + (first ? 75 : 74), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; /* never split a multi-byte character */
    out.push((first ? '' : ' ') + bytes.subarray(i, end).toString('utf8'));
    i = end;
    first = false;
  }
  return out.join('\r\n');
}

/*
 * slot:  one of the arrival slots in lib/event.js; anything else gives the whole event.
 * email: optional, only used to give each guest's invite a stable id so re-sending updates rather than duplicates.
 */
function buildIcs(opts) {
  const o = opts || {};
  const known = Object.prototype.hasOwnProperty.call(EVENT.slots, o.slot);
  const hours = known ? EVENT.slots[o.slot] : EVENT.hours;
  const who = crypto.createHash('sha256').update(String(o.email || '').toLowerCase()).digest('hex').slice(0, 16);
  const uid = 'aldar-open-house-' + EVENT.dateIso + '-' + (known ? hours.join('-') : 'all') + '-' + who + '@blackoak-re.com';

  const description = [
    EVENT.title + '. ' + EVENT.host + '.',
    known
      ? 'Your preferred arrival: ' + o.slot + ' (Gulf Standard Time). The open house runs ' + EVENT.hoursLabel + '.'
      : 'The open house runs ' + EVENT.hoursLabel + ' (Gulf Standard Time).',
    'Venue: ' + EVENT.venue + '.',
    'Map: ' + EVENT.mapUrl
  ].join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BlackOak Real Estate//Aldar Open House Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + stamp(new Date()),
    'DTSTART:' + eventStamp(hours[0]),
    'DTEND:' + eventStamp(hours[1]),
    'SUMMARY:' + escapeText(EVENT.title),
    'DESCRIPTION:' + escapeText(description),
    'LOCATION:' + escapeText(EVENT.venue),
    'URL:' + EVENT.mapUrl,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + escapeText('Tomorrow: ' + EVENT.title),
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + escapeText('In 2 hours: ' + EVENT.title),
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

module.exports = { buildIcs: buildIcs, ICS_FILENAME: ICS_FILENAME };
