import {
  classifyDealerLifecycle,
  isConfirmReceiptVisible,
  isProtectedStageCode,
  isRecoveryStageCode,
  lockedAnchorStageCodesForScope,
  LOCKED_ANCHOR_STAGE_CODES,
  PROTECTED_STAGE_CODES,
  RECOVERY_STAGE_CODE,
  workflowGraphChainRequirements,
} from '../dealer-lifecycle';

describe('dealer-lifecycle', () => {
  it('classifies ready vs shipped from delivery status', () => {
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'READY_FOR_DELIVERY',
        deliveryStatus: null,
      }),
    ).toBe('ready');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'READY_FOR_DELIVERY',
        deliveryStatus: 'OUT_FOR_DELIVERY',
      }),
    ).toBe('shipped');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
      }),
    ).toBe('delivered');
  });

  it('treats post-release statuses as inProduction for dealers', () => {
    expect(
      classifyDealerLifecycle({ salesOrderStatus: 'READY_FOR_PRODUCTION' }),
    ).toBe('inProduction');
    expect(
      classifyDealerLifecycle({ salesOrderStatus: 'WAITING_FOR_MATERIALS' }),
    ).toBe('inProduction');
    expect(
      classifyDealerLifecycle({
        salesOrderStatus: 'DRAFT',
        productionSetupRequired: true,
      }),
    ).toBe('pending');
  });

  it('does not position-lock anchors on return or recovery workflows', () => {
    expect(lockedAnchorStageCodesForScope('RETURN')).toEqual([]);
    expect(lockedAnchorStageCodesForScope('RECOVERY')).toEqual([]);
    expect(lockedAnchorStageCodesForScope('STANDARD')).toEqual([...LOCKED_ANCHOR_STAGE_CODES]);
    expect(lockedAnchorStageCodesForScope(undefined)).toEqual([...LOCKED_ANCHOR_STAGE_CODES]);
  });

  it('requires the finishing trio on return workflows unless dismantle is present', () => {
    expect(workflowGraphChainRequirements('STANDARD').requiresOpeningChain).toBe(true);
    expect(workflowGraphChainRequirements('STANDARD').requiresTerminalChain).toBe(true);
    expect(workflowGraphChainRequirements('RETURN').requiresOpeningChain).toBe(false);
    expect(workflowGraphChainRequirements('RETURN').requiresTerminalChain).toBe(true);
    expect(
      workflowGraphChainRequirements('RETURN', ['DISMANTLE_RECOVER']).requiresTerminalChain,
    ).toBe(false);
    expect(
      workflowGraphChainRequirements('RECOVERY', ['DISMANTLE_RECOVER']).requiresOpeningChain,
    ).toBe(false);
  });

  it('protects dismantle & recover from rename and delete', () => {
    expect(isRecoveryStageCode(RECOVERY_STAGE_CODE)).toBe(true);
    expect(isProtectedStageCode(RECOVERY_STAGE_CODE)).toBe(true);
    expect(PROTECTED_STAGE_CODES).toContain(RECOVERY_STAGE_CODE);
  });

  it('hides confirm receipt unless the delivery is out', () => {
    expect(isConfirmReceiptVisible('OUT_FOR_DELIVERY')).toBe(true);
    expect(isConfirmReceiptVisible('DELIVERED')).toBe(false);
  });
});
