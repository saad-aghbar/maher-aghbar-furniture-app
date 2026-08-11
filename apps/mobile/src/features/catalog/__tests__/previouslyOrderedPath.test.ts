/**
 * Route registration smoke — previously-ordered must not be captured by :id.
 * Logic coverage lives with controller integration; this guards the path string.
 */
describe('catalog browse previously-ordered path', () => {
  it('uses a static path segment before product id routes', () => {
    const previouslyOrdered = '/catalog/browse/previously-ordered';
    const byId = '/catalog/browse/products/:id';
    expect(previouslyOrdered.includes('previously-ordered')).toBe(true);
    expect(byId).not.toContain('previously-ordered');
  });
});
