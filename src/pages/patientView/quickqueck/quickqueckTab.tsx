import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action, computed, makeObservable } from 'mobx';
import { Mutation } from 'cbioportal-ts-api-client';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import LazyMobXTable from 'shared/components/lazyMobXTable/LazyMobXTable';
import { CollapsibleTreeSelect } from './CollapsibleTreeSelect';
import { buildQuickqueckColumns } from './utils/quickqueckColumns';
import { getQuickqueckData } from './utils/quickqueckAPIQuery';
import {
    PHASE_FILTER_MAP,
    PHASE_FILTER_OPTIONS,
    collectDescendantIds,
} from './utils/quickqueckLookups';
import {
    QuickqueckData,
    QuickqueckLookupEntry,
    QuickqueckStudy,
} from './utils/quickqueckTypes';

type QuickqueckTabProps = {
    mutations?: Mutation[][];
};

@observer
export default class QuickqueckTab extends React.Component<QuickqueckTabProps> {
    @observable private data: QuickqueckData | null = null;
    @observable private isLoading = true;
    @observable private error: string | null = null;

    @observable private selectedCenters = new Set<number>();
    @observable private selectedEntities = new Set<number>();
    @observable private selectedPhases = new Set<string>();
    @observable private selectedTherapyLines = new Set<number>();
    @observable private patientAge: number | null = null;
    @observable private mutationQuery = '';
    @observable private mutationDropdownOpen = false;

