import {
    calculateStartDate,
    parseFlexibleDate,
    getDateNDaysBefore,
    isValidDate,
} from './absoluteTimelineDatesHelpers';

import {
    TimelineTrackSpecification,
    TimelineEvent,
    TimelineEventAttribute,
} from './../types';

// Helper type for the 'event' object within TimelineEvent, as it's deeply nested
interface MockEventDetail {
    startNumberOfDaysSinceDiagnosis: number;
    attributes: TimelineEventAttribute[];
    // Add other properties like eventType, endNumberOfDaysSinceDiagnosis if needed by tests
    eventType: string;
    patientId: string;
    studyId: string;
    uniquePatientKey: string;
}

// This represents the structure of TimelineEvent for our tests
// It needs to be compatible with the actual TimelineEvent type
interface MockTimelineEvent extends Partial<TimelineEvent> {
    // Use Partial if not all fields are mocked
    event: MockEventDetail;
    start: number; // Important for sorting in TimelineStore.allItems
    end: number;
    containingTrack: TimelineTrackSpecification;
}

// This represents TimelineTrackSpecification for our tests
// It needs to be compatible with the actual TimelineTrackSpecification type
interface MockTrack extends Partial<TimelineTrackSpecification> {
    // Use Partial if not all fields are mocked
    uid: string; // Important for TimelineStore internal logic (e.g. flattenTracks)
    items: MockTimelineEvent[];
    // Add other common/required fields like 'type', 'label'
    type: string;
    label: string;
}

