'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { isReturnWorkflowScope } from '@maher/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ReturnDetail } from './return-shared';
import type { ReturnPieceDecision, ReturnResponsibility, ReturnWorkflowOption } from './return-types';

export type ReturnConfirmKind =
  | 'approve'
  | 'reject'
  | 'need_info'
  | 'receive'
  | 'decide'
  | 'reship'
  | 'charge'
  | 'send_charge'
  | 'accept_charge'
  | 'reject_charge'
  | 'ready'
  | 'cancel'
  | 'mark_sent';

export const RETURN_RESPONSIBILITIES: ReturnResponsibility[] = ['FACTORY_WARRANTY', 'DEALER_RESPONSIBILITY', 'SHARED', 'UNDETERMINED'];
export const RETURN_DECISIONS: ReturnPieceDecision[] = ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'];

export function defaultWorkflowId(decision: ReturnPieceDecision, workflows: ReturnWorkflowOption[]): string | undefined {
  const published = workflows.filter((workflow) => isReturnWorkflowScope(workflow.scope) && workflow.status !== 'ARCHIVED');
  if (!published.length) return undefined;
  if (decision === 'SCRAP_RECOVERY') {
    return published.find((workflow) => workflow.code === 'RETURN_RECOVERY')?.id ?? published[0]?.id;
  }
  return published.find((workflow) => workflow.code !== 'RETURN_RECOVERY')?.id ?? published[0]?.id;
}

export interface WarehouseOption {
  id: string;
  code: string;
  nameEn?: string;
  nameAr?: string;
  locations?: Array<{ id: string; code: string; name?: string | null; isDefault?: boolean; isActive?: boolean }>;
}

