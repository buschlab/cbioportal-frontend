import * as React from 'react';
import { observable } from 'mobx';
import { PatientViewPageStore } from '../clinicalInformation/PatientViewPageStore';
import { observer } from 'mobx-react';
import { Link } from 'react-router-dom';
import { Collapse } from 'react-bootstrap';
import LazyMobXTable from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { Button } from 'react-bootstrap';
import { IClinicalTrial } from 'cbioportal-utils';
import {
    SimilarPatient,
    fetchPatientsPage,
} from 'shared/api/SimilarPatientsAPI';
import { getServerConfig } from 'config/config';
import { MutationSelect } from './MutationSelect';

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
import { forIn } from 'lodash';

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
            render: (patient: SimilarPatient) => <div>{patient.study_id}</div>,
            width: 250,
            resizable: true,
        },
        {
            name: ColumnKey.NAME,
            render: (patient: SimilarPatient) => <div>{patient.name}</div>,
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
                    {patient.mutationData.map(mutation => {
                        for (const referenceMutation of this.props.store
                            .mutationData.result) {
                            if (
                                referenceMutation.chr === mutation.chr &&
                                referenceMutation.startPosition ===
                                    mutation.startPosition &&
                                referenceMutation.referenceAllele ===
                                    mutation.referenceAllele &&
                                referenceMutation.variantAllele ===
                                    mutation.variantAllele
                            ) {
                                return <div>{mutation.keyword}</div>;
                            }
                        }
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
            selectedMutations: new Array<IGeneticAlteration>(),
            currentSimilarPatients: this.props.similarPatients,
        };
    }

    startSearch() {
        console.group('### start similarity search ###');
        console.log(this.state);
        console.groupEnd();

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
