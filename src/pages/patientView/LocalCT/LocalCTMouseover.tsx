import * as React from 'react';
import _ from 'lodash';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { OQLFilter } from 'pages/studyView/tabs/LocalClinicalTrialsHelperFunctions/LocalCTInterfaces';

export function LocalTrialsTooltip({
    filters,
}: {
    filters: OQLFilter[];
}): JSX.Element {
    const trials = _.uniqBy(
        filters,
        filter => `${filter.trialName ?? ''}::${filter.trialURL ?? ''}`
    );

    // Return a list of all matching local clinical trials with links to their URLs if available
    return (
        <div>
            <strong style={{ fontSize: 16 }}>
                Matching local clinical trials
            </strong>

            {trials.map(trial => (
                <div key={`${trial.trialName}-${trial.trialURL}`}>
                    {trial.trialURL ? (
                        <a
                            href={trial.trialURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                textDecoration: 'underline',
                                fontSize: 14,
                            }}
                        >
                            {trial.trialName}
                        </a>
                    ) : (
                        <span>{trial.trialName}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function LocalTrialsCell({
    filters,
}: {
    filters: OQLFilter[];
}): JSX.Element {
    if (filters.length === 0) {
        return <span />;
    }

    return (
        <DefaultTooltip
            placement="left"
            overlay={<LocalTrialsTooltip filters={filters} />}
        >
            <span
                aria-label="Matching local clinical trial"
                title="Matching inclusion criterion"
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    color: '#28a745',
                    fontSize: 18,
                    lineHeight: 1,
                }}
            >
                🔍
            </span>
        </DefaultTooltip>
    );
}
