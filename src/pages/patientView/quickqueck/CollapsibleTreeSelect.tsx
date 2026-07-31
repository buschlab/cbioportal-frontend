import * as React from 'react';
import { observable, action, makeObservable } from 'mobx';
import { observer } from 'mobx-react';
import { QuickqueckLookupEntry } from './utils/quickqueckTypes';

interface CollapsibleTreeSelectProps {
    entries: QuickqueckLookupEntry[];
    /** Only entries with these IDs, or visible descendants with these IDs, are shown. */
    presentIds: Set<number>;
    selectedIds: Set<number>;
    onToggle: (id: number) => void;
    /** Leaf-level counts; parent totals are summed recursively. */
    countMap?: Record<number, number>;
    placeholder?: string;
}

@observer
export class CollapsibleTreeSelect extends React.Component<
    CollapsibleTreeSelectProps
> {
    @observable private isOpen = false;
    @observable private collapsedGroups: Set<number>;

    constructor(props: CollapsibleTreeSelectProps) {
        super(props);
        // Collect all parent IDs so every group starts collapsed.
        const parentIds = new Set<number>();
        const collectParents = (entries: QuickqueckLookupEntry[]) => {
            for (const e of entries) {
                if (e.children && e.children.length > 0) {
                    parentIds.add(e.id);
                    collectParents(e.children);
                }
            }
        };
        collectParents(props.entries);
        this.collapsedGroups = parentIds;
        makeObservable(this);
    }

    @action.bound
    private toggleOpen() {
        this.isOpen = !this.isOpen;
    }

    @action.bound
    private toggleGroup(id: number) {
        if (this.collapsedGroups.has(id)) {
            this.collapsedGroups.delete(id);
        } else {
            this.collapsedGroups.add(id);
        }
    }

    private countForEntry(entry: QuickqueckLookupEntry): number {
        const { countMap } = this.props;
        if (!countMap) return 0;
        if (!entry.children || entry.children.length === 0) {
            return countMap[entry.id] ?? 0;
        }
        // Sum own count (if selectable) + all descendants
        const self = countMap[entry.id] ?? 0;
        const childSum = (entry.children ?? []).reduce(
            (acc, child) => acc + this.countForEntry(child),
            0
        );
        return self + childSum;
    }

    private renderEntry(
        entry: QuickqueckLookupEntry,
        depth = 0
    ): JSX.Element | null {
        const { presentIds, selectedIds, onToggle, countMap } = this.props;
        const hasChildren = (entry.children ?? []).some(c =>
            presentIds.has(c.id)
        );
        const selfPresent = presentIds.has(entry.id);

        if (!hasChildren && !selfPresent) return null;

        const isCollapsed = this.collapsedGroups.has(entry.id);
        const isSelected = selectedIds.has(entry.id);
        const count = countMap ? this.countForEntry(entry) : null;

        const countBadge =
            count !== null ? (
                <span
                    style={{ marginLeft: 6, color: '#888', fontSize: '0.8em' }}
                >
                    ({count})
                </span>
            ) : null;

        return (
            <div key={entry.id}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        paddingLeft: 8 + depth * 16,
                        cursor: 'pointer',
                        userSelect: 'none',
                        background: isSelected ? '#e8f0fe' : undefined,
                    }}
                    onMouseEnter={e =>
                        (e.currentTarget.style.background = isSelected
                            ? '#d2e3fc'
                            : '#f5f5f5')
                    }
                    onMouseLeave={e =>
                        (e.currentTarget.style.background = isSelected
                            ? '#e8f0fe'
                            : '')
                    }
                >
                    {hasChildren && (
                        <span
                            onClick={e => {
                                e.stopPropagation();
                                this.toggleGroup(entry.id);
                            }}
                            style={{
                                marginRight: 4,
                                fontSize: '0.75em',
                                width: 12,
                                display: 'inline-block',
                                flexShrink: 0,
                            }}
                        >
                            {isCollapsed ? '▶' : '▼'}
                        </span>
                    )}
                    {!hasChildren && (
                        <span
                            style={{
                                width: 16,
                                display: 'inline-block',
                                flexShrink: 0,
                            }}
                        />
                    )}
                    {selfPresent && (
                        <label
                            style={{
                                margin: 0,
                                fontWeight: hasChildren ? 600 : 400,
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                            onClick={() => onToggle(entry.id)}
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggle(entry.id)}
                                style={{ marginRight: 6 }}
                                onClick={e => e.stopPropagation()}
                            />
                            {entry.name}
                            {countBadge}
                        </label>
                    )}
                    {!selfPresent && hasChildren && (
                        <span
                            style={{
                                fontWeight: 600,
                                fontSize: '0.9em',
                                color: '#333',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            {entry.name}
                            {countBadge}
                        </span>
                    )}
                </div>
                {hasChildren && !isCollapsed && (
                    <div>
                        {(entry.children ?? []).map(child =>
                            this.renderEntry(child, depth + 1)
                        )}
                    </div>
                )}
            </div>
        );
    }

    render() {
        const { entries, selectedIds, placeholder = 'All' } = this.props;
        const selectedCount = selectedIds.size;

        // Build summary label from selected IDs
        const allNames: string[] = [];
        const collectNames = (es: QuickqueckLookupEntry[]) => {
            for (const e of es) {
                if (selectedIds.has(e.id)) allNames.push(e.name);
                if (e.children) collectNames(e.children);
            }
        };
        collectNames(entries);

        const triggerLabel =
            selectedCount === 0 ? placeholder : allNames.join(', ');

        return (
            <div style={{ position: 'relative', minWidth: 180, maxWidth: 260 }}>
                {/* Trigger button — mimics react-select appearance */}
                <div
                    onClick={this.toggleOpen}
                    style={{
                        border: '1px solid #cccccc',
                        borderRadius: 4,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        background: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.95em',
                        minHeight: 38,
                    }}
                >
                    <span
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: selectedCount === 0 ? '#999' : '#333',
                            flex: 1,
                        }}
                    >
                        {triggerLabel}
                    </span>
                    <span
                        style={{
                            marginLeft: 8,
                            color: '#999',
                            fontSize: '0.8em',
                        }}
                    >
                        ▼
                    </span>
                </div>

                {/* Dropdown panel */}
                {this.isOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 9999,
                            background: '#fff',
                            border: '1px solid #cccccc',
                            borderRadius: 4,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            maxHeight: 320,
                            overflowY: 'auto',
                            marginTop: 2,
                        }}
                    >
                        {entries.map(entry => this.renderEntry(entry))}
                    </div>
                )}

                {/* Click-outside overlay */}
                {this.isOpen && (
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={this.toggleOpen}
                    />
                )}
            </div>
        );
    }
}
