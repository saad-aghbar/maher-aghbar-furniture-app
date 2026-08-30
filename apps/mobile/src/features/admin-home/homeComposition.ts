/**
 * Admin home composition switch.
 *
 * - `signature` — Piece 12 management desk (Attention → Today → Flow → …)
 * - `living` — calm focus / floor journey (legacy living experiments)
 * - `atelierDashboard` — full ops atelier (queues, stage board, ribbons…)
 *
 * Ask to “go back” → set the constant below.
 */
export type AdminHomeComposition = 'signature' | 'living' | 'atelierDashboard';

export const ADMIN_HOME_COMPOSITION: AdminHomeComposition = 'signature';
