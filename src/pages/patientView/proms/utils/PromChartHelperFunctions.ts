/**
 * This file contains helper functions for the PROM charts which manipulate the clinical event data
 * from the backend, so that it can be processed by the Victory charts.
 */

import { ClinicalEvent } from 'cbioportal-ts-api-client';
import { STANDARD_RANGE_KEY, VAS_KEY, DATE_KEY } from './EQ-5D-5LChartMetadata';

/* Data structures */

// structure of a singel data point
export interface Datum {
    x: string;
    y: number | null;
    y0?: number;
    labelName?: string; // used only for tooltip, will be dynamically filled with content
}

// structure of input data object: identifier, data points as x/y pairs
export interface DataSet {
    [key: string]: Datum[];
}

/* Helper functions */

/**
 * Transforms a string to Camelcase (first letter of each word capital, all others lower-case)
 * @param input string to be transformed
 * @returns transformed string
 */
export const transformString = (input: string): string => {
    // cases where no transformation is needed
    if (input === 'EQ' || input === VAS_KEY) {
        return input;
    }

    // Define special characters that trigger capitalization
    const specialChars = [
        '_',
        '/',
        '-',
        ':',
        '@',
        '#',
        '$',
        '%',
        '&',
        '*',
        ' ',
    ];

    // Helper function to capitalize first letter
    const capitalizeFirst = (str: string) => {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // Split the string by special characters, preserving them
    let result = '';
    let currentWord = '';

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (specialChars.includes(char)) {
            // Add the current word (capitalized if it follows a special char)
            if (currentWord) {
                result += capitalizeFirst(currentWord);
                currentWord = '';
            }
            // Replace underscore with space, keep other special chars
            result += char === '_' ? ' ' : char;
        } else {
            currentWord += char;
        }
    }

    // Add the last word if exists
    if (currentWord) {
        result += capitalizeFirst(currentWord);
    }

    return result;
};

/**
 * Adds an element to a data set
 * @param dataset data set of type DataSet
 * @param key string, the identifier of the subset
 * @param element [string, number] pair (x,y values), the element to be inserted
 */
export const addElementToDataset = (
    dataset: DataSet,
    key: string,
    element: [string, string | number | null]
) => {
    const datum: Datum = {
        x: element[0],
        y: element[1] === null ? null : Number(element[1]),
    };
    if (dataset[key]) {
        // If the key exists, push the new element to the array
        dataset[key].push(datum);
    } else {
        // If the key does not exist, create a new array with the element
        dataset[key] = [datum];
    }
};

// functions that returns the smallest and largest x values (used for computing the standard range area plot)
/**
 * Finds smallest and largest x value contained in a DataSet
 * @param dataSet DataSet used for the computation
 * @returns object with minimum and maximum x value
 */
const getXDomain = (
    dataSet: DataSet
): {
    minX: Datum['x'] | null;
    maxX: Datum['x'] | null;
} => {
    const allX: Datum['x'][] = [];

    for (const series of Object.values(dataSet)) {
        for (const { x } of series) {
            allX.push(x);
        }
    }

    if (allX.length === 0) {
        return { minX: null, maxX: null };
    }

    // Normalize to sortable numbers
    const xWithSortKeys = allX.map(originalX => {
        let key: number;

        if (typeof originalX === 'number') {
            key = originalX;
        } else if (typeof originalX === 'string') {
            key = new Date(originalX).getTime(); // fallback for ISO strings
        } else {
            throw new Error('Unsupported x type');
        }

        return { originalX, key };
    });

    // Sort by key
    xWithSortKeys.sort((a, b) => a.key - b.key);

    return {
        minX: xWithSortKeys[0].originalX,
        maxX: xWithSortKeys[xWithSortKeys.length - 1].originalX,
    };
};

/**
 * Normalizes a variable given the range it can take
 * @param y value to be normalized (non-negative)
 * @param maxY maximum value y can be
 * @param minY minimum value y can be
 * @returns normalized value of y
 */
export const getNormalizedValue = (
    y: number,
    maxY: number,
    minY: number
): number => {
    if (y < 0) {
        return 0;
    }
    return (y - minY) / (maxY - minY);
};

/**
 * Merges two arrays where the values of the second are added after a specific position
 * Output looks like [first part of first array, second array, remaining of first array]
 * @param array1 first array for the merge
 * @param array2 second array for the merge
 * @param insertPosition array position where the values of array2 will be inserted in array1
 * @returns new array, which is the merge result
 */
