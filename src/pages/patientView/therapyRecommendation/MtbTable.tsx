import * as React from 'react';
import { observer } from 'mobx-react';
import * as _ from 'lodash';
import {
    ITherapyRecommendation,
    IMtb,
    MtbState,
    IDeletions,
    IClinicalTrial,
} from 'cbioportal-utils';
import { computed, makeObservable, observable } from 'mobx';
import LazyMobXTable from '../../../shared/components/lazyMobXTable/LazyMobXTable';
import styles from './style/therapyRecommendation.module.scss';
import SampleManager from '../SampleManager';
import {
    flattenStringify,
    getAuthor,
    getTooltipAuthorContent,
} from './TherapyRecommendationTableUtils';
import { Button } from 'react-bootstrap';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import {
    Mutation,
    ClinicalData,
    DiscreteCopyNumberData,
} from 'cbioportal-ts-api-client';
import { SimpleCopyDownloadControls } from 'shared/components/copyDownloadControls/SimpleCopyDownloadControls';
import { RemoteData, IOncoKbData } from 'cbioportal-utils';
import PubMedCache from 'shared/cache/PubMedCache';
import LabeledCheckbox from 'shared/components/labeledCheckbox/LabeledCheckbox';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import WindowStore from 'shared/components/window/WindowStore';
import MtbTherapyRecommendationTable from './MtbTherapyRecommendationTable';
import Select from 'react-select';
import { VariantAnnotation, MyVariantInfo } from 'genome-nexus-ts-api-client';
import { isMacOs, isSafari } from 'react-device-detect';
import DatePicker from 'react-date-picker';
import { LoginModal, UserInfoButton } from './LoginElements';
import { IMutationalSignature } from 'shared/model/MutationalSignature';
export type IMtbProps = {
    patientId: string;
    mutations: Mutation[];
    indexedVariantAnnotations:
        | { [genomicLocation: string]: VariantAnnotation }
        | undefined;
    indexedMyVariantInfoAnnotations:
        | { [genomicLocation: string]: MyVariantInfo }
        | undefined;
    cna: DiscreteCopyNumberData[];
    clinicalData: ClinicalData[];
    mutationSignatureData: _.Dictionary<IMutationalSignature[]>;
    sampleManager: SampleManager | null;
    oncoKbAvailable: boolean;
    mtbs: IMtb[];
    otherMtbs: ITherapyRecommendation[];
    deletions: IDeletions;
    containerWidth: number;
    onDeleteData: (deletions: IDeletions) => void;
    onSaveData: (mtbs: IMtb[]) => Promise<boolean>;
    mtbUrl: string;
    checkPermission: () => Promise<boolean[]>;
    oncoKbData?: RemoteData<IOncoKbData | Error | undefined>;
    cnaOncoKbData?: RemoteData<IOncoKbData | Error | undefined>;
    pubMedCache?: PubMedCache;
    clinicalTrialClipboard: IClinicalTrial[];
};

export type IMtbState = {
    mtbs: IMtb[];
    otherMtbs: ITherapyRecommendation[];
    deletions: IDeletions;
    loggedIn: boolean;
    permission: boolean;
    username: string; // currently not used
    successfulSave: boolean;
};

enum ColumnKey {
    INFO = 'MTB Info',
    THERAPYRECOMMENDATIONS = 'Therapy Recommendations',
}

enum ColumnWidth {
    INFO = 140,
}

class MtbTableComponent extends LazyMobXTable<IMtb> {}

@observer
export default class MtbTable extends React.Component<IMtbProps, IMtbState> {
    constructor(props: IMtbProps) {
        super(props);
        this.state = {
            mtbs: props.mtbs,
            otherMtbs: props.otherMtbs,
            deletions: props.deletions,
            loggedIn: false,
            permission: false,
            username: 'Unknown', // currently not used
            successfulSave: false,
        };
        makeObservable(this);
    }

