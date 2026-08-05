import { TickIntervalEnum, TimelineTick } from './types';
import React from 'react';
import { TimelineStore } from './TimelineStore';
import { observer } from 'mobx-react';
import _ from 'lodash';

import { useDateFormat } from './lib/DateFormatContext';

interface ITickAxisProps {
    store: TimelineStore;
    width: number;
}

export const TICK_AXIS_HEIGHT = 36;
const TICK_LABEL_STYLE: any = {
    fontSize: 9.5,
    fontFamily: 'Arial',
    textAnchor: 'middle',
};
const MAJOR_TICK_HEIGHT = 6;
const MINOR_TICK_HEIGHT = 3;

function makeSquiggle(onClick: () => void) {
    const points = [
        'M0,5',
        'L2.5,8',
        'L5,0',
        'L7.5,10',
        'L10,0',
        'L12.5,10',
        'L15,0',
        'L17.5,8',
        'L20,5',
    ];
    return (
        <g transform={`translate(-6 ${TICK_AXIS_HEIGHT - 6})`}>
            {/* this rect visually blocks the axis */}
            <rect y={5} height={1} width={20} fill={'#ffffff'} />
            {/* this rect is a mouse hitzone */}
            <rect
                y={0}
                height={10}
                width={20}
                fillOpacity={0}
                style={{ cursor: 'pointer' }}
                onClick={onClick}
            />
            <path
                d={points.join('')}
                stroke={TICK_AXIS_COLOR}
                strokeWidth="1"
                fill="none"
                pointerEvents={'none'} // dont block mouse from clicking on rect
            />
        </g>
    );
}

export const TICK_AXIS_COLOR = '#ccc';

