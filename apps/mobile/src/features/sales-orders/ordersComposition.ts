/**
 * Orders tab composition switch.
 *
 * - `signature` — hybrid: stage spine + day ledger groups + progress cards (default)
 * - `pipeline` — living stage spine + cinematic stream
 * - `workbench` — one hot order, lanes, quieter browse
 * - `ledger` — day-grouped workshop ledger
 * - `classic` — original searchable card FlatList
 *
 * Flip the constant below while iterating.
 */
export type OrdersComposition =
  | 'signature'
  | 'pipeline'
  | 'workbench'
  | 'ledger'
  | 'classic';

export const ORDERS_COMPOSITION: OrdersComposition = 'signature';
