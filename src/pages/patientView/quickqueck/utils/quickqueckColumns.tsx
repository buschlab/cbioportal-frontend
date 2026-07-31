import * as React from 'react';
import { Column } from 'shared/components/lazyMobXTable/LazyMobXTable';
import {
    AgeRangeMap,
    QuickqueckContact,
    QuickqueckStudy,
} from './quickqueckTypes';

function renderContacts(contacts: QuickqueckContact[]): JSX.Element {
    if (contacts.length === 0) return <span>—</span>;

    return (
        <span>
            {contacts.map((c, i) => (
                <span key={i}>
                    {i > 0 && <br />}
                    {c.department && <span>{c.department}: </span>}
                    {c.email ? (
                        <a href={`mailto:${c.email}`}>{c.name}</a>
                    ) : (
                        c.name
                    )}
                </span>
            ))}
        </span>
    );
}

/** Builds the QuickQueck trial table columns without owning table state. */
export function buildQuickqueckColumns(
    entityMap: Record<number, string>,
    phaseMap: Record<number, string>,
    therapyLineMap: Record<number, string>,
    ageRangeMap: AgeRangeMap
): Column<QuickqueckStudy>[] {
    return [
        {
            name: 'Study',
            render: (s: QuickqueckStudy) => (
                <a
                    href={`https://quickqueck.de/detail/${s.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {s.study_name}
                </a>
            ),
            sortBy: (s: QuickqueckStudy) => s.study_name,
            filter: (s, filterString) =>
                s.study_name.toLowerCase().includes(filterString.toLowerCase()),
            width: 300,
        },
        {
            name: 'Number',
            render: (s: QuickqueckStudy) => (
                <a
                    href={s.study_link}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {s.study_number}
                </a>
            ),
            sortBy: (s: QuickqueckStudy) => s.study_number,
            filter: (s, filterString) =>
                s.study_number
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 130,
        },
        {
            name: 'Center',
            render: (s: QuickqueckStudy) => <span>{s.group_name}</span>,
            sortBy: (s: QuickqueckStudy) => s.group_name,
            filter: (s, filterString) =>
                s.group_name.toLowerCase().includes(filterString.toLowerCase()),
            width: 160,
        },
        {
            name: 'Entity',
            render: (s: QuickqueckStudy) => (
                <span>{entityMap[s.entity] ?? String(s.entity)}</span>
            ),
            sortBy: (s: QuickqueckStudy) =>
                entityMap[s.entity] ?? String(s.entity),
            filter: (s, filterString) =>
                (entityMap[s.entity] ?? '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 140,
        },
        {
            name: 'Therapy Line',
            render: (s: QuickqueckStudy) => (
                <span>
                    {therapyLineMap[s.therapy_line] ?? String(s.therapy_line)}
                </span>
            ),
            sortBy: (s: QuickqueckStudy) =>
                therapyLineMap[s.therapy_line] ?? String(s.therapy_line),
            filter: (s, filterString) =>
                (therapyLineMap[s.therapy_line] ?? '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 110,
        },
        {
            name: 'Phase',
            render: (s: QuickqueckStudy) => (
                <span>
                    {s.phase !== null
                        ? phaseMap[s.phase] ?? String(s.phase)
                        : '—'}
                </span>
            ),
            sortBy: (s: QuickqueckStudy) =>
                s.phase !== null ? phaseMap[s.phase] ?? String(s.phase) : '',
            filter: (s, filterString) =>
                (s.phase !== null ? phaseMap[s.phase] ?? '' : '')
                    .toLowerCase()
                    .includes(filterString.toLowerCase()),
            width: 90,
        },
        {
            name: 'Min Age',
            render: (s: QuickqueckStudy) => {
                const range = ageRangeMap[s.age_group];
                return <span>{range?.min ?? '0'}</span>;
            },
            sortBy: (s: QuickqueckStudy) => ageRangeMap[s.age_group]?.min ?? -1,
            filter: (s, filterString) =>
                String(ageRangeMap[s.age_group]?.min ?? '').includes(
                    filterString
                ),
            width: 70,
        },
        {
            name: 'Max Age',
            render: (s: QuickqueckStudy) => {
                const range = ageRangeMap[s.age_group];
                return <span>{range?.max ?? '∞'}</span>;
            },
            sortBy: (s: QuickqueckStudy) =>
                ageRangeMap[s.age_group]?.max ?? Infinity,
            filter: (s, filterString) =>
                String(ageRangeMap[s.age_group]?.max ?? '').includes(
                    filterString
                ),
            width: 70,
        },
        {
            name: 'Trial Description',
            render: (s: QuickqueckStudy) => (
                <span style={{ whiteSpace: 'pre-wrap' }}>{s.criteria}</span>
            ),
            sortBy: (s: QuickqueckStudy) => s.criteria,
            filter: (s, filterString) =>
                s.criteria.toLowerCase().includes(filterString.toLowerCase()),
            width: 320,
        },
        {
            name: 'Contact (Clinician)',
            render: (s: QuickqueckStudy) => renderContacts(s.doctors),
            sortBy: (s: QuickqueckStudy) =>
                s.doctors.map(c => c.name).join(', '),
            filter: (s, filterString) =>
                s.doctors.some(
                    c =>
                        c.name
                            .toLowerCase()
                            .includes(filterString.toLowerCase()) ||
                        (c.email ?? '')
                            .toLowerCase()
                            .includes(filterString.toLowerCase())
                ),
            width: 200,
        },
        {
            name: 'Contact (Assistance)',
            render: (s: QuickqueckStudy) => renderContacts(s.assistants),
            sortBy: (s: QuickqueckStudy) =>
                s.assistants.map(c => c.name).join(', '),
            filter: (s, filterString) =>
                s.assistants.some(
                    c =>
                        c.name
                            .toLowerCase()
                            .includes(filterString.toLowerCase()) ||
                        (c.email ?? '')
                            .toLowerCase()
                            .includes(filterString.toLowerCase())
                ),
            width: 200,
        },
        {
            name: 'Last Modified',
            render: (s: QuickqueckStudy) => (
                <span>
                    {s.last_modified !== null
                        ? new Date(s.last_modified).toLocaleDateString()
                        : '—'}
                </span>
            ),
            sortBy: (s: QuickqueckStudy) => s.last_modified,
            width: 110,
        },
    ];
}
