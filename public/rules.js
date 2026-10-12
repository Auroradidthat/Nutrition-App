// Single source of truth for item validation.
// Loaded by the browser (script.js) and imported by the Worker (src/index.js),
// so both sides always enforce exactly the same rules.

export const MAX_NAME_LENGTH = 100;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

// Letters (any language), combining marks, numbers, spaces, and: ' ’ & , . - % ( ) /
export const ALLOWED_NAME = /^[\p{L}\p{M}\p{N} '’&,.\-%()/]+$/u;

export const NAME_ERROR = "Item names can only use letters, numbers, spaces and ' & , . - % ( ) /";
export const QUANTITY_ERROR = `Quantity must be a whole number from ${MIN_QUANTITY} to ${MAX_QUANTITY}.`;

// Returns an error message, or null when the (already trimmed) item is valid.
export function validateItem(text, quantity) {
  if (!text) return "Item name is required.";
  if (text.length > MAX_NAME_LENGTH) {
    return `Item names must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  if (!ALLOWED_NAME.test(text)) return NAME_ERROR;
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
    return QUANTITY_ERROR;
  }
  return null;
}
