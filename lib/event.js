/*
 * Event facts shared by the calendar invite and the confirmation email.
 * If the date, hours, venue or arrival slots change, change them here and in public/index.html.
 */

module.exports = {
  /* Shown as the calendar entry's title and in the email subject. */
  title: 'Aldar Open House Event',
  host: 'An Aldar \u00d7 BlackOak property experience',
  dateIso: '2026-12-12',
  dateLabel: 'Saturday, 12 December 2026',
  hoursLabel: '10am to 6pm',
  venue: 'Aldar Sales Centre, Dubai',
  mapUrl: 'https://maps.app.goo.gl/Uun4Rvu5Nh8cL4Ar8',
  /* Dubai is UTC+4 all year, with no daylight saving. */
  tzOffsetHours: 4,
  /* The whole event, used when no arrival slot is given. */
  hours: [10, 18],
  /* Arrival slots offered by the form: label -> [start hour, end hour], Dubai time. */
  slots: {
    '10am-1pm': [10, 13],
    '1pm-3pm': [13, 15],
    '3pm-6pm': [15, 18]
  }
};
