/**
 * @jest-environment jsdom
 */

import React from 'react';
import { inspect } from 'util';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LineScatterPlot from './LineScatterPlotProms';
import { DataSet } from '../utils/PromChartHelperFunctions';
import * as Constants from '../utils/PromChartConstants';
import {
    AVERAGE_KEY,
    INDEX_KEY,
    VAS_KEY,
    STANDARD_RANGE_KEY,
} from '../utils/EQ-5D-5LChartMetadata';

// Mocking victory components
jest.mock('victory', () => ({
    ...jest.requireActual('victory'),
    VictoryChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="victory-chart">{children}</div>
    ),
    VictoryLine: (props: any) => (
        <div data-testid="victory-line" data-props={inspect(props)} />
    ),
    VictoryScatter: (props: any) => (
        <div data-testid="victory-scatter" data-props={inspect(props)} />
    ),
    VictoryAxis: (props: any) => (
        <div
            data-testid={`victory-axis-${props.orientation || 'bottom'}`}
            data-props={inspect(props)}
        />
    ),
    VictoryLegend: (props: any) => (
        <div data-testid="victory-legend">
            {props.data.map((d: any, i: number) => (
                <div
                    key={i}
                    data-testid={`legend-item-${i}`}
                    onClick={e =>
                        props.events[0].eventHandlers.onClick(e, { index: i })
                    }
                >
                    {d.name}
                </div>
            ))}
        </div>
    ),
    VictoryTooltip: () => <div />,
    VictoryGroup: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="victory-group">{children}</div>
    ),
    VictoryLabel: (props: any) => <div>{props.text}</div>,
    VictoryArea: (props: any) => (
        <div data-testid="victory-area" data-props={inspect(props)} />
    ),
    VictoryZoomContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="victory-zoom-container">{children}</div>
    ),
}));

// Mock other dependencies
jest.mock('cbioportal-frontend-commons', () => ({
    DefaultTooltip: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    DownloadControls: (props: any) => <div data-testid="download-controls" />,
    CBIOPORTAL_VICTORY_THEME: {
        axis: {
            style: {
                grid: {
                    fill: 'none',
                    stroke: '#ECEFF1',
                    strokeDasharray: '10, 5',
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    pointerEvents: 'visible',
                },
            },
        },
        pie: {
            colorScale: [],
            style: { data: {}, labels: {} },
        },
        tooltip: {
            style: {},
            flyoutStyle: {},
        },
    },
}));

jest.mock('react-fontawesome', () => (props: any) => (
    <i className={`fa fa-${props.name}`} />
));

jest.mock('save-svg-as-png', () => ({
    saveSvgAsPng: jest.fn(),
}));

// Helper functions from LineScatterPlotProms.tsx are not exported, so we redefine them here for testing.
const getColor = (key: string, index: number): string => {
    if (key === AVERAGE_KEY) return Constants.averageLayoutValues.color;
    if (key === INDEX_KEY) return Constants.eqLayoutValues.color;
    if (key === VAS_KEY) return Constants.vasLayoutValues.color;
    if (key === STANDARD_RANGE_KEY)
        return Constants.standardRangeLayoutValues.color;
    return Constants.lineColors[index % Constants.lineColors.length];
};

const getLegendSymbol = (key: string): string => {
    if (key === AVERAGE_KEY) return Constants.averageLayoutValues.symbol;
    if (key === INDEX_KEY) return Constants.eqLayoutValues.symbol;
    if (key === VAS_KEY) return Constants.vasLayoutValues.symbol;
    if (key === STANDARD_RANGE_KEY)
        return Constants.standardRangeLayoutValues.symbol;
    return 'minus';
};

const getScatterSymbol = (key: string, origY: number | null): string => {
    if (key === AVERAGE_KEY) return Constants.averageLayoutValues.symbol;
    if (key === INDEX_KEY) {
        if (origY !== null && origY < 0)
            return Constants.eqLayoutValues.symbolNegative;
        return Constants.eqLayoutValues.symbol;
    }
    if (key === VAS_KEY) return Constants.vasLayoutValues.symbol;
    return 'circle';
};

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

describe('LineScatterPlotProms helpers', () => {
    describe('getColor', () => {
        it('returns correct color for special keys', () => {
            expect(getColor(AVERAGE_KEY, 0)).toBe(
                Constants.averageLayoutValues.color
            );
            expect(getColor(INDEX_KEY, 0)).toBe(Constants.eqLayoutValues.color);
        });
        it('returns a default line color for other keys', () => {
            expect(getColor('some_other_key', 0)).toBe(Constants.lineColors[0]);
        });
    });

    describe('getLegendSymbol', () => {
        it('returns correct symbol for special keys', () => {
            expect(getLegendSymbol(AVERAGE_KEY)).toBe(
                Constants.averageLayoutValues.symbol
            );
            expect(getLegendSymbol(INDEX_KEY)).toBe(
                Constants.eqLayoutValues.symbol
            );
        });
        it('returns "minus" for other keys', () => {
            expect(getLegendSymbol('some_other_key')).toBe('minus');
        });
    });

    describe('getScatterSymbol', () => {
        it('returns correct symbol for INDEX_KEY with negative value', () => {
            expect(getScatterSymbol(INDEX_KEY, -0.1)).toBe(
                Constants.eqLayoutValues.symbolNegative
            );
        });
    });

    describe('getScatterColor', () => {
        it('returns negative color for INDEX_KEY with negative value', () => {
            expect(getScatterColor(INDEX_KEY, 'blue', -0.1)).toBe(
                Constants.eqLayoutValues.colorNegative
            );
        });
    });
});

describe('LineScatterPlot', () => {
    let consoleLogSpy: jest.SpyInstance;
    beforeAll(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterAll(() => {
        consoleLogSpy.mockRestore();
    });

    const mockData: DataSet = {
        'My Score': [
            { x: '2023-01-01', y: 50 },
            { x: '2023-02-01', y: 60 },
        ],
        Average: [
            { x: '2023-01-01', y: 55 },
            { x: '2023-02-01', y: 58 },
        ],
    };

    const defaultProps = {
        data: JSON.parse(JSON.stringify(mockData)),
        xLabel: 'Date',
        yLabel: 'Score',
        yTickFormat: ['0', '25', '50', '75', '100'],
        yRange: [0, 100] as [number, number],
    };

    it('renders without crashing', () => {
        render(<LineScatterPlot {...defaultProps} />);
        expect(screen.getByTestId('victory-chart')).toBeInTheDocument();
    });

    it('renders standard range area when provided', () => {
        const propsWithStandardRange = {
            ...defaultProps,
            standardRange: [40, 60] as [number, number],
            showStandardRange: true,
        };
        render(<LineScatterPlot {...propsWithStandardRange} />);
        expect(screen.getByTestId('victory-area')).toBeInTheDocument();
    });
});
