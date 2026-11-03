/**
 * Payload-bound idempotency scope for a form submission.
 *
 * The server's UNIQUE idempotency key makes a retried submit safe — but only
 * if the retry carries the SAME key AND the same payload (payload_hash).
 * Reusing a key after the user edits the cart would be rejected as a
 * conflict; generating a new key on every render/handler would duplicate
 * the sale. This helper keeps the key stable for an identical payload and
 * rotates it the moment the payload changes.
 */
export interface IdempotencyScope {
  key: string;
  signature: string;
}

export function nextIdempotencyScope(
  current: IdempotencyScope | null,
  signature: string,
  generate: () => string = () => crypto.randomUUID(),
): IdempotencyScope {
  if (current && current.signature === signature) return current;
  return { key: generate(), signature };
}
