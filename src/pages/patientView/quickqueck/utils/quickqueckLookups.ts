import {
    QuickqueckClinic,
    QuickqueckLookupEntry,
    QuickqueckLookupMap,
} from './quickqueckTypes';

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
