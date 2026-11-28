"use client";

import { useMemo } from "react";
import { Field, Select } from "@/app/components/ui";
import { countryOptions, suggestedZone, timeZoneOptions, zoneOptionLabel } from "@/app/lib/audience";

export interface Audience {
  country: string;
  timeZone: string;
}

/** Country and time zone selects; choosing a country fills in its likeliest zone. */
export function AudienceFields({
  value,
  onChange,
  disabled,
  allowEmpty = true,
  requireZone = false,
  countryHint,
  zoneHint,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  /** Always keep a zone, even with no country. */
  requireZone?: boolean;
  countryHint?: string;
  zoneHint?: string;
}) {
  const countries = useMemo(() => countryOptions(), []);
  const zones = useMemo(() => timeZoneOptions(value.timeZone).map((z) => [z, zoneOptionLabel(z)] as const), [value.timeZone]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Audience country" hint={countryHint}>
        <Select
          value={value.country}
          disabled={disabled}
          onChange={(e) => {
            const country = e.target.value;
            onChange({ country, timeZone: country ? suggestedZone(country) : value.timeZone });
          }}
        >
          {allowEmpty && <option value="">Not set</option>}
          <optgroup label="Popular">
            {countries.featured.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </optgroup>
          <optgroup label="All countries">
            {countries.rest.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </optgroup>
        </Select>
      </Field>
      <Field label="Audience time zone" hint={zoneHint}>
        <Select value={value.timeZone} disabled={disabled} onChange={(e) => onChange({ ...value, timeZone: e.target.value })}>
          {allowEmpty && !requireZone && <option value="">Not set</option>}
          {zones.map(([z, label]) => <option key={z} value={z}>{label}</option>)}
        </Select>
      </Field>
    </div>
  );
}
