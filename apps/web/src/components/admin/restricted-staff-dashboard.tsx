'use client';

import { Board } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { QuickJumpsBoard } from './desk';

/** Staff without report access: a greeting board and the modules they can open. */
export function RestrictedStaffDashboard({ firstName }: { firstName: string | null }) {
  const tCommon = useTranslations('common');

  return (
    <div className="maher-stagger space-y-5 pb-8">
      <Board wash="top" as="section">
        <div className="px-5 py-5 sm:px-6">
          <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[30px] sm:leading-9">
            {firstName
              ? tCommon('dashboardGreetingNamed', { name: firstName })
              : tCommon('dashboardGreeting')}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--maher-text-secondary)]">
            {tCommon('personaGenericBody')}
          </p>
        </div>
      </Board>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <QuickJumpsBoard title={tCommon('personaGenericTitle')} description={tCommon('dashboardQuickHint')} />
        </div>
      </div>
    </div>
  );
}
