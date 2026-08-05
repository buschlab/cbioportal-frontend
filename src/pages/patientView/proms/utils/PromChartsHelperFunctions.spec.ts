import { ClinicalEvent } from 'cbioportal-ts-api-client';
import {
    transformString,
    addElementToDataset,
    mergeArrays,
    createRangeData,
    normalizeDataSet,
    getOriginalY,
    calculateAverage,
    sortArrayBasedOnComparator,
    isAttributeNumberValueWellDefined,
    isAttributeDateValueWellDefined,
    compareClinicalEvents,
    createCommonXAxisForDataSet,
    splitString,
    convertISOToDDMMYYYY,
    doClinicalEventsHavePromData,
    Datum,
    DataSet,
    parseDate,
} from './PromChartHelperFunctions';
import { DATE_KEY, VAS_KEY, STANDARD_RANGE_KEY } from './EQ-5D-5LChartMetadata';

describe('PromChartHelperFunctions', () => {
    describe('transformString', () => {
        it('should return "EQ" for input "EQ"', () => {
            expect(transformString('EQ')).toBe('EQ');
        });

        it(`should return "${VAS_KEY}" for input "${VAS_KEY}"`, () => {
            expect(transformString(VAS_KEY)).toBe(VAS_KEY);
        });

        it('should capitalize first letter and replace underscores with spaces', () => {
            expect(transformString('usual_activity')).toBe('Usual Activity');
        });

        it('should handle other special characters and capitalize words', () => {
            expect(transformString('pain/discomfort')).toBe('Pain/Discomfort');
            expect(transformString('anxiety-depression')).toBe(
                'Anxiety-Depression'
            );
        });

        it('should handle all caps input by converting to title case', () => {
            expect(transformString('ALL_CAPS_STRING')).toBe('All Caps String');
        });

        it('should handle already camel-cased or spaced strings correctly', () => {
            expect(transformString('Already Spaced')).toBe('Already Spaced');
        });

        it('should return an empty string for an empty input', () => {
            expect(transformString('')).toBe('');
        });

        it('should handle single words', () => {
            expect(transformString('word')).toBe('Word');
            expect(transformString('WORD')).toBe('Word');
        });

        it('should handle strings with leading/trailing special characters', () => {
            expect(transformString('_leading_underscore')).toBe(
                ' Leading Underscore'
            ); // Space because _ is replaced
            expect(transformString('trailing_underscore_')).toBe(
                'Trailing Underscore '
            );
        });
    });

    describe('addElementToDataset', () => {
        it('should add an element to an existing key', () => {
            const dataset: DataSet = {
                series1: [{ x: '2023-01-01', y: 10 }],
            };
            addElementToDataset(dataset, 'series1', ['2023-01-02', 20]);
            expect(dataset.series1).toEqual([
                { x: '2023-01-01', y: 10 },
                { x: '2023-01-02', y: 20 },
            ]);
        });

        it('should create a new key and add an element if key does not exist', () => {
            const dataset: DataSet = {};
            addElementToDataset(dataset, 'seriesNew', ['2023-01-01', 5]);
            expect(dataset.seriesNew).toEqual([{ x: '2023-01-01', y: 5 }]);
        });
    });

    describe('mergeArrays', () => {
        it('should merge array2 into array1 at the specified position', () => {
            const arr1 = [1, 2, 5, 6];
            const arr2 = [3, 4];
            expect(mergeArrays(arr1, arr2, 2)).toEqual([1, 2, 3, 4, 5, 6]);
        });

        it('should insert at the beginning if position is 0', () => {
            const arr1 = [3, 4];
            const arr2 = [1, 2];
            expect(mergeArrays(arr1, arr2, 0)).toEqual([1, 2, 3, 4]);
        });

        it('should append to the end if position is array1.length', () => {
            const arr1 = [1, 2];
            const arr2 = [3, 4];
            expect(mergeArrays(arr1, arr2, 2)).toEqual([1, 2, 3, 4]);
        });

        it('should append if position is greater than array1.length', () => {
            const arr1 = [1, 2];
            const arr2 = [3, 4];
            expect(mergeArrays(arr1, arr2, 5)).toEqual([1, 2, 3, 4]);
        });

        it('should return array2 if array1 is empty', () => {
            const arr1: any[] = [];
            const arr2 = [1, 2];
            expect(mergeArrays(arr1, arr2, 0)).toEqual([1, 2]);
        });

        it('should return array1 if array2 is empty', () => {
            const arr1 = [1, 2];
            const arr2: any[] = [];
            expect(mergeArrays(arr1, arr2, 1)).toEqual([1, 2]);
        });

        it('should return an empty array if insertPosition is negative', () => {
            expect(mergeArrays([1], [2], -1)).toEqual([]);
        });
        it('should return an empty array if insertPosition is null', () => {
            expect(mergeArrays([1], [2], null as any)).toEqual([]);
        });
        it('should return an empty array if insertPosition is undefined', () => {
            expect(mergeArrays([1], [2], undefined as any)).toEqual([]);
        });
    });

    describe('createRangeData', () => {
        const sampleDataSet: DataSet = {
            seriesA: [
                { x: '2023-01-01', y: 10 },
                { x: '2023-03-15', y: 30 },
            ],
            seriesB: [
                { x: '2023-02-10', y: 20 },
                { x: '2023-04-01', y: 40 },
            ],
        };

        it('should create a standard range dataset based on min/max x values', () => {
            const standardRange: [number, number] = [0.2, 0.8];
            const expected: DataSet = {
                [STANDARD_RANGE_KEY]: [
                    { x: '2023-01-01', y: 0.8, y0: 0.2 },
                    { x: '2023-04-01', y: 0.8, y0: 0.2 },
                ],
            };
            expect(createRangeData(sampleDataSet, standardRange)).toEqual(
                expected
            );
        });

        it('should handle a dataset with a single point', () => {
            const singlePointDataSet: DataSet = {
                series: [{ x: '2023-01-01', y: 10 }],
            };
            const standardRange: [number, number] = [1, 5];
            const expected: DataSet = {
                [STANDARD_RANGE_KEY]: [
                    { x: '2023-01-01', y: 5, y0: 1 },
                    { x: '2023-01-01', y: 5, y0: 1 },
                ],
            };
            expect(createRangeData(singlePointDataSet, standardRange)).toEqual(
                expected
            );
        });

        it('should return an empty object for an empty dataset', () => {
            expect(createRangeData({}, [0, 1])).toEqual({});
        });
    });

    describe('normalizeDataSet', () => {
        const sampleData: Datum[] = [
            { x: 'd1', y: 10 },
            { x: 'd2', y: 20 },
            { x: 'd3', y: 30 },
            { x: 'd4', y: null },
            { x: 'd5', y: -5 }, // should be treated as 0 for normalization
        ];
        const range: [number, number] = [0, 30];

        it('should normalize y values within the given range', () => {
            const normalized = normalizeDataSet(sampleData, range);
            expect(normalized[0].y).toBeCloseTo(10 / 30);
            expect(normalized[1].y).toBeCloseTo(20 / 30);
            expect(normalized[2].y).toBeCloseTo(30 / 30);
            expect(normalized[3].y).toBeNull();
            expect(normalized[4].y).toBeCloseTo(0 / 30); // -5 becomes 0
        });

        it('should return original data if maxY is 0', () => {
            const data = [{ x: 'd1', y: 0 }];
            expect(normalizeDataSet(data, [0, 0])).toEqual(data);
        });

        it('should return original data if maxY equals minY', () => {
            const data = [{ x: 'd1', y: 10 }];
            expect(normalizeDataSet(data, [10, 10])).toEqual(data);
        });

        it('should handle non-zero min range', () => {
            const data: Datum[] = [
                { x: 'd1', y: 10 },
                { x: 'd2', y: 15 },
                { x: 'd3', y: 20 },
            ];
            const customRange: [number, number] = [10, 20];
            const normalized = normalizeDataSet(data, customRange);
            expect(normalized[0].y).toBeCloseTo(0); // (10-10)/(20-10)
            expect(normalized[1].y).toBeCloseTo(0.5); // (15-10)/(20-10)
            expect(normalized[2].y).toBeCloseTo(1); // (20-10)/(20-10)
        });
    });

    describe('getOriginalY', () => {
        const originalData: Datum[] = [
            { x: '2023-01-01', y: 100 },
            { x: '2023-01-02', y: 200 },
            { x: '2023-01-03', y: null },
        ];

        it('should return the original y value for a given x', () => {
            expect(getOriginalY('2023-01-01', originalData)).toBe(100);
            expect(getOriginalY('2023-01-02', originalData)).toBe(200);
        });

        it('should return null if y was originally null', () => {
            expect(getOriginalY('2023-01-03', originalData)).toBeNull();
        });

        it('should return null if x is not found', () => {
            expect(getOriginalY('2023-01-04', originalData)).toBeNull();
        });
    });

    describe('calculateAverage', () => {
        it('should calculate the average of an array of numbers', () => {
            expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
            expect(calculateAverage([10, 20, 60])).toBe(30);
        });

        it('should return undefined for an empty array', () => {
            expect(calculateAverage([])).toBeUndefined();
        });

        it('should return the number itself for a single-element array', () => {
            expect(calculateAverage([5])).toBe(5);
        });
    });

    describe('sortArrayBasedOnComparator', () => {
        const comparator = ['apple', 'banana', 'cherry', 'date'];

        it('should sort array based on comparator order', () => {
            const arr = ['cherry', 'apple', 'date'];
            expect(sortArrayBasedOnComparator(arr, comparator)).toEqual([
                'apple',
                'cherry',
                'date',
            ]);
        });

        it('should place elements not in comparator at the end, maintaining their relative order', () => {
            const arr = ['grape', 'cherry', 'apple', 'fig'];
            // 'grape' and 'fig' are not in comparator
            // Their original relative order is grape, fig
            const sorted = sortArrayBasedOnComparator(arr, comparator);
            expect(sorted.slice(0, 2)).toEqual(['apple', 'cherry']);
            // Check that 'grape' and 'fig' are at the end and maintain relative order
            expect(sorted.indexOf('grape')).toBeLessThan(sorted.indexOf('fig'));
            expect(sorted).toContain('grape');
            expect(sorted).toContain('fig');
            expect(sorted.length).toBe(4);
        });

        it('should handle an empty array', () => {
            expect(sortArrayBasedOnComparator([], comparator)).toEqual([]);
        });

        it('should handle an empty comparator (maintains original order)', () => {
            const arr = ['cherry', 'apple'];
            expect(sortArrayBasedOnComparator(arr, [])).toEqual([
                'cherry',
                'apple',
            ]); // or ['apple', 'cherry'] depending on sort stability
        });

        it('should handle array with all elements not in comparator (maintains original order)', () => {
            const arr = ['grape', 'fig'];
            expect(sortArrayBasedOnComparator(arr, comparator)).toEqual([
                'grape',
                'fig',
            ]);
        });
    });

    describe('isAttributeNumberValueWellDefined', () => {
        it('should return true for valid number strings', () => {
            expect(isAttributeNumberValueWellDefined('123')).toBe(true);
            expect(isAttributeNumberValueWellDefined('0.5')).toBe(true);
            expect(isAttributeNumberValueWellDefined('-10')).toBe(true);
        });

        it('should return false for invalid number strings', () => {
            expect(isAttributeNumberValueWellDefined('abc')).toBe(false);
            expect(isAttributeNumberValueWellDefined('12a')).toBe(false);
        });

        it('should return false for empty string, null, or undefined', () => {
            expect(isAttributeNumberValueWellDefined('')).toBe(false);
            expect(isAttributeNumberValueWellDefined(null as any)).toBe(false);
            expect(isAttributeNumberValueWellDefined(undefined)).toBe(false);
        });
    });

    describe('isAttributeDateValueWellDefined', () => {
        it('should return true for valid date strings', () => {
            expect(isAttributeDateValueWellDefined('2023-01-01')).toBe(true);
            expect(
                isAttributeDateValueWellDefined('2023-10-20T10:00:00Z')
            ).toBe(true);
        });

        it('should return false for invalid date strings', () => {
            expect(isAttributeDateValueWellDefined('not a date')).toBe(false);
            expect(isAttributeDateValueWellDefined('2023-13-01')).toBe(false); // Invalid month
        });

        it('should return false for empty string, null, or undefined', () => {
            expect(isAttributeDateValueWellDefined('')).toBe(false);
            expect(isAttributeDateValueWellDefined(null as any)).toBe(false);
            expect(isAttributeDateValueWellDefined(undefined)).toBe(false);
        });
    });

    describe('compareClinicalEvents', () => {
        const createEvent = (
            date: string | undefined,
            days: number
        ): ClinicalEvent => ({
            attributes: date ? [{ key: DATE_KEY, value: date }] : [],
            startNumberOfDaysSinceDiagnosis: days,
            endNumberOfDaysSinceDiagnosis: days,
            uniquePatientKey: 'up1',
            uniqueSampleKey: 'us1',
            studyId: 's1',
            patientId: 'p1',
            eventType: 'EQ-5D-5L',
        });

        it('should compare events based on DATE_KEY if valid', () => {
            const eventA = createEvent('2023-01-01', 10);
            const eventB = createEvent('2023-01-05', 5);
            expect(compareClinicalEvents(eventA, eventB)).toBeLessThan(0);
        });

        it('should fallback to startNumberOfDaysSinceDiagnosis if DATE_KEY is invalid or missing', () => {
            const eventA = createEvent('invalid-date', 10);
            const eventB = createEvent(undefined, 5);
            expect(compareClinicalEvents(eventA, eventB)).toBeGreaterThan(0); // 10 > 5
        });

        it('should use startNumberOfDaysSinceDiagnosis if one DATE_KEY is missing', () => {
            const eventA = createEvent('2023-01-01', 10);
            const eventB = createEvent(undefined, 15); // eventB is later by days
            expect(compareClinicalEvents(eventA, eventB)).toBeLessThan(0); // 10 < 15
        });

        it('should return 0 for events with same date or same days if date is missing', () => {
            const eventA = createEvent('2023-01-01', 10);
            const eventB = createEvent('2023-01-01', 5); // Same date, different days
            expect(compareClinicalEvents(eventA, eventB)).toBe(0);

            const eventC = createEvent(undefined, 20);
            const eventD = createEvent(undefined, 20);
            expect(compareClinicalEvents(eventC, eventD)).toBe(0);
        });
    });

    describe('createCommonXAxisForDataSet', () => {
        it('should create a common X axis and fill missing points with null, then sort', () => {
            const ds: DataSet = {
                seriesA: [
                    { x: '2023-01-01', y: 10 },
                    { x: '2023-01-03', y: 30 },
                ],
                seriesB: [
                    { x: '2023-01-02', y: 20 },
                    { x: '2023-01-03', y: 35 },
                ],
            };
            const result = createCommonXAxisForDataSet(ds);

            const expectedXValues = ['2023-01-01', '2023-01-02', '2023-01-03'];

            expect(result.seriesA.map(d => d.x)).toEqual(expectedXValues);
            expect(result.seriesB.map(d => d.x)).toEqual(expectedXValues);

            expect(result.seriesA).toEqual([
                { x: '2023-01-01', y: 10 },
                { x: '2023-01-02', y: null },
                { x: '2023-01-03', y: 30 },
            ]);
            expect(result.seriesB).toEqual([
                { x: '2023-01-01', y: null },
                { x: '2023-01-02', y: 20 },
                { x: '2023-01-03', y: 35 },
            ]);
        });

        it('should handle an empty dataset', () => {
            expect(createCommonXAxisForDataSet({})).toEqual({});
        });

        it('should handle datasets where one series is empty', () => {
            const ds: DataSet = {
                seriesA: [{ x: '2023-01-01', y: 10 }],
                seriesB: [],
            };
            const result = createCommonXAxisForDataSet(ds);
            expect(result.seriesA).toEqual([{ x: '2023-01-01', y: 10 }]);
            expect(result.seriesB).toEqual([{ x: '2023-01-01', y: null }]);
        });
    });

    describe('splitString', () => {
        it('should split a string by the separator and trim parts', () => {
            expect(splitString('one | two | three', '|')).toEqual([
                'one',
                'two',
                'three',
            ]);
        });

        it('should handle no separator', () => {
            expect(splitString('onetwothree', '|')).toEqual(['onetwothree']);
        });

        it('should handle empty string', () => {
            expect(splitString('', '|')).toEqual(['']);
        });

        it('should handle separator at start/end', () => {
            expect(splitString('|one|two|', '|')).toEqual([
                '',
                'one',
                'two',
                '',
            ]);
        });
    });

    describe('convertISOToDDMMYYYY', () => {
        it('should convert valid ISO date to DD/MM/YYYY', () => {
            expect(convertISOToDDMMYYYY('2023-01-15')).toBe('15/01/2023');
            expect(convertISOToDDMMYYYY('2024-12-05')).toBe('05/12/2024');
            expect(convertISOToDDMMYYYY('2023-01-15', true)).toBe('15/01/23');
            expect(convertISOToDDMMYYYY('2024-12-05', true)).toBe('05/12/24');
        });

        it('should throw error for invalid ISO format', () => {
            expect(() => convertISOToDDMMYYYY('10/01/2023')).toThrow(
                'Invalid ISO date format. Expected YYYY-MM-dd but got: 10/01/2023'
            );
            expect(() => convertISOToDDMMYYYY('2023-1-5')).toThrow(
                'Invalid ISO date format. Expected YYYY-MM-dd but got: 2023-1-5'
            );
        });

        it('should throw error for non-numeric parts', () => {
            expect(() => convertISOToDDMMYYYY('2000-MM-DD')).toThrow(
                'Invalid ISO date format. Expected YYYY-MM-dd but got: 2000-MM-DD'
            );
        });

        it('should throw error for invalid date (e.g., Aug 35)', () => {
            expect(() => convertISOToDDMMYYYY('2023-08-35')).toThrow(
                'Invalid date'
            );
        });
    });

    describe('doClinicalEventsHavePromData', () => {
        const promEventTypes = ['EQ-5D-5L', 'EQ-3D-5L'];
        const createDummyEvent = (eventType: string): ClinicalEvent => ({
            eventType,
            startNumberOfDaysSinceDiagnosis: 0,
            patientId: 'p1',
            studyId: 's1',
            uniquePatientKey: 'uk1',
            attributes: [],
            endNumberOfDaysSinceDiagnosis: 10,
            uniqueSampleKey: 'us1',
        });

        it('should return true if clinicalEvents contain any PROM event type', () => {
            const clinicalEvents: ClinicalEvent[] = [
                createDummyEvent('OTHER_EVENT'),
                createDummyEvent('EQ-5D-5L'),
            ];
            expect(
                doClinicalEventsHavePromData(clinicalEvents, promEventTypes)
            ).toBe(true);
        });

        it('should return false if clinicalEvents do not contain any PROM event type', () => {
            const clinicalEvents: ClinicalEvent[] = [
                createDummyEvent('OTHER_EVENT'),
                createDummyEvent('ANOTHER_EVENT'),
            ];
            expect(
                doClinicalEventsHavePromData(clinicalEvents, promEventTypes)
            ).toBe(false);
        });

        it('should return false for empty clinicalEvents array', () => {
            expect(doClinicalEventsHavePromData([], promEventTypes)).toBe(
                false
            );
        });

        it('should return false if clinicalEvents is null', () => {
            expect(
                doClinicalEventsHavePromData(null as any, promEventTypes)
            ).toBe(false);
        });

        it('should return false for empty promEvents array', () => {
            const clinicalEvents: ClinicalEvent[] = [
                createDummyEvent('PROM_EQ5D'),
            ];
            expect(doClinicalEventsHavePromData(clinicalEvents, [])).toBe(
                false
            );
        });
    });
    describe('parseDate', () => {
        it('should parse ISO date correctly', () => {
            const result = parseDate('2010-02-15');
            expect(result).toEqual(new Date(2010, 1, 15)); // Month is 0-based
        });

        it('should parse DD/MM/YYYY format correctly', () => {
            const result = parseDate('15/02/2011');
            expect(result).toEqual(new Date(2011, 1, 15));
        });

        it('should parse YYYY-M-DD format correctly', () => {
            const result = parseDate('2011-7-11');
            expect(result).toEqual(new Date(2011, 6, 11));
        });

        it('should parse DD.MM.YYYY format correctly', () => {
            const result = parseDate('15.02.2012');
            expect(result).toEqual(new Date(2012, 1, 15));
        });

        it('should parse D.M.YYYY format correctly', () => {
            const result = parseDate('8.5.2012');
            expect(result).toEqual(new Date(2012, 4, 8));
        });

        it('should parse MM/DD/YYYY format correctly', () => {
            const result = parseDate('02/15/2013');
            expect(result).toEqual(new Date(2013, 1, 15));
        });

        it('should parse DD.MM.YY format correctly', () => {
            const result = parseDate('02.12.13');
            expect(result).toEqual(new Date(2013, 11, 2));
        });

        it('should return null for invalid inputs', () => {
            expect(parseDate('')).toBeNull();
            expect(parseDate('invalid')).toBeNull();
            expect(parseDate('123456')).toBeNull();
            expect(parseDate('36/01/2014')).toBeNull();
        });

        it('should handle whitespace correctly', () => {
            const result = parseDate('  2015-02-15  ');
            expect(result).toEqual(new Date(2015, 1, 15));
        });
    });
});
