import * as React from 'react';
import { observable } from 'mobx';
import { PatientViewPageStore } from '../clinicalInformation/PatientViewPageStore';
import { observer } from 'mobx-react';
import { Link } from 'react-router-dom';
import { Collapse } from 'react-bootstrap';
import LazyMobXTable from 'shared/components/lazyMobXTable/LazyMobXTable';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { Button } from 'react-bootstrap';
import { IClinicalTrial } from 'cbioportal-utils';
import {
    SimilarPatient,
    TaggedMutation,
    SimilarMutation,
} from 'shared/api/SimilarPatientsAPI';
import { getServerConfig } from 'config/config';
import { MutationSelect } from './MutationSelect';
import {
    PatientSimilarityMutationTable,
    SimilarMutationColumnType,
} from './newPatientSimilarityMutationTable';
import {
    getSimilarMutations,
    filterSimilarMutations,
} from './patientSimilarityUtils';

import { remoteData } from 'cbioportal-frontend-commons';
import { sleep } from 'shared/lib/TimeUtils';
import {
    ClinicalData,
    CBioPortalAPI,
    MutationFilter,
    Mutation,
    MolecularProfile,
} from 'cbioportal-ts-api-client';
import { ITherapyRecommendation, IGeneticAlteration } from 'cbioportal-utils';
import SampleManager from 'pages/patientView/SampleManager';
import { getPatientViewUrl, getSampleViewUrl } from 'shared/api/urls';
import { mergeMutations } from 'shared/lib/StoreUtils';
import { MutationTableColumnType } from 'shared/components/mutationTable/MutationTable';
import styles from './styles.module.scss';

enum ColumnKey {
    //patient_id: string;
    //study_id: string;
    //age: number;
    //gender: string;
    //name: string;
    //cancertype: string;
    STUDY = 'study',
    NAME = 'name',
    AGE = 'age',
    GENDER = 'gender',
    CANCERTYPE = 'cancertype',
    COMMONVARIANTS = 'common variants',
}

interface PatientSimilarityProps {
    store: PatientViewPageStore;
    similarPatients: SimilarPatient[];
    sampleManager: SampleManager | null;
}

export type PatientSimilarityTableState = {
    selectedMutations: IGeneticAlteration[];
    currentSimilarPatients: SimilarPatient[];
    selectedSimilarPatient: SimilarPatient | undefined;
    similarMutations: SimilarMutation[];
};

class SimilarPatientTableComponent extends LazyMobXTable<SimilarPatient> {}

@observer
export class PatientSimilarityTable extends React.Component<
    PatientSimilarityProps,
    PatientSimilarityTableState,
    {}
