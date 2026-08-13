type MessageValue = string | { [key: string]: MessageValue };
type Messages = Record<string, Record<string, MessageValue>>;

export function flattenLeaves(
  value: MessageValue,
  prefix = '',
): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value === 'string') {
    if (prefix) out[prefix] = value;
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(out, flattenLeaves(child, path));
  }
  return out;
}

export function flattenNamespace(messages: Messages, namespace: keyof Messages): Record<string, string> {
  return flattenLeaves(messages[namespace] as MessageValue);
}

export function allLeafKeys(messages: Messages): string[] {
  const keys: string[] = [];
  for (const ns of Object.keys(messages) as Array<keyof Messages>) {
    const leaves = flattenNamespace(messages, ns);
    for (const path of Object.keys(leaves)) {
      keys.push(`${ns}.${path}`);
    }
  }
  return keys.sort();
}