describe('calculateStartDate', () => {
    let defaultTrackData: MockTrack;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        // Mock console methods to avoid cluttering test output
        consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Standard mock track data, can be modified by tests before creating the store
        defaultTrackData = {
            uid: 'track1',
            type: 'MOCK_TYPE',
            label: 'Mock Track with ISO Date',
            items: [
                {
                    start: 30, // Corresponds to startNumberOfDaysSinceDiagnosis for simplicity
                    event: {
                        startNumberOfDaysSinceDiagnosis: 30,
                        attributes: [
                            { key: 'DATE_ISO', value: '2000-02-15' },
                            { key: 'OTHER_ATTR', value: 'test' },
                        ],
                        // Fill in other required fields for MockEventDetail if any
                        eventType: 'MOCK_EVENT_TYPE',
                        patientId: 'mockPatient',
                        studyId: 'mockStudy',
                        uniquePatientKey: 'mockUniquePatientKey',
                    },
                    end: 30, // Example value
                    containingTrack: {} as TimelineTrackSpecification, // Example value
                } as MockTimelineEvent,
            ],
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Successful calculations', () => {
        it('should calculate correct start date for ISO format', () => {
            // Arrange
            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2000-01-16'); // Feb 15 - 30 days + 1 day correction = Jan 16
        });

        it('should calculate correct start date for YYYY/MM/DD format', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '2001/11/07';
            // Ensure the key is DATE_ISO if it's the first attribute being targeted
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 30;
            defaultTrackData.items[0].start = 30; // Keep 'start' consistent

            const events = defaultTrackData.items as TimelineEvent[];

            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2001-10-08'); // Nov 7 - 30 days = Oct 8
        });

        it('should calculate correct start date for YYYY.MM.DD format', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '2001.11.07';
            // Ensure the key is DATE_ISO if it's the first attribute being targeted
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 30;
            defaultTrackData.items[0].start = 30; // Keep 'start' consistent

            const events = defaultTrackData.items as TimelineEvent[];

            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2001-10-08'); // Nov 7 - 30 days = Oct 8
        });

        it('should calculate correct start date for DD/MM/YYYY format', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '15/02/2001';
            // Ensure the key is DATE_ISO if it's the first attribute being targeted
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 10;
            defaultTrackData.items[0].start = 10; // Keep 'start' consistent

            const events = defaultTrackData.items as TimelineEvent[];

            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2001-02-05'); // Feb 15 - 10 days = Feb 5
        });

        it('should calculate correct start date for MM/DD/YYYY format', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '11/16/2001';
            // Ensure the key is DATE_ISO if it's the first attribute being targeted
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 13;
            defaultTrackData.items[0].start = 13; // Keep 'start' consistent

            const events = defaultTrackData.items as TimelineEvent[];

            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2001-11-03'); // Nov 16 - 13 days = Nov 3
        });

        it('should calculate correct start date for DD.MM.YYYY format', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '15.02.2002';
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 5;
            defaultTrackData.items[0].start = 5;
            const events = defaultTrackData.items as TimelineEvent[];

            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2002-02-10'); // Feb 15 - 5 days = Feb 10
        });

        it('should work with negative relative days (event before diagnosis)', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '2003-02-25';
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = -10;
            defaultTrackData.items[0].start = -10;

            const events = defaultTrackData.items as TimelineEvent[];

            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2003-03-07'); // Feb 25 - (-10) days = Mar 07
        });

        it('should use first available event with absolute date', () => {
            // Arrange
            const tracksData: MockTrack[] = [
                {
                    uid: 'track1',
                    type: 'MOCK_TYPE',
                    label: 'Mock Track 1',
                    items: [
                        {
                            start: 20,
                            event: {
                                startNumberOfDaysSinceDiagnosis: 20,
                                attributes: [
                                    { key: 'OTHER', value: 'no date' },
                                ],
                                eventType: 'MOCK_EVENT_TYPE',
                                patientId: 'p1',
                                studyId: 's1',
                                uniquePatientKey: 'up1',
                            },
                            end: 20,
                            containingTrack: {} as MockTrack,
                        } as MockTimelineEvent,
                    ],
                },
                {
                    uid: 'track2',
                    type: 'MOCK_TYPE',
                    label: 'Mock Track 2',
                    items: [
                        {
                            start: 15, // This event should be picked due to earlier 'start'
                            event: {
                                startNumberOfDaysSinceDiagnosis: 15,
                                attributes: [
                                    { key: 'DATE_ISO', value: '2004-03-01' },
                                ],
                                eventType: 'MOCK_EVENT_TYPE',
                                patientId: 'p2',
                                studyId: 's2',
                                uniquePatientKey: 'up2',
                            },
                            end: 15,
                            containingTrack: {} as MockTrack,
                        } as MockTimelineEvent,
                    ],
                },
                {
                    uid: 'track3',
                    type: 'MOCK_TYPE',
                    label: 'Mock Track 3',
                    items: [
                        {
                            start: 25,
                            event: {
                                startNumberOfDaysSinceDiagnosis: 25,
                                attributes: [
                                    { key: 'DATE_ISO', value: '2004-03-10' },
                                ],
                                eventType: 'MOCK_EVENT_TYPE',
                                patientId: 'p3',
                                studyId: 's3',
                                uniquePatientKey: 'up3',
                            },
                            end: 25,
                            containingTrack: {} as MockTrack,
                        } as MockTimelineEvent,
                    ],
                },
            ];
            const allEvents = tracksData
                .map(track => track.items)
                .reduce((acc, val) => acc.concat(val), []);
            // Sort events by start time to mimic TimelineStore.allItems behavior,
            // as calculateStartDate picks the first event with DATE_ISO from the provided list.
            const sortedEvents = [...allEvents].sort(
                (a, b) => a.start - b.start
            ) as TimelineEvent[];
            // Act
            const result = calculateStartDate(sortedEvents);

            // Assert
            expect(result).toBe('2004-02-15'); // Uses first event with date (15 days)
        });

        it('should use first available event with well-formed absolute date', () => {
            // Arrange
            const tracksData: MockTrack[] = [
                {
                    uid: 'track1',
                    type: 'MOCK_TYPE',
                    label: 'Mock Track 1',
                    items: [
                        {
                            start: 20,
                            event: {
                                startNumberOfDaysSinceDiagnosis: 20,
                                attributes: [
                                    { key: 'OTHER', value: 'no date' },
                                ],
                                eventType: 'MOCK_EVENT_TYPE',
                                patientId: 'p1',
                                studyId: 's1',
                                uniquePatientKey: 'up1',
                            },
                            end: 20,
                            containingTrack: {} as MockTrack,
                        } as MockTimelineEvent,
                    ],
                },
                {
                    uid: 'track2',
                    type: 'MOCK_TYPE',
                    label: 'Mock Track 2',
                    items: [
                        {
                            start: 10,
                            event: {
                                startNumberOfDaysSinceDiagnosis: 10,
                                attributes: [
                                    { key: 'DATE_ISO', value: '2004-zz-11' }, // flawed date
                                ],
                                eventType: 'MOCK_EVENT_TYPE',
                                patientId: 'p2',
                                studyId: 's2',
                                uniquePatientKey: 'up2',
                            },
                            end: 10,
                            containingTrack: {} as MockTrack,
                        } as MockTimelineEvent,
                    ],
                },
                {
                    uid: 'track3',
                    type: 'MOCK_TYPE',
                    label: 'Mock Track 3',
                    items: [
                        {
                            start: 15,
                            event: {
                                startNumberOfDaysSinceDiagnosis: 15,
                                attributes: [
                                    { key: 'DATE_ISO', value: '2004-03-01' }, // This event should be picked due to well-formed 'DATE_ISO' value
                                ],
                                eventType: 'MOCK_EVENT_TYPE',
                                patientId: 'p3',
                                studyId: 's3',
                                uniquePatientKey: 'up3',
                            },
                            end: 22,
                            containingTrack: {} as MockTrack,
                        } as MockTimelineEvent,
                    ],
                },
            ];
            const allEvents = tracksData
                .map(track => track.items)
                .reduce((acc, val) => acc.concat(val), []);
            // Sort events by start time to mimic TimelineStore.allItems behavior,
            // as calculateStartDate picks the first event with DATE_ISO from the provided list.
            const sortedEvents = [...allEvents].sort(
                (a, b) => a.start - b.start
            ) as TimelineEvent[];
            // Act
            const result = calculateStartDate(sortedEvents);

            // Assert
            expect(result).toBe('2004-02-15'); // Uses first event with well-formed date (15 days)
        });
    });

    describe('Error handling', () => {
        it('should return null when store is empty', () => {
            // Arrange
            const emptyEvents: TimelineEvent[] = [];
            // Act
            const result = calculateStartDate(emptyEvents);

            // Assert
            expect(result).toBeNull();
            /* expect(consoleWarnSpy).toHaveBeenCalledWith(
                'No timeline events found'
            ); */
        });

        it('should return null when no events with absolute dates exist', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes = [
                { key: 'OTHER_ATTR', value: 'no date here' },
            ];

            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBeNull();
            /* expect(consoleWarnSpy).toHaveBeenCalledWith(
                'No timeline events with absolute dates found'
            ); */
        });

        it('should return null for invalid date format', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value =
                'invalid-date';
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBeNull();
            /* expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Invalid date format'
            ); */
        });

        it('should return null when DATE_ISO attribute is empty', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '';
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBeNull();
        });

        it('should catch errors and return null', () => {
            // Arrange - calculateStartDate expects TimelineEvent[]
            const malformedEvent = {
                start: 0,
                end: 0,
                // Missing the 'event' property, which will cause an error during processing
            } as any;
            const eventsWithMalformedItem: TimelineEvent[] = [
                defaultTrackData.items[0] as TimelineEvent, // A valid event
                malformedEvent,
            ];

            // Act
            const result = calculateStartDate(eventsWithMalformedItem);

            // Assert
            expect(result).toBeNull();
            /* expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error calculating absolute start date:',
                expect.any(Error)
            ); */
        });
    });

    describe('Edge cases', () => {
        it('should work with date at year end', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '2005-01-05';
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 10;
            defaultTrackData.items[0].start = 10;
            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2004-12-26'); // Crosses into previous year
        });

        it('should handle leap year correctly', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value = '2008-03-01'; // 2008 is leap year
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 30;
            defaultTrackData.items[0].start = 30;
            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2008-01-31'); // Correct calculation over February
        });

        it('should handle different time zones', () => {
            // Arrange
            defaultTrackData.items[0].event.attributes[0].value =
                '2009-02-15T14:30:00Z';
            defaultTrackData.items[0].event.attributes[0].key = 'DATE_ISO';
            defaultTrackData.items[0].event.startNumberOfDaysSinceDiagnosis = 1;
            defaultTrackData.items[0].start = 1;
            const events = defaultTrackData.items as TimelineEvent[];
            // Act
            const result = calculateStartDate(events);

            // Assert
            expect(result).toBe('2009-02-14'); // Only date, no time
        });
    });
});

