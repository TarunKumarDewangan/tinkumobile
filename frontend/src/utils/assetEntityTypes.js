// Asset (cash-holding) account types — Bank/Card/UPI/Cash Counter — get a
// plain running Balance instead of Receivable/Payable. Normalized so both
// "CASH COUNTER" (free-typed) and "CASH_COUNTER" match the same entry,
// mirroring backend Entity::isAssetType().
const ASSET_ENTITY_TYPES = ['BANK', 'CARD', 'UPI', 'CASH_COUNTER'];

export function isAssetEntityType(type) {
  if (!type) return false;
  return ASSET_ENTITY_TYPES.includes(type.toUpperCase().replace(/\s+/g, '_'));
}
