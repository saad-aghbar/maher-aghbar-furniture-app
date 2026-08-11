import { pickShowcaseImages } from '../pickShowcaseImages';

describe('pickShowcaseImages', () => {
  const products = [
    { id: '1', imageUrl: 'https://img/1.jpg' },
    { id: '2', thumbnailUrl: 'https://img/2-thumb.jpg', imageUrl: 'https://img/2.jpg' },
    { id: '3', galleryUrls: ['https://img/3a.jpg', 'https://img/3b.jpg'] },
    { id: '4', imageUrl: 'https://img/4.jpg' },
    { id: '5', imageUrl: 'https://img/5.jpg' },
    { id: '6', imageUrl: 'https://img/6.jpg' },
    { id: '7', imageUrl: null },
    { id: '8', imageUrl: 'https://img/8.jpg' },
    { id: '9', imageUrl: 'https://img/9.jpg' },
    { id: '10', imageUrl: 'https://img/10.jpg' },
    { id: '11', imageUrl: 'https://img/11.jpg' },
  ];

  it('returns between min and max images when the pool is large enough', () => {
    const seq = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.5, 0.15, 0.85];
    let i = 0;
    const random = () => seq[i++ % seq.length]!;
    const uris = pickShowcaseImages(products, { min: 5, max: 10, random });
    expect(uris.length).toBeGreaterThanOrEqual(5);
    expect(uris.length).toBeLessThanOrEqual(10);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('prefers thumbnail over primary image', () => {
    const uris = pickShowcaseImages(
      [{ thumbnailUrl: 'https://img/thumb.jpg', imageUrl: 'https://img/full.jpg' }],
      { min: 1, max: 1, random: () => 0 },
    );
    expect(uris).toEqual(['https://img/thumb.jpg']);
  });

  it('returns empty when no product has imagery', () => {
    expect(pickShowcaseImages([{ imageUrl: null }, { galleryUrls: [] }])).toEqual([]);
  });

  it('uses one frame per product', () => {
    const uris = pickShowcaseImages(
      [{ galleryUrls: ['https://a.jpg', 'https://b.jpg'] }],
      { min: 1, max: 5, random: () => 0 },
    );
    expect(uris).toEqual(['https://a.jpg']);
  });
});
