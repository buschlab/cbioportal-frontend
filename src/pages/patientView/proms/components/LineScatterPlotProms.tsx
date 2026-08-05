/**
 * Component for Victory line scatter plot
 */

import React, { useState, useEffect, useRef } from 'react';
import { saveSvgAsPng } from 'save-svg-as-png';
import {
    VictoryChart,
    VictoryLine,
    VictoryScatter,
    VictoryAxis,
    VictoryLegend,
    VictoryTooltip,
    VictoryGroup,
    VictoryLabel,
    VictoryArea,
    VictoryZoomContainer,
    VictoryTheme,
} from 'victory';
import { DownloadControls } from 'cbioportal-frontend-commons';
import CBIOPORTAL_VICTORY_THEME_PROM from '../utils/cBioPortalThemePROM';
import {
    AVERAGE_KEY,
    INDEX_KEY,
    VAS_KEY,
    STANDARD_RANGE_KEY,
    REFERENCE_VALUE_KEY,
    QUESTIONNAIRE_NAME,
} from '../utils/EQ-5D-5LChartMetadata';
import * as Constants from '../utils/PromChartConstants';
import '../styles.scss';
import {
    Datum,
    DataSet,
    normalizeDataSet,
    getNormalizedValue,
    getOriginalY,
    transformString,
    createCommonXAxisForDataSet,
    convertISOToDDMMYYYY,
} from '../utils/PromChartHelperFunctions';

interface LineScatterPlotProps {
    data: DataSet;
    width?: number;
    height?: number;
    title?: string;
    xLabel: string;
    yLabel: string;
    yTickFormat: string[];
    yRange: [number, number];
    secondYLabel?: string;
    secondYTickFormat?: string[];
    secondYRange?: [number, number];
    standardRange?: [number, number];
    showStandardRange?: boolean;
    showTooltip?: boolean;
    invertYAxis?: boolean;
    showReferenceLine?: boolean;
    studyReferenceValue?: number;
}

/**
 * Custom svg component representing an axis with an arrow at the end
 * @param props properties
 * @returns rendered axis
 */
const ArrowAxis = (props: any) => {
    return (
        <svg>
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth={Constants.ARROW_WIDTH}
                    markerHeight={Constants.ARROW_HEIGHT}
                    refX="0"
                    refY={Constants.REF_Y}
                    orient="auto"
                    fill={Constants.AXIS_COLOR}
                >
                    <polygon points={Constants.POLYGON} />
                </marker>
            </defs>
            <line
                x1={props.x1}
                y1={props.y2}
                x2={props.x2}
                y2={props.dimension === 'x' ? props.y2 : props.y1}
                stroke={Constants.AXIS_COLOR}
                stroke-width={Constants.AXIS_STROKE_WIDTH}
                marker-end="url(#arrowhead)"
            />
        </svg>
    );
};

/**
 * Defines the color used for a line
 * @param key string identifying the line
 * @param index number that helps to identify the right color of a pre-defined colors array
 * @returns color as string
 */
const getColor = (key: string, index: number): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.color;
    }
    if (key === INDEX_KEY) {
        return Constants.eqLayoutValues.color;
    }
    if (key === VAS_KEY) {
        return Constants.vasLayoutValues.color;
    }
    if (key === STANDARD_RANGE_KEY) {
        return Constants.standardRangeLayoutValues.color;
    } else {
        return Constants.lineColors[index % Constants.lineColors.length];
    }
};

/**
 * Defines the symbol used in the legend
 * @param key string identifying the set of data points
 * @returns symbol as string
 */
const getLegendSymbol = (key: string): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === INDEX_KEY) {
        // negative values ??
        return Constants.eqLayoutValues.symbol;
    }
    if (key === VAS_KEY) {
        return Constants.vasLayoutValues.symbol;
    }
    if (key === STANDARD_RANGE_KEY) {
        return Constants.standardRangeLayoutValues.symbol;
    }
    if (key === REFERENCE_VALUE_KEY) {
        return Constants.referenceValueLayoutValues.symbol;
    } else {
        return 'minus';
    }
};

/**
 * Defines the symbol used in the scatter chart
 * @param key string identifying a set of data points
 * @param origY original non-normalized y value of a Datum
 * @returns symbol as string
 */
