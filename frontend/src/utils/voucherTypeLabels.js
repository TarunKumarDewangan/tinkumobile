// Display names for ledger voucher types. Only the label shown on screen
// changes — the stored code stays as-is, since backend code looks ledger
// rows up by it.
const LABELS = {
  SHOP_FINANCE_INTEREST: 'Shop Processing Fee',
};

export const voucherTypeLabel = (type) => LABELS[type] ?? type;
