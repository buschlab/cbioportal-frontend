/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for PieChartProms component
 */

import React from 'react';
import { inspect } from 'util';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PieChart from './PieChartProms';
import * as Constants from '../utils/PromChartConstants';
import { Datum } from '../utils/PromChartHelperFunctions';

// Mocking victory components to avoid rendering complex SVG in tests
jest.mock('victory', () => ({
    ...jest.requireActual('victory'),
    VictoryPie: (props: any) => (
        <div data-testid="victory-pie" data-props={inspect(props)} />
    ),
    VictoryLabel: (props: any) => (
        <div data-testid="victory-label" style={props.style}>
            {props.text}
        </div>
    ),
    VictoryContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="victory-container">{children}</div>
    ),
}));

// Helper functions from PieChartProms.tsx to test them in isolation
const getColors = (
    y: number,
    thresholds: number[] | null | undefined,
    thresholdColorScale: string[],
    defaultColorScale: string[]
): string[] => {
    if (
        thresholds === null ||
        thresholds === undefined ||
        thresholds.length === 0 ||
        thresholdColorScale.length === 0
    ) {
        return defaultColorScale;
    }

    let colorIndex = thresholds.length;
    for (let j = 0; j < thresholds.length; j++) {
        if (thresholds[j] > y) {
            colorIndex = j;
            break;
        }
    }

    let color: string;

    if (
        thresholdColorScale.length > thresholds.length ||
        colorIndex < thresholdColorScale.length
    ) {
        color = thresholdColorScale[colorIndex];
    } else {
        color = thresholdColorScale[thresholdColorScale.length - 1];
    }

    const newColors = [...defaultColorScale];
    newColors.shift();
    newColors.unshift(color);

    return newColors;
};

const processData = (data: Datum, range: [number, number]): Datum[] => {
    let newData: Datum[] = [];

    newData[0] = data;
    newData[1] = { x: '', y: data.y !== null ? range[1] - data.y : range[1] };

    return newData;
};

describe('PieChartProms helpers', () => {
    describe('getColors', () => {
        const defaultColors = ['#cccccc', '#f0f0f0'];
        const thresholdColors = ['red', 'yellow', 'green', 'blue'];

        it('should return default colors if thresholds are null', () => {
            expect(getColors(50, null, thresholdColors, defaultColors)).toEqual(
                defaultColors
            );
        });

        it('should return default colors if thresholds are undefined', () => {
            expect(
                getColors(50, undefined, thresholdColors, defaultColors)
            ).toEqual(defaultColors);
        });

        it('should return default colors if thresholds array is empty', () => {
            expect(getColors(50, [], thresholdColors, defaultColors)).toEqual(
                defaultColors
            );
        });

        it('should select color based on y value being below first threshold', () => {
            const thresholds = [25, 75];
            const expected = [thresholdColors[0], defaultColors[1]];
            expect(
                getColors(10, thresholds, thresholdColors, defaultColors)
            ).toEqual(expected);
        });
    });

    describe('processData', () => {
        const range: [number, number] = [0, 100];

        it('should process data with a positive y value', () => {
            const data: Datum = { x: 'Test', y: 75 };
            const result = processData(data, range);
            expect(result).toEqual([
                { x: 'Test', y: 75 },
                { x: '', y: 25 },
            ]);
        });

        it('should process data with a null y value', () => {
            const data: Datum = { x: 'Test', y: null };
            const result = processData(data, range);
            expect(result).toEqual([
                { x: 'Test', y: null },
                { x: '', y: 100 },
            ]);
        });
    });
});

