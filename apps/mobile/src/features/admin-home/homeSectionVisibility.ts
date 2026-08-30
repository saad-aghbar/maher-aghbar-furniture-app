import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export const HOME_SECTION_IDS = [
  'attention',
  'today',
  'factoryFlow',
  'production',
  'outbound',
  'materials',
  'inventory',
  'quality',
  'exceptions',
  'workers',
  'late',
  'money',
  'manufacturing',
  'activity',
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export type HomeSectionVisibility = Record<HomeSectionId, boolean>;

const STORAGE_KEY = '@maher/admin-home-section-visibility/v2';

export const DEFAULT_HOME_SECTION_VISIBILITY: HomeSectionVisibility = {
  attention: true,
  today: true,
  factoryFlow: true,
  production: true,
  outbound: true,
  materials: true,
  inventory: true,
  quality: true,
  exceptions: true,
  workers: true,
  late: true,
  money: true,
  manufacturing: true,
  activity: true,
};

function normalize(raw: unknown): HomeSectionVisibility {
  const next = { ...DEFAULT_HOME_SECTION_VISIBILITY };
  if (!raw || typeof raw !== 'object') return next;
  for (const id of HOME_SECTION_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'boolean') next[id] = v;
  }
  return next;
}

let map: HomeSectionVisibility = { ...DEFAULT_HOME_SECTION_VISIBILITY };
let ready = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return map;
}

function getReadySnapshot() {
  return ready;
}

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) map = normalize(JSON.parse(raw) as unknown);
  } catch {
    map = { ...DEFAULT_HOME_SECTION_VISIBILITY };
  }
  ready = true;
  emit();
}

void hydrate();

async function persist(next: HomeSectionVisibility) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // local preference only
  }
}

function setMap(next: HomeSectionVisibility) {
  map = next;
  emit();
  void persist(next);
}

/** Local show/hide preferences for admin Home signature sections (shared store). */
export function useHomeSectionVisibility() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isReady = useSyncExternalStore(subscribe, getReadySnapshot, getReadySnapshot);

  useEffect(() => {
    if (!ready) void hydrate();
  }, []);

  const isVisible = useCallback((id: HomeSectionId) => current[id] !== false, [current]);

  const setVisible = useCallback((id: HomeSectionId, visible: boolean) => {
    setMap({ ...map, [id]: visible });
  }, []);

  const showAll = useCallback(() => {
    setMap({ ...DEFAULT_HOME_SECTION_VISIBILITY });
  }, []);

  return { map: current, ready: isReady, isVisible, setVisible, showAll };
}
