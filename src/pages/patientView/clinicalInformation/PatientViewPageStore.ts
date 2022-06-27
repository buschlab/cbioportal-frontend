import _ from 'lodash';
import {
    CBioPortalAPIInternal,
    ClinicalData,
    ClinicalDataMultiStudyFilter,
    CopyNumberCount,
    DiscreteCopyNumberData,
    DiscreteCopyNumberFilter,
    GenePanel,
    GenePanelData,
    MolecularProfile,
    Mutation,
    MutationFilter,
    NumericGeneMolecularData,
    ReferenceGenomeGene,
    ResourceData,
    Sample,
    SampleMolecularIdentifier,
    StructuralVariantFilter,
    GenericAssayData,
    GenericAssayMeta,
    GenericAssayDataMultipleStudyFilter,
    GenericAssayMetaFilter,
} from 'cbioportal-ts-api-client';
import client from '../../../shared/api/cbioportalClientInstance';
import internalClient from '../../../shared/api/cbioportalInternalClientInstance';
import oncokbClient from '../../../shared/api/oncokbClientInstance';
import {
    computed,
    observable,
    action,
    runInAction,
    makeObservable,
} from 'mobx';
import { remoteData, stringListToSet } from 'cbioportal-frontend-commons';
import { IGisticData } from 'shared/model/Gistic';
import { cached, labelMobxPromises } from 'mobxpromise';
import MrnaExprRankCache from 'shared/cache/MrnaExprRankCache';
import request from 'superagent';
import DiscreteCNACache from 'shared/cache/DiscreteCNACache';
import {
    getDarwinUrl,
    getDigitalSlideArchiveMetaUrl,
    getGenomeNexusHgvsgUrl,
} from '../../../shared/api/urls';
import PubMedCache from 'shared/cache/PubMedCache';
import GenomeNexusCache from 'shared/cache/GenomeNexusCache';
import GenomeNexusMutationAssessorCache from 'shared/cache/GenomeNexusMutationAssessorCache';
import {
    GenomeNexusAPI,
    GenomeNexusAPIInternal,
    VariantAnnotation,
} from 'genome-nexus-ts-api-client';
import {
    ONCOKB_DEFAULT_INFO,
    USE_DEFAULT_PUBLIC_INSTANCE_FOR_ONCOKB,
} from 'react-mutation-mapper';
import { ClinicalInformationData } from 'shared/model/ClinicalInformation';
import VariantCountCache from 'shared/cache/VariantCountCache';
import CopyNumberCountCache from './CopyNumberCountCache';
import CancerTypeCache from 'shared/cache/CancerTypeCache';
import MutationCountCache from 'shared/cache/MutationCountCache';
import {
    concatMutationData,
    evaluateDiscreteCNAPutativeDriverInfo,
    evaluateMutationPutativeDriverInfo,
    existsSomeMutationWithAscnPropertyInCollection,
    fetchClinicalData,
    fetchClinicalDataForPatient,
    fetchCnaOncoKbData,
    fetchCnaOncoKbDataForOncoprint,
    fetchCopyNumberData,
    fetchCopyNumberSegments,
    fetchCosmicData,
    fetchDiscreteCNAData,
    fetchGisticData,
    fetchMutationData,
    fetchMutSigData,
    fetchOncoKbCancerGenes,
    fetchOncoKbData,
    fetchOncoKbDataForOncoprint,
    fetchOncoKbInfo,
    fetchReferenceGenomeGenes,
    fetchSamplesForPatient,
    fetchStudiesForSamplesWithoutCancerTypeClinicalData,
    fetchVariantAnnotationsIndexedByGenomicLocation,
    filterAndAnnotateMolecularData,
    filterAndAnnotateMutations,
    findDiscreteMolecularProfile,
    findMolecularProfileIdDiscrete,
    findMrnaRankMolecularProfileId,
    findMutationMolecularProfile,
    findSamplesWithoutCancerTypeClinicalData,
    findUncalledMutationMolecularProfileId,
    generateUniqueSampleKeyToTumorTypeMap,
    getGenomeNexusUrl,
    getOtherBiomarkersQueryId,
    getSampleClinicalDataMapByKeywords,
    getSampleClinicalDataMapByThreshold,
    getSampleTumorTypeMap,
    groupBySampleId,
    makeGetOncoKbCnaAnnotationForOncoprint,
    makeGetOncoKbMutationAnnotationForOncoprint,
    makeIsHotspotForOncoprint,
    makeStudyToCancerTypeMap,
    mapSampleIdToClinicalData,
    mergeDiscreteCNAData,
    mergeMutations,
    mergeMutationsIncludingUncalled,
    ONCOKB_DEFAULT,
    generateStructuralVariantId,
    fetchStructuralVariantOncoKbData,
    parseOtherBiomarkerQueryId,
    tumorTypeResolver,
} from 'shared/lib/StoreUtils';
import {
    computeGenePanelInformation,
    CoverageInformation,
} from 'shared/lib/GenePanelUtils';
import {
    fetchCivicGenes,
    fetchCivicVariants,
    fetchCnaCivicGenes,
} from 'shared/lib/CivicUtils';
import { fetchHotspotsData } from 'shared/lib/CancerHotspotsUtils';
import {
    AnnotateMutationByProteinChangeQuery,
    CancerGene,
    IndicatorQueryResp,
} from 'oncokb-ts-api-client';
import { MutationTableDownloadDataFetcher } from 'shared/lib/MutationTableDownloadDataFetcher';
import { getNavCaseIdsCache } from 'shared/lib/handleLongUrls';
import {
    fetchTrialMatchesUsingPOST,
    fetchTrialsById,
} from '../../../shared/api/MatchMinerAPI';
import {
    IDetailedTrialMatch,
    ITrial,
    ITrialMatch,
    ITrialQuery,
} from '../../../shared/model/MatchMiner';
import { groupTrialMatchesById } from '../trialMatch/TrialMatchTableUtils';
import { GeneFilterOption } from '../mutation/GeneFilterMenu';
import TumorColumnFormatter from '../mutation/column/TumorColumnFormatter';
import { getVariantAlleleFrequency } from 'shared/lib/MutationUtils';
import { AppStore, SiteError } from 'AppStore';
import { getGeneFilterDefault } from './PatientViewPageStoreUtil';
import { checkNonProfiledGenesExist } from '../PatientViewPageUtils';
import autobind from 'autobind-decorator';
import { createVariantAnnotationsByMutationFetcher } from 'shared/components/mutationMapper/MutationMapperUtils';
import SampleManager from '../SampleManager';
import { getFilteredMolecularProfilesByAlterationType } from 'pages/studyView/StudyViewUtils';
import {
    getMyCancerGenomeData,
    getMyVariantInfoAnnotationsFromIndexedVariantAnnotations,
    ICivicGeneIndex,
    ICivicVariantIndex,
    IHotspotIndex,
    IMyCancerGenomeData,
    IMyVariantInfoIndex,
    indexHotspotsData,
    IOncoKbData,
} from 'cbioportal-utils';
import { makeGeneticTrackData } from 'shared/components/oncoprint/DataUtils';
import { GeneticTrackDatum } from 'shared/components/oncoprint/Oncoprint';
import {
    AlterationTypeConstants,
    AnnotatedExtendedAlteration,
    DataTypeConstants,
    CustomDriverNumericGeneMolecularData,
} from 'pages/resultsView/ResultsViewPageStore';
import {
    cna_profile_data_to_string,
    getMutationSubType,
    getSimplifiedMutationType,
} from 'shared/lib/oql/AccessorsForOqlFilter';
import {
    CLINICAL_ATTRIBUTE_ID_ENUM,
    MIS_TYPE_VALUE,
    GENOME_NEXUS_ARG_FIELD_ENUM,
    MSI_H_THRESHOLD,
    TMB_H_THRESHOLD,
} from 'shared/constants';
import {
    OTHER_BIOMARKER_HUGO_SYMBOL,
    OtherBiomarkersQueryType,
    OTHER_BIOMARKER_NAME,
} from 'react-mutation-mapper';
import {
    IMutationalSignature,
    IMutationalSignatureMeta,
} from 'shared/model/MutationalSignature';
import { GenericAssayTypeConstants } from 'shared/lib/GenericAssayUtils/GenericAssayCommonUtils';
import {
    MutationalSignaturesVersion,
    MutationalSignatureStableIdKeyWord,
    validateMutationalSignatureRawData,
} from 'shared/lib/GenericAssayUtils/MutationalSignaturesUtils';
import { getServerConfig } from 'config/config';
import { getOncoKbIconStyle } from 'shared/lib/AnnotationColumnUtils';

import {
    IMtb,
    IDeletions,
    ITherapyRecommendation,
    IClinicalTrial,
} from '../../../shared/model/TherapyRecommendation';
import {
    StudyListEntry,
    StudyList,
} from '../clinicalTrialMatch/utils/StudyList';
import {
    Study,
    ClinicalTrialsGovStudies,
    Location,
    LocationList,
    Intervention,
    InterventionList,
    EligibilityModule,
} from 'shared/api/ClinicalTrialsGovStudyStrucutre';
import { IDetailedClinicalTrialMatch } from '../clinicalTrialMatch/ClinicalTrialMatchTable';
import {
    searchStudiesForKeywordAsString,
    getStudiesByCondtionsFromOncoKB,
    IOncoKBStudyDictionary,
    getAllStudyNctIdsByOncoTreeCode,
    getAllStudyNctIdsByOncoTreeCodes,
    getStudiesNCTIds,
} from 'shared/api/ClinicalTrialMatchAPI';
import {
    fetchMtbsUsingGET,
    updateMtbUsingPUT,
    deleteMtbUsingDELETE,
    checkPermissionUsingGET,
    fetchOtherMtbsUsingPOST,
} from 'shared/api/TherapyRecommendationAPI';
import { RecruitingStatus } from 'shared/enums/ClinicalTrialsGovRecruitingStatus';
import { ageAsNumber } from '../clinicalTrialMatch/utils/AgeSexConverter';
import { City } from '../clinicalTrialMatch/ClinicalTrialMatchSelectUtil';

type PageMode = 'patient' | 'sample';
type ResourceId = string;

export async function checkForTissueImage(patientId: string): Promise<boolean> {
    if (/TCGA/.test(patientId) === false) {
        return false;
    } else {
        let resp = await request.get(getDigitalSlideArchiveMetaUrl(patientId));

        // if the count is greater than 0, there is a slide for this patient
        return resp.body && resp.body.total_count && resp.body.total_count > 0;
    }
}

export type PathologyReportPDF = {
    name: string;
    url: string;
};

export function parseCohortIds(concatenatedIds: string) {
    return concatenatedIds.split(',').map((entityId: string) => {
        return entityId.includes(':')
            ? entityId
            : this.studyId + ':' + entityId;
    });
}

export function buildCohortIdsFromNavCaseIds(
    navCaseIds: { patientId: string; studyId: string }[]
) {
    return _.map(navCaseIds, navCaseId => {
        return navCaseId.studyId + ':' + navCaseId.patientId;
    });
}

export function handlePathologyReportCheckResponse(
    patientId: string,
    resp: any
): PathologyReportPDF[] {
    if (resp.total_count > 0) {
        // only use pdfs starting with the patient id to prevent mismatches
        const r = new RegExp('^' + patientId);
        const filteredItems: any = _.filter(resp.items, (item: any) =>
            r.test(item.name)
        );
        return _.map(filteredItems, (item: any) => ({
            url: item.url,
            name: item.name,
        }));
    } else {
        return [];
    }
}

export function filterMutationsByProfiledGene(
    mutationRows: Mutation[][],
    sampleIds: string[],
    sampleToGenePanelId: { [sampleId: string]: string },
    genePanelIdToEntrezGeneIds: { [sampleId: string]: number[] }
): Mutation[][] {
    return _.filter(mutationRows, (mutations: Mutation[]) => {
        const entrezGeneId = mutations[0].gene.entrezGeneId;
        const geneProfiledInSamples = TumorColumnFormatter.getProfiledSamplesForGene(
            entrezGeneId,
            sampleIds,
            sampleToGenePanelId,
            genePanelIdToEntrezGeneIds
        );
        return (
            _(geneProfiledInSamples)
                .values()
                .filter((profiled: boolean) => profiled)
                .value().length === sampleIds.length
        );
    });
}