    constructor(props: QuickqueckTabProps) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        this.loadData();
    }

    @action
    private async loadData() {
        this.isLoading = true;
        this.error = null;
        try {
            this.data = await getQuickqueckData();
        } catch (e) {
            this.error = e?.message ?? 'Unknown error loading quickqueck data.';
        } finally {
            this.isLoading = false;
        }
    }

    @computed get filteredStudies(): QuickqueckStudy[] {
        if (!this.data) return [];
        const { ageRangeMap } = this.data;

        const expandedEntityIds = this.expandedSelectedEntityIds;

        return this.data.studies.filter(s => {
            if (
                this.selectedCenters.size > 0 &&
                !this.selectedCenters.has(s.group)
            ) {
                return false;
            }

            if (
                this.selectedEntities.size > 0 &&
                !expandedEntityIds.has(s.entity)
            ) {
                return false;
            }

            if (this.selectedPhases.size > 0) {
                const phaseMatches =
                    s.phase !== null &&
                    Array.from(this.selectedPhases).some(label =>
                        PHASE_FILTER_MAP[label]?.has(s.phase!)
                    );
                if (!phaseMatches) return false;
            }

            if (
                this.selectedTherapyLines.size > 0 &&
                !this.selectedTherapyLines.has(s.therapy_line)
            ) {
                return false;
            }

            if (this.patientAge !== null) {
                const range = ageRangeMap[s.age_group];
                if (range) {
                    if (range.min !== null && this.patientAge < range.min) {
                        return false;
                    }
                    if (range.max !== null && this.patientAge > range.max) {
                        return false;
                    }
                }
            }

            if (this.mutationQuery.trim()) {
                return s.criteria
                    .toLowerCase()
                    .includes(this.mutationQuery.toLowerCase());
            }

            return true;
        });
    }

    /** Selecting a parent entity also matches every descendant entity. */
    @computed private get expandedSelectedEntityIds(): Set<number> {
        const expandedEntityIds = new Set<number>();
        if (!this.data || this.selectedEntities.size === 0) {
            return expandedEntityIds;
        }

        const expand = (entries: QuickqueckLookupEntry[]) => {
            for (const entry of entries) {
                if (this.selectedEntities.has(entry.id)) {
                    for (const id of collectDescendantIds(entry)) {
                        expandedEntityIds.add(id);
                    }
                }
                if (entry.children) expand(entry.children);
            }
        };
        expand(this.data.rawEntities);

        return expandedEntityIds;
    }

    @computed get centerCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            map[s.group] = (map[s.group] ?? 0) + 1;
        }
        return map;
    }

    @computed get entityCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            map[s.entity] = (map[s.entity] ?? 0) + 1;
        }
        return map;
    }

    /** Phase labels are canonical UI filters that may match several API IDs. */
    @computed get phaseEntries(): QuickqueckLookupEntry[] {
        if (!this.data) return [];
        const presentPhaseIds = new Set(
            this.data.studies
                .map(s => s.phase)
                .filter((p): p is number => p !== null)
        );

        return PHASE_FILTER_OPTIONS.map((label, idx) => ({ label, idx }))
            .filter(({ label }) =>
                [...(PHASE_FILTER_MAP[label] ?? [])].some(id =>
                    presentPhaseIds.has(id)
                )
            )
            .map(({ label, idx }) => ({ id: idx, name: label }));
    }

    @computed get phaseCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        PHASE_FILTER_OPTIONS.forEach((label, idx) => {
            map[idx] = this.data!.studies.filter(
                s => s.phase !== null && PHASE_FILTER_MAP[label]?.has(s.phase!)
            ).length;
        });
        return map;
    }

    @computed get selectedPhaseIndices(): Set<number> {
        return new Set(
            Array.from(this.selectedPhases)
                .map(label => PHASE_FILTER_OPTIONS.indexOf(label))
                .filter(i => i >= 0)
        );
    }

    @computed get therapyLineEntries(): QuickqueckLookupEntry[] {
        if (!this.data) return [];
        return Array.from(new Set(this.data.studies.map(s => s.therapy_line)))
            .map(id => ({
                id,
                name: this.data!.therapyLineMap[id] ?? String(id),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    @computed get therapyLineCountMap(): Record<number, number> {
        if (!this.data) return {};
        const map: Record<number, number> = {};
        for (const s of this.data.studies) {
            map[s.therapy_line] = (map[s.therapy_line] ?? 0) + 1;
        }
        return map;
    }

    /** Mutation suggestions are derived from patient mutations in gene and protein-change form. */
    @computed get mutationSuggestions(): string[] {
        const { mutations } = this.props;
        if (!mutations || mutations.length === 0) return [];

        const suggestions = new Set<string>();
        for (const group of mutations) {
            for (const m of group) {
                const gene = m.gene?.hugoGeneSymbol;
                if (gene) {
                    suggestions.add(gene);
                    if (m.proteinChange) {
                        suggestions.add(`${gene} ${m.proteinChange}`);
                    }
                }
            }
        }
        return Array.from(suggestions).sort();
    }

    @action.bound
    private onCenterToggle(id: number) {
        this.selectedCenters = this.toggleSelectedId(this.selectedCenters, id);
    }

    @action.bound
    private onEntityToggle(id: number) {
        this.selectedEntities = this.toggleSelectedId(
            this.selectedEntities,
            id
        );
    }

    @action.bound
    private onPhaseToggle(id: number) {
        const label = PHASE_FILTER_OPTIONS[id];
        if (!label) return;

        const next = new Set(this.selectedPhases);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        this.selectedPhases = next;
    }

    @action.bound
    private onTherapyLineToggle(id: number) {
        this.selectedTherapyLines = this.toggleSelectedId(
            this.selectedTherapyLines,
            id
        );
    }

    @action.bound
    private onPatientAgeChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = e.target.value;
        this.patientAge = val === '' ? null : parseInt(val, 10);
    }

    @action.bound
    private clearAllFilters() {
        this.selectedCenters = new Set();
        this.selectedEntities = new Set();
        this.selectedPhases = new Set();
        this.selectedTherapyLines = new Set();
        this.patientAge = null;
        this.mutationQuery = '';
    }

    private toggleSelectedId(
        selectedIds: Set<number>,
        id: number
    ): Set<number> {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    }

    private renderFilterBar() {
        const hasAnyFilter =
            this.selectedCenters.size > 0 ||
            this.selectedEntities.size > 0 ||
            this.selectedPhases.size > 0 ||
            this.selectedTherapyLines.size > 0 ||
            this.patientAge !== null ||
            this.mutationQuery.trim() !== '';

        const total = this.data?.studies.length ?? 0;
        const shown = this.filteredStudies.length;

        return (
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    gap: '12px',
                    marginBottom: '16px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Center
                    </label>
                    {this.data && (
                        <CollapsibleTreeSelect
                            entries={this.data.rawClinicsAsEntries}
                            presentIds={
                                new Set(this.data.studies.map(s => s.group))
                            }
                            selectedIds={this.selectedCenters}
                            onToggle={this.onCenterToggle}
                            countMap={this.centerCountMap}
                        />
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Entity
                    </label>
                    {this.data && (
                        <CollapsibleTreeSelect
                            entries={this.data.rawEntities}
                            presentIds={
                                new Set(this.data.studies.map(s => s.entity))
                            }
                            selectedIds={this.selectedEntities}
                            onToggle={this.onEntityToggle}
                            countMap={this.entityCountMap}
                        />
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Therapy Line
                    </label>
                    <CollapsibleTreeSelect
                        entries={this.therapyLineEntries}
                        presentIds={
                            new Set(this.therapyLineEntries.map(e => e.id))
                        }
                        selectedIds={this.selectedTherapyLines}
                        onToggle={this.onTherapyLineToggle}
                        countMap={this.therapyLineCountMap}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Phase
                    </label>
                    <CollapsibleTreeSelect
                        entries={this.phaseEntries}
                        presentIds={new Set(this.phaseEntries.map(e => e.id))}
                        selectedIds={this.selectedPhaseIndices}
                        onToggle={this.onPhaseToggle}
                        countMap={this.phaseCountMap}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                    }}
                >
                    <label
                        style={{
                            marginBottom: 0,
                            fontWeight: 600,
                            fontSize: '0.85em',
                        }}
                    >
                        Patient Age
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={120}
                        placeholder="Any"
                        value={this.patientAge ?? ''}
                        onChange={this.onPatientAgeChange}
                        style={{
                            width: 80,
                            padding: '6px 8px',
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            fontSize: '0.95em',
                        }}
                    />
                </div>
                {this.renderMutationFilter()}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        gap: '4px',
                    }}
                >
                    {hasAnyFilter && (
                        <button
                            className="btn btn-sm btn-default"
                            onClick={this.clearAllFilters}
                        >
                            Clear all
                        </button>
                    )}
                    <small style={{ color: '#666', whiteSpace: 'nowrap' }}>
                        {shown} / {total} studies
                    </small>
                </div>
            </div>
        );
    }

    private renderMutationFilter() {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    position: 'relative',
                }}
            >
                <label
                    style={{
                        marginBottom: 0,
                        fontWeight: 600,
                        fontSize: '0.85em',
                    }}
                >
                    Mutation
                </label>
                <div
                    style={{
                        display: 'flex',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        background: '#fff',
                        minWidth: 180,
                    }}
                >
                    <input
                        type="text"
                        placeholder="e.g. KRAS G12C"
                        value={this.mutationQuery}
                        onChange={action(
                            (e: React.ChangeEvent<HTMLInputElement>) => {
                                this.mutationQuery = e.target.value;
                                this.mutationDropdownOpen = true;
                            }
                        )}
                        onFocus={action(() => {
                            this.mutationDropdownOpen = true;
                        })}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            padding: '6px 8px',
                            fontSize: '0.95em',
                            borderRadius: 4,
                        }}
                    />
                    {this.mutationSuggestions.length > 0 && (
                        <button
                            onClick={action(() => {
                                this.mutationDropdownOpen = !this
                                    .mutationDropdownOpen;
                            })}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '0 8px',
                                color: '#999',
                                fontSize: '0.8em',
                            }}
                        >
                            ▼
                        </button>
                    )}
                </div>
                {this.mutationDropdownOpen &&
                    this.mutationSuggestions.length > 0 &&
                    this.renderMutationSuggestions()}
            </div>
        );
    }

    private renderMutationSuggestions() {
        return (
            <>
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9998,
                    }}
                    onClick={action(() => {
                        this.mutationDropdownOpen = false;
                    })}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 9999,
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: 240,
                        overflowY: 'auto',
                        minWidth: 180,
                        marginTop: 2,
                    }}
                >
                    {this.mutationSuggestions
                        .filter(
                            s =>
                                !this.mutationQuery ||
                                s
                                    .toLowerCase()
                                    .includes(this.mutationQuery.toLowerCase())
                        )
                        .map(suggestion => (
                            <div
                                key={suggestion}
                                onClick={action(() => {
                                    this.mutationQuery = suggestion;
                                    this.mutationDropdownOpen = false;
                                })}
                                style={{
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontSize: '0.9em',
                                }}
                                onMouseEnter={e =>
                                    (e.currentTarget.style.background =
                                        '#f5f5f5')
                                }
                                onMouseLeave={e =>
                                    (e.currentTarget.style.background = '')
                                }
                            >
                                {suggestion}
                            </div>
                        ))}
                </div>
            </>
        );
    }

    render() {
        if (this.isLoading) {
            return (
                <LoadingIndicator isLoading={true} size="big" center={true} />
            );
        }

        if (this.error) {
            return (
                <div className="alert alert-danger" role="alert">
                    Failed to load quickqueck trials: {this.error}
                </div>
            );
        }

        if (!this.data || this.data.studies.length === 0) {
            return (
                <div className="alert alert-info" role="alert">
                    No quickqueck trials available.
                </div>
            );
        }

        const columns = buildQuickqueckColumns(
            this.data.entityMap,
            this.data.phaseMap,
            this.data.therapyLineMap,
            this.data.ageRangeMap
        );

        return (
            <div data-test="quickqueck-table">
                <div
                    style={{
                        marginBottom: 12,
                        fontSize: '1.00em',
                        fontWeight: 400,
                    }}
                >
                    Clinical Trials Search via QuickQueck. This search is based
                    on cached results from{' '}
                    {new Date(this.data.lastUpdated).toLocaleDateString()}.
                </div>
                {this.renderFilterBar()}
                <LazyMobXTable
                    columns={columns}
                    data={this.filteredStudies}
                    initialSortColumn="Last Modified"
                    initialSortDirection="desc"
                    showPagination={true}
                    initialItemsPerPage={25}
                />
            </div>
        );
    }
}
