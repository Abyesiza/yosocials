import { Temporal } from "temporal-polyfill";

/**
 * Audience countries and time zones. Country codes are ISO 3166-1 alpha-2,
 * the same list the API validates against; names come from the browser.
 */

/** Where most Aby Socials audiences live, with their time zone. Shown first. */
export const FEATURED_COUNTRIES: readonly { code: string; zone: string }[] = [
  { code: "UG", zone: "Africa/Kampala" },
  { code: "KE", zone: "Africa/Nairobi" },
  { code: "TZ", zone: "Africa/Dar_es_Salaam" },
  { code: "RW", zone: "Africa/Kigali" },
  { code: "NG", zone: "Africa/Lagos" },
  { code: "GH", zone: "Africa/Accra" },
  { code: "ZA", zone: "Africa/Johannesburg" },
];

const ISO_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

let regionNames: Intl.DisplayNames | null = null;

/** "Uganda" for "UG"; the code itself if the browser has no name for it. */
export function countryName(code: string): string {
  regionNames ??= new Intl.DisplayNames(["en-GB"], { type: "region" });
  return regionNames.of(code) ?? code;
}

/** Featured countries first, then every other country by name. */
export function countryOptions(): { featured: { code: string; name: string }[]; rest: { code: string; name: string }[] } {
  const featured = new Set(FEATURED_COUNTRIES.map((c) => c.code));
  return {
    featured: FEATURED_COUNTRIES.map(({ code }) => ({ code, name: countryName(code) })),
    rest: ISO_CODES.filter((c) => !featured.has(c))
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB")),
  };
}

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Every IANA zone the browser knows, plus `keep` if it's missing from the list. */
export function timeZoneOptions(keep?: string | null): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [browserZone()];
  const all = new Set(zones);
  for (const z of [keep, browserZone()]) if (z) all.add(z);
  return [...all].sort();
}

type LocaleWithZones = Intl.Locale & { getTimeZones?: () => string[]; timeZones?: string[] };

/** The likeliest zone for a country: our list, the country's only zone, or else the browser's zone. */
export function suggestedZone(country: string | null | undefined): string {
  const own = browserZone();
  if (!country) return own;
  const featured = FEATURED_COUNTRIES.find((c) => c.code === country);
  if (featured) return featured.zone;
  try {
    const locale = new Intl.Locale(`und-${country}`) as LocaleWithZones;
    const zones = locale.getTimeZones?.() ?? locale.timeZones;
    if (zones?.length === 1) return zones[0];
  } catch {
    // Older browsers don't list zones per country.
  }
  return own;
}

/** "EAT", "GMT+3": the short name of a zone right now. */
export function shortZone(zone: string): string {
  return (
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? zone
  );
}

/** "Africa/Kampala (EAT)" for a select option. */
export const zoneOptionLabel = (zone: string) => `${zone.replaceAll("_", " ")} (${shortZone(zone)})`;

/** A value for <input type="datetime-local"> showing `iso` as wall-clock time in `zone`. */
export function toZonedInput(iso: string | Date, zone: string): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(new Date(iso).getTime());
  return instant.toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: "minute" });
}

/** The UTC ISO time a datetime-local value means in `zone`. */
export function fromZonedInput(value: string, zone: string): string {
  return Temporal.PlainDateTime.from(value).toZonedDateTime(zone).toInstant().toString();
}

/** Midnight at the start of `isoDate` (YYYY-MM-DD) in `zone`, as UTC ISO. */
export const startOfDayIn = (isoDate: string, zone: string) =>
  Temporal.PlainDate.from(isoDate).toZonedDateTime({ timeZone: zone }).toInstant().toString();

/** YYYY-MM-DD of `iso` in `zone`, for grouping by day. */
export const dayIn = (iso: string, zone: string) =>
  Temporal.Instant.fromEpochMilliseconds(new Date(iso).getTime()).toZonedDateTimeISO(zone).toPlainDate().toString();

/** "Friday 4 December" for a YYYY-MM-DD day. */
export const dayHeading = (isoDate: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );

/** "9:05" in `zone`. */
export const clockIn = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** "Fri 4 Dec, 9:05 EAT". */
export const whenIn = (iso: string, zone: string) =>
  `${new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))} ${shortZone(zone)}`;

/** "up to 1 a day, 18 hours apart" from a platform's posting limits. */
export function describeLimits(maxPerDay: number, minSpacingMinutes: number): string {
  const h = Math.floor(minSpacingMinutes / 60);
  const m = minSpacingMinutes % 60;
  const parts = [h && `${h} ${h === 1 ? "hour" : "hours"}`, m && `${m} ${m === 1 ? "minute" : "minutes"}`].filter(Boolean);
  return `up to ${maxPerDay} a day${parts.length ? `, ${parts.join(" ")} apart` : ""}`;
}