describe('parseFlexibleDate', () => {
    it('should parse ISO date correctly', () => {
        const result = parseFlexibleDate('2010-02-15');
        expect(result).toEqual(new Date(2010, 1, 15)); // Month is 0-based
    });

    it('should parse DD/MM/YYYY format correctly', () => {
        const result = parseFlexibleDate('15/02/2011');
        expect(result).toEqual(new Date(2011, 1, 15));
    });

    it('should parse YYYY-M-DD format correctly', () => {
        const result = parseFlexibleDate('2011-7-11');
        expect(result).toEqual(new Date(2011, 6, 11));
    });

    it('should parse DD.MM.YYYY format correctly', () => {
        const result = parseFlexibleDate('15.02.2012');
        expect(result).toEqual(new Date(2012, 1, 15));
    });

    it('should parse D.M.YYYY format correctly', () => {
        const result = parseFlexibleDate('8.5.2012');
        expect(result).toEqual(new Date(2012, 4, 8));
    });

    it('should parse MM/DD/YYYY format correctly', () => {
        const result = parseFlexibleDate('02/15/2013');
        expect(result).toEqual(new Date(2013, 1, 15));
    });

    it('should parse DD.MM.YY format correctly', () => {
        const result = parseFlexibleDate('02.12.13');
        expect(result).toEqual(new Date(2013, 11, 2));
    });

    it('should return null for invalid inputs', () => {
        expect(parseFlexibleDate('')).toBeNull();
        expect(parseFlexibleDate('invalid')).toBeNull();
        expect(parseFlexibleDate('123456')).toBeNull();
        expect(parseFlexibleDate('36/01/2014')).toBeNull();
    });

    it('should handle whitespace correctly', () => {
        const result = parseFlexibleDate('  2015-02-15  ');
        expect(result).toEqual(new Date(2015, 1, 15));
    });
});

