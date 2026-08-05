/**
 * Component for Victory pie chart
 */

import React from 'react';
import { VictoryLabel, VictoryPie, VictoryContainer } from 'victory';
import * as Constants from '../utils/PromChartConstants';
import { Datum, transformString } from '../utils/PromChartHelperFunctions';
import CBIOPORTAL_VICTORY_THEME_PROM from '../utils/cBioPortalThemePROM';

interface PieChartProps {
    data: Datum;
    width?: number;
    height?: number;
    dataRange: [number, number];
    thresholds?: number[];
    showThresholds?: boolean;
}

/**
 * Defines the colors to be used by the chart
 * @param y number, value to be displayed in the pie chart
 * @param thresholds optional parameter indicating that the color should be selected according to some threshold values
 * @param thresholdColorScale string[] array containing the colors used when thresholds are given
 * @param defaultColorScale string[] array containing the colors which are used as default
 * @returns an array of colors as strings
 */
const getColors = (
    y: number,
    thresholds: number[] | null | undefined,
    thresholdColorScale: string[],
    defaultColorScale: string[]
): string[] => {
    // Check whether thresholds are defined
    if (
        thresholds === null ||
        thresholds === undefined ||
        thresholds.length === 0 ||
        thresholdColorScale.length === 0
    ) {
        return defaultColorScale;
    }

    // For given y, find index of nearest smaller number of thresholds
    let colorIndex = thresholds.length;
    for (let j = 0; j < thresholds.length; j++) {
        if (thresholds[j] > y) {
            colorIndex = j;
            break;
        }
    }

    let color: string;

    // Case: length of thresholds is greater than or equal to length of colors corresponding to thresholds
    if (
        thresholdColorScale.length > thresholds.length ||
        colorIndex < thresholdColorScale.length
    ) {
        color = thresholdColorScale[colorIndex];
    } else {
        color = thresholdColorScale[thresholdColorScale.length - 1]; // Choose last color
    }

    const newColors = [...defaultColorScale];
    newColors.shift();
    newColors.unshift(color);

    return newColors;
};

/**
 * Pre-processes the data before it will be rendered in the chart
 * @param data Datum, x/y value pair
 * @param range tuple representing the total range of y
 * @returns processed data
 */
const processData = (data: Datum, range: [number, number]): Datum[] => {
    let newData: Datum[] = [];

    newData[0] = data;
    newData[1] = { x: '', y: data.y !== null ? range[1] - data.y : range[1] };

    return newData;
};

const PieChart: React.FC<PieChartProps> = ({
    data,
    width = 125,
    height = 150,
    dataRange,
    thresholds,
    showThresholds = false,
}) => {
    const viewBoxPath = '0 0 ' + width + ' ' + height;
    const processedData = processData(data, dataRange);
    let thresholdColorScale = Constants.thresholdColorScale;

    if (showThresholds && thresholds) {
        switch (thresholds.length) {
            case 1:
                thresholdColorScale = [
                    Constants.thresholdColorScale[0],
                    Constants.thresholdColorScale[4],
                ];
                break;
            case 2:
                thresholdColorScale = [
                    Constants.thresholdColorScale[0],
                    Constants.thresholdColorScale[2],
                    Constants.thresholdColorScale[4],
                ];
                break;
            case 3:
                thresholdColorScale = [
                    Constants.thresholdColorScale[0],
                    Constants.thresholdColorScale[2],
                    Constants.thresholdColorScale[3],
                    Constants.thresholdColorScale[4],
                ];
                break;
            default:
                break;
        }
    }

    return (
        <div>
            <svg viewBox={viewBoxPath} width={width} height={height}>
                {/* Pie Chart */}
                <VictoryPie
                    theme={CBIOPORTAL_VICTORY_THEME_PROM}
                    containerComponent={<VictoryContainer />}
                    standalone={false}
                    radius={width / 3}
                    width={width}
                    height={width}
                    innerRadius={width / 4}
                    labels={[]}
                    data={processedData}
                    colorScale={getColors(
                        data.y !== null ? data.y : NaN,
                        showThresholds ? thresholds : undefined,
                        thresholdColorScale,
                        Constants.defaultPieColors
                    )}
                    padAngle={3}
                />

                {/* Labels for name and value*/}
                {/* Value in the middle of the donut chart*/}
                <VictoryLabel
                    textAnchor="middle"
                    style={{
                        fontSize: Constants.LABEL_TITLE_FONTSIZE,
                        fontWeight: 'bold',
                        fill:
                            data.y !== null && data.y < 0
                                ? Constants.eqLayoutValues.colorNegative
                                : Constants.cBioPortalFontColor,
                    }}
                    x={width / 2}
                    y={width / 2}
                    text={data.y !== null ? data.y : 'N/A'}
                />

                {/* Name below chart */}
                <VictoryLabel
                    textAnchor="middle"
                    style={{
                        fontSize: Constants.LABEL_TITLE_FONTSIZE,
                        fill: Constants.cBioPortalFontColor,
                    }}
                    x={width / 2}
                    y={height - 20}
                    text={transformString(data.x.toString())}
                />
            </svg>
        </div>
    );
};

export default PieChart;
