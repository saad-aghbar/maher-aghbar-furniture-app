import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';
import {
  selectActiveSpecOptionGroups,
  selectActiveSpecOptionValues,
  selectSpecOptionValuesForPicker,
} from '../selectSpecOptions';

const values: SpecOptionValue[] = [
  {
    id: 'v-old',
    groupId: 'g-foam',
    code: 'D28',
    nameEn: 'Foam 28',
    nameAr: 'إسفنج 28',
    isActive: false,
    sortOrder: 5,
  },
  {
    id: 'v-40',
    groupId: 'g-foam',
    code: 'D40',
    nameEn: 'Foam 40',
    nameAr: 'إسفنج 40',
    isActive: true,
    sortOrder: 30,
  },
  {
    id: 'v-35',
    groupId: 'g-foam',
    code: 'D35',
    nameEn: 'Foam 35',
    nameAr: 'إسفنج 35',
    isActive: true,
    sortOrder: 20,
  },
  {
    id: 'v-gold',
    groupId: 'g-paint',
    code: 'GOLD',
    nameEn: 'Gold',
    nameAr: 'ذهبي',
    isActive: true,
    sortOrder: 10,
  },
];

describe('selectSpecOptionValues', () => {
  it('hides deactivated values from new pickers', () => {
    expect(selectActiveSpecOptionValues(values).map((v) => v.id)).toEqual([
      'v-40',
      'v-35',
      'v-gold',
    ]);
  });

  it('sorts picker values and can scope to a group', () => {
    expect(selectSpecOptionValuesForPicker(values, 'g-foam').map((v) => v.code)).toEqual([
      'D35',
      'D40',
    ]);
  });

  it('keeps inactive groups out of picker lists', () => {
    const groups: SpecOptionGroup[] = [
      {
        id: 'g-foam',
        code: 'FOAM_DENSITY',
        nameEn: 'Foam density',
        nameAr: 'كثافة الإسفنج',
        inputType: 'SELECT',
        isActive: true,
        sortOrder: 10,
      },
      {
        id: 'g-old',
        code: 'OLD',
        nameEn: 'Retired',
        nameAr: 'قديم',
        inputType: 'SELECT',
        isActive: false,
        sortOrder: 99,
      },
    ];
    expect(selectActiveSpecOptionGroups(groups).map((g) => g.id)).toEqual(['g-foam']);
  });
});
