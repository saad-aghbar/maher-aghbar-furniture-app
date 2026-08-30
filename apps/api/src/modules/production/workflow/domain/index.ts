export {
  validateWorkflowGraph,
  type WorkflowValidationIssue,
  type WorkflowValidationNode,
  type WorkflowValidationEdge,
  type WorkflowValidationResult,
} from './workflow-graph-validator';

export {
  compileWorkflow,
  type CompiledProductionWorkflow,
  type CompiledNode,
  type CompiledEdge,
  type CompilerNode,
  type CompilerEdge,
  type CompilerProductOverride,
  type CompilerOrderOverride,
  type Applicability,
} from './workflow-compiler';

export {
  validateTerminalChain,
  planTerminalChainAppend,
  executionKindForStageCode,
  TERMINAL_STAGE_CODES,
  type TerminalStageCode,
  type TerminalAppendPlan,
} from './terminal-chain';

export {
  validateOpeningChain,
  planOpeningChainAppend,
  OPENING_STAGE_CODE,
  type OpeningAppendPlan,
} from './opening-chain';

export { calculateWorkflowProgress, type ProgressNodeInput } from './workflow-progress';

export {
  normalizeExplicitCode,
  slugFromEnglishName,
  nextUniqueCode,
  resolveGeneratedCode,
  resolveNodeKey,
  nextLibrarySortOrder,
  nextNodeSortOrder,
  cartesianReconnect,
  pickStagePatch,
  lockedAnchorNameChanged,
} from './technical-id';
