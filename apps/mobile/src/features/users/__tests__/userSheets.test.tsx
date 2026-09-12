import { Dimensions } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import { CreateUserSheet } from '../components/CreateUserSheet';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import { assertSheetHeightContract, renderSheet, resolveSheetHeightCap } from '@/test/sheetHarness';
import { createUserBody, formFromUser, updateUserBody } from '../userForm';
import { identityFromSegment } from '../segment';
import type { UserRow } from '@/api/modules/users';

const mockCreateUser = jest.fn().mockResolvedValue({ id: 'u-new', username: 'cutter3' });
const mockUpdateUser = jest.fn().mockResolvedValue({ id: 'u1', username: 'cutter' });

jest.mock('@/components/feedback/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/api/queryClient', () => ({
  toastMessageForError: () => 'error',
}));

jest.mock('@/features/users/query', () => ({
  useRolesQuery: () => ({
    data: [
      {
        id: 'role-worker',
        code: 'PRODUCTION_WORKER',
        kind: 'PRODUCTION_WORKER',
        nameEn: 'Worker',
        nameAr: 'عامل',
      },
    ],
  }),
  useStaffTypesQuery: () => ({ data: [], isLoading: false }),
  useDepartmentsQuery: () => ({ data: { data: [] } }),
  useCreateUserMutation: () => ({ mutateAsync: mockCreateUser, isPending: false }),
  useUpdateUserMutation: () => ({ mutateAsync: mockUpdateUser, isPending: false }),
}));

jest.mock('@/features/workflow/query', () => ({
  useStageLibraryQuery: () => ({ data: [], isLoading: false }),
}));

jest.mock('../components/DepartmentPickerSheet', () => ({
  DepartmentPickerSheet: () => null,
}));

jest.mock('../components/TempPasswordSheet', () => ({
  TempPasswordSheet: () => null,
}));

const worker: UserRow = {
  id: 'u1',
  username: 'cutter',
  email: null,
  phone: null,
  firstName: 'Yousef',
  lastName: 'Haddad',
  preferredLanguage: 'ar',
  isActive: true,
  lastLoginAt: null,
  customerId: null,
  stageDefinitionIds: [],
  hourlyRate: 25,
  roles: [
    {
      role: {
        id: 'role-worker',
        code: 'PRODUCTION_WORKER',
        kind: 'PRODUCTION_WORKER',
        nameEn: 'Worker',
        nameAr: 'عامل',
      },
    },
  ],
};

describe('CreateUserSheet hourly rate', () => {
  beforeAll(() => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: HARNESS_WINDOW.width,
      height: HARNESS_WINDOW.height,
      scale: HARNESS_WINDOW.scale,
      fontScale: HARNESS_WINDOW.fontScale,
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('keeps the create sheet inside the height contract and shows the rate field', async () => {
    const view = await renderSheet(
      <CreateUserSheet open onClose={() => {}} segment="workers" />,
    );
    await waitFor(() => {
      expect(view.getByTestId('bottom-sheet-panel')).toBeTruthy();
      expect(view.getByTestId('user-hourly-rate')).toBeTruthy();
      expect(view.getByTestId('user-form-save')).toBeTruthy();
    });
    assertSheetHeightContract(view);
  });

  it('keyboard-open cap shrinks below the default 70% window', () => {
    const defaultCap = resolveSheetHeightCap({ windowHeight: HARNESS_WINDOW.height });
    const withKeyboard = resolveSheetHeightCap({
      windowHeight: HARNESS_WINDOW.height,
      keyboardHeight: 320,
    });
    expect(withKeyboard).toBeLessThan(defaultCap);
    expect(withKeyboard).toBeGreaterThan(0);
  });
});

describe('user form hourly rate payload', () => {
  it('includes a worker rate on create and versions it on edit', () => {
    const identity = identityFromSegment('workers');
    expect(
      createUserBody({
        username: 'cutter3',
        firstName: 'Cutter3',
        lastName: 'Cutter3',
        roleId: 'role-worker',
        identity,
        hourlyRate: '32',
      }),
    ).toEqual(
      expect.objectContaining({
        username: 'cutter3',
        hourlyRate: 32,
      }),
    );
    const hydrated = formFromUser(worker);
    expect(hydrated.hourlyRate).toBe('25');
    expect(hydrated.identity.employeeType).toBe('WORKER');
    expect(
      updateUserBody({
        username: 'cutter',
        firstName: 'Yousef',
        lastName: 'Haddad',
        isActive: true,
        roleId: 'role-worker',
        departmentId: null,
        identity: hydrated.identity,
        hourlyRate: '35',
      }),
    ).toEqual(
      expect.objectContaining({
        hourlyRate: 35,
      }),
    );
  });
});
