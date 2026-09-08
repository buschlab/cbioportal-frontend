import * as React from 'react';
import LazyMobXTable from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import {
    LazyMobXTableStore,
    Column,
} from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import { getSampleViewUrl } from '../../../shared/api/urls';
import {
    CNA_COLOR_AMP,
    CNA_COLOR_GAIN,
    CNA_COLOR_HETLOSS,
    CNA_COLOR_HOMDEL,
    MUT_COLOR_INFRAME,
    MUT_COLOR_MISSENSE,
    MUT_COLOR_PROMOTER,
    MUT_COLOR_SPLICE,
    MUT_COLOR_TRUNC,
    STRUCTURAL_VARIANT_COLOR,
} from 'cbioportal-frontend-commons';
import {
    FinalResultRow,
    FinalResultRowClinicalTraitsAndBiomarkers,
} from '../tabs/LocalClinicalTrialsHelperFunctions/LocalCTInterfaces';

const mutationColorMap: Record<string, string> = {
    Missense_Mutation: MUT_COLOR_MISSENSE,
    In_Frame_Del: MUT_COLOR_INFRAME,
    In_Frame_Ins: MUT_COLOR_INFRAME,
    Truncating: MUT_COLOR_TRUNC,
    Splice_Site: MUT_COLOR_SPLICE,
    Promoter: MUT_COLOR_PROMOTER,
    AMP: CNA_COLOR_AMP,
    GAIN: CNA_COLOR_GAIN,
    HOMDEL: CNA_COLOR_HOMDEL,
    HETLOSS: CNA_COLOR_HETLOSS,
    FUSION: STRUCTURAL_VARIANT_COLOR,
};

const AltTypeColorMap: Record<string, string> = {
    Mutation: '#008000',
    'Copy Number Alteration': '#ff0000',
    'Structural Variant': '#8B00C9',
};

interface Props {
    resultsTable: FinalResultRow[];
}

interface PropsClinicalTraitsAndBiomarkers {
    resultsTableClinicalTraitsAndBiomarkers: FinalResultRowClinicalTraitsAndBiomarkers[];
}

