import React from 'react';
import { ITherapyRecommendation, IGeneticAlteration } from 'cbioportal-utils';
import { Mutation, DiscreteCopyNumberData } from 'cbioportal-ts-api-client';
import Select from 'react-select';
import _, { isUndefined } from 'lodash';
import { flattenArray } from '../therapyRecommendation/TherapyRecommendationTableUtils';
import AlleleFreqColumnFormatter from '../mutation/column/AlleleFreqColumnFormatter';
import { VariantAnnotation, MyVariantInfo } from 'genome-nexus-ts-api-client';
import SampleManager from 'pages/patientView/SampleManager';
import { If, Then } from 'react-if';
import { components } from 'react-select';
import styles from '../therapyRecommendation/style/therapyRecommendation.module.scss';
import CreatableSelect from 'react-select';
import { useState } from 'react';

interface MutationSelectProps {
    data: Mutation[];
    mutations: Mutation[];
    indexedVariantAnnotations:
        | { [genomicLocation: string]: VariantAnnotation }
        | undefined;
    indexedMyVariantInfoAnnotations:
        | { [genomicLocation: string]: MyVariantInfo }
        | undefined;
    cna: DiscreteCopyNumberData[];
    onChange: (alterations: IGeneticAlteration[]) => void;
    sampleManager: SampleManager | null;
}

type MyOption = { label: string; value: IGeneticAlteration };

type MutationSelectState = {
    selectedOptions: MyOption[];
};

export class MutationSelect extends React.Component<
    MutationSelectProps,
    MutationSelectState,
    {}
> {
    constructor(props: MutationSelectProps) {
        super(props);
        this.state = {
            selectedOptions: new Array<MyOption>(),
        };
    }

    private get allMutations() {
        return this.props.mutations.map((mutation: Mutation) => {
            const index =
                mutation.chr +
                ',' +
                mutation.startPosition +
                ',' +
                mutation.endPosition +
                ',' +
                mutation.referenceAllele +
                ',' +
                mutation.variantAllele;
            const annotation = this.props.indexedVariantAnnotations
                ? this.props.indexedVariantAnnotations[index]
                : undefined;
            const myVariantInfo = this.props.indexedMyVariantInfoAnnotations
                ? this.props.indexedMyVariantInfoAnnotations[index]
                : undefined;
            let dbsnp;
            let clinvar;
            let cosmic;
            let gnomad;

            if (annotation && annotation.colocatedVariants) {
                const f = annotation.colocatedVariants.filter(value =>
                    value.dbSnpId.startsWith('rs')
                );
                if (f.length > 0) dbsnp = f[0].dbSnpId;
            }
            if (myVariantInfo) {
                if (myVariantInfo.clinVar) {
                    clinvar = myVariantInfo.clinVar.variantId;
                }
                if (myVariantInfo.cosmic) {
                    cosmic = myVariantInfo.cosmic.cosmicId;
                }
                if (
                    myVariantInfo.gnomadExome &&
                    myVariantInfo.gnomadExome.alleleFrequency
                ) {
                    gnomad = myVariantInfo.gnomadExome.alleleFrequency.af;
                }
            }
            return {
                hugoSymbol: mutation.gene.hugoGeneSymbol,
                alteration: mutation.proteinChange,
                entrezGeneId: mutation.entrezGeneId,
                chromosome: mutation.chr,
                start: mutation.startPosition,
                end: mutation.endPosition,
                ref: mutation.referenceAllele,
                alt: mutation.variantAllele,
                aminoAcidChange: mutation.aminoAcidChange,
                alleleFrequency: AlleleFreqColumnFormatter.calcFrequency(
                    mutation
                ),
                dbsnp,
                clinvar,
                cosmic,
                gnomad,
                sampleIds: [mutation.sampleId],
            } as IGeneticAlteration;
        });
    }

    private get allCNA() {
        return this.props.cna.map((alt: DiscreteCopyNumberData) => {
            return {
                hugoSymbol: alt.gene.hugoGeneSymbol,
                alteration:
                    alt.alteration === -2 ? 'Deletion' : 'Amplification',
                entrezGeneId: alt.entrezGeneId,
                sampleIds: [alt.sampleId],
            } as IGeneticAlteration;
        });
    }

    private get allAlterations() {
        // collect all alterations in IGeneticAlteration objects
        let collectedAlterations: IGeneticAlteration[] = [];
        collectedAlterations.push(...this.allMutations);
        collectedAlterations.push(...this.allCNA);

        // remove duplicates (esp. from differnet samples) but safe samples
        let foundIdx = -1;
        var groupedAlterations = collectedAlterations.reduce(
            (
                accu: IGeneticAlteration[],
                curr: IGeneticAlteration,
                idx: Number,
                arr: IGeneticAlteration[]
            ) => {
                if (
                    accu.some((value, resIdx, reArr) => {
                        // already present?
                        foundIdx = resIdx;
                        return (
                            value.hugoSymbol == curr.hugoSymbol &&
                            value.alteration == curr.alteration
                        );
                    })
                ) {
                    // already present, add sample
                    accu[foundIdx].sampleIds!.push(...curr.sampleIds!);
                } else {
                    // not yet present, push element
                    accu.push(curr);
                }
                return accu;
            },
            []
        );

        let groupedSortedAlterations = groupedAlterations.map(
            (alt: IGeneticAlteration) => ({
                ...alt,
                sampleIds: this.props
                    .sampleManager!.getSampleIdsInOrder()
                    .filter(item => alt.sampleIds!.includes(item)),
            })
        );

        return groupedSortedAlterations;
    }

    private readonly alterationOptions = this.allAlterations.map(
        (alteration: IGeneticAlteration) => ({
            value: alteration,
            label: alteration.hugoSymbol + ' ' + alteration.alteration,
        })
    );

    public render() {
        const Option = (props: any) => {
            return (
                <div
                    key={
                        props.data.value.hugoSymbol +
                        ':' +
                        props.data.value.alteration
                    }
                >
                    <components.Option {...props}>
                        <span style={{ marginRight: 5 }}>{props.label}</span>
                        <If
                            condition={
                                typeof props.value === 'object' &&
                                props.value !== null &&
                                'sampleIds' in props.value &&
                                props.value.sampleIds != null
                            }
                        >
                            <Then>
                                <span>
                                    {props.value.sampleIds.map(
                                        (sampleId: string) => (
                                            <span
                                                key={
                                                    sampleId +
                                                    ':' +
                                                    props.data.value
                                                        .hugoSymbol +
                                                    ':' +
                                                    props.data.value.alteration
                                                }
                                                className={styles.genomicSpan}
                                            >
                                                {this.props.sampleManager!.getComponentForSample(
                                                    sampleId,
                                                    1,
                                                    ''
                                                )}
                                            </span>
                                        )
                                    )}
                                </span>
                            </Then>
                        </If>
                    </components.Option>
                </div>
            );
        };

        return (
            <Select
                options={this.alterationOptions}
                components={{ Option }}
                isMulti
                defaultValue={[]}
                name="patientSimilarityAlterationSelect"
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(selectedOption: MyOption[]) => {
                    if (Array.isArray(selectedOption)) {
                        this.props.onChange(
                            selectedOption.map(option => option.value)
                        );
                        this.setState({
                            selectedOptions: selectedOption,
                        });
                    } else if (selectedOption === null) {
                        this.props.onChange([] as IGeneticAlteration[]);
                    }
                }}
                value={this.state.selectedOptions}
            />
        );
    }
}