> {
    private readonly ENTRIES_PER_PAGE = 10;
    private readonly _columns = [
        {
            name: ColumnKey.STUDY,
            render: (patient: SimilarPatient, i: any) => (
                <div
                    onClick={() => {
                        this.selectPatient(i);
                    }}
                >
                    {patient.study_id}
                </div>
            ),
            width: 250,
            resizable: true,
        },
        {
            name: ColumnKey.NAME,
            render: (patient: SimilarPatient) => (
                <a
                    href={getPatientViewUrl(
                        patient.study_id,
                        patient.patient_id
                    )}
                    target="_blank"
                >
                    {patient.name}
                </a>
            ),
            width: 250,
            resizable: true,
        },
        {
            name: ColumnKey.AGE,
            render: (patient: SimilarPatient) => <div>{patient.age}</div>,
            width: 250,
            resizable: true,
        },
        {
            name: ColumnKey.GENDER,
            render: (patient: SimilarPatient) => <div>{patient.gender}</div>,
            width: 250,
            resizable: true,
        },
        {
            name: ColumnKey.CANCERTYPE,
            render: (patient: SimilarPatient) => (
                <div>{patient.cancertype}</div>
            ),
            width: 250,
            resizable: true,
        },
        {
            name: ColumnKey.COMMONVARIANTS,
            render: (patient: SimilarPatient) => (
                <div>
                    {filterSimilarMutations(
                        getSimilarMutations(
                            this.props.store.mergedMutationData,
                            mergeMutations(patient.mutationData)
                        ),
                        ['equal', 'phgvs']
                    ).map((mutation: SimilarMutation) => {
                        return (
                            <div>
                                {[
                                    mutation.mutations1[0].gene.hugoGeneSymbol,
                                    mutation.mutations1[0].proteinChange,
                                ].join(' ')}
                            </div>
                        );
                    })}
                </div>
            ),
            width: 250,
            resizable: true,
        },
    ];

    constructor(props: PatientSimilarityProps) {
        super(props);
        this.state = {
            selectedSimilarPatient: undefined,
            similarMutations: [], // used for mutation table
            selectedMutations: new Array<IGeneticAlteration>(), // used for search
            currentSimilarPatients: this.props.similarPatients,
        };
        this.selectPatient(0);
    }

    startSearch() {
        var newSimilarPatients: SimilarPatient[] = [];
        var didFilter: boolean = false;

        if (this.state.selectedMutations.length > 0) {
            for (const similarPatient of this.props.similarPatients) {
                var addPatient = true;
                for (const alteration of this.state.selectedMutations) {
                    const foundMutation = similarPatient.mutationData.find(
                        (currentAlteration: Mutation) => {
                            if (
                                alteration.chromosome ===
                                    currentAlteration.chr &&
                                alteration.start ===
                                    currentAlteration.startPosition &&
                                alteration.ref ===
                                    currentAlteration.referenceAllele &&
                                alteration.alt ===
                                    currentAlteration.variantAllele
                            ) {
                                return true;
                            }
                        }
                    );
                    if (!foundMutation) {
                        addPatient = false;
                        break;
                    }
                }

                if (addPatient) {
                    newSimilarPatients.push(similarPatient);
                }
            }

            didFilter = true;
        }

        if (!didFilter) {
            newSimilarPatients = this.props.similarPatients;
        }
        this.setState({
            currentSimilarPatients: newSimilarPatients,
        });
    }

    selectPatient(i: number) {
        // i == position of similar patient in currentSimilarPatients state

        const selectedSimilarPatient = this.state.currentSimilarPatients[i];
        const mergedSimilarMutations = mergeMutations(
            selectedSimilarPatient.mutationData
        );
        const similarMutations = getSimilarMutations(
            this.props.store.mergedMutationData,
            mergedSimilarMutations
        );
        const filteredSimilarMutations = filterSimilarMutations(
            similarMutations,
            ['equal', 'phgvs', 'pathway', 'gene']
        );

        console.group('### TEST RELOAD PATIENTS ###');
        console.log(mergedSimilarMutations);
        console.groupEnd();

        this.setState({
            selectedSimilarPatient: selectedSimilarPatient,
            similarMutations: filteredSimilarMutations,
        });
    }

    private getVisibleColumns(): { [columnId: string]: boolean } {
        let result = {} as { [columnId: string]: boolean };

        const visibleColumns = [] as SimilarMutationColumnType[];
        for (const colId of visibleColumns) {
            result[colId] = true;
        }

        const invisibleColumns = [] as SimilarMutationColumnType[];
        for (const colId of invisibleColumns) {
            result[colId] = false;
        }
        return result;
    }

    render() {
        return (
            <div>
                <div style={{ padding: '3px' }}>
                    <div>
                        <b>Mutations: </b>
                        <MutationSelect
                            mutations={this.props.store.mutationData.result}
                            cna={this.props.store.discreteCNAData.result}
                            data={[]}
                            indexedVariantAnnotations={
                                this.props.store.indexedVariantAnnotations
                                    .result
                            }
                            indexedMyVariantInfoAnnotations={
                                this.props.store.indexedMyVariantInfoAnnotations
                                    .result
                            }
                            onChange={(
                                selectedOptions: IGeneticAlteration[]
                            ) => {
                                this.setState({
                                    selectedMutations: selectedOptions,
                                });
                            }}
                            sampleManager={this.props.sampleManager}
                        ></MutationSelect>
                    </div>
                    <div>
                        <button
                            onClick={() => {
                                this.startSearch();
                            }}
                            className={'btn btn-default'}
                        >
                            Search
                        </button>
                    </div>
                </div>
                <div>
                    <SimilarPatientTableComponent
                        showCopyDownload={false}
                        data={this.state.currentSimilarPatients} //
                        columns={this._columns}
                        initialItemsPerPage={this.ENTRIES_PER_PAGE}
                    />
                </div>
                <div>
                    <PatientSimilarityMutationTable
                        //data={this.props.store.mergedMutationData} //{this.props.store.mergedMutationData} mergeMutations(this.state.selectedSimilarPatient.mutationData)
                        data={this.state.similarMutations}
                        // reference mutations
                        sampleManager1={this.props.sampleManager}
                        sampleToGenePanelId1={
                            this.props.store.sampleToMutationGenePanelId.result
                        }
                        genePanelIdToEntrezGeneIds1={
                            this.props.store.genePanelIdToEntrezGeneIds.result
                        }
                        sampleIds1={this.props.store.sampleIds}
                        // comparison mutations
                        sampleManager2={this.props.sampleManager}
                        sampleToGenePanelId2={
                            this.props.store.sampleToMutationGenePanelId.result
                        }
                        genePanelIdToEntrezGeneIds2={
                            this.props.store.genePanelIdToEntrezGeneIds.result
                        }
                        sampleIds2={this.props.store.sampleIds}
                        // misc
                        //usingPublicOncoKbInstance={false}
                        //generateGenomeNexusHgvsgUrl={this.props.store.generateGenomeNexusHgvsgUrl}
                        columnVisibility={this.getVisibleColumns()}
                        rowColorFunc={(d: SimilarMutation) => {
                            switch (d.similarityTag) {
                                case 'equal':
                                    return styles.bg_comparisonEqual;
                                case 'gene':
                                    return styles.bg_comparisonGene;
                                case 'pathway':
                                    return styles.bg_comparisonPathway;
                                case 'phgvs':
                                    return styles.bg_comparisonPhgvs;
                                default:
                                    return styles.bg_comparisonUnequal;
                            }
                        }}

                        //customDriverName={
                        //    getServerConfig()
                        //        .oncoprint_custom_driver_annotation_binary_menu_label!
                        //}
                        //customDriverDescription={
                        //    getServerConfig()
                        //        .oncoprint_custom_driver_annotation_binary_menu_description!
                        //}
                        //customDriverTiersName={
                        //    getServerConfig()
                        //        .oncoprint_custom_driver_annotation_tiers_menu_label!
                        //}
                        //customDriverTiersDescription={
                        //    getServerConfig()
                        //        .oncoprint_custom_driver_annotation_tiers_menu_description!
                        //}
                    />
                </div>
            </div>
        );
    }
}

