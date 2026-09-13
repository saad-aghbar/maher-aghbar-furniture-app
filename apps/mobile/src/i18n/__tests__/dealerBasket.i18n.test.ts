import { translate } from '../translate';

const KEYS = [
  'mobile.newOrder.basket',
  'mobile.newOrder.basketEmpty',
  'mobile.newOrder.addLine',
  'mobile.newOrder.removeLine',
  'mobile.newOrder.editLineSpec',
  'mobile.newOrder.editItem',
  'mobile.newOrder.editProductVariant',
  'mobile.newOrder.editCustomItem',
  'mobile.newOrder.customItemTitle',
  'mobile.newOrder.waitingForFactoryPrice',
  'mobile.newOrder.addCustomToBasket',
  'mobile.newOrder.basketWaitsForFactoryPrice',
  'mobile.lineKind.standard',
  'mobile.lineKind.customized',
  'mobile.lineKind.custom',
  'mobile.newOrder.pickVariant',
  'mobile.newOrder.defaultVariant',
  'mobile.newOrder.untitledModel',
  'mobile.newOrder.basketPieceCount',
  'mobile.newOrder.basketEditingPiece',
  'mobile.newOrder.openBasketDesk',
  'mobile.productDetail.pickVariant',
  'mobile.adminRequest.variant',
  'mobile.adminRequest.foamDensity',
] as const;

describe('dealer basket i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves basket keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
