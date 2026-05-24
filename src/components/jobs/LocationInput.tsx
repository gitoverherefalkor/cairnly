
import React from 'react';
import { MapPin, Globe } from 'lucide-react';

interface LocationInputProps {
  primaryCountry: string;
  onPrimaryCountryChange: (value: string) => void;
  secondaryCountry: string;        // empty string = none
  onSecondaryCountryChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  remoteOnly: boolean;
  onRemoteOnlyChange: (value: boolean) => void;
  disabled?: boolean;
}

// Countries supported by most job APIs (LinkedIn via n8n/Apify covers all of
// these). Ordered: anglophone first, then EU/EEA alphabetical, then the rest.
export const COUNTRIES = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'ca', label: 'Canada' },
  { code: 'au', label: 'Australia' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'ie', label: 'Ireland' },
  // EU / EEA
  { code: 'at', label: 'Austria' },
  { code: 'be', label: 'Belgium' },
  { code: 'bg', label: 'Bulgaria' },
  { code: 'hr', label: 'Croatia' },
  { code: 'cy', label: 'Cyprus' },
  { code: 'cz', label: 'Czech Republic' },
  { code: 'dk', label: 'Denmark' },
  { code: 'ee', label: 'Estonia' },
  { code: 'fi', label: 'Finland' },
  { code: 'fr', label: 'France' },
  { code: 'de', label: 'Germany' },
  { code: 'gr', label: 'Greece' },
  { code: 'hu', label: 'Hungary' },
  { code: 'is', label: 'Iceland' },
  { code: 'it', label: 'Italy' },
  { code: 'lv', label: 'Latvia' },
  { code: 'lt', label: 'Lithuania' },
  { code: 'lu', label: 'Luxembourg' },
  { code: 'mt', label: 'Malta' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'no', label: 'Norway' },
  { code: 'pl', label: 'Poland' },
  { code: 'pt', label: 'Portugal' },
  { code: 'ro', label: 'Romania' },
  { code: 'sk', label: 'Slovakia' },
  { code: 'si', label: 'Slovenia' },
  { code: 'es', label: 'Spain' },
  { code: 'se', label: 'Sweden' },
  { code: 'ch', label: 'Switzerland' },
  // Middle East / Africa
  { code: 'ae', label: 'United Arab Emirates' },
  { code: 'sa', label: 'Saudi Arabia' },
  { code: 'il', label: 'Israel' },
  { code: 'tr', label: 'Turkey' },
  { code: 'za', label: 'South Africa' },
  // Asia-Pacific
  { code: 'in', label: 'India' },
  { code: 'sg', label: 'Singapore' },
  { code: 'hk', label: 'Hong Kong' },
  { code: 'jp', label: 'Japan' },
  { code: 'kr', label: 'South Korea' },
  { code: 'my', label: 'Malaysia' },
  { code: 'ph', label: 'Philippines' },
  { code: 'th', label: 'Thailand' },
  { code: 'vn', label: 'Vietnam' },
  { code: 'id', label: 'Indonesia' },
  // Latin America
  { code: 'mx', label: 'Mexico' },
  { code: 'br', label: 'Brazil' },
  { code: 'ar', label: 'Argentina' },
  { code: 'cl', label: 'Chile' },
  { code: 'co', label: 'Colombia' },
];

// Map profile country names to country codes
export function profileCountryToCode(profileCountry: string | null): string {
  if (!profileCountry) return 'us';
  const lower = profileCountry.toLowerCase().trim();

  const exact = COUNTRIES.find(c => c.label.toLowerCase() === lower);
  if (exact) return exact.code;

  const byCode = COUNTRIES.find(c => c.code === lower);
  if (byCode) return byCode.code;

  if (lower.includes('united states') || lower.includes('usa') || lower.includes('u.s.')) return 'us';
  if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('britain')) return 'gb';
  if (lower.includes('netherlands') || lower.includes('holland')) return 'nl';
  if (lower.includes('new zealand')) return 'nz';

  return 'us';
}

const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-atlas-teal focus:border-transparent disabled:opacity-50";

const LocationInput: React.FC<LocationInputProps> = ({
  primaryCountry,
  onPrimaryCountryChange,
  secondaryCountry,
  onSecondaryCountryChange,
  city,
  onCityChange,
  remoteOnly,
  onRemoteOnlyChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">Your location</h3>
      </div>

      {/* Primary + secondary country side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Country</label>
          <select
            value={primaryCountry}
            onChange={(e) => onPrimaryCountryChange(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">+ Another country (optional)</label>
          <select
            value={secondaryCountry}
            onChange={(e) => onSecondaryCountryChange(e.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            <option value="">— None —</option>
            {COUNTRIES
              .filter(c => c.code !== primaryCountry)
              .map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))
            }
          </select>
        </div>
      </div>

      {/* City — full width */}
      <input
        type="text"
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
        placeholder="City (optional)"
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-atlas-teal focus:border-transparent disabled:opacity-50"
      />

      {/* Remote-only toggle */}
      <label className={`flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          checked={remoteOnly}
          onChange={(e) => onRemoteOnlyChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-300 text-atlas-teal focus:ring-2 focus:ring-atlas-teal cursor-pointer disabled:cursor-not-allowed"
        />
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground">Remote-friendly only</span>
      </label>
    </div>
  );
};

export default LocationInput;
