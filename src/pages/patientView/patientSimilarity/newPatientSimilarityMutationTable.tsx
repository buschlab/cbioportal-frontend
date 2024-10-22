import * as React from 'react';
import { computed, makeObservable, observable } from 'mobx';
import {
    default as MutationTable,
    IMutationTableProps,
    MutationTableColumn,
    MutationTableColumnType,
    ExtendedMutationTableColumnType,
} from 'shared/components/mutationTable/MutationTable';
import {
    default as PatientViewMutationTable,
    IPatientViewMutationTableProps,
} from '../mutation/PatientViewMutationTable';
import SampleManager from '../SampleManager';
import { Mutation } from 'cbioportal-ts-api-client';
import AlleleCountColumnFormatter from 'shared/components/mutationTable/column/AlleleCountColumnFormatter';
import AlleleFreqColumnFormatter from '../mutation/column/AlleleFreqColumnFormatter';
import TumorColumnFormatter from '../mutation/column/TumorColumnFormatter';
import ChromosomeColumnFormatter from 'shared/components/mutationTable/column/ChromosomeColumnFormatter';
import PanelColumnFormatter from 'shared/components/mutationTable/column/PanelColumnFormatter';
import { isUncalled } from 'shared/lib/MutationUtils';
import ExonColumnFormatter from 'shared/components/mutationTable/column/ExonColumnFormatter';
import { getDefaultASCNCopyNumberColumnDefinition } from 'shared/components/mutationTable/column/ascnCopyNumber/ASCNCopyNumberColumnFormatter';
import { getDefaultCancerCellFractionColumnDefinition } from 'shared/components/mutationTable/column/cancerCellFraction/CancerCellFractionColumnFormatter';
import { getDefaultClonalColumnDefinition } from 'shared/components/mutationTable/column/clonal/ClonalColumnFormatter';
import { getDefaultExpectedAltCopiesColumnDefinition } from 'shared/components/mutationTable/column/expectedAltCopies/ExpectedAltCopiesColumnFormatter';
import { ASCNAttributes } from 'shared/enums/ASCNEnums';
import AnnotationHeader from 'shared/components/mutationTable/column/annotation/AnnotationHeader';
import _ from 'lodash';
import { createMutationNamespaceColumns } from 'shared/components/mutationTable/MutationTableUtils';
import { getServerConfig } from 'config/config';
import { adjustVisibility } from 'shared/components/alterationsTableUtils';
import { SimilarMutation } from 'shared/api/SimilarPatientsAPI';
import { GeneFilterOption } from '../mutation/GeneFilterMenu';
import LazyMobXTable, {
    Column,
    LazyMobXTableProps,
} from 'shared/components/lazyMobXTable/LazyMobXTable';
import { observer } from 'mobx-react';
import autobind from 'autobind-decorator';
import generalStyles from 'shared/components/mutationTable/column/styles.module.scss';

export interface IPatientSimilarityMutationTableProps
    extends LazyMobXTableProps<SimilarMutation> {
    // general
    data?: SimilarMutation[];

    // reference mutations
    sampleManager1: SampleManager | null;
    sampleToGenePanelId1: { [sampleId: string]: string | undefined };
    genePanelIdToEntrezGeneIds1: { [genePanelId: string]: number[] };
    sampleIds1?: string[];

    // comparison mutations
    sampleManager2: SampleManager | null;
    sampleToGenePanelId2: { [sampleId: string]: string | undefined };
    genePanelIdToEntrezGeneIds2: { [genePanelId: string]: number[] };
    sampleIds2?: string[];

    // annotations
    //usingPublicOncoKbInstance: boolean;
    //generateGenomeNexusHgvsgUrl: (hgvsg: string) => string;

    // misc
}

export enum SimilarMutationColumnType {
    SIMILARITYTAG = 'Tag',

    // reference
    CHROM = 'Chrom',
    START = 'Start',
    REF = 'Ref',
    ALT = 'Alt',

    // comparison
    COMPCHROM = 'Chrom2',
    COMPSTART = 'Start2',
    COMPREF = 'Ref2',
    COMPALT = 'Alt2',
}

export type ExtendedColumnType = SimilarMutationColumnType | string;

