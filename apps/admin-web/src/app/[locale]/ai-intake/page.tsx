'use client';

import { apiFetch } from '@/lib/api-client';
import { Alert, Button, Card, Input, TextArea } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function AiIntakePage() {
  const t = useTranslations('navigation');
  const [rawText, setRawText] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createJob() {
    setLoading(true);
    setError(null);
    try {
      const job = await apiFetch('/api/v1/ai-intake/jobs', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'TEXT',
          rawText: rawText || undefined,
          customerId: customerId || undefined,
        }),
      });
      setResult(job);
    } catch {
      setError('Failed to create AI job');
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    if (!result || typeof result !== 'object' || !('id' in result) || !customerId) {
      setError('Customer ID required to approve');
      return;
    }
    setLoading(true);
    try {
      const approved = await apiFetch(`/api/v1/ai-intake/jobs/${(result as { id: string }).id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ customerId }),
      });
      setResult(approved);
    } catch {
      setError('Approval failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t('aiIntake')}</h1>
      <Card title="Human-reviewed AI intake">
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Input
            label="Customer ID (required to approve draft RFQ)"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
          <TextArea
            label="Incoming request text / OCR paste"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={createJob} loading={loading}>
              Extract (mock AI)
            </Button>
            <Button variant="secondary" onClick={approve} loading={loading}>
              Approve → Draft RFQ
            </Button>
          </div>
          {result ? (
            <pre className="overflow-auto rounded-md border border-border bg-background p-4 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