/*
 * Transform clinical data from API to clinical data shape as it will be stored
 * in the store
 */
function transformClinicalInformationToStoreShape(
    patientId: string,
    studyId: string,
    sampleIds: Array<string>,
    clinicalDataPatient: Array<ClinicalData>,
    clinicalDataSample: Array<ClinicalData>
): ClinicalInformationData {
    const patient = {
        id: patientId,
        clinicalData: clinicalDataPatient,
    };
    const samples = groupBySampleId(sampleIds, clinicalDataSample);
    const rv = {
        patient,
        samples,
    };

    return rv;
}

class ClinicalTrialsSearchParams {
    clinicalTrialsCountires: string[] = [];
    clinicalTrialsRecruitingStatus: RecruitingStatus[] = [];
    symbolsToSearch: string[] = [];
    necSymbolsToSearch: string[] = [];
    entitiesToSearch: string[] = [];
    gender: string;
    patientLocation: City;
    age: number;
    filterDistance: boolean;
    maximumDistance: number;

    constructor(
        clinicalTrialsCountires: string[],
        clinicalTrialsRecruitingStatus: RecruitingStatus[],
        symbolsToSearch: string[] = [],
        necSymbolsToSearch: string[] = [],
        entitiesToSearch: string[] = [],
        gender: string,
        patientLocation: City,
        age: number,
        filterDistance: boolean,
        maximumDistance: number
    ) {
        this.clinicalTrialsRecruitingStatus = clinicalTrialsRecruitingStatus;
        this.clinicalTrialsCountires = clinicalTrialsCountires;
        this.symbolsToSearch = symbolsToSearch;
        this.necSymbolsToSearch = necSymbolsToSearch;
        this.entitiesToSearch = entitiesToSearch;
        this.gender = gender;
        this.patientLocation = patientLocation;
        this.age = age;
        this.filterDistance = filterDistance;
        this.maximumDistance = maximumDistance;
    }
}

export class PatientViewPageStore {
    constructor(private appStore: AppStore) {
        makeObservable(this);
        //labelMobxPromises(this);
        this.internalClient = internalClient;
    }

    public internalClient: CBioPortalAPIInternal;

    @observable
    public isClinicalTrialsLoading: boolean = false;
    public showLoadingScreen: boolean = false;
    public isTrialResultsZero: boolean = true;

    @observable
    public clinicalTrialSerchParams: ClinicalTrialsSearchParams = new ClinicalTrialsSearchParams(
        [],
        [],
        [],
        [],
        [],
        '',
        { city: '', lat: 0, lng: 0, country: '', admin_name: '' },
        0,
        false,
        0
    );

    @observable public activeTabId = '';

    @observable private _patientId = '';
    @computed get patientId(): string {
        if (this._patientId) return this._patientId;

        return this.derivedPatientId.result;
    }

    @observable public urlValidationError: string | null = null;

    @observable ajaxErrors: Error[] = [];

    @observable studyId = '';

    @observable _sampleId = '';

    private openResourceTabMap = observable.map<ResourceId, boolean>();
    @autobind
    public isResourceTabOpen(resourceId: string) {
        return !!this.openResourceTabMap.get(resourceId);
    }
    @action.bound
    public setResourceTabOpen(resourceId: string, open: boolean) {
        this.openResourceTabMap.set(resourceId, open);
    }

    @action.bound
    public onFilterGenesStructuralVariantTable(option: GeneFilterOption): void {
        this.structuralVariantTableGeneFilterOption = option;
    }

    @observable
    public mutationTableGeneFilterOption: GeneFilterOption = getGeneFilterDefault(
        { serverConfig: getServerConfig() }
    );
    @observable
    public copyNumberTableGeneFilterOption: GeneFilterOption = getGeneFilterDefault(
        { serverConfig: getServerConfig() }
    );
    @observable
    public structuralVariantTableGeneFilterOption: GeneFilterOption = getGeneFilterDefault(
        { serverConfig: getServerConfig() }
    );

    @computed get sampleId() {
        return this._sampleId;
    }

    @computed get pageTitle(): string {
        if (this.pageMode === 'patient') {
            return `Patient: ${this.patientId}`;
        } else {
            return `Sample: ${this.sampleId}`;
        }
    }

    @computed get metaDescription(): string {
        const id = this.pageMode === 'patient' ? this.patientId : this.sampleId;
        return `${id} from ${this.studyMetaData.result!.name}`;
    }

    @computed get pageMode(): PageMode {
        return this._sampleId ? 'sample' : 'patient';
    }

    @computed get caseId(): string {
        return this.pageMode === 'sample' ? this.sampleId : this.patientId;
    }

    readonly mutationMolecularProfile = remoteData({
        await: () => [this.molecularProfilesInStudy],
        invoke: async () =>
            findMutationMolecularProfile(
                this.molecularProfilesInStudy,
                this.studyId,
                AlterationTypeConstants.MUTATION_EXTENDED
            ),
    });

    readonly discreteMolecularProfile = remoteData({
        await: () => [this.molecularProfilesInStudy],
        invoke: async () =>
            findDiscreteMolecularProfile(this.molecularProfilesInStudy),
    });

    readonly mutationMolecularProfileId = remoteData({
        await: () => [this.mutationMolecularProfile],
        invoke: async () => {
            if (this.mutationMolecularProfile.result) {
                return this.mutationMolecularProfile.result.molecularProfileId;
            } else {
                return undefined;
            }
        },
    });

    readonly structuralVariantProfile = remoteData({
        await: () => [this.studyIdToMolecularProfiles],
        invoke: async () => {
            const structuralVariantProfiles = getFilteredMolecularProfilesByAlterationType(
                this.studyIdToMolecularProfiles.result,
                AlterationTypeConstants.STRUCTURAL_VARIANT,
                [DataTypeConstants.FUSION, DataTypeConstants.SV]
            );
            if (structuralVariantProfiles.length > 0) {
                return structuralVariantProfiles[0];
            }
            return undefined;
        },
    });

    readonly uncalledMutationMolecularProfileId = remoteData({
        await: () => [this.molecularProfilesInStudy],
        invoke: async () =>
            findUncalledMutationMolecularProfileId(
                this.molecularProfilesInStudy,
                this.studyId
            ),
    });

    // this is a string of concatenated ids
    @observable
    private _patientIdsInCohort: string[] = [];

    public set patientIdsInCohort(cohortIds: string[]) {
        // cannot put action on setter
        runInAction(() => (this._patientIdsInCohort = cohortIds));
    }

    @computed
    public get patientIdsInCohort(): string[] {
        let concatenatedIds: string;
        // check to see if we copied from url hash on app load
        const memoryCachedIds = getNavCaseIdsCache();
        return memoryCachedIds ? memoryCachedIds : this._patientIdsInCohort;
    }

    readonly myCancerGenomeData: IMyCancerGenomeData = getMyCancerGenomeData();

    // get mutational signature molecular profile Ids (contribution and confidence)
    readonly mutationalSignatureMolecularProfiles = remoteData<
        MolecularProfile[]
    >(
        {
            await: () => [this.molecularProfilesInStudy],
            invoke: () => {
                return Promise.resolve(
                    this.molecularProfilesInStudy.result.filter(
                        (profile: MolecularProfile) => {
                            if (profile.genericAssayType) {
                                return (
                                    profile.genericAssayType ===
                                    GenericAssayTypeConstants.MUTATIONAL_SIGNATURE
                                );
                            }
                            return false;
                        }
                    )
                );
            },
        },
        []
    );

    readonly fetchAllMutationalSignatureData = remoteData(
        {
            await: () => [
                this.samples,
                this.mutationalSignatureMolecularProfiles,
            ],
            invoke: async () => {
                const mutationalSignatureMolecularProfileIds = this.mutationalSignatureMolecularProfiles.result.map(
                    profile => profile.molecularProfileId
                );
                if (mutationalSignatureMolecularProfileIds.length > 0) {
                    const sampleMolecularIdentifiers = _.flatMap(
                        mutationalSignatureMolecularProfileIds,
                        mutationalSignatureMolecularProfileId => {
                            return _.map(this.samples.result, sample => {
                                return {
                                    molecularProfileId: mutationalSignatureMolecularProfileId,
                                    sampleId: sample.sampleId,
                                } as SampleMolecularIdentifier;
                            });
                        }
                    );
                    const genericAssayRawData = await client.fetchGenericAssayDataInMultipleMolecularProfilesUsingPOST(
                        {
                            genericAssayDataMultipleStudyFilter: {
                                sampleMolecularIdentifiers,
                            } as GenericAssayDataMultipleStudyFilter,
                        }
                    );
                    if (
                        validateMutationalSignatureRawData(genericAssayRawData)
                    ) {
                        return Promise.resolve(genericAssayRawData);
                    }
                }
                return Promise.resolve([]);
            },
        },
        []
    );

    readonly mutationalSignatureDataGroupByVersion = remoteData(
        {
            await: () => [
                this.fetchAllMutationalSignatureData,
                this.mutationData,
                this.mutationalSignatureMetaGroupByStableId,
            ],
            invoke: () => {
                const contributionData = this.fetchAllMutationalSignatureData.result.filter(
                    data =>
                        data.molecularProfileId.includes(
                            MutationalSignatureStableIdKeyWord.MutationalSignatureContributionKeyWord
                        )
                );
                const confidenceData = this.fetchAllMutationalSignatureData.result.filter(
                    data =>
                        data.molecularProfileId.includes(
                            MutationalSignatureStableIdKeyWord.MutationalSignatureConfidenceKeyWord
                        )
                );
                // we know mutational signatures data are coming in as a pair (contribution and confidence)
                // we can always find the confidence data based on a key: uniqueSampleKey + id (split by '_', the last word of genericAssayStableId is id)
                const confidenceDataMap = _.keyBy(
                    confidenceData,
                    data =>
                        data.uniqueSampleKey +
                        _.last(data.genericAssayStableId.split('_'))
                );
                const numMutationData = this.mutationData.result.length;

                const result: IMutationalSignature[] = [];
                // only loop the contribution data then find and fill in the paired confidence data
                if (contributionData && contributionData.length > 0) {
                    for (const contribution of contributionData) {
                        let mutationalSignatureTableData: IMutationalSignature = {} as IMutationalSignature;
                        mutationalSignatureTableData.mutationalSignatureId =
                            contribution.genericAssayStableId;
                        mutationalSignatureTableData.patientId =
                            contribution.patientId;
                        mutationalSignatureTableData.sampleId =
                            contribution.sampleId;
                        mutationalSignatureTableData.studyId =
                            contribution.studyId;
                        mutationalSignatureTableData.uniquePatientKey =
                            contribution.uniquePatientKey;
                        mutationalSignatureTableData.uniqueSampleKey =
                            contribution.uniqueSampleKey;
                        mutationalSignatureTableData.value = parseFloat(
                            contribution.value
                        );
                        // fill in confidence data
                        mutationalSignatureTableData.confidence = parseFloat(
                            confidenceDataMap[
                                contribution.uniqueSampleKey +
                                    _.last(
                                        contribution.genericAssayStableId.split(
                                            '_'
                                        )
                                    )
                            ].value
                        );
                        mutationalSignatureTableData.numberOfMutationsForSample = numMutationData;
                        // split by '_' and use the last word of molecularProfileId as version info
                        mutationalSignatureTableData.version = _.last(
                            contribution.molecularProfileId.split('_')
                        )!;
                        mutationalSignatureTableData.meta = this.mutationalSignatureMetaGroupByStableId.result![
                            contribution.genericAssayStableId
                        ];
                        result.push(mutationalSignatureTableData);
                    }
                }
                return Promise.resolve(_.groupBy(result, data => data.version));
            },
        },
        {}
    );

