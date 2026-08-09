/**
 * Accepts next-intl / next `Link` (or a plain `<a>`).
 * Intentionally `any` so React 18 vs 19 `@types/react` in the monorepo
 * do not fail assignability on `ElementType` / `ReactNode` (bigint).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppLinkComponent = any;
