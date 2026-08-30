import type { ReactNode } from 'react';

/** File-level audit classification (H1). */
export type FileClassification =
  | 'REGISTERED'
  | 'REPRESENTED_BY_PARENT'
  | 'SCREEN_LINK'
  | 'EXCLUDED_NON_VISUAL'
  | 'UNCLASSIFIED';

export type LabRole = 'Admin' | 'Dealer' | 'Worker' | 'Shared';

export type LabRepresentation = 'direct' | 'parent' | 'screen-link';

export type ReviewState = 'needs_work' | 'approved' | 'review_later' | 'unset';

export type LabRenderContext = {
  variant: string;
  resetKey: number;
  rolePreview: LabRole | 'All';
};

export type LabRegistryEntry = {
  /** Stable id e.g. production.order-board-card */
  id: string;
  componentName: string;
  displayName?: string;
  category: string;
  subcategory?: string;
  role: LabRole;
  /** Path relative to apps/mobile/ */
  sourceFile: string;
  usedIn: string[];
  /** Expo href for [Open usage] — fixtures /dev only */
  openUsageTarget?: string;
  description: string;
  variants?: string[];
  interactive: boolean;
  tags: string[];
  contains?: string[];
  representation: LabRepresentation;
  /** Lazy preview — only mounted in inspector */
  render?: (ctx: LabRenderContext) => ReactNode;
};

export type FileAuditRow = {
  /** Path relative to apps/mobile/ */
  path: string;
  classification: FileClassification;
  exportNames: string[];
  registryIds: string[];
  notes?: string;
};
