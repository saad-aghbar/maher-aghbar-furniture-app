import {
  getTopic,
  pickLocaleCopy,
  TOPIC_GROUP_LABELS,
  type PushLocale,
  type TopicGroup,
} from '@maher/notifications';
import type { Locale } from '@maher/types';
import type { NotificationTopicRow } from '@/api/modules/notifications';

function asPushLocale(locale: Locale | string): PushLocale {
  if (locale === 'ar' || locale === 'he') return locale;
  return 'en';
}

function isTopicGroup(value: string): value is TopicGroup {
  return Object.prototype.hasOwnProperty.call(TOPIC_GROUP_LABELS, value);
}

export function localizeTopicGroupName(
  groupId: string,
  fallback: string,
  locale: Locale | string,
): string {
  if (!isTopicGroup(groupId)) return fallback;
  return pickLocaleCopy(TOPIC_GROUP_LABELS[groupId], asPushLocale(locale));
}

export function localizeNotificationTopicRow(
  row: NotificationTopicRow,
  locale: Locale | string,
): NotificationTopicRow {
  const topic = getTopic(row.code);
  if (!topic) return row;
  const ui = asPushLocale(locale);
  return {
    ...row,
    name: pickLocaleCopy(topic.name, ui),
    hint: pickLocaleCopy(topic.hint, ui),
  };
}

export type LocalizedTopicGroup = {
  id: string;
  name: string;
  rows: NotificationTopicRow[];
};

/** Group API topics and overlay names/hints from the app UI locale — not account preferredLanguage. */
export function groupLocalizedNotificationTopics(
  topics: NotificationTopicRow[],
  groups: Array<{ id: string; name: string }>,
  locale: Locale | string,
): LocalizedTopicGroup[] {
  const order = groups.map((g) => g.id);
  const fallbackNames = new Map(groups.map((g) => [g.id, g.name]));
  const map = new Map<string, NotificationTopicRow[]>();
  for (const row of topics) {
    const localized = localizeNotificationTopicRow(row, locale);
    const list = map.get(row.group) ?? [];
    list.push(localized);
    map.set(row.group, list);
  }
  const ids = [...order.filter((id) => map.has(id))];
  for (const id of map.keys()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => ({
    id,
    name: localizeTopicGroupName(id, fallbackNames.get(id) ?? id, locale),
    rows: map.get(id) ?? [],
  }));
}