export class PatientSimilarityMutationTableComponent extends LazyMobXTable<
    SimilarMutation
> {}

@observer
export class PatientSimilarityMutationTable extends React.Component<
    IPatientSimilarityMutationTableProps,
    {}
> {
    @observable.ref public table: LazyMobXTable<SimilarMutation> | null = null;
    protected _columns: Record<ExtendedColumnType, Column<SimilarMutation>>;
    constructor(props: IPatientSimilarityMutationTableProps) {
        super(props);
        makeObservable(this);
        this._columns = {};
        this.generateColumns();
    }

    @autobind
    private tableRef(t: LazyMobXTable<SimilarMutation> | null) {
        this.table = t;
    }

    public static defaultProps = {
        ...MutationTable.defaultProps,
        columns: [
            //MutationTableColumnType.COHORT,
            ////MutationTableColumnType.MRNA_EXPR,
            //MutationTableColumnType.COPY_NUM,
            //MutationTableColumnType.ANNOTATION,
            //MutationTableColumnType.CUSTOM_DRIVER,
            //MutationTableColumnType.CUSTOM_DRIVER_TIER,
            //MutationTableColumnType.HGVSG,
            //MutationTableColumnType.REF_READS_N,
            //MutationTableColumnType.VAR_READS_N,
            //MutationTableColumnType.REF_READS,
            //MutationTableColumnType.VAR_READS,
            //MutationTableColumnType.START_POS,
            //MutationTableColumnType.END_POS,
            //MutationTableColumnType.REF_ALLELE,
            //MutationTableColumnType.VAR_ALLELE,
            //MutationTableColumnType.MUTATION_STATUS,
            //MutationTableColumnType.VALIDATION_STATUS,
            //MutationTableColumnType.CENTER,
            //MutationTableColumnType.GENE,
            //MutationTableColumnType.CHROMOSOME,
            //MutationTableColumnType.PROTEIN_CHANGE,
            //MutationTableColumnType.MUTATION_TYPE,
            //MutationTableColumnType.VARIANT_TYPE,
            //MutationTableColumnType.FUNCTIONAL_IMPACT,
            //MutationTableColumnType.COSMIC,
            //MutationTableColumnType.TUMOR_ALLELE_FREQ,
            //MutationTableColumnType.SAMPLES,
            //MutationTableColumnType.EXON,
            //MutationTableColumnType.HGVSC,
            //MutationTableColumnType.GNOMAD,
            //MutationTableColumnType.CLINVAR,
            //MutationTableColumnType.DBSNP,
            //MutationTableColumnType.GENE_PANEL,
            //MutationTableColumnType.SIGNAL,

            SimilarMutationColumnType.SIMILARITYTAG,
            SimilarMutationColumnType.CHROM,
            SimilarMutationColumnType.START,
            SimilarMutationColumnType.REF,
            SimilarMutationColumnType.ALT,
        ],
    };

    protected getSamples(): string[] {
        if (this.props.sampleIds1) {
            return this.props.sampleIds1;
        } else {
            return [];
        }
    }

    protected getMutationData(
        similarMutation: SimilarMutation,
        mutations: string
    ): Mutation[] {
        return similarMutation[
            mutations as keyof SimilarMutation
        ] as Mutation[];
    }

    protected getMutationDataString(
        similarMutation: SimilarMutation,
        mutations: string,
        key: string
    ): string | null {
        const data = this.getMutationData(similarMutation, mutations);
        if (data.length > 0) {
            return data[0][key as keyof Mutation] as string;
        } else {
            return null;
        }
    }

    protected getSimilarMutationDataTag(
        similarMutation: SimilarMutation
    ): string | null {
        return similarMutation.similarityTag;
    }

    protected generateColumns() {
        // general columns
        this._columns[SimilarMutationColumnType.SIMILARITYTAG] = {
            name: SimilarMutationColumnType.SIMILARITYTAG,
            render: (d: SimilarMutation) => {
                return <div>{d.similarityTag}</div>;
            },
            download: (d: SimilarMutation) => d.similarityTag,
            sortBy: (d: SimilarMutation) => d.similarityTag,
            filter: (
                d: SimilarMutation,
                filterString: string,
                filterStringUpper: string
            ) => d.similarityTag.toUpperCase().includes(filterStringUpper),
            visible: true,
            align: 'right',
        };

        // reference mutation
        this._columns[SimilarMutationColumnType.CHROM] = {
            name: SimilarMutationColumnType.CHROM,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div className={generalStyles['integer-data']}>
                        {ChromosomeColumnFormatter.getData(
                            this.getMutationData(d, 'mutations1')
                        )}
                    </div>
                );
            },
            download: (d: SimilarMutation) =>
                ChromosomeColumnFormatter.getData(
                    this.getMutationData(d, 'mutations1')
                ) || '',
            sortBy: (d: SimilarMutation) =>
                ChromosomeColumnFormatter.getSortValue(
                    this.getMutationData(d, 'mutations1')
                ),
            filter: (
                d: SimilarMutation,
                filterString: string,
                filterStringUpper: string
            ) =>
                (
                    ChromosomeColumnFormatter.getData(
                        this.getMutationData(d, 'mutations1')
                    ) + ''
                )
                    .toUpperCase()
                    .includes(filterStringUpper),
            visible: true,
            align: 'right',
        };
        this._columns[SimilarMutationColumnType.START] = {
            name: SimilarMutationColumnType.START,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'startPosition'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[SimilarMutationColumnType.REF] = {
            name: SimilarMutationColumnType.REF,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'referenceAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[SimilarMutationColumnType.ALT] = {
            name: SimilarMutationColumnType.ALT,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations1',
                            'variantAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };

        // comparison mutation
        this._columns[SimilarMutationColumnType.COMPCHROM] = {
            name: SimilarMutationColumnType.COMPCHROM,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(d, 'mutations2', 'chr')}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[SimilarMutationColumnType.COMPSTART] = {
            name: SimilarMutationColumnType.COMPSTART,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'startPosition'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[SimilarMutationColumnType.COMPREF] = {
            name: SimilarMutationColumnType.COMPREF,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'referenceAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[SimilarMutationColumnType.COMPALT] = {
            name: SimilarMutationColumnType.COMPALT,
            render: (d: SimilarMutation, i: number) => {
                return (
                    <div>
                        {this.getMutationDataString(
                            d,
                            'mutations2',
                            'variantAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };

        // reference mutation columns
        //this._columns[MutationTableColumnType.SAMPLES] = {
        //    name: MutationTableColumnType.SAMPLES,
        //    render: (d: SimilarMutation) =>
        //        TumorColumnFormatter.renderFunction(
        //            d,
        //            this.props.sampleManager,
        //            this.props.sampleToGenePanelId,
        //            this.props.genePanelIdToEntrezGeneIds,
        //            this.props.onSelectGenePanel,
        //            this.props.disableTooltip
        //        ),
        //    sortBy: (d: SimilarMutation) =>
        //        TumorColumnFormatter.getSortValue(d, this.props.sampleManager),
        //    download: (d: SimilarMutation) => TumorColumnFormatter.getSample(d),
        //    resizable: true,
        //};

        //const GenePanelProps = (d: SimilarMutation) => ({
        //    data: d,
        //    sampleToGenePanelId: this.props.sampleToGenePanelId,
        //    sampleManager: this.props.sampleManager,
        //    genePanelIdToGene: this.props.genePanelIdToEntrezGeneIds,
        //    onSelectGenePanel: this.props.onSelectGenePanel,
        //});

        //this._columns[MutationTableColumnType.GENE_PANEL] = {
        //    name: MutationTableColumnType.GENE_PANEL,
        //    render: (d: SimilarMutation) =>
        //        PanelColumnFormatter.renderFunction(GenePanelProps(d)),
        //    download: (d: SimilarMutation) =>
        //        PanelColumnFormatter.download(GenePanelProps(d)),
        //    visible: false,
        //    sortBy: (d: SimilarMutation) =>
        //        PanelColumnFormatter.getGenePanelIds(GenePanelProps(d)),
        //};

        //this._columns[MutationTableColumnType.SAMPLES].shouldExclude = () => {
        //    return this.getSamples().length < 2;
        //};

        // order columns
        //this._columns[MutationTableColumnType.SAMPLES].order = 5,
        //this._columns[MutationTableColumnType.GENE_PANEL].order = 10,
        //this._columns[MutationTableColumnType.CENTER].order = 15,

        (this._columns[SimilarMutationColumnType.SIMILARITYTAG].order = 19),
            //this._columns[MutationTableColumnType.CHROMOSOME].order = 20,
            //this._columns[MutationTableColumnType.START_POS].order = 25,
            //this._columns[MutationTableColumnType.END_POS].order = 30,
            //this._columns[MutationTableColumnType.REF_ALLELE].order = 35,
            //this._columns[MutationTableColumnType.VAR_ALLELE].order = 40,
            //this._columns[MutationTableColumnType.GENE].order = 45,
            //this._columns[MutationTableColumnType.HGVSG].order = 50,
            //this._columns[MutationTableColumnType.HGVSC].order = 55,
            //this._columns[MutationTableColumnType.PROTEIN_CHANGE].order = 60,
            //this._columns[MutationTableColumnType.EXON].order = 65,

            //this._columns[MutationTableColumnType.REF_READS_N].order = 70,
            //this._columns[MutationTableColumnType.VAR_READS_N].order = 75,
            //this._columns[MutationTableColumnType.REF_READS].order = 80,
            //this._columns[MutationTableColumnType.VAR_READS].order = 85,
            //this._columns[MutationTableColumnType.COPY_NUM].order = 90,
            //this._columns[MutationTableColumnType.MUTATION_STATUS].order = 95,
            //this._columns[MutationTableColumnType.VALIDATION_STATUS].order = 100,
            //this._columns[MutationTableColumnType.TUMOR_ALLELE_FREQ].order = 105,
            //this._columns[MutationTableColumnType.COHORT].order = 110,

            //this._columns[MutationTableColumnType.CUSTOM_DRIVER_TIER].order = 115,
            //this._columns[MutationTableColumnType.MUTATION_TYPE].order = 120,
            //this._columns[MutationTableColumnType.VARIANT_TYPE].order = 125,
            //this._columns[MutationTableColumnType.FUNCTIONAL_IMPACT].order = 130,
            ////this._columns[MutationTableColumnType.MRNA_EXPR].order =

            //this._columns[MutationTableColumnType.ANNOTATION].order = 135,
            //this._columns[MutationTableColumnType.COSMIC].order = 140,
            //this._columns[MutationTableColumnType.GNOMAD].order = 145,
            //this._columns[MutationTableColumnType.CLINVAR].order = 150,
            //this._columns[MutationTableColumnType.DBSNP].order = 155,
            //this._columns[MutationTableColumnType.SIGNAL].order = 160,

            (this._columns[SimilarMutationColumnType.CHROM].order = 165),
            (this._columns[SimilarMutationColumnType.START].order = 170),
            (this._columns[SimilarMutationColumnType.REF].order = 175),
            (this._columns[SimilarMutationColumnType.ALT].order = 180);
    }

    @computed protected get columns(): Column<SimilarMutation>[] {
        return _.values(this._columns);
    }

    public render() {
        return (
            <PatientSimilarityMutationTableComponent
                ref={this.tableRef}
                columns={this.columns}
                data={this.props.data}
                dataStore={this.props.dataStore}
                downloadDataFetcher={this.props.downloadDataFetcher}
                initialItemsPerPage={this.props.initialItemsPerPage}
                initialSortColumn={this.props.initialSortColumn}
                initialSortDirection={this.props.initialSortDirection}
                itemsLabel={this.props.itemsLabel}
                itemsLabelPlural={this.props.itemsLabelPlural}
                paginationProps={this.props.paginationProps}
                showCountHeader={this.props.showCountHeader}
                columnVisibility={this.props.columnVisibility}
                columnVisibilityProps={this.props.columnVisibilityProps}
                storeColumnVisibility={this.props.storeColumnVisibility}
                onRowClick={this.props.onRowClick}
                onRowMouseEnter={this.props.onRowMouseEnter}
                onRowMouseLeave={this.props.onRowMouseLeave}
                columnToHeaderFilterIconModal={
                    this.props.columnToHeaderFilterIconModal
                }
                deactivateColumnFilter={this.props.deactivateColumnFilter}
                customControls={this.props.customControls}
                showCopyDownload={false}
                rowColorFunc={this.props.rowColorFunc}
            />
        );
    }
}
