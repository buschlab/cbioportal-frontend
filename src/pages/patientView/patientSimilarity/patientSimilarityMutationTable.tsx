import * as React from 'react';
import { computed, makeObservable } from 'mobx';
import {
    default as MutationTable,
    IMutationTableProps,
    MutationTableColumn,
    MutationTableColumnType,
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
import LazyMobXTable from 'shared/components/lazyMobXTable/LazyMobXTable';

export interface IPatientSimilarityMutationTableProps
    extends IMutationTableProps {
    sampleManager: SampleManager | null;
    sampleToGenePanelId: { [sampleId: string]: string | undefined };
    genePanelIdToEntrezGeneIds: { [genePanelId: string]: number[] };
    sampleIds?: string[];
    onSelectGenePanel?: (name: string) => void;
    disableTooltip?: boolean;
    similarMutations: SimilarMutation[];
}

export enum MutationTableColumnTypeExtension {
    SIMILARITYTAG = 'Tag',
    CHROM = 'chr2',
    START = 'start2',
    REF = 'ref2',
    ALT = 'alt2',
}

export class PatientSimilarityMutationTable extends MutationTable<
    IPatientSimilarityMutationTableProps
> {
    constructor(props: IPatientSimilarityMutationTableProps) {
        super(props);
        makeObservable(this);
    }

    public static defaultProps = {
        ...MutationTable.defaultProps,
        columns: [
            MutationTableColumnType.COHORT,
            //MutationTableColumnType.MRNA_EXPR,
            MutationTableColumnType.COPY_NUM,
            MutationTableColumnType.ANNOTATION,
            MutationTableColumnType.CUSTOM_DRIVER,
            MutationTableColumnType.CUSTOM_DRIVER_TIER,
            MutationTableColumnType.HGVSG,
            MutationTableColumnType.REF_READS_N,
            MutationTableColumnType.VAR_READS_N,
            MutationTableColumnType.REF_READS,
            MutationTableColumnType.VAR_READS,
            MutationTableColumnType.START_POS,
            MutationTableColumnType.END_POS,
            MutationTableColumnType.REF_ALLELE,
            MutationTableColumnType.VAR_ALLELE,
            MutationTableColumnType.MUTATION_STATUS,
            MutationTableColumnType.VALIDATION_STATUS,
            MutationTableColumnType.CENTER,
            MutationTableColumnType.GENE,
            MutationTableColumnType.CHROMOSOME,
            MutationTableColumnType.PROTEIN_CHANGE,
            MutationTableColumnType.MUTATION_TYPE,
            MutationTableColumnType.VARIANT_TYPE,
            MutationTableColumnType.FUNCTIONAL_IMPACT,
            MutationTableColumnType.COSMIC,
            MutationTableColumnType.TUMOR_ALLELE_FREQ,
            MutationTableColumnType.SAMPLES,
            MutationTableColumnType.EXON,
            MutationTableColumnType.HGVSC,
            MutationTableColumnType.GNOMAD,
            MutationTableColumnType.CLINVAR,
            MutationTableColumnType.DBSNP,
            MutationTableColumnType.GENE_PANEL,
            MutationTableColumnType.SIGNAL,

            MutationTableColumnTypeExtension.SIMILARITYTAG,
            MutationTableColumnTypeExtension.CHROM,
            MutationTableColumnTypeExtension.START,
            MutationTableColumnTypeExtension.REF,
            MutationTableColumnTypeExtension.ALT,
        ],
    };

    protected getSamples(): string[] {
        if (this.props.sampleIds) {
            return this.props.sampleIds;
        } else {
            return [];
        }
    }

    protected getSimilarMutationData(i: number): SimilarMutation {
        return this.props.similarMutations[i];
    }

    protected getSimilarMutationDataString(
        i: number,
        key: string
    ): string | null {
        const data = this.getSimilarMutationData(i).mutations2;
        if (data.length > 0) {
            return data[0][key as keyof Mutation] as string;
        } else {
            return null;
        }
    }

    protected getSimilarMutationDataTag(i: number): string | null {
        return this.getSimilarMutationData(i).similarityTag;
    }

    protected generateColumns() {
        super.generateColumns();

        // similar mutation columns
        this._columns[MutationTableColumnTypeExtension.SIMILARITYTAG] = {
            name: MutationTableColumnTypeExtension.SIMILARITYTAG,
            render: (d: Mutation[], i: number) => {
                return <div>{this.getSimilarMutationDataTag(i)}</div>;
            },
            visible: true,
            align: 'right',
        };

        this._columns[MutationTableColumnTypeExtension.CHROM] = {
            name: MutationTableColumnTypeExtension.CHROM,
            render: (d: Mutation[], i: number) => {
                return <div>{this.getSimilarMutationDataString(i, 'chr')}</div>;
            },
            visible: true,
            align: 'right',
        };
        this._columns[MutationTableColumnTypeExtension.START] = {
            name: MutationTableColumnTypeExtension.START,
            render: (d: Mutation[], i: number) => {
                return (
                    <div>
                        {this.getSimilarMutationDataString(i, 'startPosition')}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[MutationTableColumnTypeExtension.REF] = {
            name: MutationTableColumnTypeExtension.REF,
            render: (d: Mutation[], i: number) => {
                return (
                    <div>
                        {this.getSimilarMutationDataString(
                            i,
                            'referenceAllele'
                        )}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };
        this._columns[MutationTableColumnTypeExtension.ALT] = {
            name: MutationTableColumnTypeExtension.ALT,
            render: (d: Mutation[], i: number) => {
                return (
                    <div>
                        {this.getSimilarMutationDataString(i, 'variantAllele')}
                    </div>
                );
            },
            visible: true,
            align: 'right',
        };

        // reference mutation columns
        this._columns[MutationTableColumnType.SAMPLES] = {
            name: MutationTableColumnType.SAMPLES,
            render: (d: Mutation[]) =>
                TumorColumnFormatter.renderFunction(
                    d,
                    this.props.sampleManager,
                    this.props.sampleToGenePanelId,
                    this.props.genePanelIdToEntrezGeneIds,
                    this.props.onSelectGenePanel,
                    this.props.disableTooltip
                ),
            sortBy: (d: Mutation[]) =>
                TumorColumnFormatter.getSortValue(d, this.props.sampleManager),
            download: (d: Mutation[]) => TumorColumnFormatter.getSample(d),
            resizable: true,
        };

        const GenePanelProps = (d: Mutation[]) => ({
            data: d,
            sampleToGenePanelId: this.props.sampleToGenePanelId,
            sampleManager: this.props.sampleManager,
            genePanelIdToGene: this.props.genePanelIdToEntrezGeneIds,
            onSelectGenePanel: this.props.onSelectGenePanel,
        });

        this._columns[MutationTableColumnType.GENE_PANEL] = {
            name: MutationTableColumnType.GENE_PANEL,
            render: (d: Mutation[]) =>
                PanelColumnFormatter.renderFunction(GenePanelProps(d)),
            download: (d: Mutation[]) =>
                PanelColumnFormatter.download(GenePanelProps(d)),
            visible: false,
            sortBy: (d: Mutation[]) =>
                PanelColumnFormatter.getGenePanelIds(GenePanelProps(d)),
        };

        this._columns[MutationTableColumnType.SAMPLES].shouldExclude = () => {
            return this.getSamples().length < 2;
        };

        // order columns
        (this._columns[MutationTableColumnType.SAMPLES].order = 5),
            (this._columns[MutationTableColumnType.GENE_PANEL].order = 10),
            (this._columns[MutationTableColumnType.CENTER].order = 15),
            (this._columns[
                MutationTableColumnTypeExtension.SIMILARITYTAG
            ].order = 19),
            (this._columns[MutationTableColumnType.CHROMOSOME].order = 20),
            (this._columns[MutationTableColumnType.START_POS].order = 25),
            (this._columns[MutationTableColumnType.END_POS].order = 30),
            (this._columns[MutationTableColumnType.REF_ALLELE].order = 35),
            (this._columns[MutationTableColumnType.VAR_ALLELE].order = 40),
            (this._columns[MutationTableColumnType.GENE].order = 45),
            (this._columns[MutationTableColumnType.HGVSG].order = 50),
            (this._columns[MutationTableColumnType.HGVSC].order = 55),
            (this._columns[MutationTableColumnType.PROTEIN_CHANGE].order = 60),
            (this._columns[MutationTableColumnType.EXON].order = 65),
            (this._columns[MutationTableColumnType.REF_READS_N].order = 70),
            (this._columns[MutationTableColumnType.VAR_READS_N].order = 75),
            (this._columns[MutationTableColumnType.REF_READS].order = 80),
            (this._columns[MutationTableColumnType.VAR_READS].order = 85),
            (this._columns[MutationTableColumnType.COPY_NUM].order = 90),
            (this._columns[MutationTableColumnType.MUTATION_STATUS].order = 95),
            (this._columns[
                MutationTableColumnType.VALIDATION_STATUS
            ].order = 100),
            (this._columns[
                MutationTableColumnType.TUMOR_ALLELE_FREQ
            ].order = 105),
            (this._columns[MutationTableColumnType.COHORT].order = 110),
            (this._columns[
                MutationTableColumnType.CUSTOM_DRIVER_TIER
            ].order = 115),
            (this._columns[MutationTableColumnType.MUTATION_TYPE].order = 120),
            (this._columns[MutationTableColumnType.VARIANT_TYPE].order = 125),
            (this._columns[
                MutationTableColumnType.FUNCTIONAL_IMPACT
            ].order = 130),
            //this._columns[MutationTableColumnType.MRNA_EXPR].order =

            (this._columns[MutationTableColumnType.ANNOTATION].order = 135),
            (this._columns[MutationTableColumnType.COSMIC].order = 140),
            (this._columns[MutationTableColumnType.GNOMAD].order = 145),
            (this._columns[MutationTableColumnType.CLINVAR].order = 150),
            (this._columns[MutationTableColumnType.DBSNP].order = 155),
            (this._columns[MutationTableColumnType.SIGNAL].order = 160),
            (this._columns[MutationTableColumnTypeExtension.CHROM].order = 165),
            (this._columns[MutationTableColumnTypeExtension.START].order = 170),
            (this._columns[MutationTableColumnTypeExtension.REF].order = 175),
            (this._columns[MutationTableColumnTypeExtension.ALT].order = 180);
    }
}