    // only fetch meta for contribution
    // contribution and confidence are sharing the same meta, no need to fetch twice
    readonly fetchAllMutationalSignatureContributionMetaData = remoteData({
        await: () => [this.fetchAllMutationalSignatureData],
        invoke: async () => {
            const mutationalSignatureContributionStableIds = _.chain(
                this.fetchAllMutationalSignatureData.result
            )
                .map((data: GenericAssayData) => data.stableId)
                .uniq()
                .filter(stableId =>
                    stableId.includes(
                        MutationalSignatureStableIdKeyWord.MutationalSignatureContributionKeyWord
                    )
                )
                .value();

            if (mutationalSignatureContributionStableIds.length > 0) {
                return client.fetchGenericAssayMetaDataUsingPOST({
                    genericAssayMetaFilter: {
                        genericAssayStableIds: mutationalSignatureContributionStableIds,
                    } as GenericAssayMetaFilter,
                });
            } else {
                return Promise.resolve([]);
            }
        },
    });

    readonly mutationalSignatureMeta = remoteData<IMutationalSignatureMeta[]>(
        {
            await: () => [this.fetchAllMutationalSignatureContributionMetaData],
            invoke: () => {
                return Promise.resolve(
                    this.fetchAllMutationalSignatureContributionMetaData.result!.map(
                        (metaData: GenericAssayMeta) => {
                            let meta = {} as IMutationalSignatureMeta;
                            const name: string =
                                'NAME' in metaData.genericEntityMetaProperties
                                    ? metaData.genericEntityMetaProperties[
                                          'NAME'
                                      ]
                                    : '';
                            const description: string =
                                'DESCRIPTION' in
                                metaData.genericEntityMetaProperties
                                    ? metaData.genericEntityMetaProperties[
                                          'DESCRIPTION'
                                      ]
                                    : 'No description';
                            const url: string =
                                'URL' in metaData.genericEntityMetaProperties
                                    ? metaData.genericEntityMetaProperties[
                                          'URL'
                                      ]
                                    : 'No url';
                            // TODO: should we add additional property 'CATEGORY' in data file
                            // currently, category can be derived from name
                            // name format: ENTITY_NAME (CATEGORY)
                            // we can get category between '(' and ')'
                            const category: string = name
                                ? name.substring(
                                      name.lastIndexOf('(') + 1,
                                      name.lastIndexOf(')')
                                  )
                                : 'No category';
                            const confidenceStatement: string =
                                'DESCRIPTION' in
                                metaData.genericEntityMetaProperties
                                    ? metaData.genericEntityMetaProperties[
                                          'DESCRIPTION'
                                      ]
                                    : 'No confidence statement';
                            meta.mutationalSignatureId = metaData.stableId;
                            meta.name = name;
                            meta.description = description;
                            meta.url = url;
                            meta.category = category;
                            meta.confidenceStatement = confidenceStatement;
                            return meta;
                        }
                    )
                );
            },
        },
        []
    );

    readonly mutationalSignatureMetaGroupByStableId = remoteData<{
        [stableId: string]: IMutationalSignatureMeta;
    }>({
        await: () => [this.mutationalSignatureMeta],
        invoke: () => {
            return Promise.resolve(
                _.keyBy(
                    this.mutationalSignatureMeta.result,
                    meta => meta.mutationalSignatureId
                )
            );
        },
    });

    readonly hasMutationalSignatureData = remoteData({
        await: () => [this.fetchAllMutationalSignatureData],
        invoke: async () => {
            return Promise.resolve(
                this.fetchAllMutationalSignatureData.result &&
                    this.fetchAllMutationalSignatureData.result.length > 0
            );
        },
    });

    // set version 2 of the mutational signature as default
    @observable _selectedMutationalSignatureVersion: string =
        MutationalSignaturesVersion.V2;
    @computed get selectedMutationalSignatureVersion() {
        return this._selectedMutationalSignatureVersion;
    }
    @action
    setMutationalSignaturesVersion(version: string) {
        this._selectedMutationalSignatureVersion = version;
    }

    readonly derivedPatientId = remoteData<string>({
        await: () => [this.samples],
        invoke: async () => {
            for (let sample of this.samples.result) return sample.patientId;
            return '';
        },
        default: '',
    });

    readonly clinicalDataPatient = remoteData({
        await: () =>
            this.pageMode === 'patient' ? [] : [this.derivedPatientId],
        invoke: async () =>
            fetchClinicalDataForPatient(this.studyId, this.patientId),
        default: [],
    });

    readonly samples = remoteData(
        {
            invoke: () =>
                fetchSamplesForPatient(
                    this.studyId,
                    this._patientId,
                    this.sampleId
                ),
            onError: (err: Error) => {
                this.appStore.siteErrors.push({
                    errorObj: err,
                    dismissed: false,
                    title: 'Samples / Patients not valid',
                } as SiteError);
            },
        },
        []
    );

    // use this when pageMode === 'sample' to get total nr of samples for the
    // patient
    readonly allSamplesForPatient = remoteData({
        await: () => [this.derivedPatientId],
        invoke: async () => {
            return await client.getAllSamplesOfPatientInStudyUsingGET({
                studyId: this.studyId,
                patientId: this.derivedPatientId.result,
                projection: 'DETAILED',
            });
        },
        default: [],
    });

    // NOTE: this.samples do not contain unique keys if it is populated by the getSampleInStudyUsingGET method.
    // To make sure that samples always have unique keys we get them from this.allSamplesForPatient.
    readonly samplesWithUniqueKeys = remoteData(
        {
            await: () => [this.samples, this.allSamplesForPatient],
            invoke: () =>
                Promise.resolve(
                    this.samples.result.map(
                        sample =>
                            this.allSamplesForPatient.result.find(
                                s => s.sampleId === sample.sampleId
                            ) || sample
                    )
                ),
        },
        []
    );

    readonly samplesWithoutCancerTypeClinicalData = remoteData(
        {
            await: () => [this.samples, this.clinicalDataForSamples],
            invoke: async () =>
                findSamplesWithoutCancerTypeClinicalData(
                    this.samples,
                    this.clinicalDataForSamples
                ),
        },
        []
    );

    readonly studiesForSamplesWithoutCancerTypeClinicalData = remoteData(
        {
            await: () => [this.samplesWithoutCancerTypeClinicalData],
            invoke: async () =>
                fetchStudiesForSamplesWithoutCancerTypeClinicalData(
                    this.samplesWithoutCancerTypeClinicalData
                ),
        },
        []
    );

    readonly studies = remoteData(
        {
            invoke: async () => [
                await client.getStudyUsingGET({ studyId: this.studyId }),
            ],
        },
        []
    );

    readonly studyIdToStudy = remoteData(
        {
            await: () => [this.studies],
            invoke: () =>
                Promise.resolve(_.keyBy(this.studies.result, x => x.studyId)),
        },
        {}
    );

    @computed get studyToCancerType() {
        return makeStudyToCancerTypeMap(this.studies.result);
    }

    readonly cnaSegments = remoteData(
        {
            await: () => [this.samples],
            invoke: () => fetchCopyNumberSegments(this.studyId, this.sampleIds),
        },
        []
    );

    readonly resourceDefinitions = remoteData({
        invoke: () =>
            internalClient.getAllResourceDefinitionsInStudyUsingGET({
                studyId: this.studyId,
            }),
        onResult: defs => {
            // open resources which have `openByDefault` set to true
            if (defs) {
                for (const def of defs)
                    if (def.openByDefault)
                        this.setResourceTabOpen(def.resourceId, true);
            }
        },
    });

    readonly studyResourceData = remoteData<ResourceData[]>({
        await: () => [this.resourceDefinitions],
        invoke: () => {
            const ret: ResourceData[] = [];
            const studyResourceDefinitions = this.resourceDefinitions.result!.filter(
                d => d.resourceType === 'STUDY'
            );
            const promises = [];
            for (const resource of studyResourceDefinitions) {
                promises.push(
                    internalClient
                        .getAllStudyResourceDataInStudyUsingGET({
                            studyId: this.studyId,
                            resourceId: resource.resourceId,
                            projection: 'DETAILED',
                        })
                        .then(data => ret.push(...data))
                );
            }
            return Promise.all(promises).then(() => ret);
        },
    });

    readonly sampleResourceData = remoteData<{
        [sampleId: string]: ResourceData[];
    }>({
        await: () => [this.resourceDefinitions, this.samples],
        invoke: () => {
            const sampleResourceDefinitions = this.resourceDefinitions.result!.filter(
                d => d.resourceType === 'SAMPLE'
            );
            if (!sampleResourceDefinitions.length) {
                return Promise.resolve({});
            }

            const samples = this.samples.result!;
            const ret: { [sampleId: string]: ResourceData[] } = {};
            const promises = [];
            for (const sample of samples) {
                for (const resource of sampleResourceDefinitions) {
                    promises.push(
                        internalClient
                            .getAllResourceDataOfSampleInStudyUsingGET({
                                sampleId: sample.sampleId,
                                studyId: this.studyId,
                                resourceId: resource.resourceId,
                                projection: 'DETAILED',
                            })
                            .then(data => {
                                ret[sample.sampleId] =
                                    ret[sample.sampleId] || [];
                                ret[sample.sampleId].push(...data);
                            })
                    );
                }
            }
            return Promise.all(promises).then(() => ret);
        },
    });

    readonly patientResourceData = remoteData<ResourceData[]>({
        await: () => [this.resourceDefinitions],
        invoke: () => {
            const ret: ResourceData[] = [];
            const patientResourceDefinitions = this.resourceDefinitions.result!.filter(
                d => d.resourceType === 'PATIENT'
            );
            const promises = [];
            for (const resource of patientResourceDefinitions) {
                promises.push(
                    internalClient
                        .getAllResourceDataOfPatientInStudyUsingGET({
                            studyId: this.studyId,
                            patientId: this.patientId,
                            resourceId: resource.resourceId,
                            projection: 'DETAILED',
                        })
                        .then(data => ret.push(...data))
                );
            }
            return Promise.all(promises).then(() => ret);
        },
    });

    readonly resourceIdToResourceData = remoteData<{
        [resourceId: string]: ResourceData[];
    }>({
        await: () => [
            this.sampleResourceData,
            this.patientResourceData,
            this.studyResourceData,
        ],
        invoke: () => {
            const allData: ResourceData[] = _.flatMap(
                this.sampleResourceData.result!,
                v => v
            )
                .concat(this.patientResourceData.result!)
                .concat(this.studyResourceData.result!);
            return Promise.resolve(_.groupBy(allData, d => d.resourceId));
        },
    });

    readonly pathologyReport = remoteData(
        {
            await: () => [this.derivedPatientId],
            invoke: () => {
                // only check path report for tcga studies
                if (this.studyId.toLowerCase().indexOf('tcga') > -1) {
                    const pathLinkUrl =
                        'https://raw.githubusercontent.com/inodb/datahub/a0d36d77b242e32cda3175127de73805b028f595/tcga/pathology_reports/symlink_by_patient';
                    const rawPdfUrl =
                        'https://github.com/inodb/datahub/raw/a0d36d77b242e32cda3175127de73805b028f595/tcga/pathology_reports';
                    const reports: PathologyReportPDF[] = [];

                    // keep checking if patient has more reports recursively
                    function getPathologyReport(
                        patientId: string,
                        i: number
                    ): any {
                        return request
                            .get(`${pathLinkUrl}/${patientId}.${i}`)
                            .then(
                                function(resp) {
                                    // add report
                                    let pdfName: string = resp.text.split(
                                        '/'
                                    )[1];
                                    reports.push({
                                        name: `${pdfName}`,
                                        url: `${rawPdfUrl}/${pdfName}`,
                                    });
                                    // check if patient has more reports
                                    return getPathologyReport(patientId, i + 1);
                                },
                                () => reports
                            );
                    }

                    return getPathologyReport(this.patientId, 0);
                } else {
                    return Promise.resolve([]);
                }
            },
            onError: (err: Error) => {
                // fail silently
            },
        },
        []
    );

    readonly cosmicData = remoteData({
        await: () => [this.mutationData, this.uncalledMutationData],
        invoke: () =>
            fetchCosmicData(this.mutationData, this.uncalledMutationData),
    });

