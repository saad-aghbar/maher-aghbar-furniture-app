import { BrandMark as SharedBrandMark, type BrandMarkProps } from '@maher/ui';

/** @deprecated Prefer importing BrandMark from @maher/ui */
export function BrandMark(props: BrandMarkProps) {
  return <SharedBrandMark {...props} />;
}