export const mergeArrays = (
    array1: any[],
    array2: any[],
    insertPosition: number
): any[] => {
    const arr1 = array1;
    const arr2 = array2;
    const position = insertPosition;

    if (position < 0 || position === null || position === undefined) return [];
    let result = [];

    // if position greater than length of arr1, concate arr2 to arr1 regardless of concrete position
    if (position > arr1.length - 1) {
        for (let i = 0; i < arr1.length + arr2.length; i++) {
            result[i] = i < arr1.length ? arr1[i] : arr2[i - arr1.length];
        }
        return result;
    }

    // add first part of first array
    for (let i = 0; i < position; i++) {
        result[i] = arr1[i];
    }
    // add second array
    for (let i = position; i < position + arr2.length; i++) {
        result[i] = arr2[i - position];
    }
    // add remaining part of first array
    for (let i = position + arr2.length; i < arr2.length + arr1.length; i++) {
        result[i] = arr1[i - arr2.length];
    }
    return result;
};

/**
 * Creates DataSet of the standard range values, which can be displayed the PROM chart
 * @param dataSet DataSet for which the standard range set will be created
 * @param standardRange tuple representing a range for values of dataSet
 * @returns DataSet where x values are from dataSet and y values are the standardRange values
 */
export const createRangeData = (
    dataSet: DataSet,
    standardRange: [number, number]
): DataSet => {
    const { minX, maxX } = getXDomain(dataSet);

    if (minX === null || maxX === null) return {};

    const name = STANDARD_RANGE_KEY;

    // create DataSet of two elements = four value pairs
    const result: DataSet = {
        [name]: [
            {
                x: minX,
                y: standardRange[1],
                y0: standardRange[0],
            },
            {
                x: maxX,
                y: standardRange[1],
                y0: standardRange[0],
            },
        ],
    };
    return result;
};

/**
 * Normalizes all y values of a DataSet
 * @param dataSet Datum[], data set, where the y values are to be normalized
 * @param range Tuple of the minimum and maximum value y can take
 * @returns the normalized data set
 */
export const normalizeDataSet = (
    dataSet: Datum[],
    range: [number, number]
): Datum[] => {
    const [minY, maxY] = range;

    // If normalization not possible (max is 0 or max equals min), return original data
    if (maxY === 0 || maxY === minY) {
        return dataSet;
    }

    // Normalize the y values
    return dataSet.map(datum => ({
        ...datum,
        y:
            typeof datum.y === 'number'
                ? getNormalizedValue(datum.y, maxY, minY) // Normalization of positive values
                : null,
    }));
};

/**
 * Gets the original y value of a x/y pair where y has previously been normalized
 * @param x x value for which the original y value must be found
 * @param origData Datum[], where x is supposed to be included in one element
 * @returns y for which the pair x,y is contained in origData
 */
export const getOriginalY = (
    x: number | string,
    origData: Datum[]
): number | null => {
    // iterate through origData
    for (let datum of origData) {
        if (datum.x === x) {
            return datum.y;
        }
    }
    return null;
};

/**
 * Calclates the average of an array of numbers
 * @param numbers array of numbers for which the average is calculated
 * @returns average of the elements of numbers
 */
export const calculateAverage = (numbers: number[]): number | undefined => {
    if (numbers.length === 0) {
        return undefined;
    }
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length;
};

/**
 * Custom sort function for arrays based on element order in a comparator array, which ideally is a superset
 * of the array. If the array is not a subset of the comparator, elements that do not occur
 * in comparator will be placed at the end.
 * @param array array to be sorted
 * @param comparator reference array, which determines the sort order;
 * If array is not a subset of comparator, elements that do not occur in comparator will be placed at the end.
 * @returns sorted array
 */
export const sortArrayBasedOnComparator = (
    array: any[],
    comparator: any[]
): any[] => {
    return array.sort((a, b) => {
        const indexA = comparator.indexOf(a);
        const indexB = comparator.indexOf(b);
        // If both are not found, maintain relative order
        if (indexA === -1 && indexB === -1) return 0;
        // If only a is not found, place it after b
        if (indexA === -1) return 1;
        // If only b is not found, place it after a
        if (indexB === -1) return -1;
        // Both found, sort by original order
        return indexA - indexB;
    });
};

/**
 * Checks whether a variable of type string can be converted to number without issues
 * @param value string to be checked for safe conversion
 * @returns true if value can meaningfully be converted to number, otherwise false
 */
export const isAttributeNumberValueWellDefined = (
    value: string | undefined
): boolean => {
    return (
        value !== undefined &&
        value !== null &&
        value.length > 0 &&
        !isNaN(Number(value))
    );
};

/**
 * Checks whether a variable of type string can be converted to Date without issues
 * @param value string to be checked for safe conversion
 * @returns true if value can meaningfully be converted to Date, otherwise false
 */
export const isAttributeDateValueWellDefined = (
    value: string | undefined
): boolean => {
    // remove whitespace at the start and end of string
    if (value) {
        value = value.trim();
    }
    return (
        value !== undefined &&
        value !== null &&
        value.length > 0 &&
        parseDate(value) !== null
    );
};

/**
 * Compares two ClinicalEvent according to an attribute representing a date
 * @param a ClinicalEvent
 * @param b ClinicalEvent
 * @returns time difference between the two events
 */