    @computed
    get columnWidths() {
        return {
            [ColumnKey.INFO]: ColumnWidth.INFO,
            [ColumnKey.THERAPYRECOMMENDATIONS]:
                this.props.containerWidth - ColumnWidth.INFO,
        };
    }

    @observable selectedTherapyRecommendation:
        | ITherapyRecommendation
        | undefined;
    @observable backupTherapyRecommendation: ITherapyRecommendation | undefined;
    @observable showOncoKBForm: boolean;

    private _columns = [
        {
            name: ColumnKey.INFO,
            render: (mtb: IMtb) => (
                <div>
                    <span className={styles.edit}>
                        <DefaultTooltip
                            trigger={['hover', 'focus']}
                            overlay={getTooltipAuthorContent(
                                'MTB session',
                                mtb.author
                            )}
                            destroyTooltipOnHide={false}
                        >
                            <i className={'fa fa-user-md fa-2x'}></i>
                        </DefaultTooltip>
                    </span>
                    <label
                        style={{
                            display: 'block',
                        }}
                    >
                        Date:
                        {isMacOs && isSafari ? (
                            <DatePicker
                                value={mtb.date ? new Date(mtb.date) : null}
                                disabled={
                                    this.isDisabled(mtb) ||
                                    !this.state.permission
                                }
                                onChange={(d: Date) => {
                                    const newDate =
                                        d.getFullYear() +
                                        '-' +
                                        ('0' + (d.getMonth() + 1)).slice(-2) +
                                        '-' +
                                        ('0' + d.getDate()).slice(-2);
                                    const newMtbs = this.state.mtbs.slice();
                                    newMtbs.find(
                                        x => x.id === mtb.id
                                    )!.date = newDate;
                                    this.setState({ mtbs: newMtbs });
                                }}
                                format="dd.MM.y"
                            />
                        ) : (
                            <input
                                type="date"
                                value={mtb.date}
                                style={{ marginLeft: 6 }}
                                disabled={
                                    this.isDisabled(mtb) ||
                                    !this.state.permission
                                }
                                onChange={(
                                    e: React.FormEvent<HTMLInputElement>
                                ) => {
                                    const newDate = e.currentTarget.value;
                                    const newMtbs = this.state.mtbs.slice();
                                    newMtbs.find(
                                        x => x.id === mtb.id
                                    )!.date = newDate;
                                    this.setState({ mtbs: newMtbs });
                                }}
                            ></input>
                        )}
                    </label>
                    <label
                        style={{
                            display: 'block',
                        }}
                    >
                        State:
                        <select
                            defaultValue={mtb.mtbState}
                            style={{ marginLeft: 2 }}
                            disabled={
                                (this.isDisabled(mtb) &&
                                    !(
                                        sessionStorage.getItem(mtb.id) ===
                                        MtbState.FINAL.toUpperCase()
                                    )) ||
                                !this.state.permission
                            }
                            onChange={(
                                e: React.ChangeEvent<HTMLSelectElement>
                            ) => {
                                const newState = e.target.value;
                                sessionStorage.setItem(mtb.id, newState);
                                if (newState === MtbState.FINAL.toUpperCase())
                                    if (
                                        !window.confirm(
                                            'Are you sure you wish to finalize this MTB session to disable editing?'
                                        )
                                    ) {
                                        const newMtbs = this.state.mtbs.slice();
                                        e.target.value = newMtbs.find(
                                            x => x.id === mtb.id
                                        )!.mtbState;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        this.setState({ mtbs: newMtbs });
                                        return;
                                    }
                                const newMtbs = this.state.mtbs.slice();
                                newMtbs.find(
                                    x => x.id === mtb.id
                                )!.mtbState = newState as MtbState;
                                this.setState({ mtbs: newMtbs });
                            }}
                        >
                            {Object.entries(MtbState).map(([key, value]) => (
                                <option key={key} value={key}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </label>
                    <LabeledCheckbox
                        checked={mtb.geneticCounselingRecommendation}
                        disabled={
                            this.isDisabled(mtb) || !this.state.permission
                        }
                        onChange={() => {
                            const newGcr = !mtb.geneticCounselingRecommendation;
                            const newMtbs = this.state.mtbs.slice();
                            newMtbs.find(
                                x => x.id === mtb.id
                            )!.geneticCounselingRecommendation = newGcr;
                            this.setState({ mtbs: newMtbs });
                        }}
                        labelProps={{ style: { marginRight: 10 } }}
                    >
                        <span style={{ marginTop: '-2px' }}>
                            Genetic Counseling
                        </span>
                    </LabeledCheckbox>
                    <LabeledCheckbox
                        checked={mtb.rebiopsyRecommendation}
                        disabled={
                            this.isDisabled(mtb) || !this.state.permission
                        }
                        onChange={() => {
                            const newRr = !mtb.rebiopsyRecommendation;
                            const newMtbs = this.state.mtbs.slice();
                            newMtbs.find(
                                x => x.id === mtb.id
                            )!.rebiopsyRecommendation = newRr;
                            this.setState({ mtbs: newMtbs });
                        }}
                        labelProps={{ style: { marginRight: 10 } }}
                    >
                        <span style={{ marginTop: '-2px' }}>Rebiopsy</span>
                    </LabeledCheckbox>
                    <textarea
                        title="Comments"
                        rows={10}
                        cols={80}
                        value={mtb.generalRecommendation}
                        placeholder="Comments"
                        disabled={
                            this.isDisabled(mtb) || !this.state.permission
                        }
                        onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>
                        ) => {
                            const newComment = e.target.value;
                            const newMtbs = this.state.mtbs.slice();
                            newMtbs.find(
                                x => x.id === mtb.id
                            )!.generalRecommendation = newComment;
                            this.setState({ mtbs: newMtbs });
                        }}
                    />
                    <Select
                        options={this.props
                            .sampleManager!.getSampleIdsInOrder()
                            .map(sampleId => ({
                                label: sampleId,
                                value: sampleId,
                            }))}
                        isMulti
                        defaultValue={mtb.samples.map(sampleId => ({
                            label: sampleId,
                            value: sampleId,
                        }))}
                        name="samplesConsidered"
                        className="basic-multi-select"
                        classNamePrefix="select"
                        placeholder="Select considered samples..."
                        isDisabled={
                            this.isDisabled(mtb) || !this.state.permission
                        }
                        onChange={(selectedOption: Array<any>) => {
                            const newSamples = [];
                            if (selectedOption !== null) {
                                const sampleIds = selectedOption.map(
                                    sampleId => sampleId.value
                                );
                                newSamples.push(...sampleIds);
                            }
                            const newMtbs = this.state.mtbs.slice();
                            newMtbs.find(
                                x => x.id === mtb.id
                            )!.samples = newSamples;
                            this.setState({ mtbs: newMtbs });
                        }}
                        value={mtb.samples.map(sampleId => ({
                            label: sampleId,
                            value: sampleId,
                        }))}
                    />
                    <span className={styles.edit}>
                        <Button
                            type="button"
                            className={
                                'btn btn-default ' + styles.deleteMtbButton
                            }
                            disabled={
                                this.isDisabled(mtb) || !this.state.permission
                            }
                            onClick={() =>
                                window.confirm(
                                    'Are you sure you wish to delete this MTB session?'
                                ) && this.deleteMtb(mtb)
                            }
                        >
                            <i
                                className={`fa fa-trash ${styles.marginLeft}`}
                                aria-hidden="true"
                            ></i>{' '}
                            Delete MTB
                        </Button>
                    </span>
                </div>
            ),
            width: this.columnWidths[ColumnKey.INFO],
        },
        {
            name: ColumnKey.THERAPYRECOMMENDATIONS,
            render: (mtb: IMtb) => (
                <MtbTherapyRecommendationTable
                    patientId={this.props.patientId}
                    mutations={this.props.mutations}
                    indexedVariantAnnotations={
                        this.props.indexedVariantAnnotations
                    }
                    indexedMyVariantInfoAnnotations={
                        this.props.indexedMyVariantInfoAnnotations
                    }
                    cna={this.props.cna}
                    clinicalData={this.props.clinicalData}
                    mutationSignatureData={this.props.mutationSignatureData}
                    sampleManager={this.props.sampleManager}
                    oncoKbAvailable={this.props.oncoKbAvailable}
                    therapyRecommendations={mtb.therapyRecommendations}
                    otherMtbs={this.props.otherMtbs}
                    containerWidth={WindowStore.size.width - 20}
                    onDelete={this.therapyRecommendationOnDelete(mtb.id)}
                    onAddOrEdit={this.therapyRecommendationOnAddOrEdit(mtb.id)}
                    onReposition={this.therapyRecommendationReposition(mtb.id)}
                    oncoKbData={this.props.oncoKbData}
                    cnaOncoKbData={this.props.cnaOncoKbData}
                    pubMedCache={this.props.pubMedCache}
                    isDisabled={this.isDisabled(mtb) || !this.state.permission}
                    showButtons={true}
                    clinicalTrialClipboard={this.props.clinicalTrialClipboard}
                />
            ),
            width: this.columnWidths[ColumnKey.THERAPYRECOMMENDATIONS],
        },
    ];

    therapyRecommendationOnDelete = (mtbId: string) => (
        therapyRecommendationToDelete: ITherapyRecommendation
    ) => {
        this.state.deletions.therapyRecommendation.push(
            therapyRecommendationToDelete.id
        );
        const newMtbs = this.state.mtbs.slice();
        let m = newMtbs.find(x => x.id === mtbId)!;
        m.therapyRecommendations = newMtbs
            .find(x => x.id === mtbId)!
            .therapyRecommendations.filter(
                (therapyRecommendation: ITherapyRecommendation) =>
                    therapyRecommendationToDelete.id !==
                    therapyRecommendation.id
            );
        m.samples = [];
        m.therapyRecommendations.forEach(y => {
            y.reasoning.clinicalData?.forEach(c => {
                if (
                    c.sampleId! != undefined &&
                    !m.samples.includes(c.sampleId!)
                ) {
                    m.samples.push(c.sampleId!);
                }
            });
            y.reasoning.geneticAlterations?.forEach(g => {
                g.sampleIds!.forEach(s => {
                    if (!m.samples.includes(s)) {
                        m.samples.push(s);
                    }
                });
            });
        });
        this.setState({ mtbs: newMtbs });
        return true;
    };

    therapyRecommendationSuspendAndGetIndex = (mtbId: string) => (
        therapyRecommendationToDelete: ITherapyRecommendation
    ) => {
        var therapyRecommendationIndex = -1;
        const newMtbs = this.state.mtbs.slice();
        newMtbs.find(x => x.id === mtbId)!.therapyRecommendations = newMtbs
            .find(x => x.id === mtbId)!
            .therapyRecommendations.filter(
                (therapyRecommendation: ITherapyRecommendation, index) => {
                    if (
                        therapyRecommendationToDelete.id !==
                        therapyRecommendation.id
                    ) {
                        return true;
                    } else {
                        therapyRecommendationIndex = index;
                        return false;
                    }
                }
            );
        this.setState({ mtbs: newMtbs });
        return therapyRecommendationIndex;
    };

    therapyRecommendationOnAddOrEdit = (mtbId: string) => (
        therapyRecommendationToAdd?: ITherapyRecommendation
    ) => {
        if (therapyRecommendationToAdd === undefined) return false;
        const index = this.therapyRecommendationSuspendAndGetIndex(mtbId)(
            therapyRecommendationToAdd
        );
        const newMtbs = this.state.mtbs.slice();
        if (index === -1) {
            let y = newMtbs.find(x => x.id === mtbId)!;
            y.therapyRecommendations.unshift(therapyRecommendationToAdd);

            therapyRecommendationToAdd.reasoning.clinicalData?.forEach(c => {
                if (
                    c.sampleId! != undefined &&
                    !y.samples.includes(c.sampleId!)
                ) {
                    y.samples.push(c.sampleId!);
                }
                console.log('sid', c.sampleId);
            });
            therapyRecommendationToAdd.reasoning.geneticAlterations?.forEach(
                g => {
                    g.sampleIds!.forEach(s => {
                        if (!y.samples.includes(s)) {
                            y.samples.push(s);
                        }
                    });
                }
            );
        } else {
            let y = newMtbs.find(x => x.id === mtbId)!;
            y.therapyRecommendations.splice(
                index,
                0,
                therapyRecommendationToAdd
            );
            therapyRecommendationToAdd.reasoning.clinicalData?.forEach(c => {
                if (
                    c.sampleId! != undefined &&
                    !y.samples.includes(c.sampleId!)
                ) {
                    y.samples.push(c.sampleId!);
                }
                console.log('sid', c.sampleId);
            });
            therapyRecommendationToAdd.reasoning.geneticAlterations?.forEach(
                g => {
                    g.sampleIds!.forEach(s => {
                        if (!y.samples.includes(s)) {
                            y.samples.push(s);
                        }
                    });
                }
            );
        }
        this.setState({ mtbs: newMtbs });
        return true;
    };

    therapyRecommendationReposition = (mtbId: string) => (
        therapyRecommendation: ITherapyRecommendation,
        newIndex: number
    ) => {
        const newMtbs = this.state.mtbs.slice();
        const oldIndex = this.therapyRecommendationSuspendAndGetIndex(mtbId)(
            therapyRecommendation
        );
        newMtbs
            .find(x => x.id === mtbId)!
            .therapyRecommendations.splice(newIndex, 0, therapyRecommendation);
        this.setState({ mtbs: newMtbs });
        return true;
    };

    private addMtb() {
        const now = new Date();
        const newMtbs = this.state.mtbs.slice();
        const newMtb = {
            id: 'mtb_' + this.props.patientId + '_' + now.getTime(),
            orderId: (
                this.props.clinicalData.filter(
                    e => e.clinicalAttributeId == 'ORDER_ID'
                )[0] || { value: '' }
            ).value,
            generalRecommendation: '',
            geneticCounselingRecommendation: false,
            rebiopsyRecommendation: false,
            therapyRecommendations: [],
            date: now.toISOString().split('T')[0],
            mtbState: Object.keys(MtbState).find(
                key =>
                    MtbState[key as keyof typeof MtbState] === MtbState.PARTIAL
            ),
            samples: [],
            author: getAuthor(),
        } as IMtb;
        newMtbs.unshift(newMtb);
        this.setState({ mtbs: newMtbs });
    }

    private deleteMtb(mtbToDelete: IMtb) {
        this.state.deletions.mtb.push(mtbToDelete.id);
        const newMtbs = this.state.mtbs
            .slice()
            .filter((mtb: IMtb) => mtbToDelete.id !== mtb.id);
        this.setState({ mtbs: newMtbs });
    }

    private saveMtbs() {
        console.group('Save mtbs');
        this.isProcessingSaveData = true;
        this.props.onSaveData(this.state.mtbs).then(res => {
            this.isProcessingSaveData = false;
            console.log('onSaveData returned with ' + res);
            if (res == true) {
                console.log('Showing successfulSave div');
                this.setState({ successfulSave: true });
                setTimeout(() => this.saveCallback(), 3000);
                if (
                    this.state.deletions.mtb.length > 0 ||
                    this.state.deletions.therapyRecommendation.length > 0
                ) {
                    console.log('Save deletions');
                    this.props.onDeleteData(this.state.deletions);
                }
            } else {
                window.alert(
                    'Saving data failed - error output is in console.'
                );
            }
        });
        console.groupEnd();
    }

    private saveCallback() {
        console.log('Hiding successfulSave div');
        this.setState({ successfulSave: false });
    }

    @observable showLoginModal: boolean = false;
    @observable isProcessingSaveData: boolean = false;

    private openLoginModal() {
        this.showLoginModal = true;
    }

    private closeLoginModal() {
        this.showLoginModal = false;
        this.props.checkPermission().then(res => {
            console.log('checkPermission returned with ' + res);
            this.setState({ loggedIn: res[0] });
            this.setState({ permission: res[1] });
        });
    }

    private isDisabled(mtb: IMtb) {
        return (
            (mtb.mtbState as MtbState) ===
            Object.keys(MtbState).find(
                key => MtbState[key as keyof typeof MtbState] === MtbState.FINAL
            )
        );
    }

    private test() {
        console.group('Test');
        console.log(this.props);
        console.groupEnd();
    }

    render() {
        return (
            <div>
                <LoginModal
                    showLoginModal={this.showLoginModal}
                    handleClose={() => this.closeLoginModal()}
                    mtbUrl={this.props.mtbUrl}
                />
                <h2 style={{ marginBottom: '0' }}>MTB Sessions</h2>
                <p className={styles.edit}>
                    <div className="btn-group">
                        <Button
                            type="button"
                            className={
                                'btn btn-default ' + styles.addMTBFUButton
                            }
                            disabled={!this.state.permission}
                            onClick={() => this.addMtb()}
                        >
                            <i
                                className={`fa fa-plus ${styles.marginLeft}`}
                                aria-hidden="true"
                            ></i>{' '}
                            Add MTB
                        </Button>
                        <Button
                            type="button"
                            className={'btn btn-default ' + styles.testButton}
                            disabled={!this.state.permission}
                            onClick={() => {
                                this.saveMtbs();
                                this.state.mtbs.forEach((mtb: IMtb) =>
                                    sessionStorage.removeItem(mtb.id)
                                );
                            }}
                        >
                            Save Data
                        </Button>
                        {this.state.loggedIn ? (
                            <UserInfoButton
                                mtbUrl={this.props.mtbUrl}
                                openLoginModal={() => this.openLoginModal()}
                            />
                        ) : (
                            <span
                                className={'fa fa-stack fa-2x'}
                                style={{
                                    fontSize: '15px',
                                    marginTop: '12px',
                                    marginLeft: '13px',
                                }}
                                title="Write access is only available if you are logged in and authorized."
                            >
                                <i className={'fa fa-user fa-stack-2x'}></i>
                                <i
                                    className={
                                        'fa fa-exclamation-triangle fa-stack-1x fa-inverse'
                                    }
                                    style={{
                                        color: 'yellow',
                                        textAlign: 'right',
                                        bottom: '0px !important',
                                        position: 'absolute',
                                        lineHeight: '3em',
                                    }}
                                ></i>
                            </span>
                        )}
                        {this.state.successfulSave ? (
                            <div className={styles.successBox}>
                                Saving data was successful!
                            </div>
                        ) : null}
                        <LoadingIndicator
                            center={true}
                            isLoading={this.isProcessingSaveData}
                            size="big"
                        />
                    </div>
                </p>
                <MtbTableComponent
                    data={this.state.mtbs}
                    columns={this._columns}
                    showCopyDownload={false}
                    className={styles['mtb-table']}
                />
                <SimpleCopyDownloadControls
                    downloadData={() => flattenStringify(this.state.mtbs)}
                    downloadFilename={`mtb_${this.props.patientId}.json`}
                    controlsStyle="BUTTON"
                />
            </div>
        );
    }

    componentDidMount() {
        this.props.checkPermission().then(res => {
            console.log('checkPermission returned with ' + res);
            this.setState({ loggedIn: res[0] });
            this.setState({ permission: res[1] });
        });
    }
}
