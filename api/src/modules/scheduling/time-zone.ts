/** A moment as the audience sees it on their clock. */
export interface LocalTime {
  /** "YYYY-MM-DD" in the zone. */
  day: string;
  /** 0 (Sunday) to 6 (Saturday). */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function localTime(at: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** "HH:MM" → minutes since midnight ("24:00" is 1440). */
export function clockMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

// ICU names most African zones only as "GMT+3"; people there know these.
const ZONE_NAMES: Record<string, string> = {
  ...Object.fromEntries(
    [
      'Africa/Kampala',
      'Africa/Nairobi',
      'Africa/Dar_es_Salaam',
      'Africa/Addis_Ababa',
      'Africa/Mogadishu',
      'Africa/Djibouti',
      'Africa/Asmara',
      'Indian/Antananarivo',
      'Indian/Comoro',
      'Indian/Mayotte',
    ].map((z) => [z, 'EAT']),
  ),
  ...Object.fromEntries(
    [
      'Africa/Kigali',
      'Africa/Bujumbura',
      'Africa/Lusaka',
      'Africa/Harare',
      'Africa/Maputo',
      'Africa/Blantyre',
      'Africa/Lubumbashi',
      'Africa/Gaborone',
      'Africa/Windhoek',
      'Africa/Juba',
      'Africa/Khartoum',
    ].map((z) => [z, 'CAT']),
  ),
  ...Object.fromEntries(
    ['Africa/Johannesburg', 'Africa/Maseru', 'Africa/Mbabane'].map((z) => [
      z,
      'SAST',
    ]),
  ),
  ...Object.fromEntries(
    [
      'Africa/Lagos',
      'Africa/Kinshasa',
      'Africa/Douala',
      'Africa/Luanda',
      'Africa/Libreville',
      'Africa/Malabo',
      'Africa/Niamey',
      'Africa/Ndjamena',
      'Africa/Porto-Novo',
      'Africa/Brazzaville',
      'Africa/Bangui',
    ].map((z) => [z, 'WAT']),
  ),
};

/** The zone's short name at that moment: "EAT", "BST", "GMT+5:30". */
export function zoneName(at: Date, timeZone: string): string {
  if (ZONE_NAMES[timeZone]) return ZONE_NAMES[timeZone];
  return (
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  );
}

/** "Tuesday 09:00 (EAT)", for reasons. */
export function describeSlot(at: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  return `${time} (${zoneName(at, timeZone)})`;
}

/** "Wed 3 Dec, 11:15 EAT", for messages. */
export function describeMoment(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${zoneName(at, timeZone)}`;
}

/** "Wed 3 Dec", for a local day "YYYY-MM-DD". */
export function describeDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(`${day}T12:00:00Z`))
    .replace(',', '');
}