describe('PieChart', () => {
    const defaultProps = {
        data: { x: 'VAS', y: 80 },
        dataRange: [0, 100] as [number, number],
    };

    it('renders without crashing', () => {
        render(<PieChart {...defaultProps} />);
        expect(screen.getByTestId('victory-pie')).toBeInTheDocument();
    });

    it('displays the correct value and name', () => {
        render(<PieChart {...defaultProps} />);
        expect(screen.getByText('80')).toBeInTheDocument();
        expect(screen.getByText('VAS')).toBeInTheDocument();
    });

    it('displays "N/A" when data.y is null', () => {
        const props = {
            ...defaultProps,
            data: { x: 'VAS', y: null },
        };
        render(<PieChart {...props} />);
        expect(screen.getByText('N/A')).toBeInTheDocument();
        expect(screen.getByText('VAS')).toBeInTheDocument();
    });

    it('applies negative color style for negative values', () => {
        const props = {
            ...defaultProps,
            data: { x: 'Index', y: -0.1 },
            dataRange: [-0.594, 1] as [number, number],
        };
        render(<PieChart {...props} />);
        const valueLabel = screen.getByText('-0.1');
        expect(valueLabel).toBeInTheDocument();
        expect(valueLabel).toHaveStyle({
            fill: Constants.eqLayoutValues.colorNegative,
        });
    });

    it('applies default color style for positive values', () => {
        render(<PieChart {...defaultProps} />);
        const valueLabel = screen.getByText('80');
        expect(valueLabel).toBeInTheDocument();
        expect(valueLabel).toHaveStyle({
            fill: Constants.cBioPortalFontColor,
        });
    });

    it('passes correct colorScale to VictoryPie based on 1 threshold', () => {
        const props = {
            ...defaultProps,
            data: { x: 'VAS', y: 40 },
            thresholds: [50],
            showThresholds: true,
        };
        render(<PieChart {...props} />);
        const pie = screen.getByTestId('victory-pie');
        const pieProps = pie.getAttribute('data-props')!;
        let positionColorScale = pieProps.lastIndexOf('colorScale');
        let result: string[] = ['', ''];
        if (positionColorScale > 0) {
            const colorScaleValues = pieProps
                .slice(positionColorScale + 12, positionColorScale + 12 + 25)
                .trim();
            //console.log(colorScaleValues)
            const individualsValues = colorScaleValues.split(',');
            const thresholdColorScaleValue = individualsValues[0].slice(
                3,
                individualsValues[0].length - 1
            );
            const defaultColorScaleValue = individualsValues[1].slice(
                2,
                individualsValues[1].length - 3
            );
            //console.log(thresholdColorScaleValue)
            //console.log(defaultColorScaleValue)
            result = [thresholdColorScaleValue, defaultColorScaleValue];
        }

        const expectedColorScale = [
            Constants.thresholdColorScale[0],
            Constants.defaultPieColors[1],
        ];

        expect(result).toEqual(expectedColorScale);
    });

    it('passes correct colorScale to VictoryPie with 2 thresholds', () => {
        const props = {
            ...defaultProps,
            data: { x: 'VAS', y: 60 },
            thresholds: [50, 80],
            showThresholds: true,
        };
        render(<PieChart {...props} />);
        const pie = screen.getByTestId('victory-pie');
        //console.log(pie.getAttribute('data-props'))
        const pieProps = pie.getAttribute('data-props')!;
        let positionColorScale = pieProps.lastIndexOf('colorScale');
        let result: string[] = ['', ''];
        if (positionColorScale > 0) {
            const colorScaleValues = pieProps
                .slice(positionColorScale + 12, positionColorScale + 12 + 25)
                .trim();
            //console.log(colorScaleValues)
            const individualsValues = colorScaleValues.split(',');
            const thresholdColorScaleValue = individualsValues[0].slice(
                3,
                individualsValues[0].length - 1
            );
            const defaultColorScaleValue = individualsValues[1].slice(
                2,
                individualsValues[1].length - 3
            );
            //console.log(thresholdColorScaleValue)
            //console.log(defaultColorScaleValue)
            result = [thresholdColorScaleValue, defaultColorScaleValue];
        }

        const expectedColorScale = [
            Constants.thresholdColorScale[2],
            Constants.defaultPieColors[1],
        ];

        expect(result).toEqual(expectedColorScale);
    });
});