/** All state, queries and mutations behind the return desk page. */
export function useReturnDesk(id: string) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ReturnConfirmKind | null>(null);
  const [needInfoNote, setNeedInfoNote] = useState('');
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [condition, setCondition] = useState('GOOD');
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedLocationId, setReceivedLocationId] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [decisions, setDecisions] = useState<Record<string, { decision: ReturnPieceDecision; workflowId?: string }>>({});
  const [responsibility, setResponsibility] = useState<ReturnResponsibility>('UNDETERMINED');
  const [chargeAmount, setChargeAmount] = useState('');
  const [factoryShare, setFactoryShare] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [reshipAddress, setReshipAddress] = useState('');
  const [reshipNotes, setReshipNotes] = useState('');

  const detailQuery = useQuery({
    queryKey: ['returns', id],
    queryFn: () => apiFetch<ReturnDetail>(`/api/v1/returns/${id}`),
  });
  const detail = detailQuery.data;

  const workflowsQuery = useQuery({
    queryKey: ['production-workflows', 'return-decision'],
    queryFn: () => apiFetch<ReturnWorkflowOption[]>('/api/v1/production-workflows'),
    staleTime: 60_000,
  });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses', 'return-receive'],
    queryFn: () => apiFetch<WarehouseOption[]>('/api/v1/inventory/warehouses'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!detail) return;
    setResponsibility((detail.responsibility as ReturnResponsibility) || 'UNDETERMINED');
    setChargeAmount(detail.chargeAmount != null && Number(detail.chargeAmount) > 0 ? String(detail.chargeAmount) : '');
    setFactoryShare(detail.factoryShareAmount != null && Number(detail.factoryShareAmount) > 0 ? String(detail.factoryShareAmount) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.responsibility, detail?.chargeAmount, detail?.factoryShareAmount]);

  // Pre-select every awaiting piece the first time the receive board shows.
  useEffect(() => {
    const awaiting = (detail?.pieces ?? []).filter((p) => p.state === 'AWAITING_RECEIPT').map((p) => p.id);
    setSelectedPieceIds((current) => (current.length ? current.filter((pid) => awaiting.includes(pid)) : awaiting));
  }, [detail?.pieces]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['returns'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const settle = async () => {
    setError(null);
    setConfirm(null);
    await invalidate();
  };
  const fail = (err: unknown) => setError(mutationErrorMessage(err));
  const base = `/api/v1/returns/${id}`;

  const resolveMutation = useMutation({
    mutationFn: (approvalStatus: 'APPROVED' | 'REJECTED') => apiFetch(`${base}/resolve`, { method: 'PATCH', body: JSON.stringify({ approvalStatus }) }),
    onSuccess: settle,
    onError: fail,
  });
  const needInfoMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/need-info`, { method: 'PATCH', body: JSON.stringify({ needInfoNote: needInfoNote.trim() }) }),
    onSuccess: async () => {
      setNeedInfoNote('');
      await settle();
    },
    onError: fail,
  });
  const markSentMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/mark-sent`, { method: 'POST', body: '{}' }),
    onSuccess: settle,
    onError: fail,
  });
  const receiveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          pieceIds: selectedPieceIds.length ? selectedPieceIds : undefined,
          receivedCondition: condition,
          warehouseId: warehouseId || undefined,
          receivedLocationId: receivedLocationId || undefined,
          receivedNotes: receiveNotes.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      setReceiveNotes('');
      await settle();
    },
    onError: fail,
  });
  const decideMutation = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/decisions`, {
        method: 'POST',
        body: JSON.stringify({ items: Object.entries(decisions).map(([pieceId, draft]) => ({ pieceId, decision: draft.decision, workflowId: draft.workflowId })) }),
      }),
    onSuccess: async () => {
      setDecisions({});
      await settle();
    },
    onError: fail,
  });
  const responsibilityMutation = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/responsibility`, {
        method: 'PATCH',
        body: JSON.stringify({
          responsibility,
          dealerAmount: responsibility !== 'FACTORY_WARRANTY' && Number(chargeAmount) > 0 ? Number(chargeAmount) : undefined,
          factoryAmount: responsibility === 'SHARED' && Number(factoryShare) > 0 ? Number(factoryShare) : undefined,
        }),
      }),
    onSuccess: settle,
    onError: fail,
  });
  const chargeMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/charge`, { method: 'POST', body: JSON.stringify({ amount: Number(chargeAmount || detail?.chargeAmount || 0) }) }),
    onSuccess: settle,
    onError: fail,
  });
  const sendChargeMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/charge/send`, { method: 'POST', body: '{}' }),
    onSuccess: settle,
    onError: fail,
  });
  const respondChargeMutation = useMutation({
    mutationFn: (input: { accept: boolean; note?: string }) => apiFetch(`${base}/charge/respond`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      setRejectNote('');
      await settle();
    },
    onError: fail,
  });
  const reshipMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/reship`, { method: 'POST', body: JSON.stringify({ address: reshipAddress.trim() || undefined, notes: reshipNotes.trim() || undefined }) }),
    onSuccess: settle,
    onError: fail,
  });
  const readyMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/ready-to-return`, { method: 'POST' }),
    onSuccess: settle,
    onError: fail,
  });
  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`${base}/cancel`, { method: 'POST' }),
    onSuccess: settle,
    onError: fail,
  });
  const cancelPieceMutation = useMutation({
    mutationFn: (pieceId: string) => apiFetch(`${base}/pieces/${pieceId}/cancel`, { method: 'POST' }),
    onSuccess: settle,
    onError: fail,
  });

  const busy =
    resolveMutation.isPending ||
    needInfoMutation.isPending ||
    markSentMutation.isPending ||
    receiveMutation.isPending ||
    decideMutation.isPending ||
    responsibilityMutation.isPending ||
    chargeMutation.isPending ||
    sendChargeMutation.isPending ||
    respondChargeMutation.isPending ||
    reshipMutation.isPending ||
    readyMutation.isPending ||
    cancelMutation.isPending ||
    cancelPieceMutation.isPending;

  const workflows = (workflowsQuery.data ?? []).filter((workflow) => isReturnWorkflowScope(workflow.scope));

  return {
    detailQuery,
    detail,
    workflows,
    warehouses: warehousesQuery.data ?? [],
    error,
    setError,
    confirm,
    setConfirm,
    busy,
    form: {
      needInfoNote,
      setNeedInfoNote,
      selectedPieceIds,
      setSelectedPieceIds,
      condition,
      setCondition,
      warehouseId,
      setWarehouseId,
      receivedLocationId,
      setReceivedLocationId,
      receiveNotes,
      setReceiveNotes,
      decisions,
      setDecisions,
      responsibility,
      setResponsibility,
      chargeAmount,
      setChargeAmount,
      factoryShare,
      setFactoryShare,
      rejectNote,
      setRejectNote,
      reshipAddress,
      setReshipAddress,
      reshipNotes,
      setReshipNotes,
    },
    mutations: {
      resolve: resolveMutation,
      needInfo: needInfoMutation,
      markSent: markSentMutation,
      receive: receiveMutation,
      decide: decideMutation,
      responsibility: responsibilityMutation,
      charge: chargeMutation,
      sendCharge: sendChargeMutation,
      respondCharge: respondChargeMutation,
      reship: reshipMutation,
      ready: readyMutation,
      cancel: cancelMutation,
      cancelPiece: cancelPieceMutation,
    },
  };
}

export type ReturnDesk = ReturnType<typeof useReturnDesk>;
