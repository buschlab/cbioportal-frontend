export type QuickqueckLookupEntry = {
    id: number;
    name: string;
    children?: QuickqueckLookupEntry[];
};

export type QuickqueckClinic = {
    id: number;
    group_id: number | null;
    name: string;
    rank: string;
    children?: QuickqueckClinic[];
};

/** Age range derived from a QuickQueck age-group label. */
export type AgeRange = {
    /** Inclusive lower bound in years; null means unbounded or unknown. */
    min: number | null;
    /** Inclusive upper bound in years; null means unbounded or unknown. */
    max: number | null;
};

export type QuickqueckContact = {
    department?: string;
    name: string;
    email?: string;
};

export type QuickqueckStudy = {
    id: number;
    group: number;
    group_name: string;
    entity: number;
    therapy_line: number;
    age_group: number;
    study_name: string;
    study_linkname: string;
    study_link: string;
    study_number: string;
    phase: number | null;
    criteria: string;
    doctor: string;
    study_assistance: string;
    doctors: QuickqueckContact[];
    assistants: QuickqueckContact[];
    last_modified: string;
};

export type QuickqueckApiResponse = {
    studies: QuickqueckStudy[];
    clinics: QuickqueckClinic[];
    entities: QuickqueckLookupEntry[];
    phases: QuickqueckLookupEntry[];
    therapy_lines: QuickqueckLookupEntry[];
    age_groups: QuickqueckLookupEntry[];
};

export type QuickqueckLookupMap = Record<number, string>;
export type AgeRangeMap = Record<number, AgeRange>;

export type QuickqueckData = {
    studies: QuickqueckStudy[];
    entityMap: QuickqueckLookupMap;
    phaseMap: QuickqueckLookupMap;
    therapyLineMap: QuickqueckLookupMap;
    ageGroupMap: QuickqueckLookupMap;
    ageRangeMap: AgeRangeMap;
    lastUpdated: number;
    rawEntities: QuickqueckLookupEntry[];
    rawClinicsAsEntries: QuickqueckLookupEntry[];
};
