import React from 'react';
import { useDateFormat } from './DateFormatContext';
import './../timeline.scss';
import { DefaultTooltip } from 'cbioportal-frontend-commons';

// Button that toggles between relative and absolute date format for timeline ticks
const FormatToggle: React.FC = () => {
    const { useAbsoluteDateFormat, toggleFormat, startDate } = useDateFormat();
    if (startDate === null) {
        return null;
    }
    return (
        <DefaultTooltip
            overlay={
                <span>
                    Switch between absolute dates and relative time information
                    on the axis
                </span>
            }
            placement="top"
        >
            <button className={'btn btn-xs'} onClick={toggleFormat}>
                {useAbsoluteDateFormat
                    ? 'Show Relative Dates'
                    : 'Show Absolute Dates'}
            </button>
        </DefaultTooltip>
    );
};

export default FormatToggle;
