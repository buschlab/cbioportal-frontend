/**
 * Main component for PROMs
 */

import React from 'react';
import Timeline from './components/patientTimeline';
import LineScatterPlot from './components/LineScatterPlotProms';
import {
    DataSet,
    addElementToDataset,
    transformString,
    calculateAverage,
    sortArrayBasedOnComparator,
    isAttributeNumberValueWellDefined,
    isAttributeDateValueWellDefined,
    compareClinicalEvents,
    splitString,
    convertISOToDDMMYYYY,
    parseDate,
} from './utils/PromChartHelperFunctions';
import {
    PROM_KEYS,
    AVERAGE_KEY,
    DATE_KEY,
    INDEX_KEY,
    EQ_RANGE,
    VAS_RANGE,
    EQ_VALUES_ALPHA,
    VAS_VALUES_ALPHA,
    VALUES_ALPHA,
    VALUES_RANGE,
    STANDARD_RANGE,
    THRESHOLDS_EQ,
    THRESHOLDS_VAS,
    CHART_TITLES,
    QUESTIONNAIRE_NAME,
    EQ_5D_5L_INFO_URL,
    SCORES_INFO,
    HEALTH_DETAILS_INFO,
    CURRENT_SCORES_INFO,
    SHOW_REFERENCE_LINE,
    SHOW_STANDARD_RANGE,
    SHOW_THRESHOLDS,
    PROM_EVENT_TYPE,
    SUBTYPE,
} from './utils/EQ-5D-5LChartMetadata';
import PieChart from './components/PieChartProms';
import FontAwesome from 'react-fontawesome';
import { PatientViewPageStore } from 'pages/patientView/clinicalInformation/PatientViewPageStore';
import PatientViewMutationsDataStore from '../mutation/PatientViewMutationsDataStore';
import { Grid, Row, Col } from 'react-bootstrap';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { ClinicalEvent } from 'cbioportal-ts-api-client';
import * as Constants from './utils/PromChartConstants';
import './styles.scss';

interface PROMsProps {
    patientViewPageStore: PatientViewPageStore;
    sampleManager: any;
    dataStore: PatientViewMutationsDataStore;
    allClinicalEventsInStudy: ClinicalEvent[];
}

// Defines the layout and content of tooltip for the info icons
const InfoTooltip = ({
    id,
    children,
    href,
    tooltip,
    placement,
}: {
    id: string;
    children: any;
    href: string;
    tooltip: any;
    placement: string;
}) => {
    return (
        <DefaultTooltip
            placement={placement}
            trigger={['hover', 'focus', 'click']}
            overlay={tooltip}
            arrowContent={<div className="rc-tooltip-arrow-inner" />}
            destroyTooltipOnHide={true}
        >
            {children}
        </DefaultTooltip>
    );
};

/**
 * Transforms and pre-processes the data before it will be provided to the chart components
 * @param data the input data for this component
 * @returns data for the charts as a tuple of three DataSets
 */
