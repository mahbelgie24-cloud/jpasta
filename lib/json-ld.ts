/**
 * JSON-LD serialization for `<script type="application/ld+json">`.
 *
 * `JSON.stringify` does not escape `<`, so a catalog value containing
 * `</script>` (an owner-editable product name, for example) would terminate
 * the script block and inject markup — stored XSS on a public page even
 * though React escapes every normal text node. Escaping the HTML-significant
 * characters keeps the JSON valid while making the element unbreakable.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