    readonly mutSigData = remoteData({
        invoke: async () => fetchMutSigData(this.studyId),
    });

    // Mutation annotation
    // genome nexus
    readonly indexedVariantAnnotations = remoteData<
        { [genomicLocation: string]: VariantAnnotation } | undefined
    >(
        {
            await: () => [this.mutationData, this.uncalledMutationData],
            invoke: async () =>
                await fetchVariantAnnotationsIndexedByGenomicLocation(
                    concatMutationData(
                        this.mutationData,
                        this.uncalledMutationData
                    ),
                    [
                        GENOME_NEXUS_ARG_FIELD_ENUM.ANNOTATION_SUMMARY,
                        GENOME_NEXUS_ARG_FIELD_ENUM.HOTSPOTS,
                        GENOME_NEXUS_ARG_FIELD_ENUM.CLINVAR,
                        getServerConfig().show_signal
                            ? GENOME_NEXUS_ARG_FIELD_ENUM.SIGNAL
                            : '',
                    ].filter(f => f),
                    getServerConfig().isoformOverrideSource,
                    this.genomeNexusClient
                ),
            onError: (err: Error) => {
                // fail silently, leave the error handling responsibility to the data consumer
            },
        },
        undefined
    );

    readonly indexedMyVariantInfoAnnotations = remoteData<
        IMyVariantInfoIndex | undefined
    >({
        await: () => [this.mutationData, this.uncalledMutationData],
        invoke: async () => {
            const indexedVariantAnnotations = await fetchVariantAnnotationsIndexedByGenomicLocation(
                concatMutationData(
                    this.mutationData,
                    this.uncalledMutationData
                ),
                [GENOME_NEXUS_ARG_FIELD_ENUM.MY_VARIANT_INFO],
                getServerConfig().isoformOverrideSource,
                this.genomeNexusClient
            );
            return getMyVariantInfoAnnotationsFromIndexedVariantAnnotations(
                indexedVariantAnnotations
            );
        },
        onError: () => {
            // fail silently, leave the error handling responsibility to the data consumer
        },
    });

    readonly hotspotData = remoteData({
        await: () => [this.mutationData, this.uncalledMutationData],
        invoke: async () => {
            return fetchHotspotsData(
                this.mutationData,
                this.uncalledMutationData,
                this.genomeNexusInternalClient
            );
        },
        onError: () => {
            // fail silently
        },
    });

    readonly clinicalDataForAllSamplesForPatient = remoteData({
        await: () => [this.allSamplesForPatient],
        invoke: () => {
            const identifiers = this.allSamplesForPatient.result.map(
                sample => ({
                    entityId: sample.sampleId,
                    studyId: this.studyId,
                })
            );
            const clinicalDataMultiStudyFilter = {
                identifiers,
            } as ClinicalDataMultiStudyFilter;
            return fetchClinicalData(clinicalDataMultiStudyFilter);
        },
    });

    readonly clinicalDataForSamples = remoteData(
        {
            await: () => [this.samples],
            invoke: () => {
                const identifiers = this.sampleIds.map((sampleId: string) => ({
                    entityId: sampleId,
                    studyId: this.studyId,
                }));
                const clinicalDataMultiStudyFilter = {
                    identifiers,
                } as ClinicalDataMultiStudyFilter;
                return fetchClinicalData(clinicalDataMultiStudyFilter);
            },
        },
        []
    );

    readonly clinicalDataGroupedBySample = remoteData(
        {
            await: () => [this.clinicalDataForSamples],
            invoke: async () =>
                groupBySampleId(
                    this.sampleIds,
                    this.clinicalDataForSamples.result
                ),
        },
        []
    );

    readonly clinicalDataGroupedBySampleMap = remoteData(
        {
            await: () => [this.clinicalDataGroupedBySample],
            invoke: async () => {
                return mapSampleIdToClinicalData(
                    this.clinicalDataGroupedBySample.result
                );
            },
        },
        {}
    );

    readonly getWholeSlideViewerIds = remoteData({
        await: () => [this.clinicalDataGroupedBySample],
        invoke: () => {
            const clinicalData = this.clinicalDataGroupedBySample.result!;
            const clinicalAttributeId = 'MSK_SLIDE_ID';
            if (clinicalData) {
                const ids = _.chain(clinicalData)
                    .map(data => data.clinicalData)
                    .flatten()
                    .filter(attribute => {
                        return (
                            attribute.clinicalAttributeId ===
                            clinicalAttributeId
                        );
                    })
                    .map(attribute => attribute.value)
                    .value();

                return Promise.resolve(ids);
            }
            return Promise.resolve([]);
        },
    });

    readonly studyMetaData = remoteData({
        invoke: async () => client.getStudyUsingGET({ studyId: this.studyId }),
    });

    public sampleManager = remoteData<SampleManager>({
        await: () => [
            this.patientViewDataForAllSamplesForPatient,
            this.studyMetaData,
            this.clinicalEvents,
        ],
        invoke: async () => {
            const patientData = this.patientViewDataForAllSamplesForPatient
                .result!;

            if (this.clinicalEvents.result.length > 0) {
                return new SampleManager(
                    patientData.samples!,
                    this.sampleIds,
                    this.clinicalEvents.result
                );
            } else {
                return new SampleManager(
                    patientData.samples!,
                    this.sampleIds,
                    undefined
                );
            }
        },
    });

    readonly patientViewData = remoteData<ClinicalInformationData>(
        {
            await: () => [
                this.clinicalDataPatient,
                this.clinicalDataForSamples,
            ],
            invoke: async () =>
                transformClinicalInformationToStoreShape(
                    this.patientId,
                    this.studyId,
                    this.sampleIds,
                    this.clinicalDataPatient.result,
                    this.clinicalDataForSamples.result
                ),
        },
        {}
    );

    readonly patientViewDataForAllSamplesForPatient = remoteData<
        ClinicalInformationData
    >({
        await: () => [
            this.clinicalDataPatient,
            this.allSamplesForPatient,
            this.clinicalDataForAllSamplesForPatient,
        ],
        invoke: async () =>
            transformClinicalInformationToStoreShape(
                this.patientId,
                this.studyId,
                this.allSamplesForPatient.result!.map(s => s.sampleId),
                this.clinicalDataPatient.result,
                this.clinicalDataForAllSamplesForPatient.result!
            ),
    });

    readonly sequencedSampleIdsInStudy = remoteData(
        {
            invoke: async () => {
                return stringListToSet(
                    await client.getAllSampleIdsInSampleListUsingGET({
                        sampleListId: `${this.studyId}_sequenced`,
                    })
                );
            },
            onError: (err: Error) => {
                // fail silently, leave the error handling responsibility to the data consumer
            },
        },
        {}
    );

    readonly molecularProfilesInStudy = remoteData(() => {
        return client.getAllMolecularProfilesInStudyUsingGET({
            studyId: this.studyId,
        });
    }, []);

    readonly studyIdToMolecularProfiles = remoteData({
        await: () => [this.molecularProfilesInStudy],
        invoke: () => {
            return Promise.resolve(
                _.groupBy(
                    this.molecularProfilesInStudy.result!,
                    molecularProfile => molecularProfile.studyId
                )
            );
        },
        onError: error => {},
        default: {},
    });

    readonly molecularProfileIdToMolecularProfile = remoteData<{
        [molecularProfileId: string]: MolecularProfile;
    }>(
        {
            await: () => [this.molecularProfilesInStudy],
            invoke: () => {
                return Promise.resolve(
                    this.molecularProfilesInStudy.result.reduce(
                        (
                            map: {
                                [molecularProfileId: string]: MolecularProfile;
                            },
                            next: MolecularProfile
                        ) => {
                            map[next.molecularProfileId] = next;
                            return map;
                        },
                        {}
                    )
                );
            },
        },
        {}
    );

    readonly referenceGenes = remoteData<ReferenceGenomeGene[]>({
        await: () => [this.studies, this.discreteCNAData],
        invoke: async () => {
            return fetchReferenceGenomeGenes(
                this.studies.result[0].referenceGenome,
                this.discreteCNAData.result.map((d: DiscreteCopyNumberData) =>
                    d.gene.hugoGeneSymbol.toUpperCase()
                )
            );
        },
        onError: err => {
            // throwing this allows sentry to report it
            throw err;
        },
    });

    public readonly mrnaRankMolecularProfileId = remoteData(
        {
            await: () => [this.molecularProfilesInStudy],
            invoke: async () =>
                findMrnaRankMolecularProfileId(
                    this.molecularProfilesInStudy.result!.map(
                        p => p.molecularProfileId
                    )
                ),
        },
        null
    );

    readonly discreteCNAData = remoteData<DiscreteCopyNumberData[]>(
        {
            await: () => [this.molecularProfileIdDiscrete, this.samples],
            invoke: async () => {
                const filter = {
                    sampleIds: this.sampleIds,
                } as DiscreteCopyNumberFilter;
                return fetchDiscreteCNAData(
                    filter,
                    this.molecularProfileIdDiscrete
                );
            },
            onResult: (result: DiscreteCopyNumberData[]) => {
                // We want to take advantage of this loaded data, and not redownload the same data
                //  for users of the cache
                this.discreteCNACache.addData(result);
            },
        },
        []
    );

    readonly molecularData = remoteData<NumericGeneMolecularData[]>(
        {
            await: () => [this.discreteCNAData],
            invoke: () =>
                Promise.resolve(
                    this.discreteCNAData.result!.map(d => ({
                        ...d,
                        value: d.alteration,
                    }))
                ),
        },
        []
    );

    @computed get mergedDiscreteCNAData(): DiscreteCopyNumberData[][] {
        return mergeDiscreteCNAData(this.discreteCNAData);
    }

    readonly gisticData = remoteData<IGisticData>(
        {
            invoke: async () => fetchGisticData(this.studyId),
        },
        {}
    );

    readonly clinicalEvents = remoteData(
        {
            await: () => [this.patientViewData],
            invoke: async () => {
                const events = await internalClient.getAllClinicalEventsOfPatientInStudyUsingGET(
                    {
                        studyId: this.studyId,
                        patientId: this.patientId,
                        projection: 'DETAILED',
                    }
                );

                return _.sortBy(events, e => e.startNumberOfDaysSinceDiagnosis);
            },
        },
        []
    );

    readonly molecularProfileIdDiscrete = remoteData({
        await: () => [this.molecularProfilesInStudy],
        invoke: async () => {
            return findMolecularProfileIdDiscrete(
                this.molecularProfilesInStudy
            );
        },
    });

    readonly studyToMolecularProfileDiscrete = remoteData(
        {
            await: () => [this.molecularProfileIdDiscrete],
            invoke: async () => {
                // we just need it in this form for input to DiscreteCNACache
                const ret: { [studyId: string]: MolecularProfile } = {};
                if (this.molecularProfileIdDiscrete.result) {
                    ret[
                        this.studyId
                    ] = await client.getMolecularProfileUsingGET({
                        molecularProfileId: this.molecularProfileIdDiscrete
                            .result,
                    });
                }
                return ret;
            },
        },
        {}
    );

    readonly darwinUrl = remoteData({
        await: () => [this.derivedPatientId],
        invoke: async () => {
            if (getServerConfig().enable_darwin === true) {
                let resp = await request.get(
                    getDarwinUrl(this.sampleIds, this.patientId)
                );
                return resp.text;
            } else {
                return '';
            }
        },
        onError: () => {
            // fail silently
        },
    });

    readonly hasTissueImageIFrameUrl = remoteData(
        {
            await: () => [this.derivedPatientId],
            invoke: async () => {
                return checkForTissueImage(this.patientId);
            },
            onError: () => {
                // fail silently
            },
        },
        false
    );

    readonly uncalledMutationData = remoteData(
        {
            await: () => [
                this.samples,
                this.uncalledMutationMolecularProfileId,
            ],
            invoke: async () => {
                const mutationFilter = {
                    sampleIds: this.samples.result.map(
                        (sample: Sample) => sample.sampleId
                    ),
                } as MutationFilter;

                return fetchMutationData(
                    mutationFilter,
                    this.uncalledMutationMolecularProfileId.result
                );
            },
        },
        []
    );

