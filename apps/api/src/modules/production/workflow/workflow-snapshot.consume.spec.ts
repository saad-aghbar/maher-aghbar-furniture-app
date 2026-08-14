import { jsonIdList } from '../../../common/helpers/inventory-stage-behavior.util';

describe('snapshot consume freeze', () => {
  it('stores consume inventory item ids as a json list', () => {
    expect(jsonIdList(['frame', 'kit'])).toEqual(['frame', 'kit']);
    expect(jsonIdList(null)).toEqual([]);
    expect(jsonIdList(['', 1, 'ok'])).toEqual(['ok']);
  });

  it('keeps omitted consume ids as legacy all-WIP behavior', () => {
    expect(jsonIdList(undefined)).toEqual([]);
  });
});
