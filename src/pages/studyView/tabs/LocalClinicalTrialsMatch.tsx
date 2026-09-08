import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import { ClinicalAttribute, ClinicalData } from 'cbioportal-ts-api-client';
import {
    clinicalTrial,
    getLocalCTBundle,
} from './LocalClinicalTrialsHelperFunctions/LocalCT';
import { StudyViewPageStore } from '../StudyViewPageStore';
import {
    OQLFilter,
    ClinicalFilter,
    FinalResultRow,
    FinalResultRowClinicalTraitsAndBiomarkers,
    LocalCTBundle,
    AgeFilter,
} from './LocalClinicalTrialsHelperFunctions/LocalCTInterfaces';
import {
    ageEligibilityNotes,
    alterationLabel,
    useMutationsPerPatient,
    buildAlterations,
    alterationsByInclusion,
    patientsByExclusion,
    clinicalInclusionsByTrial,
    clinicalExclusionPatients,
} from './LocalClinicalTrialsHelperFunctions/LocalCTTools';
import {
    CTLazyTable,
    CTLazyTableClinicalTraitsAndBiomarkers,
} from 'pages/studyView/table/LocalCTTable';
import client from 'shared/api/cbioportalClientInstance';

// Helper function to obrain StudyViewPageStore encoding metadata on the currently viewed study
interface Props {
    store: StudyViewPageStore;
}