    readonly genePanelData = remoteData(
        {
            await: () => [this.samples, this.molecularProfilesInStudy],
            invoke: async () => {
                // gather sample molecular identifiers
                const sampleMolecularIdentifiers: SampleMolecularIdentifier[] = [];
                this.samples.result!.forEach(sample => {
                    const profiles = this.molecularProfilesInStudy.result!;
                    if (profiles) {
                        const sampleId = sample.sampleId;
                        for (const profile of profiles) {
                            sampleMolecularIdentifiers.push({
                                molecularProfileId: profile.molecularProfileId,
                                sampleId,
                            });
                        }
                    }
                });
                // query for gene panel data using sample molecular identifiers
                let genePanelData: GenePanelData[] = [];
                if (sampleMolecularIdentifiers.length) {
                    genePanelData = await client.fetchGenePanelDataInMultipleMolecularProfilesUsingPOST(
                        {
                            genePanelDataMultipleStudyFilter: {
                                sampleMolecularIdentifiers,
                            },
                        } as any
                    );
                }

                return genePanelData;
            },
        },
        []
    );

    readonly genePanels = remoteData(
        {
            await: () => [this.genePanelData],
            invoke: async () => {
                let genePanelData: GenePanelData[] = this.genePanelData.result;

                // query for gene panel metadata
                const genePanelIds = _.uniq(
                    genePanelData
                        .map(gpData => gpData.genePanelId)
                        .filter(id => !!id)
                );
                if (genePanelIds.length) {
                    return client.fetchGenePanelsUsingPOST({
                        genePanelIds,
                        projection: 'DETAILED',
                    });
                }
                return [];
            },
        },
        []
    );

    readonly genePanelIdToPanel = remoteData<{
        [genePanelId: string]: GenePanel;
    }>(
        {
            await: () => [this.genePanels],
            invoke: async () => {
                return _.keyBy(
                    this.genePanels.result,
                    genePanel => genePanel.genePanelId
                );
            },
        },
        {}
    );

    readonly coverageInformation = remoteData<CoverageInformation>(
        {
            await: () => [
                this.mutatedGenes,
                this.samplesWithUniqueKeys,
                this.genePanelData,
                this.genePanels,
            ],
            invoke: async () => {
                // plug all data into computeGenePanelInformation to generate coverageInformation object
                return computeGenePanelInformation(
                    this.genePanelData.result,
                    this.genePanels.result,
                    this.samplesWithUniqueKeys.result!,
                    [
                        {
                            uniquePatientKey: this.samplesWithUniqueKeys
                                .result![0].uniquePatientKey,
                        },
                    ],
                    this.mutatedGenes.result!
                );
            },
        },
        { samples: {}, patients: {} }
    );

    readonly genePanelDataByMolecularProfileIdAndSampleId = remoteData<{
        [profileId: string]: { [sampleId: string]: GenePanelData };
    }>(
        {
            await: () => [this.genePanelData],
            invoke: async () => {
                return _.chain(this.genePanelData.result!)
                    .groupBy(datum => datum.molecularProfileId)
                    .mapValues(data =>
                        _.keyBy(data, genePanelData => genePanelData.sampleId)
                    )
                    .value();
            },
        },
        {}
    );

    readonly mutationData = remoteData<Mutation[]>(
        {
            await: () => [this.samples, this.mutationMolecularProfileId],
            invoke: async () => {
                const mutationFilter = {
                    sampleIds: this.sampleIds,
                } as MutationFilter;

                return fetchMutationData(
                    mutationFilter,
                    this.mutationMolecularProfileId.result
                );
            },
        },
        []
    );

    readonly structuralVariantData = remoteData({
        await: () => [this.samples, this.structuralVariantProfile],
        invoke: async () => {
            if (this.structuralVariantProfile.result) {
                const structuralVariantFilter = {
                    sampleMolecularIdentifiers: this.sampleIds.map(sampleId => {
                        return {
                            molecularProfileId: this.structuralVariantProfile
                                .result!.molecularProfileId,
                            sampleId,
                        };
                    }),
                } as StructuralVariantFilter;

                return client.fetchStructuralVariantsUsingPOST({
                    structuralVariantFilter,
                });
            }
            return [];
        },
        default: [],
    });

    readonly groupedStructuralVariantData = remoteData({
        await: () => [this.structuralVariantData],
        invoke: async () => {
            return _(this.structuralVariantData.result)
                .groupBy(generateStructuralVariantId)
                .values()
                .value();
        },
        default: [],
    });

    readonly mutatedGenes = remoteData({
        await: () => [this.mutationData],
        invoke: () => {
            return Promise.resolve(
                _.uniqBy(this.mutationData.result!, d => d.entrezGeneId).map(
                    m => ({
                        hugoGeneSymbol: m.gene.hugoGeneSymbol,
                        entrezGeneId: m.entrezGeneId,
                    })
                )
            );
        },
    });

    readonly oncoKbCancerGenes = remoteData(
        {
            invoke: () => {
                if (getServerConfig().show_oncokb) {
                    return fetchOncoKbCancerGenes();
                } else {
                    return Promise.resolve([]);
                }
            },
        },
        []
    );

    readonly oncoKbInfo = remoteData(
        {
            invoke: () => {
                if (getServerConfig().show_oncokb) {
                    return fetchOncoKbInfo();
                } else {
                    return Promise.resolve(ONCOKB_DEFAULT_INFO);
                }
            },
        },
        ONCOKB_DEFAULT_INFO
    );

    @computed get usingPublicOncoKbInstance() {
        return this.oncoKbInfo.result
            ? this.oncoKbInfo.result.publicInstance
            : USE_DEFAULT_PUBLIC_INSTANCE_FOR_ONCOKB;
    }

    @computed get mergeOncoKbIcons() {
        return getOncoKbIconStyle().mergeIcons;
    }

    readonly oncoKbAnnotatedGenes = remoteData(
        {
            await: () => [this.oncoKbCancerGenes],
            invoke: () => {
                if (getServerConfig().show_oncokb) {
                    return Promise.resolve(
                        _.reduce(
                            this.oncoKbCancerGenes.result,
                            (
                                map: { [entrezGeneId: number]: boolean },
                                next: CancerGene
                            ) => {
                                if (next.oncokbAnnotated) {
                                    map[next.entrezGeneId] = true;
                                }
                                return map;
                            },
                            {}
                        )
                    );
                } else {
                    return Promise.resolve({});
                }
            },
        },
        {}
    );

    readonly oncoKbData = remoteData<IOncoKbData | Error>(
        {
            await: () => [
                this.oncoKbAnnotatedGenes,
                this.mutationData,
                this.uncalledMutationData,
                this.clinicalDataForSamples,
                this.studiesForSamplesWithoutCancerTypeClinicalData,
                this.studies,
            ],
            invoke: () => {
                if (getServerConfig().show_oncokb) {
                    return fetchOncoKbData(
                        this.uniqueSampleKeyToTumorType,
                        this.oncoKbAnnotatedGenes.result || {},
                        this.mutationData,
                        undefined,
                        this.uncalledMutationData
                    );
                } else {
                    return Promise.resolve({
                        indicatorMap: null,
                        uniqueSampleKeyToTumorType: null,
                    });
                }
            },
            onError: (err: Error) => {
                // fail silently, leave the error handling responsibility to the data consumer
            },
        },
        ONCOKB_DEFAULT
    );

    readonly civicGenes = remoteData<ICivicGeneIndex | undefined>(
        {
            await: () => [
                this.mutationData,
                this.uncalledMutationData,
                this.clinicalDataForSamples,
            ],
            invoke: async () =>
                getServerConfig().show_civic
                    ? fetchCivicGenes(
                          this.mutationData,
                          this.uncalledMutationData
                      )
                    : {},
            onError: (err: Error) => {
                // fail silently
            },
        },
        undefined
    );

    readonly civicVariants = remoteData<ICivicVariantIndex | undefined>(
        {
            await: () => [
                this.civicGenes,
                this.mutationData,
                this.uncalledMutationData,
            ],
            invoke: async () => {
                if (getServerConfig().show_civic && this.civicGenes.result) {
                    return fetchCivicVariants(
                        this.civicGenes.result as ICivicGeneIndex,
                        this.mutationData,
                        this.uncalledMutationData
                    );
                } else {
                    return {};
                }
            },
            onError: (err: Error) => {
                // fail silently
            },
        },
        undefined
    );

    readonly cnaOncoKbData = remoteData<IOncoKbData>(
        {
            await: () => [
                this.oncoKbAnnotatedGenes,
                this.discreteCNAData,
                this.clinicalDataForSamples,
                this.studies,
            ],
            invoke: async () => {
                if (getServerConfig().show_oncokb) {
                    return fetchCnaOncoKbData(
                        this.uniqueSampleKeyToTumorType,
                        this.oncoKbAnnotatedGenes.result || {},
                        this.discreteCNAData
                    );
                } else {
                    return ONCOKB_DEFAULT;
                }
            },
            onError: (err: Error) => {
                // fail silently, leave the error handling responsibility to the data consumer
            },
        },
        ONCOKB_DEFAULT
    );

    readonly structuralVariantOncoKbData = remoteData<IOncoKbData>(
        {
            await: () => [
                this.oncoKbAnnotatedGenes,
                this.structuralVariantData,
                this.clinicalDataForSamples,
                this.studies,
            ],
            invoke: async () => {
                if (getServerConfig().show_oncokb) {
                    return fetchStructuralVariantOncoKbData(
                        this.uniqueSampleKeyToTumorType,
                        this.oncoKbAnnotatedGenes.result || {},
                        this.structuralVariantData
                    );
                } else {
                    return ONCOKB_DEFAULT;
                }
            },
            onError: (err: Error) => {
                // fail silently, leave the error handling responsibility to the data consumer
            },
        },
        ONCOKB_DEFAULT
    );

    readonly cnaCivicGenes = remoteData<ICivicGeneIndex | undefined>(
        {
            await: () => [this.discreteCNAData, this.clinicalDataForSamples],
            invoke: async () =>
                getServerConfig().show_civic
                    ? fetchCnaCivicGenes(this.discreteCNAData)
                    : {},
            onError: (err: Error) => {
                // fail silently
            },
        },
        undefined
    );

    readonly cnaCivicVariants = remoteData<ICivicVariantIndex | undefined>(
        {
            await: () => [this.civicGenes, this.mutationData],
            invoke: async () => {
                if (this.cnaCivicGenes.status == 'complete') {
                    return fetchCivicVariants(
                        this.cnaCivicGenes.result as ICivicGeneIndex
                    );
                }
            },
            onError: (err: Error) => {
                // fail silently
            },
        },
        undefined
    );

    readonly copyNumberCountData = remoteData<CopyNumberCount[]>(
        {
            await: () => [this.discreteCNAData],
            invoke: async () =>
                fetchCopyNumberData(
                    this.discreteCNAData,
                    this.molecularProfileIdDiscrete
                ),
        },
        []
    );

    @computed get sampleIds(): string[] {
        if (this.samples.result) {
            return this.samples.result.map(sample => sample.sampleId);
        }

        return [];
    }

    readonly indexedHotspotData = remoteData<IHotspotIndex | undefined>({
        await: () => [this.hotspotData],
        invoke: () => Promise.resolve(indexHotspotsData(this.hotspotData)),
    });

    readonly sampleToMutationGenePanelId = remoteData<{
        [sampleId: string]: string;
    }>(
        {
            await: () => [
                this.mutationMolecularProfileId,
                this.genePanelDataByMolecularProfileIdAndSampleId,
            ],
            invoke: async () => {
                if (this.mutationMolecularProfileId.result) {
                    return _.mapValues(
                        this.genePanelDataByMolecularProfileIdAndSampleId
                            .result[this.mutationMolecularProfileId.result] ||
                            {},
                        genePanelData => genePanelData.genePanelId
                    );
                }
                return {};
            },
        },
        {}
    );

