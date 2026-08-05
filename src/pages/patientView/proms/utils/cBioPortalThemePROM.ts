/**
 * This file loads the CBIOPORTAL_VICTORY_THEME for Victory charts and adapts it for the
 * case of the PROM charts
 */

import { CBIOPORTAL_VICTORY_THEME } from 'cbioportal-frontend-commons';
import * as Constants from './PromChartConstants';
import { assign } from 'lodash';

// *
// * Typography
// *
const sansSerif = 'Arial, Helvetica';
const letterSpacing = 'normal';
const fontSize = Constants.TEXT_FONTSIZE;
// *
// * Layout
// *
const padding = 8;
const baseProps = {
    fontFamily: sansSerif,
    width: 350,
    height: 350,
    padding: 50,
};
// *
// * Labels
// *
const baseLabelStyles = {
    fontFamily: sansSerif,
    fontSize,
    letterSpacing,
    padding,
    stroke: 'transparent',
    strokeWidth: 0,
};
const centeredLabelStyles = assign({ textAnchor: 'middle' }, baseLabelStyles);
const axisLabelStyles = assign({}, baseLabelStyles, {
    fontSize: Constants.AXISLABEL_FONTSIZE,
    padding,
});
const axisTickLabelStyles = assign({}, baseLabelStyles, {
    fontSize: Constants.TICKLABEL_FONTSIZE,
    fill: Constants.cBioPortalFontColor,
    padding: 2,
});
const legendLabelStyles = assign({}, baseLabelStyles);
// *
// * Strokes
// *
const strokeLinecap = 'round';
const strokeLinejoin = 'round';

const CBIOPORTAL_VICTORY_THEME_PROM = {
    axis: assign(
        {
            style: {
                axis: {
                    //fill: 'transparent',
                    stroke: Constants.AXIS_COLOR,
                    strokeWidth: Constants.AXIS_STROKE_WIDTH,
                    strokeLinecap,
                    strokeLinejoin,
                },
                axisLabel: assign({}, centeredLabelStyles, axisLabelStyles),
                grid: CBIOPORTAL_VICTORY_THEME.axis.style.grid,
                ticks: {
                    //fill: 'transparent',
                    size: Constants.TICK_SIZE,
                    stroke: Constants.TICK_COLOR,
                    strokeWidth: Constants.TICK_STROKE_WIDTH,
                    strokeLinecap,
                    strokeLinejoin,
                },
                tickLabels: axisTickLabelStyles,
            },
        },
        baseProps
    ),
    chart: baseProps,
    line: assign(
        {
            style: {
                data: {
                    fill: 'transparent',
                    opacity: 1,
                    strokeWidth: Constants.LINE_STROKE_WIDTH,
                },
                labels: centeredLabelStyles,
            },
        },
        baseProps
    ),
    pie: CBIOPORTAL_VICTORY_THEME.pie,
    scatter: assign(
        {
            style: {
                labels: centeredLabelStyles,
            },
            size: Constants.SCATTER_POINT_SIZE,
        },
        baseProps
    ),
    tooltip: CBIOPORTAL_VICTORY_THEME.tooltip,
    legend: {
        titleOrientation: 'top',
        style: {
            labels: legendLabelStyles,
            title: assign({}, baseLabelStyles, { padding: 5 }),
        },
    },
};

export default CBIOPORTAL_VICTORY_THEME_PROM;
