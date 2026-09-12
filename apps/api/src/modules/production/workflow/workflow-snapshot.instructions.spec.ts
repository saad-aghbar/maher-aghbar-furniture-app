import { readFileSync } from 'fs';
import { join } from 'path';

describe('workflow snapshot item instructions', () => {
  const source = readFileSync(join(__dirname, 'workflow-snapshot.service.ts'), 'utf8');

  it('broadcasts the production-order instruction block to every node', () => {
    expect(source).toContain('instructionsAr');
    expect(source).toContain('instructionsEn');
    expect(source).toContain('instructionsHe');
    expect(source).toMatch(/instructionsAr:\s*instructionsAr/);
    expect(source).toMatch(/instructionsEn:\s*instructionsEn/);
    expect(source).toMatch(/instructionsHe:\s*instructionsHe/);
  });

  it('does not read per-stage ProductStageInstruction rows', () => {
    expect(source).not.toContain('productStageInstruction');
  });

  it('variant-scopes stage inventory and material loads', () => {
    expect(source).toContain('pickVariantScopedRows');
  });
});