    readonly sampleToStructuralVariantGenePanelId = remoteData<{
        [sampleId: string]: string;
    }>(
        {
            await: () => [
                this.structuralVariantProfile,
                this.genePanelDataByMolecularProfileIdAndSampleId,
            ],
            invoke: async () => {
                if (this.structuralVariantProfile.result) {
                    return _.mapValues(
                        this.genePanelDataByMolecularProfileIdAndSampleId
                            .result[
                            this.structuralVariantProfile.result!
                                .molecularProfileId
                        ] || {},
                        genePanelData => genePanelData.genePanelId
                    );
                }
                return {};
            },
        },
        {}
    );

    readonly sampleToDiscreteGenePanelId = remoteData<{
        [sampleId: string]: string;
    }>(
        {
            await: () => [
                this.molecularProfileIdDiscrete,
                this.genePanelDataByMolecularProfileIdAndSampleId,
            ],
            invoke: async () => {
                if (this.molecularProfileIdDiscrete.result) {
                    return _.mapValues(
                        this.genePanelDataByMolecularProfileIdAndSampleId
                            .result[this.molecularProfileIdDiscrete.result] ||
                            {},
                        genePanelData => genePanelData.genePanelId
                    );
                }
                return {};
            },
        },
        {}
    );

    readonly genePanelIdToEntrezGeneIds = remoteData<{
        [genePanelId: string]: number[];
    }>(
        {
            await: () => [this.genePanelIdToPanel],
            invoke: async () => {
                return _(this.genePanelIdToPanel.result)
                    .mapValues(genePanel =>
                        _.map(
                            genePanel.genes,
                            genePanelToGene => genePanelToGene.entrezGeneId
                        )
                    )
                    .value();
            },
        },
        {}
    );

    @computed get mergedMutationData(): Mutation[][] {
        return mergeMutations(this.mutationData);
    }

    @computed get mutationHugoGeneSymbols(): string[] {
        var gene_symbols: string[] = [];
        this.mergedMutationData.forEach(function(value: Mutation[]) {
            gene_symbols.push(value[0].gene.hugoGeneSymbol);
        });

        this.mergedDiscreteCNADataFilteredByGene.forEach(function(
            value: DiscreteCopyNumberData[]
        ) {
            gene_symbols.push(value[0].gene.hugoGeneSymbol);
        });

        var unique_gene_symbols = [...new Set(gene_symbols)];

        return unique_gene_symbols;
    }

    @computed get mergedMutationDataIncludingUncalled(): Mutation[][] {
        return mergeMutationsIncludingUncalled(
            this.mutationData,
            this.uncalledMutationData
        );
    }

    readonly getDiscreteCNAPutativeDriverInfo = remoteData({
        await: () => [this.getOncoKbCnaAnnotationForOncoprint],
        invoke: () => {
            return Promise.resolve(
                (
                    cnaDatum: CustomDriverNumericGeneMolecularData
                ): {
                    oncoKb: string;
                    customDriverBinary: boolean;
                } => {
                    const getOncoKBAnnotationFunc = this
                        .getOncoKbCnaAnnotationForOncoprint.result!;
                    const oncoKbDatum:
                        | IndicatorQueryResp
                        | undefined
                        | null
                        | false =
                        getOncoKBAnnotationFunc &&
                        !(getOncoKBAnnotationFunc instanceof Error) &&
                        getOncoKBAnnotationFunc(cnaDatum);

                    // Note: custom driver annotations are part of the incoming datum
                    return evaluateDiscreteCNAPutativeDriverInfo(
                        cnaDatum,
                        oncoKbDatum,
                        false,
                        undefined
                    );
                }
            );
        },
    });

    @computed
    get annotatedExtendedAlterationData(): AnnotatedExtendedAlteration[] {
        const filteredAndAnnotatedMutations = filterAndAnnotateMutations(
            _.flatten(this.mergedMutationDataIncludingUncalledFilteredByGene),
            this.getMutationPutativeDriverInfo.result!,
            this.entrezGeneIdToGene.result!
        );

        const mutationData = [
            ...filteredAndAnnotatedMutations.data,
            ...filteredAndAnnotatedMutations.vusAndGermline,
            ...filteredAndAnnotatedMutations.vus,
            ...filteredAndAnnotatedMutations.germline,
        ];

        const filteredAndAnnotatedMolecularData = filterAndAnnotateMolecularData(
            _.flatten(this.mergedDiscreteCNADataFilteredByGene).map(d => ({
                ...d,
                value: d.alteration,
            })),
            this.getDiscreteCNAPutativeDriverInfo.result!,
            this.entrezGeneIdToGene
        );

        const cnaData = [
            ...filteredAndAnnotatedMolecularData.data,
            ...filteredAndAnnotatedMolecularData.vus,
        ];

        const annotatedExtendedCnaData = cnaData.map(molecularData => ({
            ...molecularData,
            molecularProfileAlterationType: this.discreteMolecularProfile
                .result!.molecularAlterationType,
            alterationType: AlterationTypeConstants.COPY_NUMBER_ALTERATION,
            alterationSubType: cna_profile_data_to_string[molecularData.value],
        })) as AnnotatedExtendedAlteration[];

        const annotatedExtendedMutations = mutationData.map(
            extendedAlteration => {
                const alterationType =
                    getSimplifiedMutationType(
                        extendedAlteration.mutationType
                    ) === 'fusion'
                        ? AlterationTypeConstants.FUSION
                        : AlterationTypeConstants.MUTATION_EXTENDED;

                return {
                    ...extendedAlteration,
                    molecularProfileAlterationType: this
                        .mutationMolecularProfile.result!
                        .molecularAlterationType,
                    alterationType: alterationType,
                    alterationSubType:
                        getMutationSubType(extendedAlteration) || '',
                    value: 0,
                };
            }
        ) as AnnotatedExtendedAlteration[];

        return [...annotatedExtendedMutations, ...annotatedExtendedCnaData];
    }

    @computed get caseAggregatedAlterationDataGroupedByGene(): {
        [geneSymbol: string]: {
            samples: {
                [uniqueSampleKey: string]: AnnotatedExtendedAlteration[];
            };
        };
    } {
        const groupedByGene = _.groupBy(
            this.annotatedExtendedAlterationData,
            alteration => alteration.hugoGeneSymbol
        );
        return _.mapValues(groupedByGene, alterations => ({
            samples: _.groupBy(alterations, a => a.uniqueSampleKey),
        }));
    }

    @computed get mergedMutationDataFilteredByGene(): Mutation[][] {
        if (
            this.mutationTableGeneFilterOption === GeneFilterOption.ALL_SAMPLES
        ) {
            return filterMutationsByProfiledGene(
                this.mergedMutationData,
                this.sampleIds,
                this.sampleToMutationGenePanelId.result,
                this.genePanelIdToEntrezGeneIds.result
            );
        }
        return this.mergedMutationData;
    }

    @computed
    get mergedMutationDataIncludingUncalledFilteredByGene(): Mutation[][] {
        if (
            this.mutationTableGeneFilterOption === GeneFilterOption.ALL_SAMPLES
        ) {
            return filterMutationsByProfiledGene(
                this.mergedMutationDataIncludingUncalled,
                this.sampleIds,
                this.sampleToMutationGenePanelId.result,
                this.genePanelIdToEntrezGeneIds.result
            );
        }
        return this.mergedMutationDataIncludingUncalled;
    }

    @computed
    get mergedDiscreteCNADataFilteredByGene(): DiscreteCopyNumberData[][] {
        if (
            this.copyNumberTableGeneFilterOption ===
            GeneFilterOption.ALL_SAMPLES
        ) {
            return _.filter(
                this.mergedDiscreteCNAData,
                (mutations: DiscreteCopyNumberData[]) => {
                    const entrezGeneId = mutations[0].gene.entrezGeneId;
                    const geneProfiledInSamples = TumorColumnFormatter.getProfiledSamplesForGene(
                        entrezGeneId,
                        this.sampleIds,
                        this.sampleToMutationGenePanelId.result,
                        this.genePanelIdToEntrezGeneIds.result
                    );
                    return (
                        _(geneProfiledInSamples)
                            .values()
                            .filter((profiled: boolean) => profiled)
                            .value().length === this.sampleIds.length
                    );
                }
            );
        }
        return this.mergedDiscreteCNAData;
    }

    @computed get existsSomeMutationWithVAFData() {
        return _.some(
            this.mergedMutationDataIncludingUncalled,
            mutationList => {
                return _.some(mutationList, m => {
                    const vafReport = getVariantAlleleFrequency(m);
                    return vafReport !== null && vafReport.vaf > 0;
                });
            }
        );
    }

    @computed get existsSomeMutationWithAscnProperty(): {
        [property: string]: boolean;
    } {
        return existsSomeMutationWithAscnPropertyInCollection(
            this.mergedMutationDataIncludingUncalled
        );
    }

    readonly mutationTableShowGeneFilterMenu = remoteData({
        await: () => [
            this.samples,
            this.sampleToMutationGenePanelId,
            this.genePanelIdToEntrezGeneIds,
        ],
        invoke: () => {
            const entrezGeneIds: number[] = _.uniq(
                _.map(
                    this.mergedMutationDataIncludingUncalled,
                    mutations => mutations[0].entrezGeneId
                )
            );
            const sampleIds = this.samples.result!.map(s => s.sampleId);
            return Promise.resolve(
                sampleIds.length > 1 &&
                    checkNonProfiledGenesExist(
                        sampleIds,
                        entrezGeneIds,
                        this.sampleToMutationGenePanelId.result,
                        this.genePanelIdToEntrezGeneIds.result
                    )
            );
        },
    });

    readonly cnaTableShowGeneFilterMenu = remoteData({
        await: () => [
            this.samples,
            this.sampleToMutationGenePanelId,
            this.genePanelIdToEntrezGeneIds,
        ],
        invoke: () => {
            const entrezGeneIds: number[] = _.uniq(
                _.map(
                    this.mergedDiscreteCNAData,
                    alterations => alterations[0].entrezGeneId
                )
            );
            const sampleIds = this.samples.result!.map(s => s.sampleId);
            return Promise.resolve(
                sampleIds.length > 1 &&
                    checkNonProfiledGenesExist(
                        sampleIds,
                        entrezGeneIds,
                        this.sampleToMutationGenePanelId.result,
                        this.genePanelIdToEntrezGeneIds.result
                    )
            );
        },
    });

    readonly structuralVariantTableShowGeneFilterMenu = remoteData({
        await: () => [
            this.samples,
            this.sampleToStructuralVariantGenePanelId,
            this.genePanelIdToEntrezGeneIds,
            this.groupedStructuralVariantData,
        ],
        invoke: () => {
            const entrezGeneIds: number[] = _.uniq(
                _.flatMap(this.groupedStructuralVariantData.result, datum =>
                    datum[0].site2EntrezGeneId
                        ? [
                              datum[0].site1EntrezGeneId,
                              datum[0].site2EntrezGeneId,
                          ]
                        : [datum[0].site1EntrezGeneId]
                )
            );
            const sampleIds = this.samples.result!.map(s => s.sampleId);
            return Promise.resolve(
                sampleIds.length > 1 &&
                    checkNonProfiledGenesExist(
                        sampleIds,
                        entrezGeneIds,
                        this.sampleToStructuralVariantGenePanelId.result,
                        this.genePanelIdToEntrezGeneIds.result
                    )
            );
        },
        default: false,
    });

    @computed get uniqueSampleKeyToTumorType(): { [sampleId: string]: string } {
        return generateUniqueSampleKeyToTumorTypeMap(
            this.clinicalDataForSamples,
            this.studiesForSamplesWithoutCancerTypeClinicalData,
            this.samplesWithoutCancerTypeClinicalData
        );
    }

    @action('SetSampleId') setSampleId(newId: string) {
        if (newId) this._patientId = '';
        this._sampleId = newId;
    }

    @action('SetPatientId') setPatientId(newId: string) {
        if (newId) this._sampleId = '';
        this._patientId = newId;
    }

