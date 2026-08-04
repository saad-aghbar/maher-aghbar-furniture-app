/**
 * Pick whether a nav href should look active for the current pathname.
 * When multiple items match via prefix (e.g. `/orders` and `/orders/new`),
 * only the longest matching href is active — so sibling routes don't stay red together.
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  allHrefs: readonly string[],
): boolean {
  const path = pathname.split('?')[0] || '/';
  const matches = (candidate: string) =>
    path === candidate || path.startsWith(`${candidate}/`);

  if (!matches(href)) return false;

  const best = [...allHrefs].filter(matches).sort((a, b) => b.length - a.length)[0];
  return best === href;
}
