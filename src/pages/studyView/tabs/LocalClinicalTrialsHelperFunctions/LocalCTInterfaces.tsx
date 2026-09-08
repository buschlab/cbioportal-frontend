// This file defines TypeScript interfaces for the local clinical trials feature, including data structures for mutations, copy number alterations, structural variants, and filters for age and OQL criteria. These interfaces are used to ensure type safety when working with local clinical trial data in the application.
import {
    Mutation,
    Gene,
    NumericGeneMolecularData,
    StructuralVariant,
} from 'cbioportal-ts-api-client';
import { clinicalTrial } from './LocalCT';

// Helper function to get CNV type
export declare type NumericGeneMolecularDataWithStatus = NumericGeneMolecularData & {
    copyNumberStatus: 'AMP' | 'GAIN' | 'HETLOSS' | 'HOMDEL' | 'NEUTRAL';
};

// Search interface for mutations and CNA
export interface MutationsPerPatient {
    mutations: Mutation[];
    cnaExt: NumericGeneMolecularDataWithStatus[];
    sv: StructuralVariant[];
}

// This interface defines the structure of an alteration, which can be a mutation, copy number alteration, or structural variant, and includes relevant information such as gene, patient ID, sample ID, alteration type, and specific details depending on the alteration type.
export interface Alteration {
    gene: Gene;
    patientId: string;
    sampleId: string;

    alterationType:
        | 'Mutation'
        | 'Copy Number Alteration'
        | 'Structural Variant'
        | 'Clinical';

    // mutation fields
    proteinChange?: string;
    mutationType?: string;

    // CNA
    cna?: number;

    // fusion / SV
    fusion?: boolean;
    partnerGene?: Gene;

    //clinical
    clinicalParameterId?: string;
    clinicalParameterName?: string;
    clinicalParameterDataType?: 'string' | 'number';
    clinicalParameterOperator?:
        | '>'
        | '>='
        | '<'
        | '<='
        | '='
        | '!='
        | 'contains';
    clinicalParameterValue?: string | number;
}

// This interface defines the shape of a clinical match entry, used to track which clinical filter matched and with which value.
export interface ClinicalMatch {
    sampleId: string;
    patientId: string;
    filter: ClinicalFilter;
    value: string;
}

// This interface defines the structure of the age filter that can be applied to clinical trial matching, including minimum and maximum age, as well as optional trial information for context.
export interface AgeFilter {
    min_age?: number;
    max_age?: number;
    trialName?: string;
    trialURL?: string;
}

// This interface defines the structure of the OQL filter that will be used to match patient alterations against trial criteria, including gene, alteration type, criterion type (inclusion or exclusion), and optional trial information.
export interface OQLFilter {
    gene: string;
    alterationType:
        | 'Mutation'
        | 'Copy Number Alteration'
        | 'Structural Variant';
    criterionType: 'incl' | 'excl';
    trialName?: string;
    trialURL?: string;

    proteinChange?: string;
    mutationType?: string;

    cnaType?: string;

    fusionPartner?: string;
}

// This interface defines the structure of a clinical filter that can be applied to match patients against trial criteria based on clinical parameters, including the parameter name, data type, operator, value, and criterion type (inclusion or exclusion), along with optional trial information for context.
// Generic syntax:
// Clinical:{parameterName}:{dataType}:{operator}:{value}
// Specific examples for json representation of a clinical criterion:
// Clinical:HLA-Type:string:contains:HLA-A*02\:01 -> Here the backslash is used to escape the colons in the HLA type, which is necessary for parsing the criterion correctly. The criterion specifies that the patient's HLA type should contain "HLA-A*02:01" for inclusion in the trial.
// Clinical:TMB:number:>:10
export interface ClinicalFilter {
    clinicalParameterId: string;
    clinicalParameterName: string;
    clinicalParameterDataType: 'string' | 'number';
    clinicalParameterOperator:
        | '>'
        | '>='
        | '<'
        | '<='
        | '='
        | '!='
        | 'contains';
    clinicalParameterValue: string | number;

    criterionType: 'incl' | 'excl';

    trialName?: string;
    trialURL?: string;
}

// This interface defines the structure of the final result row that will be displayed in the local clinical trials matching table, including patient and sample information, trial details, and molecular alteration data.
export interface FinalResultRow {
    studyId: string;
    patientId: string;
    patientDisplayName?: string | undefined;
    age: string;
    ageNotes?: string;
    sampleId: string;
    trial: string;
    trialURL: string;
    gene: string;
    alterationType: Alteration['alterationType'];
    mutationType: string;
    alteration: string;
}

export interface FinalResultRowClinicalTraitsAndBiomarkers {
    studyId: string;
    patientId: string;
    patientDisplayName?: string | undefined;
    age: string;
    ageNotes?: string;
    sampleId: string;
    trial: string;
    trialURL: string;
    clinicalParameterName: string;
    clinicalParameterValue: string;
}

export interface FilterSet {
    hugoFilter: string[];
    OQLFilterMutation: OQLFilter[];
    OQLFilterCNA: OQLFilter[];
    OQLFilterSV: OQLFilter[];
    clinicalFilter: ClinicalFilter[];
    ageFilter: AgeFilter[];
}

export interface TrialFilters extends FilterSet {
    trial: clinicalTrial;
}

export interface LocalCTBundle {
    trials: clinicalTrial[];
    filtersByTrial: TrialFilters[];
    aggregateFilters: FilterSet;
}
