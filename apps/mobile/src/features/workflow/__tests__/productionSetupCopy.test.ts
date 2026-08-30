import {
  productionSetupIssueText,
  productionSetupProductLine,
  stripExampleParenthetical,
} from '../productionSetupCopy';
import type { ProductionSetupStage } from '@/api/modules/workflow';

const packaging: ProductionSetupStage = {
  workflowNodeId: 'node-pack',
  nodeKey: 'PACKAGING',
  stageDefinitionId: 'sd-pack',
  nameEn: 'Packaging',
  nameAr: 'تغليف',
  nameHe: 'אריזה',
  behavior: 'PRODUCES_FINISHED',
  consumesRawMaterials: false,
  consumesSemiFinished: true,
  consumeOutputIds: [],
  output: null,
};

describe('stripExampleParenthetical', () => {
  it('drops leftover example dumps without touching the instruction', () => {
    expect(
      stripExampleParenthetical(
        'Name every ship package for Packaging (for example A, legs, 3).',
      ),
    ).toBe('Name every ship package for Packaging.');
  });

  it('leaves copy without a parenthetical example unchanged', () => {
    expect(stripExampleParenthetical('Name every ship package for Packaging.')).toBe(
      'Name every ship package for Packaging.',
    );
  });
});

describe('productionSetupProductLine', () => {
  it('shows SKU / localized name', () => {
    expect(
      productionSetupProductLine(
        { sku: 'SOF-3S-STD', nameEn: '3-Seater Sofa Standard', nameAr: 'كنبة ثلاثية قياسية' },
        'en',
      ),
    ).toBe('SOF-3S-STD / 3-Seater Sofa Standard');
  });

  it('does not invent a name when only SKU exists', () => {
    expect(productionSetupProductLine({ sku: 'SOF-3S-STD' }, 'en')).toBe('SOF-3S-STD');
  });
});

describe('productionSetupIssueText', () => {
  it('names the producing stage without an example dump', () => {
    const t = (key: string, vars?: Record<string, string | number>) => {
      if (key === 'mobile.production.workflow.issueOutputName') {
        return `Name every ship package for ${vars?.stage}.`;
      }
      return key;
    };
    expect(
      productionSetupIssueText(
        {
          code: 'SETUP_OUTPUT_NAME_REQUIRED',
          message: 'Name the component or finished product this stage produces.',
          workflowNodeId: 'node-pack',
        },
        [packaging],
        'en',
        t,
      ),
    ).toBe('Name every ship package for Packaging.');
  });

  it('strips example dumps from backend fallback copy', () => {
    const t = (key: string) => key;
    expect(
      productionSetupIssueText(
        {
          code: 'UNKNOWN_CODE',
          message: 'Name every ship package for Packaging (for example A, legs, 3).',
        },
        [],
        'en',
        t,
      ),
    ).toBe('Name every ship package for Packaging.');
  });
});