describe('getDateNDaysBefore', () => {
    it('should calculate N days before given date', () => {
        const date = new Date(2016, 1, 15); // Feb 15, 2024
        const result = getDateNDaysBefore(date, 5);
        expect(result).toEqual(new Date(2016, 1, 10)); // Feb 10, 2024
    });

    it('should work with negative values (days after date)', () => {
        const date = new Date(2017, 1, 15);
        const result = getDateNDaysBefore(date, -5);
        expect(result).toEqual(new Date(2017, 1, 20)); // Feb 20, 2024
    });

    it('should handle month transitions correctly', () => {
        const date = new Date(2018, 1, 5); // Feb 5, 2024
        const result = getDateNDaysBefore(date, 10);
        expect(result).toEqual(new Date(2018, 0, 26)); // Jan 26, 2024
    });
});

describe('isValidDate', () => {
    it('should recognize valid dates', () => {
        expect(isValidDate(new Date(2019, 1, 15))).toBe(true);
        expect(isValidDate(new Date(2010, 0, 1))).toBe(true);
    });

    it('should recognize invalid dates', () => {
        expect(isValidDate(new Date('invalid'))).toBe(false);
        expect(isValidDate(new Date(1800, 0, 1))).toBe(false); // Before 1900
    });

    it('should recognize non-Date objects', () => {
        expect(isValidDate('not a date' as any)).toBe(false);
        expect(isValidDate(null as any)).toBe(false);
    });
});

// Complex tests
describe('Complex Tests', () => {
    it('should handle complex scenarios with multiple events correctly', () => {
        // This data structure needs to be an array of TimelineTrackSpecification
        const complexTracksData: MockTrack[] = [
            {
                uid: 'trackA',
                type: 'DIAGNOSIS_TRACK',
                label: 'Diagnosis',
                items: [
                    {
                        // This event has no DATE_ISO, so it should be skipped by calculateStartDate
                        start: 0,
                        event: {
                            startNumberOfDaysSinceDiagnosis: 0,
                            attributes: [{ key: 'TYPE', value: 'diagnosis' }],
                        },
                    } as MockTimelineEvent,
                ],
            },
            {
                uid: 'trackB',
                type: 'TREATMENT_TRACK',
                label: 'Treatment',
                items: [
                    {
                        start: 30,
                        event: {
                            startNumberOfDaysSinceDiagnosis: 30,
                            attributes: [
                                { key: 'DATE_ISO', value: '15.03.2024' },
                                { key: 'TYPE', value: 'treatment' },
                            ],
                            eventType: 'TREATMENT',
                            patientId: 'pB',
                            studyId: 'sB',
                            uniquePatientKey: 'upB',
                        },
                        end: 30,
                        containingTrack: {} as MockTrack,
                    } as MockTimelineEvent,
                ],
            },
            {
                uid: 'trackC',
                type: 'EVENT_TRACK',
                label: 'Other Events',
                items: [
                    {
                        start: 60,
                        event: {
                            startNumberOfDaysSinceDiagnosis: 60,
                            attributes: [
                                { key: 'DATE_ISO', value: '2024-04-14' },
                            ],
                            eventType: 'OTHER_EVENT',
                            patientId: 'pC',
                            studyId: 'sC',
                            uniquePatientKey: 'upC',
                        },
                        end: 60,
                        containingTrack: {} as MockTrack,
                    } as MockTimelineEvent,
                ],
            },
        ];
        const allEvents = complexTracksData
            .map(track => track.items)
            .reduce((acc, val) => acc.concat(val), []);

        // To ensure the test behaves as it would have with TimelineStore.allItems,
        // (which sorts events by their 'start' property), we sort them here.
        // calculateStartDate picks the first event from the *provided list*
        // that has a 'DATE_ISO' attribute.
        const sortedEvents = [...allEvents].sort((a, b) => {
            if (a.start === undefined || b.start === undefined) return 0; // Should not happen with MockTimelineEvent
            return a.start - b.start;
        }) as TimelineEvent[];

        const result = calculateStartDate(sortedEvents);
        expect(result).toBe('2024-02-14'); // Mar 15 - 30 days -1 day correction = Feb 14
    });
});
