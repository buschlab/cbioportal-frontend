import {
    ClinicCityMap,
    QuickqueckClinic,
    QuickqueckLookupEntry,
    QuickqueckLookupMap,
} from './quickqueckTypes';

const CLINIC_NOISE_WORDS = new Set([
    'ukf',
    'uke',
    'ukhd',
    'tum',
    'lmu',
    'uksh',
    'uk',
    'nct',
    'wtz',
    'ucch',
    'ccc',
    'cccf',
    'cccts',
    'cccu',
    'cccm',
    'cccg',
    'cccz',
    'ccc-n',
    'ccc-mv',
    'mcc',
    'uct',
    'utc',
    'uccl',
    'nwtz',
    'rbct',
    'slk',
    'diako',
    'fek',
    'hopa',
    'hope',
    'owl',
    'abcd',
    'g-ccc',
    'umg',
    'umo',
    'campus',
    'netzwerkpartner',
    'klinikum',
    'krankenhaus',
    'brüderkrankenhaus',
    'hospital',
    'universitätsspital',
    'kantonsspital',
    'schwerpunktpraxis',
    'radiochir.',
    'norddeutschl.',
    'am',
    'am urban',
    'urban',
    'r.',
    'd.',
    'isar',
    'onk.',
    'ostholstein-onk.',
]);

const CLINIC_CITY_OVERRIDES: Record<number, string> = {
    9: 'München',
    49: 'Kiel',
    50: 'Schwarzwald-Baar',
};

/**
 * Canonical phase filter labels and the QuickQueck phase IDs they match.
 * Combined phases are intentionally matched by each constituent phase filter.
 */
export const PHASE_FILTER_MAP: Record<string, Set<number>> = {
    I: new Set([8, 9]),
    II: new Set([7, 9, 12]),
    III: new Set([4, 12]),
    IV: new Set([3]),
    Beobachtungsstudie: new Set([18]),
    NIS: new Set([6]),
    Register: new Set([1]),
};

export const PHASE_FILTER_OPTIONS = [
    'I',
    'II',
    'III',
    'IV',
    'Beobachtungsstudie',
    'NIS',
    'Register',
];

function extractCityFromClinicName(
    name: string,
    groupId: number | null
): string | null {
    if (groupId !== null && CLINIC_CITY_OVERRIDES[groupId] !== undefined) {
        return CLINIC_CITY_OVERRIDES[groupId];
    }

    const parenMatch = name.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) return parenMatch[1].trim();

    const words = name.replace(/,/g, ' ').split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
        const raw = words[i].replace(/[.,;]+$/, '');
        if (!raw) continue;
        if (CLINIC_NOISE_WORDS.has(raw.toLowerCase())) continue;
        if (!/^[A-ZÄÖÜ]/.test(raw)) continue;

        const adjMatch = raw.match(/^(.+?)n?er$/);
        if (adjMatch && adjMatch[1].length > 2) {
            const base = adjMatch[1];
            if (
                /^[A-ZÄÖÜ]/.test(base) &&
                !CLINIC_NOISE_WORDS.has(base.toLowerCase())
            ) {
                return base + (raw.endsWith('ner') ? '' : '');
            }
        }

        const hyphenMatch = raw.match(/^([A-ZÄÖÜ][^-]+)-([A-Z]{2,4})$/);
        if (hyphenMatch) return hyphenMatch[1];

        return raw;
    }

    return null;
}

export function buildClinicCityMap(clinics: QuickqueckClinic[]): ClinicCityMap {
    const map: ClinicCityMap = {};
    function visit(clinic: QuickqueckClinic) {
        if (clinic.group_id !== null) {
            const city = extractCityFromClinicName(
                clinic.name,
                clinic.group_id
            );
            if (city) map[clinic.group_id] = city;
        }
        if (clinic.children) clinic.children.forEach(visit);
    }
    clinics.forEach(visit);
    return map;
}

export function buildLookupMap(
    entries: QuickqueckLookupEntry[]
): QuickqueckLookupMap {
    const map: QuickqueckLookupMap = {};
    function visit(entry: QuickqueckLookupEntry) {
        map[entry.id] = entry.name;
        if (entry.children) {
            entry.children.forEach(visit);
        }
    }
    entries.forEach(visit);
    return map;
}

/** Returns an entry ID and every descendant ID for hierarchical filter matching. */
export function collectDescendantIds(entry: QuickqueckLookupEntry): number[] {
    const ids: number[] = [entry.id];
    if (entry.children) {
        for (const child of entry.children) {
            ids.push(...collectDescendantIds(child));
        }
    }
    return ids;
}

/**
 * Converts the clinic hierarchy into the generic tree shape used by the filter.
 * Non-selectable grouping nodes receive negative sentinel IDs.
 */
export function clinicsToLookupEntries(
    clinics: QuickqueckClinic[]
): QuickqueckLookupEntry[] {
    return clinics.map((clinic, i) => {
        const children: QuickqueckLookupEntry[] = (clinic.children ?? []).map(
            child => clinicsToLookupEntries([child])[0]
        );

        return {
            id: clinic.group_id ?? -(i + 1),
            name: clinic.name,
            children: children.length > 0 ? children : undefined,
        };
    });
}
