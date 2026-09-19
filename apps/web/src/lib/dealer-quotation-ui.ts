export function dealerCanDecideQuotation(
  status: string,
  commerciallyExpired?: boolean,
): boolean {
  if (commerciallyExpired) return false;
  return status === 'SENT' || status === 'VIEWED';
}
