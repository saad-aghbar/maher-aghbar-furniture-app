'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@maher/ui';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

function useEmbedded() {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('embedded') === '1';
    const fromClass = document.documentElement.classList.contains('maher-embedded');
    setEmbedded(fromQuery || fromClass);
    if (fromQuery) document.documentElement.classList.add('maher-embedded');
  }, []);
  return embedded;
}

export function AppShell({ children }: { children: ReactNode }) {
  const tNav = useTranslations('navigation');
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const embedded = useEmbedded();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // In the Expo WebView (embedded), treat mid breakpoints like desktop for side nav,
  // and keep the slide-in drawer for the narrowest widths.
  const asideVisible = embedded ? 'md:block' : 'lg:block';
  const drawerOnly = embedded ? 'md:hidden' : 'lg:hidden';

  return (
    <div className={cn('flex min-h-screen bg-background', embedded && 'maher-embedded-shell')}>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen w-[264px] shrink-0 border-e border-border',
          asideVisible,
        )}
      >
        <Sidebar />
      </aside>

      {mobileOpen ? (
        <div className={cn('fixed inset-0 z-50', drawerOnly)}>
          <button
            type="button"
            aria-label={tNav('closeMenu')}
            className="maher-animate-fade absolute inset-0 bg-[#1c1917]/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="maher-animate-in-start absolute inset-y-0 start-0 w-[264px] shadow-float">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setMobileOpen(true)} menuButtonClassName={drawerOnly} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div key={pathname} className="maher-page-enter mx-auto w-full max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