// The major component to control the local clinical trials matching tab. It fetches the local clinical trial data, extracts molecular alteration data for patients in the current study, applies the trial inclusion and exclusion criteria to identify matches, and renders the results in a table.
const LocalClinicalTrialsMatch: React.FC<Props> = observer(({ store }) => {
    // const [trials, setTrials] = useState<clinicalTrial[] | null>(null);
    const [ageByPatient, setAgeByPatient] = useState<{
        [patientId: string]: string;
    }>({});
    const [
        patientDisplayNameByPatient,
        setPatientDisplayNameByPatient,
    ] = useState<{
        [patientId: string]: string;
    }>({});
    const [showBoilerplate, setShowBoilerplate] = useState(false);
    const [showMolecular, setShowMolecular] = useState(true);
    const [showClinical, setShowClinical] = useState(true);
    const [showTrials, setShowTrials] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [clinicalDataForFiltering, setClinicalDataForFiltering] = useState<
        ClinicalData[]
    >([]);
    const [bundle, setBundle] = useState<LocalCTBundle | null>(null);
    const [loadError, setLoadError] = useState<Error | null>(null);

    useEffect(() => {
        getLocalCTBundle()
            .then(setBundle)
            .catch(setLoadError);
    }, []);

    const trials = bundle?.trials ?? null;

    const {
        hugoFilter,
        OQLFilterMutation,
        OQLFilterCNA,
        OQLFilterSV,
        clinicalFilter,
        ageFilter,
    } = bundle?.aggregateFilters ?? {
        hugoFilter: [] as string[],
        OQLFilterMutation: [] as OQLFilter[],
        OQLFilterCNA: [] as OQLFilter[],
        OQLFilterSV: [] as OQLFilter[],
        clinicalFilter: [] as ClinicalFilter[],
        ageFilter: [] as AgeFilter[],
    };

    const hugoSet = useMemo(() => new Set(hugoFilter), [hugoFilter]);
    const hugoFilterKey = useMemo(() => hugoFilter.join(','), [hugoFilter]);

    const mutationsPerPatient = useMutationsPerPatient(
        store,
        hugoFilter,
        hugoFilterKey
    );

    useEffect(() => {
        let disposed = false;

        const loadAgeClinicalData = async () => {
            if (
                store.selectedSamples.status !== 'complete' ||
                store.clinicalAttributes.status !== 'complete'
            ) {
                return;
            }

            const selectedSamples = store.selectedSamples.result;
            if (selectedSamples.length === 0) {
                if (!disposed) {
                    setAgeByPatient({});
                }
                return;
            }

            const ageAttribute = store.clinicalAttributes.result.find(
                (attr: ClinicalAttribute) => {
                    if (!attr.patientAttribute) {
                        return false;
                    }

                    const attributeId =
                        attr.clinicalAttributeId?.toUpperCase() || '';
                    const displayName = (attr.displayName || '').toUpperCase();

                    return displayName === 'AGE';
                }
            );

            if (!ageAttribute) {
                if (!disposed) {
                    setAgeByPatient({});
                }
                return;
            }
            const ageClinicalData = await client.fetchClinicalDataUsingPOST({
                clinicalDataType: 'PATIENT',
                clinicalDataMultiStudyFilter: {
                    attributeIds: [ageAttribute.clinicalAttributeId],
                    identifiers: selectedSamples.map(sample => ({
                        studyId: sample.studyId,
                        entityId: sample.patientId,
                    })),
                },
            });

            const ageMap: { [patientId: string]: string } = {};
            ageClinicalData.forEach((datum: ClinicalData) => {
                if (datum.patientId) {
                    ageMap[datum.patientId] = datum.value;
                }
            });

            // Fetch display names for all patients
            const uniquePatientIds = Array.from(
                new Set(selectedSamples.map(s => s.patientId))
            );
            const displayNameData = await client.fetchClinicalDataUsingPOST({
                clinicalDataType: 'PATIENT',
                clinicalDataMultiStudyFilter: {
                    attributeIds: ['PATIENT_DISPLAY_NAME'],
                    identifiers: uniquePatientIds.map(patientId => ({
                        studyId:
                            selectedSamples.find(s => s.patientId === patientId)
                                ?.studyId || '',
                        entityId: patientId,
                    })),
                },
            });
            const displayNameMap: { [patientId: string]: string } = {};
            displayNameData.forEach((datum: ClinicalData) => {
                if (datum.patientId && datum.value) {
                    displayNameMap[datum.patientId] = datum.value;
                }
            });

            if (!disposed) {
                setAgeByPatient(ageMap);
                setPatientDisplayNameByPatient(displayNameMap);
            }
        };

        loadAgeClinicalData();

        return () => {
            disposed = true;
        };
    }, [
        store.selectedSamples.status,
        store.clinicalAttributes.status,
        store.filters,
    ]);

    // Fetch clinical data for clinical filter attributes
    useEffect(() => {
        let disposed = false;

        const loadClinicalDataForFiltering = async () => {
            if (
                store.selectedSamples.status !== 'complete' ||
                store.clinicalAttributes.status !== 'complete' ||
                clinicalFilter.length === 0
            ) {
                if (!disposed) setClinicalDataForFiltering([]);
                return;
            }

            const selectedSamples = store.selectedSamples.result;
            if (selectedSamples.length === 0) {
                if (!disposed) setClinicalDataForFiltering([]);
                return;
            }

            // Collect unique clinical attribute names from filters
            const filterAttrNames = new Set(
                clinicalFilter.map(f => f.clinicalParameterId.toUpperCase())
            );

            // Find matching clinical attributes (both sample and patient level)
            const matchingAttrs = store.clinicalAttributes.result.filter(
                (attr: ClinicalAttribute) => {
                    const attrId =
                        attr.clinicalAttributeId?.toUpperCase() || '';
                    return filterAttrNames.has(attrId);
                }
            );

            const attrIdToDisplayName = new Map<string, string>();
            matchingAttrs.forEach(attr => {
                if (attr.clinicalAttributeId) {
                    attrIdToDisplayName.set(
                        attr.clinicalAttributeId.toUpperCase(),
                        attr.displayName || attr.clinicalAttributeId
                    );
                }
            });

            // Add displayName to each clinicalFilter entry
            clinicalFilter.forEach(f => {
                const displayName = attrIdToDisplayName.get(
                    f.clinicalParameterId.toUpperCase()
                );
                if (displayName) {
                    // Add a new property for display name
                    (f as any).clinicalParameterName = displayName;
                }
            });

            if (matchingAttrs.length === 0) {
                if (!disposed) setClinicalDataForFiltering([]);
                return;
            }

            const sampleAttrs = matchingAttrs.filter(a => !a.patientAttribute);
            const patientAttrs = matchingAttrs.filter(a => a.patientAttribute);

            const allData: ClinicalData[] = [];

            // Fetch sample-level clinical data
            if (sampleAttrs.length > 0) {
                try {
                    const sampleData = await client.fetchClinicalDataUsingPOST({
                        clinicalDataType: 'SAMPLE',
                        clinicalDataMultiStudyFilter: {
                            attributeIds: sampleAttrs.map(
                                a => a.clinicalAttributeId
                            ),
                            identifiers: selectedSamples.map(s => ({
                                studyId: s.studyId,
                                entityId: s.sampleId,
                            })),
                        },
                    });
                    allData.push(...sampleData);
                } catch (err) {
                    console.error(
                        'Error fetching sample clinical data for filtering:',
                        err
                    );
                }
            }

            // Fetch patient-level clinical data
            if (patientAttrs.length > 0) {
                try {
                    const patientData = await client.fetchClinicalDataUsingPOST(
                        {
                            clinicalDataType: 'PATIENT',
                            clinicalDataMultiStudyFilter: {
                                attributeIds: patientAttrs.map(
                                    a => a.clinicalAttributeId
                                ),
                                identifiers: selectedSamples.map(s => ({
                                    studyId: s.studyId,
                                    entityId: s.patientId,
                                })),
                            },
                        }
                    );
                    allData.push(...patientData);
                } catch (err) {
                    console.error(
                        'Error fetching patient clinical data for filtering:',
                        err
                    );
                }
            }

            if (!disposed) setClinicalDataForFiltering(allData);
        };

        loadClinicalDataForFiltering();

        return () => {
            disposed = true;
        };
    }, [
        store.selectedSamples.status,
        store.clinicalAttributes.status,
        store.filters,
        clinicalFilter,
    ]);

    if (!mutationsPerPatient) {
        return <div>Loading Clinical Trial Matches</div>;
    }

    const filteredMutations = mutationsPerPatient.mutations.filter(m =>
        hugoSet.has(m.gene?.hugoGeneSymbol ?? '')
    );

    const filteredCna = mutationsPerPatient.cnaExt.filter(c =>
        hugoSet.has(c.gene?.hugoGeneSymbol ?? '')
    );

    const filteredSV = mutationsPerPatient.sv.filter(
        sv =>
            hugoSet.has(sv.site1HugoSymbol ?? '') ||
            hugoSet.has(sv.site2HugoSymbol ?? '')
    );

    const allAlterations = buildAlterations(
        filteredMutations,
        filteredCna,
        filteredSV
    );

    const allFilters: OQLFilter[] = [
        ...OQLFilterMutation,
        ...OQLFilterCNA,
        ...OQLFilterSV,
    ];

    const inclMap = alterationsByInclusion(allAlterations, allFilters);
    const exclMap = patientsByExclusion(allAlterations, allFilters);

    // Apply clinical filters
    const clinInclMap = clinicalInclusionsByTrial(
        clinicalDataForFiltering,
        clinicalFilter
    );

    const clinExclMap = clinicalExclusionPatients(
        clinicalDataForFiltering,
        clinicalFilter
    );

    // Merge clinical exclusions into molecular exclusions
    clinExclMap.forEach((patients, trial) => {
        if (!exclMap.has(trial)) exclMap.set(trial, new Set());
        patients.forEach(p => exclMap.get(trial)!.add(p));
    });

    const trialUrlByName = new Map<string, string>();
    allFilters.forEach(f => {
        if (f.trialName && f.trialURL && !trialUrlByName.has(f.trialName)) {
            trialUrlByName.set(f.trialName, f.trialURL);
        }
    });
    // Also populate trialUrlByName from clinical filters
    clinicalFilter.forEach(f => {
        if (f.trialName && f.trialURL && !trialUrlByName.has(f.trialName)) {
            trialUrlByName.set(f.trialName, f.trialURL);
        }
    });

    const finalResults: FinalResultRow[] = [];
    const finalResultsClin: FinalResultRowClinicalTraitsAndBiomarkers[] = [];
    const seen = new Set<string>();

    inclMap.forEach((patientsMap, trial) => {
        const exclPatients = exclMap.get(trial) ?? new Set<string>();
        const trialURL = trialUrlByName.get(trial) ?? '';

        patientsMap.forEach((alts, patientId) => {
            if (exclPatients.has(patientId)) return;

            alts.forEach(a => {
                const row: FinalResultRow = {
                    studyId: store.studyIds?.[0],
                    patientId: patientId,
                    patientDisplayName:
                        patientDisplayNameByPatient[patientId] || undefined,
                    age: ageByPatient[patientId] || '',
                    ageNotes: ageEligibilityNotes(
                        ageFilter,
                        ageByPatient[patientId],
                        trial
                    ),
                    sampleId: a.sampleId,
                    trial,
                    trialURL,
                    gene: a.gene.hugoGeneSymbol,
                    alterationType: a.alterationType,
                    mutationType: a.mutationType || '',
                    alteration: alterationLabel(a),
                };

                const key = `${row.patientId}__${row.sampleId}__${row.trial}__${row.gene}__${row.alterationType}__${row.alteration}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    finalResults.push(row);
                }
            });
        });
    });

    // Build clinical inclusion result rows
    clinInclMap.forEach((patientsMap, trial) => {
        const exclPatients = exclMap.get(trial) ?? new Set<string>();
        const trialURL = trialUrlByName.get(trial) ?? '';

        patientsMap.forEach((matches, patientId) => {
            if (exclPatients.has(patientId)) return;

            matches.forEach(m => {
                const row: FinalResultRowClinicalTraitsAndBiomarkers = {
                    studyId: store.studyIds?.[0],
                    patientId: patientId,
                    patientDisplayName:
                        patientDisplayNameByPatient[patientId] || undefined,
                    age: ageByPatient[patientId] || '',
                    ageNotes: ageEligibilityNotes(
                        ageFilter,
                        ageByPatient[patientId],
                        trial
                    ),
                    sampleId: m.sampleId,
                    trial,
                    trialURL,
                    clinicalParameterName: m.filter.clinicalParameterName,
                    clinicalParameterValue: m.value,
                };

                const key = `${row.patientId}__${row.sampleId}__${row.trial}__${row.clinicalParameterName}__${row.clinicalParameterValue}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    finalResultsClin.push(row);
                }
            });
        });
    });

    return (
        <div style={{ padding: 12 }}>
            <h2>Local Clinical Trial Matches</h2>
            <h3
                onClick={() => setShowBoilerplate(v => !v)}
                style={{ cursor: 'pointer' }}
            >
                {showBoilerplate ? '▼' : '►'} Click here to learn more about
                this tab
            </h3>
            {showBoilerplate && boilerplateText}
            <h3
                onClick={() => setShowMolecular(v => !v)}
                style={{ cursor: 'pointer' }}
            >
                {showMolecular ? '▼' : '►'} Matches based on Molecular
                Alterations:{' '}
            </h3>
            {showMolecular && <CTLazyTable resultsTable={finalResults} />}

            <h3
                onClick={() => setShowClinical(v => !v)}
                style={{ cursor: 'pointer' }}
            >
                {showClinical ? '▼' : '►'} Matches based on Clinical Traits and
                Biomarkers:{' '}
            </h3>
            {showClinical && (
                <CTLazyTableClinicalTraitsAndBiomarkers
                    resultsTableClinicalTraitsAndBiomarkers={finalResultsClin}
                />
            )}
            <h3
                onClick={() => setShowTrials(v => !v)}
                style={{ cursor: 'pointer' }}
            >
                {showTrials ? '▼' : '►'} Local Clinical Trials in this
                cBioPortal instance
            </h3>
            {showTrials && localCTList(trials)}
            <h3
                onClick={() => setShowFilters(v => !v)}
                style={{ cursor: 'pointer' }}
            >
                {showFilters ? '▼' : '►'} Filters Applied:
            </h3>
            {showFilters &&
                filtersExplainer(
                    OQLFilterMutation,
                    OQLFilterCNA,
                    OQLFilterSV,
                    clinicalFilter
                )}
        </div>
    );
});