const TickAxis: React.FunctionComponent<ITickAxisProps> = observer(function({
    store,
    width,
}: ITickAxisProps) {
    // Helper to determine text alignment based on position
    const getTextAnchor = (pixelLeft: number) => {
        if (pixelLeft < 20) return 'start'; // Too close to left edge -> align left
        if (pixelLeft > width - 20) return 'end'; // Too close to right edge -> align right
        return 'middle'; // Default
    };

    return (
        <>
            <g>
                <rect
                    transform={`translate(0 ${TICK_AXIS_HEIGHT - 1})`}
                    fill={TICK_AXIS_COLOR}
                    height={1}
                    width={width}
                />
                {store.ticks.map((tick: TimelineTick, index: number) => {
                    let content: JSX.Element | null = null;
                    // Use Context for date format and day of diagnosis
                    const { startDate } = useDateFormat();
                    const startDateTimeline = startDate
                        ? new Date(startDate)
                        : null;

                    let startPoint;
                    if (tick === store.firstTick) {
                        startPoint = tick.end - store.tickInterval + 1; //tick.end - normalTickWidth - 1;
                    } else {
                        startPoint = tick.start;
                    }

                    const majorTickPosition = store.getPosition({
                        start: startPoint,
                    });
                    const transform = majorTickPosition
                        ? `translate(${majorTickPosition.pixelLeft} 0)`
                        : undefined;
                    const minorTicks: JSX.Element[] = [];

                    if (tick.isTrim) {
                        content = makeSquiggle(store.toggleExpandedTrims);
                    } else {
                        const count = startPoint / store.tickInterval;
                        const unit =
                            store.tickInterval === TickIntervalEnum.MONTH
                                ? 'm'
                                : 'y';

                        let relativeLabel: string = '';
                        if (count < 0) {
                            relativeLabel = `${count}${unit}`;
                        } else if (count === 0) {
                            relativeLabel = '0';
                        } else {
                            relativeLabel = `${count}${unit}`;
                        }

                        let absoluteLabel: string = '';

                        // If startDateTimeline exists, we calculate the absolute label.
                        if (startDateTimeline !== null) {
                            if (count === 0) {
                                absoluteLabel =
                                    startDateTimeline.getDate() +
                                    '/' +
                                    (
                                        startDateTimeline.getMonth() + 1
                                    ).toString() +
                                    '/' +
                                    (
                                        startDateTimeline.getFullYear() + count
                                    ).toString();
                            } else {
                                absoluteLabel =
                                    (
                                        startDateTimeline.getMonth() + 1
                                    ).toString() +
                                    '/' +
                                    (
                                        startDateTimeline.getFullYear() + count
                                    ).toString();
                            }
                        }

                        // Determine dynamic text anchor
                        const anchor = majorTickPosition
                            ? getTextAnchor(majorTickPosition.pixelLeft)
                            : 'middle';

                        // Render both labels with relative label first (top)
                        // and absolute date below.
                        content = (
                            <>
                                <g
                                    transform={`translate(0 ${TICK_AXIS_HEIGHT -
                                        1})`}
                                >
                                    <text
                                        y={-8}
                                        style={{
                                            fill: '#666',
                                            fontWeight: 'normal',
                                            ...TICK_LABEL_STYLE,
                                            textAnchor: anchor,
                                        }}
                                    >
                                        {absoluteLabel}
                                    </text>
                                    <text
                                        y={-18}
                                        style={{
                                            fill: '#333',
                                            fontWeight: 600,
                                            ...TICK_LABEL_STYLE,
                                            textAnchor: anchor,
                                        }}
                                    >
                                        {relativeLabel}
                                    </text>
                                    <rect
                                        x={0}
                                        y={-MAJOR_TICK_HEIGHT}
                                        height={MAJOR_TICK_HEIGHT}
                                        width={1}
                                        fill={'#aaa'}
                                    />
                                </g>
                            </>
                        );

                        if (store.tickPixelWidth > 150) {
                            const minorTickWidth = TickIntervalEnum.MONTH;

                            for (let i = 1; i < 12; i++) {
                                const position = store.getPosition({
                                    start: startPoint + minorTickWidth * i,
                                });

                                const transform = position
                                    ? `translate(${position.pixelLeft} 0)`
                                    : undefined;

                                let showLabel = false;
                                let relativeMinorLabel = '';
                                let absoluteMinorLabel = '';

                                if (store.tickPixelWidth > 150) {
                                    if (i % 4 === 0) {
                                        // only odd
                                        showLabel = true;
                                    }
                                    if (store.tickPixelWidth > 700) {
                                        showLabel = true;
                                    }
                                }

                                if (showLabel) {
                                    let minorCount = i;

                                    if (count < 0) {
                                        minorCount = 12 - i;
                                        const prevMajor =
                                            count + 1 === 0
                                                ? ''
                                                : `${count + 1}${unit}`;
                                        relativeMinorLabel =
                                            count === -1
                                                ? `-${minorCount}m`
                                                : `${prevMajor} ${minorCount}m`;
                                    } else {
                                        relativeMinorLabel =
                                            count === 0
                                                ? `${minorCount}m`
                                                : `${relativeLabel} ${minorCount}m`;
                                    }

                                    // Always calculating if startDateTimeline exists.
                                    if (startDateTimeline !== null) {
                                        let countForAbsoluteDate = count;
                                        const minorCountAbs = i;
                                        const month =
                                            (startDateTimeline.getMonth() +
                                                1 +
                                                minorCountAbs) %
                                            12;
                                        const monthValue =
                                            month === 0 ? 12 : month;
                                        const startDateMonth =
                                            startDateTimeline.getMonth() + 1;

                                        if (monthValue < startDateMonth) {
                                            countForAbsoluteDate = count + 1;
                                        }

                                        absoluteMinorLabel =
                                            monthValue +
                                            '/' +
                                            (
                                                startDateTimeline.getFullYear() +
                                                countForAbsoluteDate
                                            ).toString();
                                    }
                                }

                                if (transform && position) {
                                    const minorAnchor = getTextAnchor(
                                        position.pixelLeft
                                    );

                                    minorTicks.push(
                                        <g transform={transform}>
                                            <g
                                                transform={`translate(0 ${TICK_AXIS_HEIGHT -
                                                    1})`}
                                            >
                                                <text
                                                    y={-8}
                                                    style={{
                                                        fill: '#666',
                                                        ...TICK_LABEL_STYLE,
                                                        textAnchor: minorAnchor,
                                                    }}
                                                >
                                                    {absoluteMinorLabel}
                                                </text>
                                                <text
                                                    y={-18}
                                                    style={{
                                                        fill: '#333',
                                                        fontWeight: 600,
                                                        ...TICK_LABEL_STYLE,
                                                        textAnchor: minorAnchor,
                                                    }}
                                                >
                                                    {relativeMinorLabel}
                                                </text>
                                                <rect
                                                    x={0}
                                                    y={-MINOR_TICK_HEIGHT}
                                                    height={MINOR_TICK_HEIGHT}
                                                    width={1}
                                                    fill={'#aaa'}
                                                />
                                            </g>
                                        </g>
                                    );
                                }
                            }
                        }
                    }

                    const rightAfterTrim =
                        index > 0 && store.ticks[index - 1].isTrim;

                    return (
                        <>
                            {!rightAfterTrim && transform && (
                                <g transform={transform}>{content}</g>
                            )}

                            {minorTicks}
                        </>
                    );
                })}
            </g>
        </>
    );
});

export default TickAxis;
