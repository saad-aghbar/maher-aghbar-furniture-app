export type {
  CanonicalWorkflowGraph,
  ParallelBand,
  PlacementIntent,
  PredecessorPatch,
  WorkflowDomainEdge,
  WorkflowDomainNode,
  WorkflowMutation,
  WorkflowValidationIssue,
  WorkflowValidationResult,
} from './types';

export {
  buildPredMap,
  codeOf,
  computeLevels,
  deriveSuccMap,
  edgePairs,
  edgesFromPredMap,
  hasCycle,
  isOpeningCode,
  isProductionCode,
  isReachable,
  isTerminalCode,
  sortedUnique,
} from './graph';

export { canonicalizeWorkflowGraph, isAllowedRoot } from './canonicalize';
export {
  filterStartSuccessorIds,
  isMiddleProductionCode,
  materialPrepSuccessorIds,
  productionSuccessorIds,
  validSuccessorCandidateIds,
  withSuccessorIds,
} from './successors';
export {
  clampParallelReferenceIds,
  clampPredecessorIds,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
} from './placementCandidates';
export { computeProductionFrontier } from './frontier';
export {
  computeParallelBands,
  isParallelToParallelJoin,
} from './parallelBands';
export { transitiveReducePredMap, transitiveReduceProduction } from './transitiveReduction';
export { validateCanonicalWorkflowGraph } from './validation';
export { diffPredecessorSets } from './diff';
export {
  applyPatchesToPredMap,
  fromRawGraph,
  simulateWorkflowMutation,
  spliceRemoveNode,
} from './mutations';
export {
  applyParallelBandLink,
  detectParallelBandLinks,
  resolveBandLinkMode,
  type ParallelBandLink,
  type ParallelBandLinkMode,
} from './bandLink';