const useProcessedData = (data: ClinicalEvent[]): DataSet[] => {
    // Filter data so that only PROM events are included
    const promData = data.filter(
        (event: ClinicalEvent) =>
            event.eventType === QUESTIONNAIRE_NAME ||
            (event.eventType === PROM_EVENT_TYPE &&
                event.attributes.find(
                    eventData =>
                        eventData.key === SUBTYPE &&
                        eventData.value === QUESTIONNAIRE_NAME
                ) !== undefined)
    );

    let datasetKeys: string[] = [];
    let dimensionDataset: DataSet = {};
    let eqVASDataset: DataSet = {};
    let currentScoreDataset: DataSet = {};
    let latestScores: [string, number | string | null][] = [];
    let latestScoreDates: string[] = [];
    let latestScoreDatesKeys: string[] = [];
    let latestScoresDate = '';

    // Write out all keys provided in promData set
    promData.forEach((event: ClinicalEvent) => {
        event.attributes.forEach((item: any) => {
            if (!datasetKeys.includes(item.key)) {
                datasetKeys.push(item.key);
            }
        });
    });

    const datasetKeysForPlots = datasetKeys.filter((key: string) =>
        PROM_KEYS.includes(key)
    );

    // Add key for average
    if (AVERAGE_KEY !== undefined) {
        datasetKeysForPlots.push(AVERAGE_KEY);
    }

    // Write out keys for the dimension plot
    let keysForDimensionPlot = datasetKeysForPlots.filter((key: string) => {
        const dimensionKeys = PROM_KEYS.slice(0, PROM_KEYS.length - 2);
        return dimensionKeys.includes(key);
    });

    // Write out keys for the EQ VAS plot
    let keysForEQVASPlot = datasetKeysForPlots.filter((key: string) => {
        const eqVasKeys = PROM_KEYS.slice(
            PROM_KEYS.length - 2,
            PROM_KEYS.length
        );
        return eqVasKeys.includes(key);
    });

    // Sort promData according to start date in ascending order
    promData.sort(compareClinicalEvents);

    promData.forEach((event: ClinicalEvent) => {
        let valuesForAverageCalculation: number[] = [];
        datasetKeysForPlots.forEach((key: string) => {
            let value = event.attributes.find((item: any) => item.key === key)
                ?.value;

            let date = event.attributes
                .find((item: any) => item.key === DATE_KEY)
                ?.value.trim();

            // Check if date is not found or maldefined
            if (isAttributeDateValueWellDefined(date)) {
                // format date
                const realDate: string = date ? date : '';
                const parsedDate = parseDate(realDate);
                if (parsedDate) {
                    const year = parsedDate.getFullYear();
                    const month = parsedDate.getMonth();
                    const day = parsedDate.getDate();
                    date = new Date(Date.UTC(year, month, day))
                        .toISOString()
                        .split('T')[0];
                }
            } else {
                return;
            }

            // Check value (not for AVERAGE since this does not exist yet)
            if (
                (key !== AVERAGE_KEY &&
                    !isAttributeNumberValueWellDefined(value)) ||
                !date
            ) {
                return;
            }
            if (keysForEQVASPlot.includes(key)) {
                if (value !== undefined) {
                    value = Number.parseFloat(value).toFixed(3);
                    addElementToDataset(eqVASDataset, key, [date, value]);
                }
            } else if (keysForDimensionPlot.includes(key)) {
                // Push values to an array of which the average will be calculated
                if (AVERAGE_KEY !== undefined) {
                    if (key !== AVERAGE_KEY) {
                        valuesForAverageCalculation.push(Number(value));
                    }
                    // Calculate average
                    else {
                        // Try to compute average dynamically
                        value = calculateAverage(
                            valuesForAverageCalculation
                        )?.toString();
                    }
                }

                // Check again if value is well-defined (needed for the average case) and push data to data set
                if (value !== undefined && value.length > 0) {
                    addElementToDataset(dimensionDataset, key, [date, value]);
                }
            } else {
                return;
            }
        });
    });

    // Get latest EQ and VAS score
    const keysOfEqVASDataset = Object.keys(eqVASDataset);

    for (let key of keysOfEqVASDataset) {
        // push last defined date to latestScoreDates
        for (let i = eqVASDataset[key].length - 1; i >= 0; i--) {
            if (
                eqVASDataset[key][i].y !== undefined &&
                eqVASDataset[key][i].y !== null
            ) {
                latestScoreDates.push(eqVASDataset[key][i].x);
                latestScoreDatesKeys.push(key);
                latestScores.push([key, eqVASDataset[key][i].y]);
                break;
            }
        }
    }

    // Check whether there is one date for the latest scores or two
    if (latestScoreDates.length > 0 && latestScores.length > 0) {
        const commonDate = latestScoreDates.every(
            date => date === latestScoreDates[0]
        );
        if (commonDate) {
            latestScoresDate = convertISOToDDMMYYYY(latestScoreDates[0]);
            // Add date of latest questionnaire to latestScores
            latestScores.push(['DATE', latestScoresDate]);
        } else {
            // two different dates
            let mergedScoreArrays: string[] = [];
            for (
                let i = 0;
                i <
                Math.min(latestScoreDates.length, latestScoreDatesKeys.length);
                i++
            ) {
                mergedScoreArrays.push(
                    convertISOToDDMMYYYY(latestScoreDates[i]) +
                        ' (' +
                        transformString(latestScoreDatesKeys[i]) +
                        ')'
                );
            }
            latestScores.push(['DATES', mergedScoreArrays.join(', ')]);
        }

        // Transform latestScores to DataSet
        latestScores.forEach(score => {
            addElementToDataset(currentScoreDataset, score[0], [
                score[0],
                score[1],
            ]);
        });
    }

    return [eqVASDataset, dimensionDataset, currentScoreDataset];
};

