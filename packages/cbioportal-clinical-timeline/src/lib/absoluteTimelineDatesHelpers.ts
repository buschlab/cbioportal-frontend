import { TimelineEvent } from '../types';
/**
 * Calculates date which corresponds to time point 0 in Timeline
 * @param store - timeline store, which includes all events
 * @returns date of diagnosis as ISO string or null if calculation not possible
 */
export const calculateStartDate = (
    timelineEvents: TimelineEvent[]
): string | null => {
    try {
        const events = timelineEvents;

        if (!events || events.length === 0) {
            // console.warn('No timeline events found');
            return null;
        }

        const clinicalEvents = events.map(item => item.event);

        // Collect events with relative and absolute dates if applicable
        const eventsWithAbsoluteDates = clinicalEvents
            .map(event => {
                const dateAttribute = event.attributes?.find(
                    attr => attr.key === 'DATE_ISO'
                );

                if (!dateAttribute?.value) {
                    return null;
                }

                return {
                    absoluteDate: dateAttribute.value,
                    relativeDays: event.startNumberOfDaysSinceDiagnosis,
                };
            })
            .filter(
                (event): event is NonNullable<typeof event> => event !== null
            );

        if (eventsWithAbsoluteDates.length === 0) {
            // console.warn('No timeline events with absolute dates found');
            return null;
        }

        // To calculate the date of diagnoses, use first event which has got both a relative and an absolute date and where the absolute date is well-defined
        let absoluteDate, relativeDays;
        for (let i = 0; i < eventsWithAbsoluteDates.length; i++) {
            if (
                parseFlexibleDate(eventsWithAbsoluteDates[i].absoluteDate) !==
                null
            ) {
                absoluteDate = eventsWithAbsoluteDates[i].absoluteDate;
                relativeDays = eventsWithAbsoluteDates[i].relativeDays;
                break;
            }
        }

        if (!absoluteDate || !relativeDays) {
            // console.error('Invalid date format');
            return null;
        }

        // Parse Date with robust parser
        const parsedDate = parseFlexibleDate(absoluteDate);

        if (!parsedDate) {
            // console.error('Invalid date format');
            return null;
        }

        // Calculate date date of diagnosis (day zero of timeline) and transform to ISO string
        const startDate = getDateNDaysBefore(
            new Date(parsedDate),
            relativeDays
        );
        const year = startDate.getFullYear();
        const month = startDate.getMonth();
        const day = startDate.getDate();
        const result = new Date(Date.UTC(year, month, day))
            .toISOString()
            .split('T')[0];
        return result;
    } catch (error) {
        // console.error('Error calculating absolute start date:', error);
        return null;
    }
};

/**
 * Calculates the date which was a number of days before a given date
 * @param d Date of event
 * @param n number representing the relative date of event
 * @returns Date object
 */
export const getDateNDaysBefore = (d: Date, n: number): Date => {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const result = new Date(Date.UTC(year, month, day));
    result.setTime(d.getTime() - n * millisecondsPerDay);
    return result;
};

/**
 * Parses different date formats in a robust way
 * Supports: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, ISO strings
 * @param dateString date string to be parsed
 * @returns Date object or null if format is invalid
 */
export const parseFlexibleDate = (dateString: string): Date | null => {
    if (
        !dateString ||
        typeof dateString !== 'string' ||
        dateString.length === 0
    ) {
        return null;
    }

    // Delete white spaces and any information related to hours, minutes etc.
    const trimmedDate = dateString.trim().split('T')[0];

    // First try native date constuctor (for ISO strings, should work in most cases)
    //const nativeDate = new Date(trimmedDate);
    //if (!isNaN(nativeDate.getTime())) {
    //  return nativeDate;
    //}

    // Regex patterns for different formats
    const patterns = [
        // YYYY-MM-DD or YYYY/MM/DD
        {
            regex: /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
            format: (match: RegExpMatchArray): [number, number, number] => {
                const year = parseInt(match[1]);
                const month = parseInt(match[2]);
                const day = parseInt(match[3]);
                return [year, month - 1, day];
            },
        },
        // DD/MM/YYYY or DD.MM.YYYY (German format, for ambiguous cases this is preferred over the American)
        {
            regex: /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/,
            format: (match: RegExpMatchArray): [number, number, number] => {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]);
                const year = parseInt(match[3]);
                // Simple heuristic to find if American format matches better
                if (month > 12 && day <= 12) {
                    return [year, day - 1, month];
                }
                return [year, month - 1, day];
            },
        },
        // MM/DD/YYYY (American format)
        {
            regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            format: (match: RegExpMatchArray): [number, number, number] => {
                const month = parseInt(match[1]);
                const day = parseInt(match[2]);
                const year = parseInt(match[3]);
                // Simple heuristic to find if German format matches better
                if (month > 12 && day <= 12) {
                    return [year, day - 1, month];
                }
                return [year, month - 1, day];
            },
        },
        // DD.MM.YY (German format)
        {
            regex: /^(\d{1,2})[/.](\d{1,2})[/.](\d{2})$/,
            format: (match: RegExpMatchArray): [number, number, number] => {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]);
                const year = parseInt(match[3]) + 2000;
                // Simple heuristic to find if American like format matches better
                if (month > 12 && day <= 12) {
                    return [year, day - 1, month];
                }
                return [year, month - 1, day];
            },
        },
    ];

    // Test against all patterns
    for (const pattern of patterns) {
        const match = trimmedDate.match(pattern.regex);
        if (match) {
            const dateTuple = pattern.format(match);
            if (!isValidDayMonthCombination(dateTuple)) {
                return null;
            }

            const date = new Date(...dateTuple);

            // Validate result
            if (!isNaN(date.getTime()) && isValidDate(date)) {
                return date;
            }
        }
    }
    return null;
};

/**
 * Validates for real date: Does the date object represent a calendar date?
 * @param [year, month, day] - tuple representing a date
 * IMPORTANT: year will not be checked here.
 * IMPORTANT: month must be  greater or equal to 0 and smaller or equal to 11 for a valid date!
 * @returns true, if the combination of day, month and year is a valid date, otherwise false
 */
const isValidDayMonthCombination = ([year, month, day]: [
    number,
    number,
    number
]): boolean => {
    // Helper function to check if a year is a leap year
    const isLeapYear = (year: number): boolean => {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    };
    // Validate month
    if (month < 0 || month > 11) {
        return false;
    }
    // Validate day based on month and year
    const daysInMonth = [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if (day < 1 || day > daysInMonth[month]) {
        return false;
    }
    return true;
};

/**
 * Validation for valid date: Does the date object represent a valid date?
 * @param date Date object to be validated
 * @returns true if date is valid, otherwise false
 */
export const isValidDate = (date: Date): boolean => {
    return (
        date instanceof Date &&
        !isNaN(date.getTime()) &&
        date.getFullYear() > 1900
    );
};

/**
 * Calculates the date which is a number of days later than a given date
 * @param d - Date object representing the start date
 * @param n - number representing the relative date of an event
 * @returns Date object
 */
export const getDateNDaysAfter = (d: Date, n: number): Date => {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const result = new Date(Date.UTC(year, month, day));
    result.setTime(d.getTime() + n * millisecondsPerDay);
    return result;
};
