import { splitSearchMeta } from '../entityRowMeta';

describe('search row status language', () => {
  it('lifts raw STATUS codes into a badge slot', () => {
    expect(splitSearchMeta('PARTIALLY_PAID • 196.272')).toEqual({
      status: 'PARTIALLY_PAID',
      meta: '196.272',
    });
    expect(splitSearchMeta('CLOSED • Zaatar Home')).toEqual({
      status: 'CLOSED',
      meta: 'Zaatar Home',
    });
  });

  it('leaves ordinary subtitles unparsed', () => {
    expect(splitSearchMeta('Oasis Living')).toEqual({ meta: 'Oasis Living' });
    expect(splitSearchMeta(undefined)).toEqual({});
  });
});
