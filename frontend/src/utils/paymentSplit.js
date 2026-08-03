// Shared helpers for forms using <PaymentSplitInput/> — keeps the line
// shape (mode/otherMode/amount) consistent and centralizes how it's turned
// into the { payment_mode, payment_lines } the backend expects.

export function newSingleLine(mode = 'CASH', amount = 0) {
  return [{ mode, otherMode: '', amount }];
}

// Resolves a line's actual mode string (unwraps OTHER + its free-text value).
function resolveMode(line) {
  return line.mode === 'OTHER' ? (line.otherMode || 'OTHER').toUpperCase() : line.mode;
}

// lines -> { payment_mode, payment_lines } ready to merge into a submit payload.
// Single line: payment_mode is the resolved mode, payment_lines is omitted.
// 2 lines: payment_mode is 'SPLIT' (for display), payment_lines carries the breakdown.
export function buildPaymentPayload(lines) {
  if (!lines || lines.length === 0) {
    return { payment_mode: 'CASH' };
  }
  if (lines.length === 1) {
    return { payment_mode: resolveMode(lines[0]) };
  }
  return {
    payment_mode: 'SPLIT',
    payment_lines: lines.map(l => ({ payment_mode: resolveMode(l), amount: parseFloat(l.amount) || 0 })),
  };
}

export function paymentLinesSumMatches(lines, total) {
  if (!lines || lines.length < 2) return true;
  const sum = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  return Math.abs(sum - (parseFloat(total) || 0)) <= 0.01;
}

// Builds the <option> list for PaymentSplitInput: the caller's base modes
// (CASH, UPI, etc.), then the user's actual Bank/Card/UPI/Cash-Counter
// entities (so dual-posting can match them by name). Append any trailing
// options (ADJUSTMENT, OTHER, ...) yourself, after this.
export function buildModeOptions(baseOptions, bankEntities) {
  const options = [...baseOptions];
  if (bankEntities?.length > 0) {
    options.push({ value: '', label: '── MY BANKS/CARDS ──', disabled: true });
    bankEntities.forEach(b => options.push({ value: b.name, label: `🏦 ${b.name.toUpperCase()}` }));
  }
  return options;
}
