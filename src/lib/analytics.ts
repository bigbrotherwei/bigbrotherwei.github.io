const visitorKey = 'analytics-visitor-id';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readVisitorId(storage: Storage, randomUUID: () => string): string | null {
  try {
    const stored = storage.getItem(visitorKey);
    if (stored && uuidPattern.test(stored)) return stored;
    const id = randomUUID();
    if (!uuidPattern.test(id)) return null;
    storage.setItem(visitorKey, id);
    return id;
  } catch {
    return null;
  }
}
