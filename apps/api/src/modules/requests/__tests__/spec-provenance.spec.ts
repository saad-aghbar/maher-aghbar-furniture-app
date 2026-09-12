import { specProvenance } from '../spec-provenance';

describe('spec provenance', () => {
  it('labels dealer corrections separately from sheet values', () => {
    const rows = specProvenance({
      item: { productName: 'Karina', width: '255', foamDensity: 'D35' },
      jobFields: [
        {
          fieldName: '__items',
          fieldValue: JSON.stringify([{ productName: 'كرينا', width: '250', foamDensity: 'D35' }]),
        },
      ],
    });
    expect(rows.find((row) => row.key === 'width')?.source).toBe('dealer');
    expect(rows.find((row) => row.key === 'foamDensity')?.source).toBe('both');
  });
});
