import {
  isCatalogTemplateActionAvailable,
  isPlanTypeBoardVisible,
  planTypeLens,
} from '../catalogTemplateAction';

describe('catalog template action gating', () => {
  it('shows the action when Standard + product + usable template', () => {
    const template = {
      showBoard: true,
      actionAvailable: true,
      hasUsableDefinition: true,
      manufacturingComplexity: 'STANDARD',
      product: { id: 'p1', sku: 'SF-MIL-03', nameEn: 'Milano Sofa' },
      requestedFabricLabel: 'Velvet Beige',
    };
    expect(isPlanTypeBoardVisible(template)).toBe(true);
    expect(isCatalogTemplateActionAvailable(template)).toBe(true);
    expect(planTypeLens(template.manufacturingComplexity)).toBe('standard');
  });

  it('shows the Modified board and action when the server marks it available', () => {
    const template = {
      showBoard: true,
      actionAvailable: true,
      hasUsableDefinition: true,
      manufacturingComplexity: 'MODIFIED',
      product: { id: 'p1', sku: 'SF-MIL-03', nameEn: 'Milano Sofa' },
    };
    expect(isPlanTypeBoardVisible(template)).toBe(true);
    expect(isCatalogTemplateActionAvailable(template)).toBe(true);
    expect(planTypeLens('MODIFIED')).toBe('modified');
  });

  it('shows the Custom board with no template action', () => {
    const template = {
      showBoard: true,
      actionAvailable: false,
      hasUsableDefinition: false,
      manufacturingComplexity: 'CUSTOM',
    };
    expect(isPlanTypeBoardVisible(template)).toBe(true);
    expect(isCatalogTemplateActionAvailable(template)).toBe(false);
    expect(planTypeLens('CUSTOM')).toBe('custom');
  });

  it('hides the action when there is no usable template', () => {
    const template = {
      showBoard: true,
      actionAvailable: false,
      hasUsableDefinition: false,
      manufacturingComplexity: 'STANDARD',
      product: { id: 'p1', sku: 'SF-MIL-03', nameEn: 'Milano Sofa' },
    };
    expect(isPlanTypeBoardVisible(template)).toBe(true);
    expect(isCatalogTemplateActionAvailable(template)).toBe(false);
  });
});