//import React, { useState } from 'react';
//import CreatableSelect from 'react-select';
//import { Mutation, DiscreteCopyNumberData } from 'cbioportal-ts-api-client';
//import { VariantAnnotation, MyVariantInfo } from 'genome-nexus-ts-api-client';
//import _ from 'lodash';
//
//export interface Dict<T> {
//    [key: string]: T;
//}
//
//interface Option {
//    label: string;
//    value: Mutation;
//}
//
//interface MutationSelectProps {
//    data: Mutation[];
//    mutations: Mutation[];
//    cna: DiscreteCopyNumberData[];
//    onChange: (selectedOption: Array<any>) => void;
//    isMulti?: boolean;
//    name?: string;
//    className?: string;
//    classNamePrefix?: string;
//    placeholder?: string;
//}
//
//export const MutationSelect2 = (
//    props: MutationSelectProps
//) => {
//    let mutationOptions: Array<object> = [];
//    props.mutations.forEach((mutation: Mutation) => {
//        mutationOptions.push({
//            value: mutation,
//            label: mutation.keyword,
//        });
//    });
//
//    props.cna.forEach((mutation: DiscreteCopyNumberData) => {
//        mutationOptions.push({
//            value:
//                mutation.gene.hugoGeneSymbol +
//                ' ' +
//                (mutation.alteration === -2 ? 'Deletion' : 'Amplification'),
//            label:
//                mutation.gene.hugoGeneSymbol +
//                ' ' +
//                (mutation.alteration === -2 ? 'Deletion' : 'Amplification'),
//        });
//    });
//
//    mutationOptions.sort();
//
//    const mutationDefault = props.data.map((mutation: Mutation) => ({
//        value: mutation,
//        label: mutation.keyword,
//    }));
//
//    const [value, setValue] = useState<Option[]>();
//    const [inputValue, setInputValue] = useState<string>();
//    //const [options, setOptions] = useState<Option[]>([]);
//
//    const onChange = (selectedOption: Option[]) => {
//        setValue(selectedOption);
//        setInputValue('');
//        if (Array.isArray(selectedOption)) {
//            props.onChange(
//                selectedOption.map((option: Option) => {
//                    return option.value;
//                })
//            );
//        } else if (selectedOption === null) {
//            props.onChange([]);
//        }
//    };
//
//    const onInputChange = (textInput: string, { action }: any) => {
//        if (action === 'input-change') {
//            setInputValue(textInput);
//        }
//    };
//
//    const findMutation = (query: string) => {
//        var mutation = mutationOptions.find((option: Option) => {
//            const currentMutation: Mutation = option.value
//            if (currentMutation.keyword.includes(query)) {
//                return true
//            }
//        })
//        return mutation
//    }
//
//    const onKeyDown = (event: any) => {
//        // delete items using backspace and keep the remaining letters
//        if (event.key === 'Backspace' && value !== undefined) {
//            if (inputValue === '' && value.length > 0) {
//                const remainder = [...(value || [])];
//                if (typeof remainder !== 'undefined' && remainder.length > 0) {
//                    const temp = remainder.pop() as Option;
//                    const remainderValue = temp.label;
//                    setValue(remainder);
//                    setInputValue(remainderValue);
//                }
//            }
//        }
//    };
//
//    return (
//        <>
//            <CreatableSelect
//                height={'100%'}
//                name={props.name}
//                className={props.className}
//                classNamePrefix={props.classNamePrefix}
//                defaultInputValue=""
//                defaultValue={mutationDefault}
//                allowCreateWhileLoading={true}
//                inputValue={inputValue}
//                onInputChange={onInputChange}
//                autoSize={false}
//                onChange={onChange}
//                onKeyDown={onKeyDown}
//                value={value}
//                options={mutationOptions}
//                tabSelectsOption={false}
//                placeholder={props.placeholder}
//                backspaceRemovesValue={false}
//                isMulti
//            />
//        </>
//    );
//};
//
//export default MutationSelect;
//
//
