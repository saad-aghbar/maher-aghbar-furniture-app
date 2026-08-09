import {
  mapWorkflowStageAdmin,
  mapWorkflowStageSafe,
  photosForStage,
  sanitizeWorkflowStageForDealer,
} from './production-workflow-stages.util';

const stage = {
  status: 'IN_PROGRESS',
  progressPercent: 40,
  actualStart: new Date('2026-01-01'),
  actualEnd: null,
  plannedEnd: new Date('2020-01-01'),
  notes: 'floor',
  stageDefinition: {
    code: 'CUT',
    nameEn: 'Cutting',
    nameAr: 'قص',
    nameHe: null,
    sortOrder: 1,
    dependsOnCodes: ['PREP'],
  },
  tasks: [
    {
      id: 'task-1',
      assignedEmployee: { id: 'w1', firstName: 'Ali', lastName: 'Hassan' },
      blockers: [
        { id: 'b1', category: 'MATERIAL', reason: 'Wood', resolvedAt: null },
        { id: 'b2', category: 'OTHER', reason: 'Old', resolvedAt: new Date() },
      ],
      notes: null,
    },
  ],
};

const docs = [
  {
    id: 'doc-1',
    fileName: 'cut-done.jpg',
    mimeType: 'image/jpeg',
    category: 'TASK_PHOTO:task-1',
  },
  {
    id: 'doc-2',
    fileName: 'other.jpg',
    mimeType: 'image/jpeg',
    category: 'TASK_PHOTO:other-task',
  },
];

describe('production-workflow-stages.util', () => {
  it('maps dealer-safe fields only and hides in-progress photos', () => {
    const safe = mapWorkflowStageSafe(stage, docs);
    expect(safe).toEqual({
      code: 'CUT',
      nameEn: 'Cutting',
      nameAr: 'قص',
      nameHe: null,
      sortOrder: 1,
      dependsOnCodes: ['PREP'],
      status: 'IN_PROGRESS',
      progressPercent: 40,
      photos: [],
    });
    expect(safe).not.toHaveProperty('assignees');
  });

  it('exposes work photos to dealers once the stage is completed', () => {
    const safe = mapWorkflowStageSafe({ ...stage, status: 'COMPLETED' }, docs);
    expect(safe.photos).toEqual([
      { id: 'doc-1', fileName: 'cut-done.jpg', mimeType: 'image/jpeg' },
    ]);
  });

  it('enriches admin projection with assignees, open blockers, overdue, photos', () => {
    const admin = mapWorkflowStageAdmin(stage, docs);
    expect(admin.assignees).toEqual([
      {
        id: 'w1',
        name: 'Ali Hassan',
        elapsedMinutes: 0,
        actualMinutes: 0,
        actualSeconds: 0,
        running: false,
        openStartedAt: null,
        estimatedMinutes: null,
        plannedCompletion: null,
      },
    ]);
    expect(admin.blockers).toEqual([
      { id: 'b1', category: 'MATERIAL', reason: 'Wood' },
    ]);
    expect(admin.isOverdue).toBe(true);
    expect(admin.notes).toBe('floor');
    expect(admin.attachmentCount).toBe(1);
    expect(admin.photos).toHaveLength(1);
  });

  it('includes live openStartedAt when a worker timer is running', () => {
    const admin = mapWorkflowStageAdmin(
      {
        ...stage,
        tasks: [
          {
            id: 'task-1',
            status: 'IN_PROGRESS',
            actualMinutes: 30,
            assignedEmployee: { id: 'w1', firstName: 'Ali', lastName: 'Hassan' },
            blockers: [],
            notes: null,
            timeEntries: [{ startedAt: new Date('2026-08-09T10:00:00.000Z'), endedAt: null }],
          },
        ],
      },
      docs,
    );
    expect(admin.assignees[0]).toMatchObject({
      id: 'w1',
      actualMinutes: 30,
      running: true,
      openStartedAt: '2026-08-09T10:00:00.000Z',
    });
    expect(admin.assignees[0]?.elapsedMinutes).toBeGreaterThanOrEqual(30);
  });

  it('filters photos by task id on the stage', () => {
    expect(photosForStage(stage, docs).map((p) => p.id)).toEqual(['doc-1']);
  });

  it('sanitizes leaked admin fields for dealers but keeps completed photos', () => {
    const cleaned = sanitizeWorkflowStageForDealer({
      code: 'CUT',
      nameEn: 'Cutting',
      nameAr: 'قص',
      nameHe: null,
      sortOrder: 1,
      dependsOnCodes: [],
      status: 'COMPLETED',
      progressPercent: 100,
      assignees: [{ id: 'x', name: 'X' }],
      notes: 'nope',
      photos: [{ id: 'd1', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
    });
    expect(cleaned).not.toHaveProperty('assignees');
    expect(cleaned).not.toHaveProperty('notes');
    expect(cleaned.photos).toHaveLength(1);
  });
});
