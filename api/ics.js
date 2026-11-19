/*
 * GET /api/ics?slot=<arrival slot>
 * Returns the calendar invite as a real text/calendar file, which phones hand straight to their calendar app.
 * The slot is checked against the known list and nothing the visitor sends is echoed into the file.
 */

const { buildIcs, ICS_FILENAME } = require('../lib/ics');

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  let slot = req.query && typeof req.query.slot === 'string' ? req.query.slot : '';
  if (!slot) {
    try { slot = new URL(req.url, 'http://x').searchParams.get('slot') || ''; } catch (e) { slot = ''; }
  }
  const ics = buildIcs({ slot: slot });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + ICS_FILENAME + '"');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  return res.end(req.method === 'HEAD' ? '' : ics);
};
