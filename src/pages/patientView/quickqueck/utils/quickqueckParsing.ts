import { AgeRange, QuickqueckContact } from './quickqueckTypes';

const SUB_YEAR_RE = /Tag|Tage|Woche|Wochen|Monat|Monate|Monaten/i;
const EMAIL_SCAN_RE = /\(?([A-Za-z0-9._\-%+-]+@[A-Za-z0-9.\-]+\.[A-Za-z]+)\)?/g;
const PHONE_NOISE_RE = /\:?\s*(?:Tel\w*\s*)\:?[\;\d\/\s\-]+\;?\s*/g;
const NUMBER_NOISE_RE = /\:?\s*\d[\d\s\-\/]+\;?/g;

function tokenToYears(
    token: string
): { value: number | null; exclusive: boolean } {
    const t = token.trim().replace(/\s*\([^)]*\)\s*$/, '');
    const exclusive = t.includes('<');
    if (SUB_YEAR_RE.test(t)) return { value: 0, exclusive: false };
    const digits = t.replace(/[<>≥≤=\s]/g, '').replace(/Jahre?$/i, '');
    const n = parseFloat(digits);
    return { value: isNaN(n) ? null : n, exclusive };
}

/**
 * Parses QuickQueck age-group labels into inclusive integer-year bounds used by
 * the patient-age filter. Sub-year labels are treated as year 0 because the UI
 * filter accepts whole years only.
 */
export function parseAgeRange(name: string): AgeRange {
    const n = name.trim();

    const abMatch = n.match(/^ab\s+(\d+)\s*(Monat\w*|Jahr\w*)/i);
    if (abMatch) {
        const isMonth = /monat/i.test(abMatch[2]);
        return { min: isMonth ? 0 : parseFloat(abMatch[1]), max: null };
    }

    const parts = n.split(/\s*[-–]\s*/);
    if (parts.length === 2) {
        const lo = tokenToYears(parts[0]);
        const hi = tokenToYears(parts[1]);
        let hiVal = hi.value;
        if (hiVal !== null && hi.exclusive && Number.isInteger(hiVal)) {
            hiVal = Math.max(hiVal - 1, 0);
        }
        if (hiVal !== null) hiVal = Math.max(hiVal, 0);
        return { min: lo.value, max: hiVal };
    }

    const singleMatch = n.match(/^([≥≤><]+)\s*(\d+(?:\.\d+)?)\s*(?:Jahre?)?$/i);
    if (singleMatch) {
        const op = singleMatch[1];
        const val = parseFloat(singleMatch[2]);
        if (op === '≥' || op === '>=') return { min: val, max: null };
        if (op === '>' || op === '>>') return { min: val + 1, max: null };
        if (op === '≤' || op === '<=') return { min: 0, max: val };
        if (op === '<') return { min: 0, max: Math.max(val - 1, 0) };
    }

    return { min: null, max: null };
}

/**
 * Normalises QuickQueck contact free text into displayable contact records.
 * Phone-number noise is removed and email positions are used to split multiple
 * contacts while preserving optional department prefixes.
 */
export function parseContactList(raw: string): QuickqueckContact[] {
    if (!raw || !raw.trim()) return [];
    raw = raw
        .replace(/\u00ad/g, '-')
        .replace(PHONE_NOISE_RE, '')
        .replace(NUMBER_NOISE_RE, '');

    const emailMatches: Array<{
        email: string;
        start: number;
        end: number;
    }> = [];
    EMAIL_SCAN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EMAIL_SCAN_RE.exec(raw)) !== null) {
        emailMatches.push({
            email: m[1],
            start: m.index,
            end: EMAIL_SCAN_RE.lastIndex,
        });
    }

    if (emailMatches.length === 0) {
        return [{ name: raw.trim() }];
    }

    return emailMatches.map(({ email, start }, i) => {
        const prevEnd = i === 0 ? 0 : emailMatches[i - 1].end;
        const namePart = raw
            .slice(prevEnd, start)
            .replace(/^[\s,]+/, '')
            .replace(/\($/, '')
            .replace(/:\s*$/, '')
            .trim();

        const colonIdx = namePart.indexOf(':');
        if (colonIdx !== -1) {
            const department = namePart.slice(0, colonIdx).trim();
            const name = namePart.slice(colonIdx + 1).trim();
            return { department, name: name || 'Contact', email };
        }

        return { name: namePart || 'Contact', email };
    });
}
