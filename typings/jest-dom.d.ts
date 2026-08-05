/**
 * Type augmentation for @testing-library/jest-dom matchers.
 * Needed because @testing-library/jest-dom@6 types don't auto-merge
 * with @types/jest@27's jest.Matchers interface via typeRoots.
 */
declare namespace jest {
    interface Matchers<R, T = {}> {
        toBeInTheDocument(): R;
        toHaveStyle(css: string | Record<string, unknown>): R;
    }
}
