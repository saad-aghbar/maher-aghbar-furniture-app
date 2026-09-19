'use client';

import dynamic from 'next/dynamic';

export const DeliveryLocationMapLazy = dynamic(
  () =>
    import('./delivery-location-map').then((m) => m.DeliveryLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-border text-sm text-text-secondary">
        …
      </div>
    ),
  },
);