//const PatientSimilarityTable = (props: PatientSimilarityProps) => {
//    const [currentPage, setCurrentPage] = React.useState(0);
//    const [perPage, setPerPage] = React.useState(1);
//    const [totalPages, setTotalPages] = React.useState(2);
//    const [patients, setPatients] = React.useState<SimilarPatient[]>([]);
//
//    const _columns = [
//        {
//            name: ColumnKey.STUDY,
//            render: (patient: SimilarPatient) => <div>{patient.study_id}</div>,
//            width: 250,
//            resizable: true,
//        },
//        {
//            name: ColumnKey.NAME,
//            render: (patient: SimilarPatient) => <div>{patient.name}</div>,
//            width: 250,
//            resizable: true,
//        },
//        {
//            name: ColumnKey.AGE,
//            render: (patient: SimilarPatient) => <div>{patient.age}</div>,
//            width: 250,
//            resizable: true,
//        },
//        {
//            name: ColumnKey.GENDER,
//            render: (patient: SimilarPatient) => <div>{patient.gender}</div>,
//            width: 250,
//            resizable: true,
//        },
//        {
//            name: ColumnKey.CANCERTYPE,
//            render: (patient: SimilarPatient) => (
//                <div>{patient.cancertype}</div>
//            ),
//            width: 250,
//            resizable: true,
//        },
//    ];
//
//    React.useEffect(() => {
//        function sleep(ms: number) {
//            return new Promise(resolve => setTimeout(resolve, ms));
//        }
//
//        // fetch data
//        (async function() {
//            try {
//
//
//                const patients = await fetchPatientsPage(
//                    currentPage,
//                    perPage
//                );
//                //await sleep(50); // sometimes the re-render would not be triggered when fetch was too fast... any ideas why this happens?
//
//                console.group('### TEST RELOAD PATIENTS ###');
//                console.log(patients)
//                console.log(patients.length)
//                console.groupEnd();
//
//                setPatients(patients);
//                setTotalPages(2);
//
//            } catch (error) {
//                console.error('Error fetching data:', error);
//            }
//        })();
//    }, [currentPage, perPage]);
//
//    const handlePrevPage = () => {
//        if (currentPage > 0) {
//            setCurrentPage(currentPage - 1);
//        }
//    };
//
//    const handleNextPage = () => {
//        if (currentPage < totalPages) {
//            setCurrentPage(currentPage + 1);
//        }
//    };
//
//    return (
//        <div>
//            {/* Display table */}
//            <div>{currentPage}</div>
//            <div>{JSON.stringify(patients)}</div>
//            <SimilarPatientTableComponent
//                showCopyDownload={false}
//                data={patients} //
//                columns={_columns}
//                initialItemsPerPage={perPage}
//                showFilter={false}
//                showPagination={false}
//            />
//
//            {/* Pagination controls */}
//            <button onClick={handlePrevPage} disabled={currentPage === 0}>
//                Previous Page
//            </button>
//            <button
//                onClick={handleNextPage}
//                disabled={currentPage === totalPages - 1}
//            >
//                Next Page
//            </button>
//        </div>
//    );
//};
//
//export default PatientSimilarityTable;
//
