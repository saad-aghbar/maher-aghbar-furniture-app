'use client';

export interface AvailabilityItemInput {
  productId: string;
  quantity: number;
}

export interface AvailabilityResult {
  estimateStatus: 'CALCULATED' | 'PRELIMINARY' | 'UNAVAILABLE';
  earliestAvailableDate: string | null;
  requestedDateFeasible: boolean;
  suggestedDeliveryDate: string | null;
  alternativeDates: string[];
  estimateConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresAdminEstimateReview: boolean;
  minimumRequestDate?: string | null;
}

export function localDealerMinimumRequestYmd(now = new Date()): string {
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