const getScatterSymbol = (key: string, origY: number | null): string => {
    if (key === AVERAGE_KEY) {
        return Constants.averageLayoutValues.symbol;
    }
    if (key === INDEX_KEY) {
        if (origY !== null && origY < 0) {
            return Constants.eqLayoutValues.symbolNegative;
        }
        return Constants.eqLayoutValues.symbol;
    }
    if (key === VAS_KEY) {
        return Constants.vasLayoutValues.symbol;
    } else {
        return 'circle';
    }
};

/**
 * Changes the color for negative EQ Index values
 * @param key string identifying the set of data points
 * @param color string representing the default color
 * @param origY original non-normalized y value of a Datum
 * @returns color of a Datum in the scatter plot as string
 */
const getScatterColor = (
    key: string,
    color: string,
    origY: number | null
): string => {
    if (key === INDEX_KEY && origY !== null && origY < 0) {
        return Constants.eqLayoutValues.colorNegative;
    }
    return color;
};

// Hook to memoize processed data, applying normalization if a second Y axis is present + fill label (needed for tooltip)

/**
 * Pre-processes the data before it will be rendered in the chart
 * @param data DataSet, the input data
 * @param yRange tuple representing the minimum and maximum possible y value of the first y axis
 * @param secondYRange tuple representing the minimum and maximum possible y value of a second y axis
 * @returns processed data
 */
const useProcessedData = (
    data: DataSet,
    yRange: [number, number],
    secondYRange?: [number, number]
): DataSet => {
    const keys = Object.keys(data);

    // fill label property of data entries
    for (let key of keys) {
        data[key].forEach((datum: Datum) => {
            datum.labelName = key;
        });
    }

    // find longest sequence of data points
    let maxLength = 0;
    for (let key of keys) {
        if (data[key].length > maxLength) {
            maxLength = data[key].length;
        }
    }

    // add dummy data as first and last element (used for standardRange)
    for (let key of keys) {
        let dummyDatumBefore: Datum;
        let dummyDatumAfter: Datum;
        dummyDatumBefore = { x: Constants.DUMMY_DATE_IN_THE_PAST, y: null };
        data[key].unshift(dummyDatumBefore);
        dummyDatumAfter = { x: Constants.DUMMY_DAT_IN_THE_FUTURE, y: null };
        data[key].push(dummyDatumAfter);
    }

    // Normalization
    // If no second axis given, return original data (no normalization needed here)
    if (!secondYRange) {
        return data;
    }

    const newData: DataSet = { ...data };

    // Normalize dataset if it exists
    if (yRange && secondYRange) {
        if (keys.length > 1) {
            newData[keys[0]] = normalizeDataSet(data[keys[0]], yRange);
            newData[keys[1]] = normalizeDataSet(data[keys[1]], secondYRange);
        } else if (keys.length === 1) {
            const range = keys[0] === INDEX_KEY ? yRange : secondYRange;
            newData[keys[0]] = normalizeDataSet(data[keys[0]], range);
        }
    }
    return newData;
};