/**
 * Adds line breaks to a string and renders it accordingly
 * @param text string to be precessed
 * @returns a JSX element where text is displayed with the added line breaks
 */
const StringWithLineBreaks = ({ text }: { text: string }) => {
    const lines = splitString(text, ',');

    return (
        <React.Fragment>
            {lines.map((line, index) => (
                <span key={index}>
                    {line}
                    {index < lines.length - 1 && ','}
                    {index < lines.length - 1 && <br />}
                </span>
            ))}
        </React.Fragment>
    );
};

const Proms = ({
    patientViewPageStore,
    sampleManager,
    dataStore,
    allClinicalEventsInStudy = [],
}: PROMsProps) => {
    const data = patientViewPageStore.clinicalEvents.result;

    // Processed data
    const processedDataSets = useProcessedData(data);
    const scoreKeys = Object.keys(processedDataSets[0]);
    const dimensionKeys = Object.keys(processedDataSets[1]);
    const currentScoreKeys = Object.keys(processedDataSets[2]); // assert length === 3

    // Sort keys
    const promKeysTransformed = PROM_KEYS.map((key: string) => {
        return key;
    });
    const sortedScoreKeys = sortArrayBasedOnComparator(
        scoreKeys,
        promKeysTransformed
    );
    const sortedDimensionKeys = sortArrayBasedOnComparator(
        dimensionKeys,
        promKeysTransformed
    );
    const sortedCurrentScoreKeys = sortArrayBasedOnComparator(
        currentScoreKeys,
        promKeysTransformed
    );

    // Create the dataset used in the chart components
    const eqVASDataset: DataSet = {};
    for (let i = 0; i < sortedScoreKeys.length; i++) {
        eqVASDataset[sortedScoreKeys[i]] =
            processedDataSets[0][sortedScoreKeys[i]];
    }
    const dimensionDataset: DataSet = {};
    for (let i = 0; i < sortedDimensionKeys.length; i++) {
        dimensionDataset[sortedDimensionKeys[i]] =
            processedDataSets[1][sortedDimensionKeys[i]];
    }
    const currentScoreDataset: DataSet = processedDataSets[2];

    // Get the dates of the latest scores
    const currentScoreDates = currentScoreDataset[
        sortedCurrentScoreKeys[sortedCurrentScoreKeys.length - 1]
    ]
        ? currentScoreDataset[
              sortedCurrentScoreKeys[sortedCurrentScoreKeys.length - 1]
          ][0].y
        : null;
    const currentScoreDatesString = currentScoreDates
        ? currentScoreDates.toString()
        : '';

    // Formatted texts for the info tooltip
    const currentScoresDescriptionFormatted: React.FC = () => {
        return (
            <div
                color={Constants.cBioPortalFontColor}
                dangerouslySetInnerHTML={{ __html: CURRENT_SCORES_INFO }}
            />
        );
    };
    const scoresDescriptionFormatted: React.FC = () => {
        return (
            <div
                color={Constants.cBioPortalFontColor}
                dangerouslySetInnerHTML={{ __html: SCORES_INFO }}
            />
        );
    };
    const healthDetailsDescriptionFormatted: React.FC = () => {
        return (
            <div
                color={Constants.cBioPortalFontColor}
                dangerouslySetInnerHTML={{ __html: HEALTH_DETAILS_INFO }}
            />
        );
    };

    // Define standard range if it exists (default: non-existent, value: [Infinity, Infinity])
    const standardRange =
        STANDARD_RANGE[0] !== Infinity && STANDARD_RANGE[1] !== Infinity
            ? STANDARD_RANGE
            : undefined;

    // Calculate reference value displayed on EQ VAS chart
    const allPromData = allClinicalEventsInStudy.filter(
        (event: ClinicalEvent) =>
            event.eventType === QUESTIONNAIRE_NAME ||
            (event.eventType === PROM_EVENT_TYPE &&
                event.attributes.find(
                    eventData =>
                        eventData.key === SUBTYPE &&
                        eventData.value === QUESTIONNAIRE_NAME
                ) !== undefined)
    );
    let arrayOfAllEQs: number[] = [];
    allPromData.forEach((event: ClinicalEvent) => {
        event.attributes.forEach((item: any) => {
            if (
                item.key === INDEX_KEY &&
                item.value &&
                !isNaN(Number(item.value))
            ) {
                arrayOfAllEQs.push(Number(item.value));
            }
        });
    });
    let studyAverageEQ = calculateAverage(arrayOfAllEQs);
    const studyAverageEQRounded = studyAverageEQ
        ? parseFloat(studyAverageEQ.toFixed(3))
        : undefined;
    // Sort threshold arrays
    THRESHOLDS_EQ.sort((a, b) => a - b);
    THRESHOLDS_VAS.sort((a, b) => a - b);

    // Rendering
    return (
        <div className="proms">
            <h2>Patient-Reported Outcome Measures</h2>
            <div className="questionnaire-title">
                Questionnaire: {QUESTIONNAIRE_NAME} (
                <a href={EQ_5D_5L_INFO_URL} target="_blank" rel="opener">
                    Info
                </a>
                )
            </div>

            <Grid fluid>
                <Row className="prom-grid">
                    <Col md={12} lg={3}>
                        <div className="proms-container-small">
                            <div className="chart-heading-container-left">
                                <div className="chart-heading">
                                    {CHART_TITLES[0]}
                                </div>
                                <InfoTooltip
                                    tooltip={currentScoresDescriptionFormatted}
                                    href="#"
                                    id="currentEqVas"
                                    placement="right"
                                >
                                    <div className="icon-wrapper">
                                        <FontAwesome name="info-circle" />
                                    </div>
                                </InfoTooltip>
                            </div>
                            {sortedCurrentScoreKeys &&
                                sortedCurrentScoreKeys.length > 1 && (
                                    <p>
                                        {transformString(
                                            currentScoreDataset[
                                                sortedCurrentScoreKeys[
                                                    sortedCurrentScoreKeys.length -
                                                        1
                                                ]
                                            ][0].x
                                        )}
                                        {': '}
                                        <StringWithLineBreaks
                                            text={currentScoreDatesString}
                                        />
                                    </p>
                                )}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-evenly',
                                }}
                            >
                                {sortedCurrentScoreKeys &&
                                    sortedCurrentScoreKeys.length > 1 && (
                                        <React.Fragment>
                                            <PieChart
                                                data={
                                                    currentScoreDataset[
                                                        sortedCurrentScoreKeys[0]
                                                    ][0]
                                                }
                                                dataRange={
                                                    sortedCurrentScoreKeys.includes(
                                                        INDEX_KEY
                                                    )
                                                        ? EQ_RANGE
                                                        : VAS_RANGE
                                                }
                                                thresholds={
                                                    sortedCurrentScoreKeys.includes(
                                                        INDEX_KEY
                                                    )
                                                        ? THRESHOLDS_EQ
                                                        : THRESHOLDS_VAS
                                                }
                                                showThresholds={SHOW_THRESHOLDS}
                                            />
                                            {sortedCurrentScoreKeys.length ===
                                                2 &&
                                                (sortedCurrentScoreKeys.includes(
                                                    INDEX_KEY
                                                ) ? (
                                                    <div className="text-unavailable-data">
                                                        No VAS score <br />{' '}
                                                        available
                                                    </div>
                                                ) : (
                                                    <div className="text-unavailable-data">
                                                        No EQ index <br />{' '}
                                                        available
                                                    </div>
                                                ))}
                                        </React.Fragment>
                                    )}
                                {sortedCurrentScoreKeys &&
                                    sortedCurrentScoreKeys.length > 2 && (
                                        <PieChart
                                            data={
                                                currentScoreDataset[
                                                    sortedCurrentScoreKeys[1]
                                                ][0]
                                            }
                                            dataRange={VAS_RANGE}
                                            thresholds={THRESHOLDS_VAS}
                                            showThresholds={SHOW_THRESHOLDS}
                                        />
                                    )}
                            </div>
                            {!sortedCurrentScoreKeys ||
                                (sortedCurrentScoreKeys.length === 0 && (
                                    <p>
                                        Neither EQ indices nor VAS scores are
                                        available for this patient.
                                    </p>
                                ))}
                        </div>
                    </Col>
                    <Col md={12} lg={9}>
                        <div className="proms-container-large">
                            <div className="chart-heading-container-center">
                                <div className="chart-heading__capitalLettersCentered flex-width-container">
                                    {CHART_TITLES[1]}
                                </div>
                                <InfoTooltip
                                    tooltip={scoresDescriptionFormatted}
                                    href="#"
                                    id="scores"
                                    placement="left"
                                >
                                    <div className="icon-wrapper-no-bot-margin">
                                        <FontAwesome name="info-circle" />
                                    </div>
                                </InfoTooltip>
                            </div>
                            {/* EQ vs VAS */}
                            {eqVASDataset &&
                                Object.keys(eqVASDataset).length > 0 && (
                                    <LineScatterPlot
                                        data={eqVASDataset}
                                        title="Scores"
                                        xLabel="Date"
                                        yLabel="EQ Index"
                                        yTickFormat={EQ_VALUES_ALPHA}
                                        yRange={EQ_RANGE}
                                        secondYLabel="EQ VAS"
                                        secondYTickFormat={VAS_VALUES_ALPHA}
                                        secondYRange={VAS_RANGE}
                                        standardRange={standardRange}
                                        showTooltip={true}
                                        showReferenceLine={SHOW_REFERENCE_LINE}
                                        showStandardRange={SHOW_STANDARD_RANGE}
                                        studyReferenceValue={
                                            studyAverageEQRounded
                                                ? studyAverageEQRounded
                                                : undefined
                                        }
                                    />
                                )}
                            {!eqVASDataset ||
                                (Object.keys(eqVASDataset).length === 0 && (
                                    <p>
                                        Neither EQ indices nor VAS scores are
                                        available for this patient.
                                    </p>
                                ))}
                        </div>
                    </Col>
                </Row>
                <Row className="prom-grid">
                    <Col md={12} lg={9} lgOffset={3}>
                        <div className="proms-container-large">
                            <div className="chart-heading-container-center">
                                <div className="chart-heading__capitalLettersCentered flex-width-container">
                                    {CHART_TITLES[2]}
                                </div>
                                <InfoTooltip
                                    tooltip={healthDetailsDescriptionFormatted}
                                    href="#"
                                    id="healthDetails"
                                    placement="left"
                                >
                                    <div className="icon-wrapper-no-bot-margin">
                                        <FontAwesome name="info-circle" />
                                    </div>
                                </InfoTooltip>
                            </div>
                            {/* Dimensions plot */}
                            {dimensionDataset &&
                                Object.keys(dimensionDataset).length > 0 && (
                                    <LineScatterPlot
                                        data={dimensionDataset}
                                        title="Health State Detail"
                                        xLabel="Date"
                                        yLabel={'Problems'}
                                        yTickFormat={VALUES_ALPHA}
                                        yRange={VALUES_RANGE}
                                        showTooltip={true}
                                        invertYAxis={true}
                                    />
                                )}
                            {!dimensionDataset ||
                                (Object.keys(dimensionDataset).length === 0 && (
                                    <p>
                                        No health state data is applicable for
                                        this patient.
                                    </p>
                                ))}
                        </div>
                    </Col>
                </Row>
                {/* Timeline */}
                {sampleManager && dataStore && (
                    <Row className="prom-grid">
                        <Col md={12} lg={9} lgOffset={3}>
                            <div className="proms-container-large">
                                <Timeline
                                    patientViewPageStore={patientViewPageStore}
                                    sampleManager={sampleManager}
                                    dataStore={dataStore}
                                />
                            </div>
                        </Col>
                    </Row>
                )}
            </Grid>
            <div></div>
        </div>
    );
};

export default Proms;