// These are informational components that explain the functionality of the local clinical trials matching tool, list the available local clinical trials, and describe the filters applied based on the trial criteria. They are used to provide context and guidance to users of the tool.
// They aren't crucial for the functionality, but they might be helpful for users to understand the tab.
// boilerplate text
export const boilerplateText = (
    <div>
        <p>
            This table shows patients from the current study who match the
            molecular inclusion criteria for any local clinical trials. Patients
            are included if they have at least one alteration that matches an
            inclusion criterion and do not have any alterations that match
            exclusion criteria for the same trial. Click on trial names to view
            details about the trial, and on patient/sample IDs to view their
            respective pages in cBioPortal.
        </p>
        <h3>Who is this for?</h3>
        <p>
            This tool is designed for researchers and clinicians who want to
            quickly identify potential matches between patients in their study
            and a selection of local (on-site) clinical trials based on
            molecular criteria. It can be used to facilitate patient recruitment
            for trials, generate hypotheses about trial eligibility, and explore
            the landscape of available trials in relation to the molecular
            profiles of patients in the study.
        </p>
        <h3>How does it work?</h3>
        <p>
            The tool works by first extracting molecular alteration data
            (mutations, copy number alterations, structural variants) for
            patients in the current study. It then parses the inclusion and
            exclusion criteria of local clinical trials to identify molecular
            eligibility requirements. Finally, it matches patients to trials
            based on their alterations and the trial criteria, and presents the
            results in an interactive table. It requires a json file describing
            the trials and their respective eligibilty criteria. An example file
            can be found{' '}
            <a
                href={`${window.location.origin}/localCT.json`}
                target="_blank"
                rel="noopener noreferrer"
            >
                here
            </a>
            .
        </p>
    </div>
);