const LineScatterPlot: React.FC<LineScatterPlotProps> = ({
    data,
    width = 580,
    height = 200,
    title,
    xLabel,
    yLabel,
    yTickFormat,
    yRange,
    secondYLabel,
    secondYTickFormat,
    secondYRange,
    standardRange,
    showStandardRange = false,
    showTooltip = true,
    invertYAxis = false,
    showReferenceLine = false,
    studyReferenceValue,
}) => {
    // sort range arrays in ascending order
    yRange.sort((a, b) => a - b);
    secondYRange && secondYRange.sort((a, b) => a - b);
    standardRange && standardRange.sort((a, b) => a - b);
    // useState hook to show and hide specific datasets
    const [hiddenKeys, setHiddenKeys] = useState<string[]>([AVERAGE_KEY]); // datasetes named "Average" are initially not shown
    const [zoomDomain, setZoomDomain] = useState<[number, number]>();
    // Ref for VictoryZoomContainer
    const chartRef = useRef<HTMLDivElement>(null);
    // File names for the svg and png images of the chart
    const exportFileName = title
        ? `${QUESTIONNAIRE_NAME}_${title.toLowerCase()}`
        : `${QUESTIONNAIRE_NAME}_chart`;

    // chart data
    const processedData = useProcessedData(data, yRange, secondYRange);
    const augmentedData = createCommonXAxisForDataSet(processedData);

    // Transform augmentedData: input is object, output will be array
    const datasets = Object.entries(augmentedData).map(([key, points], i) => ({
        key,
        points,
        color: getColor(key, i),
        childName: `dataset-${i}`,
    }));

    /**
     * Adds(removes an identifier of a data set to/from hiddenKeys
     * @param key string identifying the data set
     */
    const toggleKey = (key: string) => {
        setHiddenKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    /**
     * Computes the zoom domain of the line chart based on the length of the displayed data
     * @param data array, the data to be displayed
     */
    const updateZoomDomain = (data: any[]) => {
        if (!data || data.length === 0) return;

        // determine the length of the input data
        let maxNumberOfPoints = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i].points.length > maxNumberOfPoints) {
                maxNumberOfPoints = data[i].points.length;
            }
        }
        // Zoom in if data has too many entries to be nicely displayed together
        if (
            maxNumberOfPoints >
            Constants.MAX_NUMBER_OF_QUESTIONNAIRES_VISIBLE + 2
        ) {
            setZoomDomain([
                1,
                Constants.MAX_NUMBER_OF_QUESTIONNAIRES_VISIBLE + 2,
            ]);
        }
    };

    // Update zoom domain when data prop changes
    useEffect(() => {
        updateZoomDomain(datasets);
    }, []);

    // Events executed when clicked on legend
    // Toggle visibility of legend entry and line-scatter
    const legendEvents = [
        {
            target: ['data', 'labels'],
            eventHandlers: {
                onClick: (_: any, props: any) => {
                    const dataset = mergedDataForLegend[props.index];
                    toggleKey(dataset.key);
                    return [];
                },
            },
        },
    ];

    /**
     * Calculates tick values given the range of the data and the number of ticks
     * @param range tuple representing the minimum and maximum possible y value
     * @param ticks number of ticks on the axis
     * @returns number[] array of tick values
     */
    const yTickValues = (range: [number, number], ticks: number): number[] => {
        // if second y axis present, normalize tick values, otherwise keep original range
        const [min, max] = secondYRange ? [0, 1] : range;
        const step = (max - min) / (ticks - 1);
        return Array.from({ length: ticks }, (_, i) => min + i * step);
    };

    /**
     * Calculates tick values of the x axis for a DataSet
     * @param data DataSet
     * @returns string array with tick values
     */
    const xTickValues = (data: DataSet): Array<string> => {
        const allX: string[] = [];
        for (const series of Object.values(data)) {
            for (const d of series) {
                if (d.x !== null && d.x !== undefined) {
                    allX.push(d.x);
                }
            }
        }

        // Remove duplicates
        const uniqueX = Array.from(new Set(allX));

        // Sort
        const sortedX = uniqueX.sort((a, b) => {
            return new Date(a).getTime() - new Date(b).getTime(); // for dates saved as strings
        });

        // Remove first and last element (dummy elements)
        sortedX.shift();
        sortedX.pop();

        return sortedX;
    };

    /**
     * Defines the text of the tooltip for the scatter points
     * @param datum Datum, the scatter point
     * @param origData Datum with the original non-normalized y value
     * @returns text for the tooltip
     */
    const displayTooltip = (datum: Datum, origData: Datum[]): string => {
        if (secondYRange) {
            const originalY = getOriginalY(datum.x, origData);
            return datum.labelName
                ? `${transformString(datum.labelName)}: ${originalY}`
                : `${originalY}`;
        }
        return datum.labelName
            ? `${transformString(datum.labelName)}: ${datum.y}`
            : `${datum.labelName}: ${datum.y}`;
    };

    /**
     * Exports the Vicotry chart to SVG
     * @param filename name of the file to be saved
     */
    const exportAsSVG = (filename = 'chart.svg') => {
        if (!chartRef.current) {
            alert('Chart not rendered yet!');
            return;
        }

        const svgElement = chartRef.current.querySelector('svg');
        if (!svgElement) {
            alert('SVG element not found!');
            return;
        }

        // Temporarily reset zoom to full range
        const originalZoom = zoomDomain;
        setZoomDomain(undefined);

        setTimeout(() => {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            const blob = new Blob([svgString], {
                type: 'image/svg+xml;charset=utf-8',
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            // Restore original zoom
            setZoomDomain(originalZoom);
        }, 10);
    };

    /**
     * Exports the Vicotry chart to a PNG file
     * @param filename name of the file to be saved
     */
    const exportAsPNG = (filename = 'chart.png') => {
        if (!chartRef.current) {
            alert('Chart not rendered yet!');
            return;
        }

        const svgElement = chartRef.current.querySelector('svg');
        if (!svgElement) {
            alert('SVG element not found!');
            return;
        }

        // Temporarily reset zoom to full range
        const originalZoom = zoomDomain;
        setZoomDomain(undefined);
        // Export
        saveSvgAsPng(svgElement, filename, {
            scale: 3,
            backgroundColor: '#fff',
        });
        // Wait for re-render
        setTimeout(() => {
            // Restore original zoom
            setZoomDomain(originalZoom);
        }, 10);
    };

    // Helpers for displaying reference value
    let referenceValue: number | undefined = undefined;
    let referenceValueNormalized: number | undefined = undefined;
    let dummyDateForReferenceLine = Constants.DUMMY_DATE_IN_THE_PAST;
    let referenceValueLabelLeft = true;
    let referenceValueData: Datum[] = [];
    let referenceValueDataSet: DataSet = {};
    let referenceValueDataSetMapped: {
        key: string;
        points: Datum[];
        color: string;
        childName: string;
    }[] = [];
    let mergedDataForLegend: {
        key: string;
        points: Datum[];
        color: string;
        childName: string;
    }[] = [];

    if (studyReferenceValue && showReferenceLine) {
        referenceValue = studyReferenceValue;
        // normalize referenceValue if necessary
        // check heuristically to which range it belongs
        if (
            secondYRange &&
            referenceValue >= yRange[0] &&
            referenceValue <= yRange[1]
        ) {
            referenceValueNormalized = getNormalizedValue(
                referenceValue,
                yRange[1],
                yRange[0]
            );
        } else if (
            secondYRange &&
            secondYRange[0] <= referenceValue &&
            secondYRange[1] >= referenceValue
        ) {
            referenceValueNormalized = getNormalizedValue(
                referenceValue,
                secondYRange[1],
                secondYRange[0]
            );
            dummyDateForReferenceLine = Constants.DUMMY_DAT_IN_THE_FUTURE;
            referenceValueLabelLeft = false;
        } else {
            // normalization not needed
            referenceValueNormalized = referenceValue;
        }
        referenceValueData = [
            {
                x: Constants.DUMMY_DATE_IN_THE_PAST,
                y: referenceValueNormalized,
            },
            {
                x: Constants.DUMMY_DAT_IN_THE_FUTURE,
                y: referenceValueNormalized,
            },
        ];
        referenceValueDataSet = {
            [REFERENCE_VALUE_KEY]: referenceValueData,
        };
        referenceValueDataSetMapped = Object.entries(referenceValueDataSet).map(
            ([key, points], i) => ({
                key,
                points,
                color: Constants.referenceValueLayoutValues.color,
                childName: `studyRefValue-${i}`,
            })
        );

        mergedDataForLegend = datasets.concat(referenceValueDataSetMapped);
    }

    // Helpers for displaying standard range
    let standardRangeData: Datum[] = [];
    let rangeNormalized: [number, number];
    let standardRangeDataSet: DataSet = {};
    let standardRangeDataMapped: {
        key: string;
        points: Datum[];
        color: string;
        childName: string;
    }[] = [];

    if (showStandardRange && standardRange) {
        // Normalize standardRange if necessary
        // check heuristically to which range it belongs
        if (
            secondYRange &&
            standardRange[0] >= yRange[0] &&
            standardRange[1] <= yRange[1]
        ) {
            rangeNormalized = [
                getNormalizedValue(standardRange[0], yRange[1], yRange[0]),
                getNormalizedValue(standardRange[1], yRange[1], yRange[0]),
            ];
        } else if (
            secondYRange &&
            secondYRange[0] <= standardRange[0] &&
            secondYRange[1] >= standardRange[1]
        ) {
            rangeNormalized = [
                getNormalizedValue(
                    standardRange[0],
                    secondYRange[1],
                    secondYRange[0]
                ),
                getNormalizedValue(
                    standardRange[1],
                    secondYRange[1],
                    secondYRange[0]
                ),
            ];
        } else {
            // normalization not needed
            rangeNormalized = standardRange;
        }
        standardRangeData = [
            {
                x: Constants.DUMMY_DATE_IN_THE_PAST,
                y: rangeNormalized[1],
                y0: rangeNormalized[0],
            },
            {
                x: Constants.DUMMY_DAT_IN_THE_FUTURE,
                y: rangeNormalized[1],
                y0: rangeNormalized[0],
            },
        ];
        standardRangeDataSet = {
            [STANDARD_RANGE_KEY]: standardRangeData,
        };
        standardRangeDataMapped = Object.entries(standardRangeDataSet).map(
            ([key, points], i) => ({
                key,
                points,
                color: getColor(key, i),
                childName: `range-${i}`,
            })
        );
        mergedDataForLegend =
            mergedDataForLegend.length > 0
                ? mergedDataForLegend.concat(standardRangeDataMapped)
                : datasets.concat(standardRangeDataMapped);
    }

    // Handle case where neither a reference value nor standard range are specified
    if (mergedDataForLegend.length === 0) {
        mergedDataForLegend = datasets;
    }

    // Specify that the short form of the year (YY) should be used for the ticks (instead of YYYY)
    const displayYearShort = true;

    // Rendering
    return (
        <div
            style={{
                display: 'flex',
            }}
        >
            <VictoryChart
                width={width}
                height={height}
                theme={CBIOPORTAL_VICTORY_THEME_PROM}
                padding={{
                    top: height / 5,
                    bottom: height / 5,
                    left: width / 5,
                    right: width / 5,
                }} // padding between chart and other Victory components, e. g. legend, title
                domainPadding={{ x: 5, y: height / 10 }} // padding between axes and data points (padding around actual plot within the diagram)
                // Zoom functionality
                containerComponent={
                    <VictoryZoomContainer
                        responsive={true}
                        zoomDimension="x"
                        allowZoom={false}
                        zoomDomain={{ x: zoomDomain }}
                        allowPan={true}
                        containerRef={chartRef}
                    />
                }
            >
                {/* Important: first print Y axis, then X axis */}
                {/* Y Axis */}
                <VictoryAxis
                    dependentAxis
                    invertAxis={invertYAxis}
                    orientation="left"
                    axisComponent={<ArrowAxis />}
                    label={yLabel}
                    tickValues={yTickValues(yRange, yTickFormat.length)}
                    tickFormat={yTickFormat}
                    axisLabelComponent={
                        <VictoryLabel
                            dx={-3 * Constants.TICK_SIZE - 2}
                            dy={-height / 3 + Constants.ARROW_HEIGHT - 1}
                            angle={0}
                        />
                    }
                />
                {/* Second Y Axis */}
                {secondYRange && secondYTickFormat && (
                    <VictoryAxis
                        dependentAxis
                        orientation="right"
                        axisComponent={<ArrowAxis />}
                        label={secondYLabel}
                        tickValues={yTickValues(
                            secondYRange,
                            secondYTickFormat.length
                        )}
                        tickFormat={secondYTickFormat}
                        axisLabelComponent={
                            <VictoryLabel
                                dx={3 * Constants.TICK_SIZE - 1}
                                dy={
                                    -Constants.AXISLABEL_FONTSIZE -
                                    height / 3 +
                                    Constants.ARROW_HEIGHT -
                                    1
                                }
                                angle={0}
                            />
                        }
                        style={{ grid: { strokeOpacity: 0 } }}
                    />
                )}

                {/* X Axis */}
                <VictoryAxis
                    axisComponent={<ArrowAxis />}
                    label={xLabel}
                    tickValues={xTickValues(processedData)}
                    tickFormat={(t: string) =>
                        `${convertISOToDDMMYYYY(t, displayYearShort)}`
                    }
                    axisLabelComponent={
                        <VictoryLabel
                            dx={0.33 * width - Constants.ARROW_HEIGHT}
                            dy={Constants.XLABEL_YOFFSET}
                        />
                    }
                    style={{ grid: { strokeOpacity: 0 } }}
                />

                {/* Plots */}

                {showStandardRange &&
                    standardRange &&
                    standardRangeDataMapped.map(
                        ({ key, points, color, childName }) => {
                            return (
                                <VictoryArea
                                    key={key}
                                    name={childName}
                                    data={points}
                                    style={{
                                        data: {
                                            fill: color,
                                            opacity:
                                                Constants
                                                    .standardRangeLayoutValues
                                                    .areaOpacity,
                                            visibility: hiddenKeys.includes(key)
                                                ? 'hidden'
                                                : 'visible',
                                        },
                                    }}
                                />
                            );
                        }
                    )}

                {/* Reference line */}
                {showReferenceLine &&
                    referenceValue &&
                    referenceValueData &&
                    referenceValueDataSetMapped.map(
                        ({ key, points, color, childName }) => {
                            return (
                                <VictoryLine
                                    key={key}
                                    name={childName}
                                    data={points}
                                    style={{
                                        data: {
                                            stroke: color,
                                            strokeWidth:
                                                Constants.REFERENCELINE_STROKE_WIDTH,
                                            strokeDasharray: '5,5',
                                            visibility: hiddenKeys.includes(key)
                                                ? 'hidden'
                                                : 'visible',
                                        },
                                        labels: {
                                            fill: color,
                                            fontSize:
                                                Constants.REFERENCELABEL_FONTSIZE,
                                            visibility: hiddenKeys.includes(key)
                                                ? 'hidden'
                                                : 'visible',
                                        },
                                    }}
                                    labels={(datum: any) => {
                                        return datum.x ===
                                            dummyDateForReferenceLine
                                            ? `${referenceValue}`
                                            : '';
                                    }}
                                    labelComponent={
                                        <VictoryLabel
                                            dy={6}
                                            dx={
                                                referenceValueLabelLeft
                                                    ? 10
                                                    : -12
                                            }
                                        />
                                    }
                                />
                            );
                        }
                    )}

                {datasets.map(({ key, points, color, childName }, i) => {
                    const scatterPoints = points.filter(
                        p => p.y !== null && p.y !== undefined
                    ); // filters out points with null or undefined y value
                    return (
                        <VictoryGroup key={key} data={scatterPoints}>
                            <VictoryLine
                                name={childName}
                                data={points}
                                style={{
                                    data: {
                                        stroke: color,
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                interpolation="linear"
                            />
                            <VictoryScatter
                                name={childName}
                                data={points}
                                sortOrder="ascending"
                                sortKey="x"
                                scale={{ x: 'time' }}
                                symbol={(d: Datum) =>
                                    getScatterSymbol(
                                        key,
                                        getOriginalY(d.x, data[key])
                                    )
                                } // different scatter symbol for negative EQ values, use original data
                                style={{
                                    data: {
                                        fill: (d: Datum) =>
                                            getScatterColor(
                                                key,
                                                color,
                                                getOriginalY(d.x, data[key])
                                            ), // different color for negative EQ values, use original data
                                        visibility: hiddenKeys.includes(key)
                                            ? 'hidden'
                                            : 'visible',
                                    },
                                }}
                                labels={
                                    !hiddenKeys.includes(key) && showTooltip
                                        ? (d: Datum) =>
                                              displayTooltip(d, data[key])
                                        : null
                                }
                                labelComponent={<VictoryTooltip dy={-7} />}
                            />
                        </VictoryGroup>
                    );
                })}

                {/* Legend */}
                <VictoryLegend
                    title={secondYRange ? null : 'Legend'}
                    orientation={secondYRange ? 'horizontal' : 'vertical'}
                    y={secondYRange ? 16 : height / 6 + 2}
                    x={secondYRange ? width / 5 + 15 : (5 / 6) * width}
                    gutter={18} // only for horizontal alignment
                    name="legend"
                    style={{
                        data: { cursor: 'pointer' },
                        labels: { cursor: 'pointer' },
                    }}
                    data={
                        //
                        //   ?
                        mergedDataForLegend.map(({ key, color }, i) => ({
                            name: transformString(key),
                            symbol: {
                                fill: hiddenKeys.includes(key)
                                    ? 'lightgray'
                                    : color,
                                type: getLegendSymbol(key),
                                opacity:
                                    key === STANDARD_RANGE_KEY
                                        ? Constants.standardRangeLayoutValues
                                              .symbolOpacity
                                        : 1.0,
                            },
                            labels: {
                                fill: hiddenKeys.includes(key)
                                    ? 'lightgray'
                                    : color,
                                opacity:
                                    key === STANDARD_RANGE_KEY &&
                                    !hiddenKeys.includes(key)
                                        ? Constants.standardRangeLayoutValues
                                              .labelOpacity
                                        : 1.0,
                            },
                        }))
                    }
                    labels={({ datum }: any) => datum.name}
                    events={legendEvents}
                />
            </VictoryChart>

            <DownloadControls
                buttons={['SVG', 'PNG']}
                filename={exportFileName}
                getSvg={() => {
                    const svgElement = chartRef.current?.querySelector('svg');
                    return svgElement
                        ? Promise.resolve(svgElement)
                        : Promise.reject('SVG not found');
                }}
                dontFade={true}
                type={'button'}
                style={{ marginTop: 10 }}
            />
        </div>
    );
};

export default LineScatterPlot;
