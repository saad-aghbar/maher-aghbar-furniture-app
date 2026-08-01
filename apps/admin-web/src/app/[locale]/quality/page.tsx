'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { QUALITY_RESULTS, statusOptions } from '@/lib/status-options';

interface ProductionOrder {
  id: string;
  number: string;
  productDescription?: string;
  status: string;
  currentStageCode?: string | null;
}

interface InspectionItem {
  checklistCode: string;
  label: string;
  result?: string | null;
}

interface InspectionRow {
  id: string;
  number: string;
  result?: string | null;
  stageCode?: string | null;
  items?: InspectionItem[];
  productionOrder?: { number: string; productDescription?: string };
}

interface TemplateItemDraft {
  key: string;
  code: string;
  labelAr: string;
  labelEn: string;
}

interface TemplateItem {
  code: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number;
}

interface TemplateRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  stageCode?: string | null;
  isActive: boolean;
  items: TemplateItem[];
}

function emptyChecklistRow(): TemplateItemDraft {
  return {
    key: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: '',
    labelAr: '',
    labelEn: '',
  };
}

export default function QualityPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const tStatus = useTranslations('statuses');
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [productionOrderId, setProductionOrderId] = useState('');
  const [stageCode, setStageCode] = useState('INSPECTION');
  const [notes, setNotes] = useState('');
  const [tplCode, setTplCode] = useState('');
  const [tplNameEn, setTplNameEn] = useState('');
  const [tplNameAr, setTplNameAr] = useState('');
  const [tplStage, setTplStage] = useState('');
  const [tplItems, setTplItems] = useState<TemplateItemDraft[]>([emptyChecklistRow()]);
  const [resultFilter, setResultFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [search, setSearch] = useState('');

  const listQuery = useQuery({
    queryKey: ['quality-inspections'],
    queryFn: () =>
      apiFetch<{ data: InspectionRow[] }>('/api/v1/quality-inspections').then((r) => r.data),
  });
  const templatesQuery = useQuery({
    queryKey: ['quality-templates'],
    queryFn: () => apiFetch<TemplateRow[]>('/api/v1/quality-checklist-templates'),
  });
  const poQuery = useQuery({
    queryKey: ['production-orders-pick-qc'],
    queryFn: () =>
      apiFetch<{ data: ProductionOrder[] }>('/api/v1/production-orders?pageSize=50').then(
        (r) => r.data,
      ),
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!productionOrderId) throw new ApiClientError(tc('selectProductionOrder'), 400);
      return apiFetch('/api/v1/quality-inspections', {
        method: 'POST',
        body: JSON.stringify({
          productionOrderId,
          stageCode: stageCode || undefined,
          notes: notes.trim() || undefined,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['quality-inspections'] });
      setCreateOpen(false);
      setBanner(tc('inspectionCreated'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!tplCode || !tplNameEn || !tplNameAr) {
        throw new ApiClientError(tc('codeAndNamesRequired'), 400);
      }
      const items = tplItems
        .filter((i) => i.code.trim() && i.labelEn.trim() && i.labelAr.trim())
        .map((i, idx) => ({
          code: i.code.trim(),
          labelEn: i.labelEn.trim(),
          labelAr: i.labelAr.trim(),
          sortOrder: idx + 1,
        }));
      if (items.length === 0) {
        throw new ApiClientError(tc('checklistItemsRequired'), 400);
      }
      return apiFetch('/api/v1/quality-checklist-templates', {
        method: 'POST',
        body: JSON.stringify({
          code: tplCode,
          nameEn: tplNameEn,
          nameAr: tplNameAr,
          stageCode: tplStage || undefined,
          items,
        }),
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['quality-templates'] });
      setTemplateOpen(false);
      setBanner(tc('checklistTemplateSaved'));
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const rows = listQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const resultFilterOpts = statusOptions(tStatus, QUALITY_RESULTS, {
    label: tCommon('all'),
  });

  const filteredRows = useMemo(() => {
    return (listQuery.data ?? []).filter((row) => {
      if (resultFilter === 'pending' && row.result) return false;
      if (resultFilter && resultFilter !== 'pending' && row.result !== resultFilter) return false;
      if (stageFilter && !(row.stageCode ?? '').toLowerCase().includes(stageFilter.toLowerCase())) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [row.number, row.productionOrder?.number, row.stageCode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [listQuery.data, resultFilter, stageFilter, search]);

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError) {
    return <ErrorState title={t('quality')} onRetry={() => listQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('quality')}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setTplCode('');
                setTplNameEn('');
                setTplNameAr('');
                setTplStage('');
                setTplItems([emptyChecklistRow()]);
                setFormError(null);
                setTemplateOpen(true);
              }}
            >
              {tc('newTemplate')}
            </Button>
            <Button
              onClick={() => {
                setProductionOrderId('');
                setStageCode('INSPECTION');
                setNotes('');
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              {tc('newInspection')}
            </Button>
          </>
        }
      />
      {banner ? <Alert variant="success">{banner}</Alert> : null}

      <Tabs defaultValue="inspections">
        <TabList>
          <Tab value="inspections">{tc('inspections')}</Tab>
          <Tab value="templates">{tc('checklistTemplates')}</Tab>
        </TabList>
        <TabPanel value="inspections">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tCommon('search')}
              className="max-w-xs"
            />
            <Select
              label={tc('result')}
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              options={[{ value: 'pending', label: tc('pending') }, ...resultFilterOpts]}
              className="max-w-xs"
            />
            <Input
              label={tc('stageCode')}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
          {filteredRows.length === 0 ? (
            <EmptyState title={tc('noInspections')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                  <TableHeaderCell>{t('production')}</TableHeaderCell>
                  <TableHeaderCell>{tc('stage')}</TableHeaderCell>
                  <TableHeaderCell>{tc('result')}</TableHeaderCell>
                  <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/quality/${row.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        <span dir="ltr">{row.number}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span dir="ltr">{row.productionOrder?.number ?? '—'}</span>
                    </TableCell>
                    <TableCell>{row.stageCode ?? '—'}</TableCell>
                    <TableCell>
                      {row.result ? <StatusBadge status={row.result} /> : tc('pending')}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/quality/${row.id}`}
                        className="text-sm text-brand hover:underline"
                      >
                        {!row.result ? tc('submitResult') : tCommon('details')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
        <TabPanel value="templates">
          {templates.length === 0 ? (
            <EmptyState title={tc('noTemplates')} />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{tc('code')}</TableHeaderCell>
                  <TableHeaderCell>{tc('name')}</TableHeaderCell>
                  <TableHeaderCell>{tc('stage')}</TableHeaderCell>
                  <TableHeaderCell>{tc('lineItems')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <span dir="ltr">{tpl.code}</span>
                    </TableCell>
                    <TableCell>{localizedName(locale, tpl)}</TableCell>
                    <TableCell>{tpl.stageCode ?? '—'}</TableCell>
                    <TableCell>
                      <span dir="ltr">{tpl.items.length}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabPanel>
      </Tabs>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tc('newInspection')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {tCommon('create')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Select
            label={tc('productionOrder')}
            value={productionOrderId}
            onChange={(e) => {
              setProductionOrderId(e.target.value);
              const po = (poQuery.data ?? []).find((p) => p.id === e.target.value);
              if (po?.currentStageCode) setStageCode(po.currentStageCode);
            }}
          >
            <option value="">{tc('select')}</option>
            {(poQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.productDescription ?? tStatus(p.status as never)}
              </option>
            ))}
          </Select>
          <Input
            label={tc('stageCode')}
            value={stageCode}
            onChange={(e) => setStageCode(e.target.value)}
          />
          <Input label={tc('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={tc('newChecklistTemplate')}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTemplateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={createTemplate.isPending} onClick={() => createTemplate.mutate()}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input label={tc('code')} value={tplCode} onChange={(e) => setTplCode(e.target.value)} />
          <Input
            label={tc('nameEn')}
            value={tplNameEn}
            onChange={(e) => setTplNameEn(e.target.value)}
          />
          <Input
            label={tc('nameAr')}
            value={tplNameAr}
            onChange={(e) => setTplNameAr(e.target.value)}
          />
          <Input
            label={tc('stageCode')}
            value={tplStage}
            onChange={(e) => setTplStage(e.target.value)}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary">{tc('checklistItems')}</p>
              <Button
                type="button"
                size="sm"
                variant="subtle"
                onClick={() => setTplItems((prev) => [...prev, emptyChecklistRow()])}
              >
                <Plus className="me-1 h-3.5 w-3.5" />
                {tc('addChecklistItem')}
              </Button>
            </div>
            {tplItems.map((item) => (
              <div
                key={item.key}
                className="grid gap-2 rounded-lg border border-border bg-surface-muted/40 p-3 md:grid-cols-[6rem_1fr_1fr_auto]"
              >
                <Input
                  value={item.code}
                  onChange={(e) =>
                    setTplItems((prev) =>
                      prev.map((r) => (r.key === item.key ? { ...r, code: e.target.value } : r)),
                    )
                  }
                  placeholder={tc('checklistItemCode')}
                  required
                />
                <Input
                  value={item.labelEn}
                  onChange={(e) =>
                    setTplItems((prev) =>
                      prev.map((r) =>
                        r.key === item.key ? { ...r, labelEn: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder={tc('checklistLabelEn')}
                  required
                />
                <Input
                  value={item.labelAr}
                  onChange={(e) =>
                    setTplItems((prev) =>
                      prev.map((r) =>
                        r.key === item.key ? { ...r, labelAr: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder={tc('checklistLabelAr')}
                  required
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={tplItems.length <= 1}
                  onClick={() =>
                    setTplItems((prev) => prev.filter((r) => r.key !== item.key))
                  }
                  aria-label={tCommon('delete')}
                >
                  <Trash2 className="h-4 w-4 text-error" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