// A list with all local clinical trials available in the cBioPortal instance, with links to their respective pages. This is generated from the localCT.json file and provides users with an overview of the trials that are being matched against.
export const localCTList = (trials: clinicalTrial[] | null) => (
    <div>
        {trials ? (
            <ul>
                {trials.map((t, idx) => (
                    <li key={idx}>
                        <a
                            href={t.trialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {t.trialName}
                        </a>
                    </li>
                ))}
            </ul>
        ) : (
            <p>No local clinical trials available.</p>
        )}
    </div>
);

// A list of all filters applied in the matching process, based on the inclusion and exclusion criteria of the trials. This component helps users understand why certain patients were matched to certain trials by showing the specific molecular criteria that were used for matching.
export const filtersExplainer = (
    OQLFilterMutation: OQLFilter[],
    OQLFilterCNA: OQLFilter[],
    OQLFilterSV: OQLFilter[],
    clinicalFilterList: ClinicalFilter[] = []
) => (
    <div>
        <ul>
            {OQLFilterMutation.map((f, idx) => (
                <li key={`mut-${idx}`}>
                    Mutation: {f.gene}{' '}
                    {f.proteinChange || f.mutationType || 'ANY'} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
            {OQLFilterCNA.map((f, idx) => (
                <li key={`cna-${idx}`}>
                    CNA: {f.gene} {f.cnaType} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
            {OQLFilterSV.map((f, idx) => (
                <li key={`sv-${idx}`}>
                    SV: {f.gene} {f.fusionPartner ? `::${f.fusionPartner}` : ''}{' '}
                    {f.mutationType} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
            {clinicalFilterList.map((f, idx) => (
                <li key={`clin-${idx}`}>
                    Clinical: {f.clinicalParameterId}{' '}
                    {f.clinicalParameterOperator}{' '}
                    {String(f.clinicalParameterValue)} (Trial:{' '}
                    <a
                        href={f.trialURL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {f.trialName}
                    </a>
                    , {f.criterionType})
                </li>
            ))}
        </ul>
    </div>
);

export default LocalClinicalTrialsMatch;
