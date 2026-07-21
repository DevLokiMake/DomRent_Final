const pad = (n: number) => n.toString().padStart(2, '0');

const toICSDate = (isoString: string): string => {
  const d = new Date(isoString);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};

const escapeICSText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export interface ICSBookingInput {
  id: number;
  title: string;
  city?: string;
  startDate: string;
  endDate: string;
}

/**
 * Генерирует .ics файл бронирования на клиенте и запускает скачивание.
 * DTEND в all-day событиях ICS не включает последний день (checkout) — это
 * совпадает с семантикой startDate/endDate бронирования (заезд/выезд).
 */
export const downloadBookingICS = (booking: ICSBookingInput) => {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DomRent//Booking//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:domrent-booking-${booking.id}@domrent.kz`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${toICSDate(booking.startDate)}`,
    `DTEND;VALUE=DATE:${toICSDate(booking.endDate)}`,
    `SUMMARY:${escapeICSText(booking.title)}`,
    booking.city ? `LOCATION:${escapeICSText(booking.city)}` : null,
    'DESCRIPTION:Бронирование DomRent',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => line !== null);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `domrent-booking-${booking.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
