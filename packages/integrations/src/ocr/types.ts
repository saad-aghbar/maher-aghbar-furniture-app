export interface OcrResult {
  text: string;
  provider: string;
  confidence?: number;
}

export interface OcrProvider {
  readonly name: string;
  extractText(input: Buffer, mimeType: string): Promise<OcrResult>;
}