    @cached @computed get mrnaExprRankCache() {
        return new MrnaExprRankCache(this.mrnaRankMolecularProfileId.result);
    }

    @cached @computed get variantCountCache() {
        return new VariantCountCache(this.mutationMolecularProfileId.result);
    }

    @cached @computed get discreteCNACache() {
        return new DiscreteCNACache(
            this.studyToMolecularProfileDiscrete.result
        );
    }

    @cached @computed get genomeNexusCache() {
        return new GenomeNexusCache(
            createVariantAnnotationsByMutationFetcher(
                [GENOME_NEXUS_ARG_FIELD_ENUM.ANNOTATION_SUMMARY],
                this.genomeNexusClient
            )
        );
    }

    @cached @computed get genomeNexusMutationAssessorCache() {
        return new GenomeNexusMutationAssessorCache(
            createVariantAnnotationsByMutationFetcher(
                [
                    GENOME_NEXUS_ARG_FIELD_ENUM.ANNOTATION_SUMMARY,
                    GENOME_NEXUS_ARG_FIELD_ENUM.MUTATION_ASSESSOR,
                ],
                this.genomeNexusClient
            )
        );
    }

    @cached @computed get pubMedCache() {
        return new PubMedCache();
    }

    @cached @computed get copyNumberCountCache() {
        return new CopyNumberCountCache(this.molecularProfileIdDiscrete.result);
    }

    @cached @computed get cancerTypeCache() {
        return new CancerTypeCache();
    }

    @cached @computed get mutationCountCache() {
        return new MutationCountCache();
    }

    @cached @computed get downloadDataFetcher() {
        return new MutationTableDownloadDataFetcher(this.mutationData);
    }

    @action setActiveTabId(id: string) {
        this.activeTabId = id;
    }

    @action clearErrors() {
        this.ajaxErrors = [];
    }

    readonly trialMatches = remoteData<ITrialMatch[]>(
        {
            invoke: () => {
                return fetchTrialMatchesUsingPOST({ mrn: this.patientId });
            },
        },
        []
    );

    readonly trialIds = remoteData<ITrialQuery>(
        {
            await: () => [this.trialMatches],
            invoke: async () => {
                let nctIds = new Set<string>(); // Trial unique id from clinicaltrials.gov
                let protocolNos = new Set<string>(); // Trials's MSK ID same as protocol_number or protocol_id
                _.forEach(
                    this.trialMatches.result,
                    (trialMatch: ITrialMatch) => {
                        if (_.isEmpty(trialMatch.protocolNo)) {
                            nctIds.add(trialMatch.nctId);
                        } else {
                            protocolNos.add(trialMatch.protocolNo);
                        }
                    }
                );
                return {
                    nct_id: [...nctIds],
                    protocol_no: [...protocolNos],
                };
            },
        },
        {
            nct_id: [],
            protocol_no: [],
        }
    );

    readonly trials = remoteData<ITrial[]>(
        {
            await: () => [this.trialIds],
            invoke: async () => {
                if (
                    this.trialIds.result.protocol_no.length > 0 ||
                    this.trialIds.result.nct_id.length > 0
                ) {
                    return fetchTrialsById(this.trialIds.result);
                }
                return [];
            },
        },
        []
    );

    readonly detailedTrialMatches = remoteData<IDetailedTrialMatch[]>(
        {
            await: () => [this.trials, this.trialMatches],
            invoke: async () => {
                if (this.trials.result && this.trialMatches.result) {
                    return groupTrialMatchesById(
                        this.trials.result,
                        this.trialMatches.result
                    );
                }
                return [];
            },
        },
        []
    );

    readonly mtbs = remoteData<IMtb[]>(
        {
            invoke: () => {
                return fetchMtbsUsingGET(
                    this.getMtbJsonStoreUrl(this.getSafePatientId()),
                    this.getSafeStudyId()
                );
            },
        },
        []
    );

    readonly otherMtbs = remoteData<ITherapyRecommendation[]>(
        {
            invoke: () => {
                return fetchOtherMtbsUsingPOST(
                    this.getMtbJsonStoreUrl('alteration'),
                    this.mutationData.result
                );
            },
        },
        []
    );

    updateMtbs = async (mtbs: IMtb[]): Promise<boolean> => {
        console.log('update');
        return updateMtbUsingPUT(
            this.getSafePatientId(),
            this.getSafeStudyId(),
            this.getMtbJsonStoreUrl(this.getSafePatientId()),
            mtbs
        );
    };

    readonly deletions: IDeletions = {
        mtb: [],
        therapyRecommendation: [],
    };

    deleteMtbs = (deletions: IDeletions) => {
        console.log('delete');
        deleteMtbUsingDELETE(
            this.getSafePatientId(),
            this.getSafeStudyId(),
            this.getMtbJsonStoreUrl(this.getSafePatientId()),
            deletions
        );
    };

    checkPermission = async (): Promise<boolean[]> => {
        let checkUrl =
            this.getMtbJsonStoreUrl(this.getSafePatientId()) + '/permission';
        return checkPermissionUsingGET(checkUrl, this.getSafeStudyId());
    };

    getMtbJsonStoreUrl = (id: string) => {
        let host: string | null = window.location.hostname;
        let port = ':' + window.location.port;
        if (
            getServerConfig().fhirspark &&
            getServerConfig().fhirspark!.host &&
            getServerConfig().fhirspark!.host !== 'undefined'
        )
            host = getServerConfig().fhirspark!.host;
        if (
            getServerConfig().fhirspark &&
            getServerConfig().fhirspark!.port &&
            getServerConfig().fhirspark!.port !== 'undefined'
        )
            port = ':' + getServerConfig().fhirspark!.port;
        return '//' + host + port + '/mtb/' + id;
    };

    private getSafePatientId = () => {
        return encodeURIComponent(this.patientId);
    };

    private getSafeStudyId = () => {
        return encodeURIComponent(this.studyId);
    };

    readonly getStudiesFromOncoKBSortedByCondition = remoteData<
        IOncoKBStudyDictionary
    >({
        await: () => [],
        invoke: async () => {
            var res: IOncoKBStudyDictionary = await getStudiesByCondtionsFromOncoKB();
            return res;
        },
    });

    readonly getStudiesFromClinicalTrialsGov = remoteData<StudyListEntry[]>(
        {
            await: () => [
                this.getStudiesFromOncoKBSortedByCondition,
                this.patientViewData,
            ],
            invoke: async () => {
                var study_list = new StudyList();
                var sortedList;
                var all_gene_symbols: string[] = this.mutationHugoGeneSymbols;
                var clinicalTrialQuery = this.clinicalTrialSerchParams;
                var search_symbols = clinicalTrialQuery.symbolsToSearch;
                var nec_search_symbols = clinicalTrialQuery.necSymbolsToSearch;
                var entity_symbols = clinicalTrialQuery.entitiesToSearch;
                var gene_symbols: string[] = [];
                var study_dictionary:
                    | IOncoKBStudyDictionary
                    | undefined = await this
                    .getStudiesFromOncoKBSortedByCondition.result;
                var trials_for_condtion: string[] = [];

                gene_symbols = [];
                if (
                    search_symbols.length == 0 &&
                    nec_search_symbols.length == 0
                ) {
                    gene_symbols = entity_symbols;
                } else {
                    gene_symbols = search_symbols.concat(nec_search_symbols);
                    gene_symbols = [...new Set(gene_symbols)];
                }

                for (const symbol of gene_symbols) {
                    var result: Study[] = await this.getAllStudiesForKeyword(
                        symbol,
                        nec_search_symbols
                    );
                    for (const std of result) {
                        study_list.addStudy(std, symbol);
                    }
                }

                var patientData = await this.patientViewData.result;
                var samples = patientData.samples;
                var oncotree_codes_in_samples: string[] = [];
                var tumor_entities: string[] = [];
                var nctIDs_with_tumor_entity: string[] = [];

                for (var i = 0; i < samples!.length; i++) {
                    for (var k = 0; k < samples![i].clinicalData.length; k++) {
                        if (
                            samples![i].clinicalData[k].clinicalAttributeId ==
                            'ONCOTREE_CODE'
                        ) {
                            oncotree_codes_in_samples.push(
                                samples![i].clinicalData[k].value
                            );
                        }

                        if (
                            samples![i].clinicalData[k].clinicalAttributeId ==
                                'CANCER_TYPE_DETAILED' ||
                            samples![i].clinicalData[k].clinicalAttributeId ==
                                'CANCER_TYPE'
                        ) {
                            tumor_entities.push(
                                samples![i].clinicalData[k].value
                            );
                        }
                    }
                }

                nctIDs_with_tumor_entity = await getStudiesNCTIds(
                    nec_search_symbols,
                    search_symbols,
                    entity_symbols,
                    this.clinicalTrialSerchParams.clinicalTrialsCountires,
                    this.clinicalTrialSerchParams.clinicalTrialsRecruitingStatus
                );

                var study_dictionary:
                    | IOncoKBStudyDictionary
                    | undefined = await this
                    .getStudiesFromOncoKBSortedByCondition.result;
                trials_for_condtion = getAllStudyNctIdsByOncoTreeCodes(
                    study_dictionary,
                    oncotree_codes_in_samples
                );

                study_list.calculateScores(
                    trials_for_condtion,
                    clinicalTrialQuery.age,
                    clinicalTrialQuery.gender,
                    clinicalTrialQuery.patientLocation,
                    nctIDs_with_tumor_entity
                );

                if (
                    clinicalTrialQuery.filterDistance &&
                    clinicalTrialQuery.maximumDistance > 0
                ) {
                    study_list.filterByDistance(
                        clinicalTrialQuery.maximumDistance
                    );
                }

                var tmp: Map<
                    String,
                    StudyListEntry
                > = study_list.getStudyListEntires();
                var arr: StudyListEntry[] = Array.from(tmp.values());
                var sorted_arr: StudyListEntry[] = arr.sort(
                    (a, b) => b.getScore() - a.getScore()
                );

                var res = '["';
                for (const a of sorted_arr) {
                    res += a.getStudy().ProtocolSection.IdentificationModule
                        .NCTId;
                    res += '","';
                }

                return sorted_arr;
            },
        },
        []
    );

    readonly clinicalTrialMatches = remoteData<IDetailedClinicalTrialMatch[]>(
        {
            await: () => [this.getStudiesFromClinicalTrialsGov],
            invoke: async () => {
                var result: IDetailedClinicalTrialMatch[] = [];
                for (const std of this.getStudiesFromClinicalTrialsGov.result) {
                    var loc: string[] = [];
                    var inv: string[] = [];

                    var locationModule: Location[] = [];
                    var interventionModule: Intervention[] = [];
                    var eligibilityCriteria: string = '';

                    try {
                        locationModule = std.getStudy().ProtocolSection
                            .ContactsLocationsModule.LocationList.Location;
                    } catch (e) {
                        //no location module in study
                        locationModule = [];
                    }

                    try {
                        interventionModule = std.getStudy().ProtocolSection
                            .ArmsInterventionsModule.InterventionList
                            .Intervention;
                    } catch (e) {
                        //no intervention module in study
                        interventionModule = [];
                    }

                    try {
                        eligibilityCriteria = std.getStudy().ProtocolSection
                            .EligibilityModule.EligibilityCriteria;
                    } catch (e) {
                        eligibilityCriteria = '';
                    }

                    for (let i = 0; i < locationModule.length; i++) {
                        let location: Location = locationModule[i];
                        loc.push(
                            location.LocationCity +
                                ': ' +
                                location.LocationFacility +
                                ': ' +
                                location.LocationState
                        );
                    }

                    for (let i = 0; i < interventionModule.length; i++) {
                        let intervention: Intervention = interventionModule[i];
                        inv.push(intervention.InterventionName);
                    }

                    var newTrial = {
                        found: std.getNumberFound(),
                        keywords: std.getKeywords().toString(),
                        conditions: std.getStudy().ProtocolSection
                            .ConditionsModule.ConditionList.Condition,
                        title:
                            std.getStudy().ProtocolSection.IdentificationModule
                                .OfficialTitle ||
                            std.getStudy().ProtocolSection.IdentificationModule
                                .BriefTitle,
                        nct: std.getStudy().ProtocolSection.IdentificationModule
                            .NCTId,
                        status: std.getStudy().ProtocolSection.StatusModule
                            .OverallStatus,
                        locations: loc,
                        interventions: inv,
                        condition_matching: false,
                        score: std.getScore(),
                        eligibility: eligibilityCriteria,
                        explanation: std.getExplanations(),
                    };
                    result.push(newTrial);
                }
                this.showLoadingScreen = false;
                if (result.length > 0) {
                    this.isTrialResultsZero = false;
                } else {
                    this.isTrialResultsZero = true;
                }
                return result;
            },
        },
        []
    );

