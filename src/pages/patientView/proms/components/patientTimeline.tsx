/**
 * Component that displays the timeline in the PROMs tab
 */

import React, { useState } from 'react';
import TimelineWrapper from 'pages/patientView/timeline/TimelineWrapper';
import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import PatientViewMutationsDataStore from 'pages/patientView/mutation/PatientViewMutationsDataStore';
import WindowStore from 'shared/components/window/WindowStore';
import './../styles.scss';

interface PatientTimelineProps {
    patientViewPageStore: PatientViewPageStore;
    sampleManager: any;
    dataStore: PatientViewMutationsDataStore;
}

const Timeline = ({
    patientViewPageStore,
    sampleManager,
    dataStore,
}: PatientTimelineProps) => {
    // Use useState to manage the visibility state
    const [showTimeline, setShowTimeline] = useState(false); // Initialize as false (initially hidden)
    // Define the toggle function
    const toggleTimeline = () => {
        setShowTimeline(prevShowTimeline => !prevShowTimeline);
    };

    // Check if necessary data is available before rendering the timeline section
    const canShowTimelineSection =
        !!sampleManager &&
        patientViewPageStore.clinicalEvents.isComplete &&
        patientViewPageStore.clinicalEvents.result.length > 0;

    return (
        <div>
            {canShowTimelineSection && (
                <div>
                    <div
                        style={{
                            marginTop: 20,
                            marginBottom: 20,
                        }}
                    >
                        <button
                            className="btn btn-xs btn-default displayBlock button-margin"
                            onClick={toggleTimeline}
                            data-test="ToggleTimeline"
                        >
                            {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
                        </button>
                        {showTimeline && (
                            <TimelineWrapper
                                dataStore={dataStore}
                                caseMetaData={{
                                    color: sampleManager.sampleColors,
                                    label: sampleManager.sampleLabels,
                                    index: sampleManager.sampleIndex,
                                }}
                                data={
                                    patientViewPageStore.clinicalEvents.result
                                }
                                sampleManager={sampleManager}
                                width={WindowStore.size.width}
                                samples={patientViewPageStore.samples.result}
                                mutationProfileId={
                                    patientViewPageStore
                                        .mutationMolecularProfileId.result!
                                }
                            />
                        )}
                    </div>
                    <hr />
                </div>
            )}
        </div>
    );
};

export default Timeline;