export const compareClinicalEvents = (a: ClinicalEvent, b: ClinicalEvent) => {
    const dateA = a.attributes.find(attr => attr.key === DATE_KEY)?.value;
    const dateB = b.attributes.find(attr => attr.key === DATE_KEY)?.value;

    // try to compare according to date
    if (
        dateA &&
        dateB &&
        isAttributeDateValueWellDefined(dateA) &&
        isAttributeDateValueWellDefined(dateB)
    ) {
        const dateAObj = new Date(dateA);
        const dateBObj = new Date(dateB);
        return dateAObj.getTime() - dateBObj.getTime();
    }

    // if not possible, use startNumberOfDaysSinceDiagnosis attribute
    return (
        a.startNumberOfDaysSinceDiagnosis - b.startNumberOfDaysSinceDiagnosis
    );
};

/**
 * Extends a DataSet so that all elements share the same x values
 * @param ds DataSet of which the x values are to be considered
 * @returns extended data set with common x values
 */
export const createCommonXAxisForDataSet = (ds: DataSet) => {
    const keys = Object.keys(ds);
    let xValues: string[] = [];

    // collect all x values
    for (let key of keys) {
        for (let i = 0; i < ds[key].length; i++) {
            if (!xValues.includes(ds[key][i].x)) {
                xValues.push(ds[key][i].x);
            }
        }
    }

    // add dummy data points if subset does not contain an x/y pair for x of xValues
    for (let key of keys) {
        for (let xVal of xValues) {
            if (!ds[key].some(obj => obj.x === xVal)) {
                ds[key].push({ x: xVal, y: null });
            }
        }
    }

    // sort DataSet
    for (let key of keys) {
        ds[key].sort((a, b) => {
            const dateA = new Date(a.x);
            const dateB = new Date(b.x);
            return dateA.getTime() - dateB.getTime();
        });
    }

    return ds;
};

/**
 * Split a string after the occurance of a separator string
 * @param text string to be split
 * @param separator string signalling the split position
 * @returns split string
 */
export const splitString = (text: string, separator: string): string[] => {
    return text.split(separator).map(line => line.trim());
};

/**
 * Converts a date string in ISO format to the format DD/MM/YYYY or DD/MM/YY
 * @param isoDate string representing an ISO date
 * @param showYearAsYY specifies whether the year should be displayed as two (true) or four digits (false)
 * @returns string representing the date as DD/MM/YYYY or DD/MM/YY, respectively
 */
export const convertISOToDDMMYYYY = (
    inputDate: string,
    showYearAsYY: boolean = false
) => {
    // Process input and assure it has valid ISO format
    const trimmedDate = inputDate.trim();

    // Check if the input matches the ISO format (YYYY-MM-dd)
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(trimmedDate)) {
        throw new Error(
            'Invalid ISO date format. Expected YYYY-MM-dd but got: ' +
                trimmedDate
        );
    }
    const isoDateAsDate = new Date(trimmedDate);
    if (!(isoDateAsDate instanceof Date && !isNaN(isoDateAsDate.getTime()))) {
        throw new Error('Invalid date');
    }

    // Now everything ok
    const isoDate = trimmedDate;

    // Split the date string into components
    const [year, month, day] = isoDate.split('-').map(Number);

    // Create a Date object to validate the date
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() + 1 !== month ||
        date.getDate() !== day
    ) {
        throw new Error('Date calculation was faulty');
    }

    // Format the date as dd/MM/YYYY
    return `${day.toString().padStart(2, '0')}/${month
        .toString()
        .padStart(2, '0')}/${year - 2000 * Number(showYearAsYY)}`;
};

/**
 * Checks whether the clinicalEvents array contains events representing PROM data
 * @param clinicalEvents ClinicalEvent[] array to be checked
 * @param promEvents string[] array containing the names of all event types which represent PROM data
 * @returns true if there are PROM data in the clinicalEvents, otherwise false
 */
export const doClinicalEventsHavePromData = (
    clinicalEvents: ClinicalEvent[],
    promEvents: string[]
): boolean => {
    if (!clinicalEvents) {
        return false;
    }
    for (let promEvent of promEvents) {
        if (
            clinicalEvents.find(
                (event: ClinicalEvent) => event.eventType === promEvent
            )
        ) {
            return true;
        }
    }
    return false;
};

// Methods taken from absolute timeline feature, slightly adapted
// For tests, see there
/**
 * Parses different date formats in a robust way
 * Supports: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, DD.MM.YY ISO strings
 * @param dateString date string to be parsed
 * @returns Date object or null if format is invalid
 */
export const parseDate = (dateString: string): Date | null => {
    if (
        !dateString ||
        typeof dateString !== 'string' ||
        dateString.length === 0
    ) {
        return null;
    }

    // Delete white spaces and any information related to hours, minutes etc.
    const trimmedDate = dateString.trim().split('T')[0];

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
const isValidDate = (date: Date): boolean => {
    return (
        date instanceof Date &&
        !isNaN(date.getTime()) &&
        date.getFullYear() > 1900
    );
};