export const CTLazyTable: React.FC<Props> = ({ resultsTable }) => {
    const columns: Column<FinalResultRow>[] = [
        {
            name: 'Patient ID',
            render: (m: FinalResultRow) => (
                <a
                    href={getSampleViewUrl(m.studyId, m.sampleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.patientDisplayName
                        ? `${m.patientId} (${m.patientDisplayName})`
                        : m.patientId}
                </a>
            ),
            sortBy: (m: FinalResultRow) => m.patientId,
            filter: (m, filterString) =>
                m.patientId.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Sample ID',
            render: (m: FinalResultRow) => (
                <a
                    href={getSampleViewUrl(m.studyId, m.sampleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.sampleId}
                </a>
            ),
            sortBy: (m: FinalResultRow) => m.sampleId,
            filter: (m, filterString) =>
                m.sampleId.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Matched Trial',
            render: (m: FinalResultRow) => (
                <a href={m.trialURL} target="_blank" rel="noopener noreferrer">
                    {m.trial}
                </a>
            ),
            sortBy: (m: FinalResultRow) => m.trial, // Placeholder for sorting
            filter: (m, filterString) =>
                m.trial.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Gene',
            render: m => <span>{m.gene}</span>,
            sortBy: (m: FinalResultRow) => m.gene || '',
            filter: (m, filterString) =>
                m.gene.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Alteration',
            render: m => {
                const color = mutationColorMap[m.alteration] || 'black';

                return (
                    <span style={{ color, fontWeight: 'bold' }}>
                        {m.alteration}
                    </span>
                );
            },
            sortBy: (m: FinalResultRow) => m.alteration || '',
            filter: (m, filterString) =>
                m.alteration
                    ?.toLowerCase()
                    .includes(filterString.toLowerCase()) || false,
            width: 50,
        },

        {
            name: 'Alteration Description',
            render: (m: FinalResultRow) => {
                const color = mutationColorMap[m.mutationType] || 'black';
                const label = m.mutationType?.replace(/_Mutation/g, ' ');

                return (
                    <span style={{ color, fontWeight: 'bold' }}>{label}</span>
                );
            },
            filter: (m, filterString) =>
                m.mutationType
                    ?.toLowerCase()
                    .includes(filterString.toLowerCase()) || false,
            sortBy: (m: FinalResultRow) => m.mutationType || '',
            width: 50,
        },

        {
            name: 'Alteration Type',
            render: (m: FinalResultRow) => {
                const color = AltTypeColorMap[m.alterationType] || 'black';
                const label = m.alterationType.replace(/_Mutation/g, ' ');

                return (
                    <span style={{ color, fontWeight: 'bold' }}>{label}</span>
                );
            },
            filter: (m, filterString) =>
                m.alterationType
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            sortBy: (m: FinalResultRow) => m.alterationType || '',
            width: 50,
        },

        {
            name: 'Notes',
            render: m => <span>{m.ageNotes}</span>,
            sortBy: (m: FinalResultRow) => m.ageNotes || '',
            width: 100,
            visible: resultsTable.some(m => !!m.ageNotes),
        },
    ];

    return <LazyMobXTable columns={columns} data={resultsTable} />;
};

export const CTLazyTableClinicalTraitsAndBiomarkers: React.FC<PropsClinicalTraitsAndBiomarkers> = ({
    resultsTableClinicalTraitsAndBiomarkers,
}) => {
    const columns: Column<FinalResultRowClinicalTraitsAndBiomarkers>[] = [
        {
            name: 'Patient ID',
            render: (m: FinalResultRowClinicalTraitsAndBiomarkers) => (
                <a
                    href={getSampleViewUrl(m.studyId, m.sampleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.patientDisplayName
                        ? `${m.patientId} (${m.patientDisplayName})`
                        : m.patientId}
                </a>
            ),
            sortBy: (m: FinalResultRowClinicalTraitsAndBiomarkers) =>
                m.patientId,
            filter: (m, filterString) =>
                m.patientId.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Sample ID',
            render: (m: FinalResultRowClinicalTraitsAndBiomarkers) => (
                <a
                    href={getSampleViewUrl(m.studyId, m.sampleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {m.sampleId}
                </a>
            ),
            sortBy: (m: FinalResultRowClinicalTraitsAndBiomarkers) =>
                m.sampleId,
            filter: (m, filterString) =>
                m.sampleId.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Matched Trial',
            render: (m: FinalResultRowClinicalTraitsAndBiomarkers) => (
                <a href={m.trialURL} target="_blank" rel="noopener noreferrer">
                    {m.trial}
                </a>
            ),
            sortBy: (m: FinalResultRowClinicalTraitsAndBiomarkers) => m.trial, // Placeholder for sorting
            filter: (m, filterString) =>
                m.trial.toLowerCase().includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Clinical Parameter / Biomarker',
            render: m => <span>{m.clinicalParameterName}</span>,
            sortBy: (m: FinalResultRowClinicalTraitsAndBiomarkers) =>
                m.clinicalParameterName || '',
            filter: (m, filterString) =>
                m.clinicalParameterName
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 50,
        },

        {
            name: 'Value',
            render: m => {
                const color =
                    mutationColorMap[m.clinicalParameterValue] || 'black';

                return (
                    <span style={{ color, fontWeight: 'bold' }}>
                        {m.clinicalParameterValue}
                    </span>
                );
            },
            sortBy: (m: FinalResultRowClinicalTraitsAndBiomarkers) =>
                m.clinicalParameterValue || '',
            filter: (m, filterString) =>
                m.clinicalParameterValue
                    ?.toString()
                    ?.toLowerCase()
                    .includes(filterString.toLowerCase()) || false,
            width: 50,
        },
        {
            name: 'Notes',
            render: m => <span>{m.ageNotes}</span>,
            sortBy: (m: FinalResultRowClinicalTraitsAndBiomarkers) =>
                m.ageNotes || '',
            width: 100,
            visible: resultsTableClinicalTraitsAndBiomarkers.some(
                m => !!m.ageNotes
            ),
        },
    ];

    return (
        <LazyMobXTable
            columns={columns}
            data={resultsTableClinicalTraitsAndBiomarkers}
        />
    );
};

export default CTLazyTable;
