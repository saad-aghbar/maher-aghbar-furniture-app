import type { OcrProvider, OcrResult } from './types';

const FIXTURE =
  'Sofa 3 seats grey velvet W220 H90 D95 qty 4 delivery 2026-09-15 hotel lobby';

export class MockOcrProvider implements OcrProvider {
  readonly name = 'mock';

  async extractText(_input: Buffer, _mimeType: string): Promise<OcrResult> {
    return { text: FIXTURE, provider: this.name, confidence: 0.99 };
  }
}
