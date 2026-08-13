'use client';

import { Alert, Button, Input, Modal } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export type DayExceptionKind = 'open' | 'close' | 'overtime' | 'clear';

export function DayExceptionDialog({
  open,
  onClose,
  dateYmd,
  isWorking,
  hasException,
  defaultShiftStart = '08:00',
  defaultShiftEnd = '16:00',
  loading,
  errorMessage,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  dateYmd: string;
  isWorking: boolean;
  hasException: boolean;
  defaultShiftStart?: string;
  defaultShiftEnd?: string;
  loading?: boolean;
  errorMessage?: string | null;
  onAction: (kind: DayExceptionKind, overtimeEnd?: string) => void;
}) {
  const t = useTranslations('mobile.adminScheduling');
  const tCommon = useTranslations('common');
  const [overtimeEnd, setOvertimeEnd] = useState('20:00');

  useEffect(() => {
    if (open) setOvertimeEnd('20:00');
  }, [open, dateYmd]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('dayCapacity.title', { date: dateYmd })}
      description={t('dayCapacity.body')}
      size="sm"
      footer={
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {tCommon('cancel')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-text-secondary">
        {t('dayCapacity.normalShift', { start: defaultShiftStart, end: defaultShiftEnd })}
      </p>
      <div className="flex flex-col gap-2">
        {!isWorking ? (
          <Button variant="secondary" loading={loading} onClick={() => onAction('open')}>
            {t('dayCapacity.open')}
          </Button>
        ) : (
          <>
            <Input
              label={t('dayCapacity.overtimeUntil')}
              value={overtimeEnd}
              onChange={(e) => setOvertimeEnd(e.target.value)}
              placeholder="20:00"
            />
            <Button
              variant="secondary"
              loading={loading}
              onClick={() => onAction('overtime', overtimeEnd.trim() || '20:00')}
            >
              {t('dayCapacity.addOvertime')}
            </Button>
            <Button variant="danger" loading={loading} onClick={() => onAction('close')}>
              {t('dayCapacity.close')}
            </Button>
          </>
        )}
        {hasException ? (
          <Button variant="danger" loading={loading} onClick={() => onAction('clear')}>
            {t('dayCapacity.clear')}
          </Button>
        ) : null}
      </div>
      {errorMessage ? (
        <Alert variant="error" className="mt-3">
          {errorMessage}
        </Alert>
      ) : null}
    </Modal>
  );
}
