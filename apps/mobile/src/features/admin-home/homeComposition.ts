/**
 * Admin home composition switch.
 *
 * - `signature` — calm factory Home (next step → floor stages → places → recent)
 * - `living` — same hierarchy (alias for earlier living experiments)
 * - `atelierDashboard` — full ops atelier (queues, stage board, ribbons…)
 *
 * Ask to “go back” → set the constant below.
 */
export type AdminHomeComposition = 'signature' | 'living' | 'atelierDashboard';

export const ADMIN_HOME_COMPOSITION: AdminHomeComposition = 'signature';