    private async getAllStudiesForKeyword(
        keyword: string,
        nec_search_symbols: string[]
    ): Promise<Study[]> {
        const STEPSIZE = 100;
        var all_studies: Study[] = [];
        var result: ClinicalTrialsGovStudies = await searchStudiesForKeywordAsString(
            keyword,
            nec_search_symbols,
            1,
            1,
            this.clinicalTrialSerchParams.clinicalTrialsCountires,
            this.clinicalTrialSerchParams.clinicalTrialsRecruitingStatus
        ); //find amount of available studies.
        var num_studies_found = result.FullStudiesResponse.NStudiesFound;
        var current_max = STEPSIZE; //ClinicalTrials.gov API Allows to oly fetch 100 studies at a time
        var current_min = 1;

        if (num_studies_found <= 0) {
            return all_studies;
        }

        //get first batch of avialable studies
        result = await searchStudiesForKeywordAsString(
            keyword,
            nec_search_symbols,
            current_min,
            current_max,
            this.clinicalTrialSerchParams.clinicalTrialsCountires,
            this.clinicalTrialSerchParams.clinicalTrialsRecruitingStatus
        );

        result.FullStudiesResponse.FullStudies.forEach(function(value) {
            all_studies.push(value.Study);
        });

        //check if there are more studies to fetch
        while (current_max < num_studies_found) {
            current_min = current_max + 1;
            current_max = current_max + STEPSIZE;

            result = await searchStudiesForKeywordAsString(
                keyword,
                nec_search_symbols,
                current_min,
                current_max,
                this.clinicalTrialSerchParams.clinicalTrialsCountires,
                this.clinicalTrialSerchParams.clinicalTrialsRecruitingStatus
            );
            result.FullStudiesResponse.FullStudies.forEach(function(value) {
                all_studies.push(value.Study);
            });
        }

        return all_studies;
    }

    public setClinicalTrialSearchParams(
        countries: string[],
        status: RecruitingStatus[],
        symbols: string[],
        necSymbols: string[],
        tumorEntities: string[],
        gender: string,
        patientLocation: City,
        age: number,
        filterDistance: boolean,
        maximumDistance: number
    ) {
        var cntr: string[] = [];

        if (countries.length == 0) {
            cntr = [];
        } else {
            cntr = countries;
        }

        this.isClinicalTrialsLoading = !this.isClinicalTrialsLoading;
        this.showLoadingScreen = true;

        this.clinicalTrialSerchParams = new ClinicalTrialsSearchParams(
            cntr,
            status,
            symbols,
            necSymbols,
            tumorEntities,
            gender,
            patientLocation,
            age,
            filterDistance,
            maximumDistance
        );
    }

    @observable
    public clinicalTrialClipboard: IClinicalTrial[] = [];

    readonly oncoKbDataForOncoprint = remoteData<IOncoKbData | Error>(
        {
            await: () => [this.mutationData, this.oncoKbAnnotatedGenes],
            invoke: async () =>
                fetchOncoKbDataForOncoprint(
                    this.oncoKbAnnotatedGenes,
                    this.mutationData
                ),
        },
        ONCOKB_DEFAULT
    );

    readonly cnaOncoKbDataForOncoprint = remoteData<IOncoKbData | Error>(
        {
            await: () => [
                this.oncoKbAnnotatedGenes,
                this.molecularData,
                this.molecularProfileIdToMolecularProfile,
            ],
            invoke: async () =>
                fetchCnaOncoKbDataForOncoprint(
                    this.oncoKbAnnotatedGenes,
                    this.molecularData
                ),
        },
        ONCOKB_DEFAULT
    );

    readonly getMutationPutativeDriverInfo = remoteData({
        await: () => [
            this.getOncoKbMutationAnnotationForOncoprint,
            this.isHotspotForOncoprint,
        ],
        invoke: () => {
            return Promise.resolve((mutation: Mutation): {
                oncoKb: string;
                hotspots: boolean;
                cbioportalCount: boolean;
                cosmicCount: boolean;
                customDriverBinary: boolean;
                customDriverTier?: string;
            } => {
                const getOncoKbMutationAnnotationForOncoprint = this
                    .getOncoKbMutationAnnotationForOncoprint.result!;
                const oncoKbDatum:
                    | IndicatorQueryResp
                    | undefined
                    | null
                    | false =
                    getOncoKbMutationAnnotationForOncoprint &&
                    !(
                        getOncoKbMutationAnnotationForOncoprint instanceof Error
                    ) &&
                    getOncoKbMutationAnnotationForOncoprint(mutation);

                const isHotspotDriver =
                    !(this.isHotspotForOncoprint.result instanceof Error) &&
                    this.isHotspotForOncoprint.result!(mutation);
                const cbioportalCountExceeded = false;
                const cosmicCountExceeded = false;

                // Note:
                // - custom driver annotations are part of the incoming datum
                // - cbio counts, cosmic and custom driver annnotations are
                //   not used for driver evaluation
                return evaluateMutationPutativeDriverInfo(
                    mutation,
                    oncoKbDatum,
                    true,
                    isHotspotDriver,
                    false,
                    cbioportalCountExceeded,
                    false,
                    cosmicCountExceeded,
                    false,
                    undefined
                );
            });
        },
    });

    readonly getOncoKbMutationAnnotationForOncoprint = remoteData<
        Error | ((mutation: Mutation) => IndicatorQueryResp | undefined)
    >({
        await: () => [this.oncoKbDataForOncoprint],
        invoke: () =>
            makeGetOncoKbMutationAnnotationForOncoprint(
                this.oncoKbDataForOncoprint
            ),
    });

    readonly getOncoKbCnaAnnotationForOncoprint = remoteData<
        | Error
        | ((data: NumericGeneMolecularData) => IndicatorQueryResp | undefined)
    >({
        await: () => [this.cnaOncoKbDataForOncoprint],
        invoke: () =>
            makeGetOncoKbCnaAnnotationForOncoprint(
                this.cnaOncoKbDataForOncoprint,
                // this.driverAnnotationSettings.oncoKb
                true
            ),
    });

    public readonly isHotspotForOncoprint = remoteData<
        ((m: Mutation) => boolean) | Error
    >({
        await: () => [this.indexedHotspotData],
        invoke: () => makeIsHotspotForOncoprint(this.indexedHotspotData),
    });

    readonly entrezGeneIdToGene = remoteData<{
        [entrezGeneId: number]: {
            hugoGeneSymbol: string;
            entrezGeneId: number;
        };
    }>({
        await: () => [this.mutatedGenes, this.referenceGenes],
        invoke: () =>
            Promise.resolve(
                _.keyBy(
                    [
                        ...this.mutatedGenes.result!,
                        ...this.referenceGenes.result!,
                    ],
                    gene => gene.entrezGeneId
                )
            ),
    });

    readonly geneticTrackData = remoteData<{
        [hugoSymbol: string]: GeneticTrackDatum[];
    }>({
        await: () => [
            this.mutationData,
            this.discreteCNAData,
            this.samplesWithUniqueKeys,
            this.molecularProfileIdDiscrete,
            this.mutationMolecularProfile,
            this.discreteMolecularProfile,
            this.coverageInformation,
            this.getMutationPutativeDriverInfo,
            this.entrezGeneIdToGene,
            this.getOncoKbCnaAnnotationForOncoprint,
            this.getDiscreteCNAPutativeDriverInfo,
        ],
        invoke: () =>
            Promise.resolve(
                _.mapValues(
                    this.caseAggregatedAlterationDataGroupedByGene,
                    data =>
                        makeGeneticTrackData(
                            data.samples,
                            _.values(data.samples)[0][0].hugoGeneSymbol, // TODO get this from the caseAggregatedAlterationDataGroupedByGene keys!
                            this.samplesWithUniqueKeys.result,
                            this.coverageInformation.result!,
                            // remove undefined values (certain molecular profiles might be missing)
                            _.compact([
                                this.mutationMolecularProfile.result!,
                                this.discreteMolecularProfile.result!,
                            ])
                        )
                )
            ),
    });

    @computed get referenceGenomeBuild() {
        if (!this.studies.isComplete) {
            throw new Error('Failed to get studies');
        }
        return getGenomeNexusUrl(this.studies.result);
    }

    @autobind
    generateGenomeNexusHgvsgUrl(hgvsg: string) {
        return getGenomeNexusHgvsgUrl(hgvsg, this.referenceGenomeBuild);
    }

    @computed get genomeNexusClient() {
        return new GenomeNexusAPI(this.referenceGenomeBuild);
    }

    @computed get genomeNexusInternalClient() {
        return new GenomeNexusAPIInternal(this.referenceGenomeBuild);
    }

    @computed get sampleMsiHInfo() {
        return getSampleClinicalDataMapByKeywords(
            this.clinicalDataForSamples.result,
            CLINICAL_ATTRIBUTE_ID_ENUM.MSI_TYPE,
            [MIS_TYPE_VALUE.INSTABLE]
        );
    }

    @computed get sampleTmbHInfo() {
        return getSampleClinicalDataMapByThreshold(
            this.clinicalDataForSamples.result,
            CLINICAL_ATTRIBUTE_ID_ENUM.TMB_SCORE,
            TMB_H_THRESHOLD
        );
    }

    getOtherBiomarkerQueries(
        type: OtherBiomarkersQueryType,
        sampleClinicalData: { [key: string]: ClinicalData }
    ) {
        return _.values(sampleClinicalData).map(clinical => {
            return {
                id: getOtherBiomarkersQueryId({
                    sampleId: clinical.sampleId,
                    type: type,
                }),
                alteration: OTHER_BIOMARKER_NAME[type],
                gene: {
                    hugoSymbol: OTHER_BIOMARKER_HUGO_SYMBOL,
                },
                tumorType: tumorTypeResolver(
                    getSampleTumorTypeMap(
                        this.clinicalDataForSamples.result,
                        this.studyMetaData.result?.cancerType.name
                    )
                ),
            } as AnnotateMutationByProteinChangeQuery;
        });
    }

    @computed get otherBiomarkerQueries() {
        const queries: AnnotateMutationByProteinChangeQuery[] = [];
        if (_.keys(this.sampleMsiHInfo).length > 0) {
            queries.push(
                ...this.getOtherBiomarkerQueries(
                    OtherBiomarkersQueryType.MSIH,
                    this.sampleMsiHInfo
                )
            );
        }
        if (_.keys(this.sampleTmbHInfo).length > 0) {
            queries.push(
                ...this.getOtherBiomarkerQueries(
                    OtherBiomarkersQueryType.TMBH,
                    this.sampleTmbHInfo
                )
            );
        }
        return queries;
    }

    readonly getOtherBiomarkersOncoKbData = remoteData<{
        [sampleId: string]: { [queryType: string]: IndicatorQueryResp };
    }>({
        invoke: async () => {
            const allResult = await oncokbClient.annotateMutationsByProteinChangePostUsingPOST_1(
                {
                    body: this.otherBiomarkerQueries,
                }
            );

            const updatedResult = allResult.map(resp => {
                return {
                    ...resp,
                    ...parseOtherBiomarkerQueryId(resp.query.id),
                };
            });
            return _.chain(updatedResult)
                .groupBy(datum => datum.sampleId)
                .mapValues(group => _.keyBy(group, groupItem => groupItem.type))
                .value();
        },
        default: {},
    });
}
