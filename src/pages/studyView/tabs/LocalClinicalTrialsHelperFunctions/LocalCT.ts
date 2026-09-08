// This file is responsible for fetching the local clinical trial data, either from a static JSON file during development or from a server endpoint in production.
declare module '*.json';
import localCTData from './localCT.dev.json'; // dev static JSON
import { LocalCTBundle } from './LocalCTInterfaces';
import { buildLocalCTBundle } from './LocalCTTools';

export type clinicalTrial = {
    trialName: string;
    trialUrl?: string;
    inclusionCriteria: string[];
    exclusionCriteria?: string[];
    min_age?: number;
    max_age?: number;
};

let trialsPromise: Promise<clinicalTrial[]> | undefined;
let bundlePromise: Promise<LocalCTBundle> | undefined;

export const loadLocalCT = async (): Promise<clinicalTrial[]> => {
    const isDev =
        window.location.hostname === 'localhost' &&
        window.location.port === '3000';

    if (isDev) {
        return localCTData.studies as clinicalTrial[];
    } else {
        const res = await fetch('/localCT.json', { credentials: 'include' });
        if (!res.ok) {
            throw new Error(`Failed to load localCT.json: ${res.statusText}`);
        }
        const data = await res.json();
        return data.studies as clinicalTrial[];
    }
};

export function getLocalCT(): Promise<clinicalTrial[]> {
    if (!trialsPromise) {
        trialsPromise = loadLocalCT().catch(error => {
            trialsPromise = undefined;
            console.warn(
                '[Local Clinical Trials] Could not load localCT.json.',
                error
            );
            throw error;
        });
    }

    return trialsPromise;
}

export function getLocalCTBundle(): Promise<LocalCTBundle> {
    if (!bundlePromise) {
        bundlePromise = getLocalCT()
            .then(buildLocalCTBundle)
            .catch(error => {
                bundlePromise = undefined;
                throw error;
            });
    }

    return bundlePromise;
}
