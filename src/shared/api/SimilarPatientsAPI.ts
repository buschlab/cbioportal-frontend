import {
    IMtb,
    IDeletions,
    ITherapyRecommendation,
    IFollowUp,
} from 'cbioportal-utils';
import * as request from 'superagent';
import { fetchTrialMatchesUsingPOST } from './MatchMinerAPI';
import client from './cbioportalClientInstance';
import defaultClient from './cbioportalClientInstance';
import {
    ClinicalData,
    CBioPortalAPI,
    MutationFilter,
    Mutation,
    MolecularProfile,
} from 'cbioportal-ts-api-client';
import {
    concatMutationData,
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
    evaluatePutativeDriverInfoWithHotspots,
    evaluatePutativeDriverInfo,
} from 'shared/lib/StoreUtils';
import {
    CLINICAL_ATTRIBUTE_ID_ENUM,
    MIS_TYPE_VALUE,
    GENOME_NEXUS_ARG_FIELD_ENUM,
    TMB_H_THRESHOLD,
    AlterationTypeConstants,
    DataTypeConstants,
} from 'shared/constants';
import { MobxPromise, stringListToIndexSet } from 'cbioportal-frontend-commons';

export interface SimilarPatient {
    patient_id: string;
    study_id: string;
    age: number;
    gender: string;
    name: string;
    cancertype: string | undefined;
    mutationData: Mutation[];
    sampleIds: string[];
}

export interface TaggedMutation extends Mutation {
    comparedMutations: Mutation[];
    similarityTag: 'equal' | 'phgvs' | 'pathway' | 'gene' | 'unequal';
}

export class SimilarMutation {
    mutations1: Mutation[];
    mutations2: Mutation[];
    similarityTag: 'equal' | 'phgvs' | 'pathway' | 'gene' | 'unequal';

    //get StringRepr() {
    //    const genomicMut1 = [this.mutation1.chr, this.mutation1.startPosition, this.mutation1.referenceAllele, this.mutation1.variantAllele].join('-')
    //    const phgvsMut1 = [this.mutation1.gene, this.mutation1.proteinChange].join(':')
    //    const genomicMut2 = [this.mutation2.chr, this.mutation2.startPosition, this.mutation2.referenceAllele, this.mutation2.variantAllele].join('-')
    //    const phgvsMut2 = [this.mutation2.gene, this.mutation2.proteinChange].join(':')
    //}
}

//export async function fetchPatientsPage(
//    page: number = 0,
//    pageSize: number = 10,
//    client: CBioPortalAPI = defaultClient
//) {
//    //'keyword'?: string;
//    //'projection'?: "ID" | "SUMMARY" | "DETAILED" | "META";
//    //'pageSize'?: number;
//    //'pageNumber'?: number;
//    //'direction'?: "ASC" | "DESC";
//    //$queryParameters?: any;
//    var patients: SimilarPatient[] = [];
//
//    const rawPatients = await client.getAllPatientsUsingGET({
//        projection: 'SUMMARY',
//        pageSize: pageSize,
//        pageNumber: page,
//    });
//
//    //console.log(rawPatients)
//
//    // GET ALL MOLECULAR PROFILE IDS
//
//    //const currentMolecularProfiles = client.getAllMolecularProfilesInStudyUsingGET({
//    //    studyId: clinicalDataDict.studyId,
//    //});
//    const molecularProfiles: MolecularProfile[] = await client.getAllMolecularProfilesUsingGET(
//        {
//            projection: 'SUMMARY',
//        }
//    );
//
//    rawPatients.forEach(async patient => {
//        (async function(patient) {
//            // GET CLINICAL DATA
//            const currentClinicalData = await client.getAllClinicalDataOfPatientInStudyUsingGET(
//                {
//                    studyId: patient.studyId,
//                    patientId: patient.patientId,
//                }
//            );
//            const clinicalDataDict = clinicalData2Dict(currentClinicalData);
//
//            //console.group('### TEST ###');
//            //console.log(clinicalDataDict)
//            //console.groupEnd();
//
//            // GET SAMPLE IDS / molecular profile ids
//
//            const mutationalProfile = findMolecularProfile(
//                molecularProfiles,
//                patient.studyId,
//                AlterationTypeConstants.MUTATION_EXTENDED
//            );
//
//            const samples = await fetchSamplesForPatient(
//                patient.studyId,
//                patient.patientId
//            );
//            const currentSamples = samples.map(el => el.sampleId);
//
//            // GET MUTATIONS
//            const mutationFilter = {
//                sampleIds: currentSamples,
//            } as MutationFilter;
//            const mutationData = await fetchMutationData(
//                mutationFilter,
//                mutationalProfile?.molecularProfileId
//            );
//
//            // COLLECT DATA
//            patients.push({
//                patient_id: patient.patientId,
//                study_id: patient.studyId,
//                age: getOrDefault(clinicalDataDict, 'AGE', undefined, Number),
//                gender: getOrDefault(clinicalDataDict, 'GENDER'),
//                name: getOrDefault(clinicalDataDict, 'PATIENT_DISPLAY_NAME'),
//                cancertype: getOrDefault(clinicalDataDict, 'TEST'),
//                mutationData: [],
//            });
//        })(patient);
//    });
//
//    return patients;
//}

function findMolecularProfile(
    molecularProfiles: MolecularProfile[],
    studyId: string,
    type: string
): MolecularProfile | undefined {
    if (!molecularProfiles) {
        return undefined;
    }

    const profile = molecularProfiles.find((profile: MolecularProfile) => {
        return (
            profile.molecularAlterationType === type &&
            profile.studyId === studyId
        );
    });

    return profile;
}

export function getOrDefault(
    dict: { [id: string]: any },
    key: string,
    dflt: any = undefined,
    conversion = (x: any) => {
        return x;
    }
) {
    return key in dict ? conversion(dict[key]) : dflt;
}

export function clinicalData2Dict(clinicalData: ClinicalData[]) {
    var result: { [id: string]: string } = {};
    clinicalData.forEach(currentData => {
        result[currentData.clinicalAttributeId] = currentData.value;
    });
    return result;
}

//export async function fetchSimilarPatientsPage(url: string) {
//    console.log('### similar patient ### Calling GET: ' + url);
//    return request
//        .get(url)
//        .timeout(120000)
//        .then(res => {
//            if (res.ok) {
//                console.group('### similar patient ### Success GETting ' + url);
//                console.log(JSON.parse(res.text));
//                console.groupEnd();
//                const response = JSON.parse(res.text);
//                return [] as SimilarPatient[];
//            } else {
//                console.group(
//                    '### similar patient ### ERROR res not ok GETting ' + url
//                );
//                console.log(JSON.parse(res.text));
//                console.groupEnd();
//
//                return [] as SimilarPatient[];
//            }
//        })
//        .catch(err => {
//            console.group('### similar patient ### ERROR catched GETting ' + url);
//            console.log(err);
//            console.groupEnd();
//
//            return [] as SimilarPatient[];
//        });
//}
