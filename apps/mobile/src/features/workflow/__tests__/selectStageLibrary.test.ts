import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  groupStageLibrary,
  isLockedOpeningStage,
  LOCKED_OPENING_STAGE_CODE,
  stageLibraryListInset,
} from '../selectStageLibrary';

const prep = { code: 'MATERIAL_PREP', sortOrder: 1 };
const carpentry = { code: 'CARPENTRY', sortOrder: 2 };
const painting = { code: 'PAINTING', sortOrder: 3 };
const foam = { code: 'FOAM', sortOrder: 4 };

describe('selectStageLibrary', () => {
  it('locks only Material preparation as the opening stage', () => {
    expect(LOCKED_OPENING_STAGE_CODE).toBe('MATERIAL_PREP');
    expect(isLockedOpeningStage(prep)).toBe(true);
    expect(isLockedOpeningStage(carpentry)).toBe(false);
    expect(isLockedOpeningStage(foam)).toBe(false);
  });

  it('groups API stages into opening vs production without inventing rows', () => {
    const { opening, production } = groupStageLibrary([foam, prep, painting, carpentry]);
    expect(opening.map((s) => s.code)).toEqual(['MATERIAL_PREP']);
    expect(production.map((s) => s.code)).toEqual(['CARPENTRY', 'PAINTING', 'FOAM']);
  });

  it('keeps last-card inset as safe-area plus tab clearance', () => {
    expect(stageLibraryListInset(34, SURFACE_TAB_BAR_CLEARANCE)).toBe(
      34 + SURFACE_TAB_BAR_CLEARANCE,
    );
  });
});
