import { parseAgeRange, parseContactList } from './quickqueckParsing';
import { buildLookupMap, clinicsToLookupEntries } from './quickqueckLookups';
import {
    AgeRangeMap,
    QuickqueckApiResponse,
    QuickqueckData,
} from './quickqueckTypes';

const cacheKey = 'quickqueck_data';
const cacheTimestampKey = 'quickqueck_timestamp';
const cacheMaxAgeMs = 14 * 24 * 60 * 60 * 1000;
const fetchUrl = '/quickqueck/search/json/';

function buildQuickqueckData(
    raw: QuickqueckApiResponse,
    date: number
): QuickqueckData {
    const ageRangeMap: AgeRangeMap = {};
    for (const ag of raw.age_groups) {
        ageRangeMap[ag.id] = parseAgeRange(ag.name);
    }

    return {
        studies: raw.studies.map(s => ({
            ...s,
            doctors: parseContactList(s.doctor),
            assistants: parseContactList(s.study_assistance),
        })),
        entityMap: buildLookupMap(raw.entities),
        phaseMap: buildLookupMap(raw.phases),
        therapyLineMap: buildLookupMap(raw.therapy_lines),
        ageGroupMap: buildLookupMap(raw.age_groups),
        ageRangeMap,
        lastUpdated: date,
        rawEntities: raw.entities,
        rawClinicsAsEntries: clinicsToLookupEntries(raw.clinics),
    };
}

/**
 * Loads QuickQueck trial data from localStorage or the remote JSON endpoint.
 * The raw API response is cached for 14 days and stale cache data is used as a
 * fallback if a refresh fails.
 */
export const getQuickqueckData = async (): Promise<QuickqueckData> => {
    const cachedRaw = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);

    const now = Date.now();
    const isCacheValid =
        cachedRaw !== null &&
        cachedTimestamp !== null &&
        now - Number(cachedTimestamp) < cacheMaxAgeMs;

    if (isCacheValid) {
        return buildQuickqueckData(
            JSON.parse(cachedRaw!) as QuickqueckApiResponse,
            Number(cachedTimestamp)
        );
    }

    try {
        const res = await fetch(fetchUrl);
        if (!res.ok) {
            throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        }

        const data: QuickqueckApiResponse = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimestampKey, String(now));
        return buildQuickqueckData(data, now);
    } catch (err) {
        if (cachedRaw !== null) {
            return buildQuickqueckData(
                JSON.parse(cachedRaw) as QuickqueckApiResponse,
                Number(cachedTimestamp)
            );
        }
        throw err;
    }
};
