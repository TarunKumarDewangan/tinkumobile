import { useEffect } from 'react';

/**
 * Mode + amount picker for a payment, with an optional 2-way split (e.g. half
 * cash, half UPI/bank). Line 1's amount always tracks totalAmount minus
 * line 2's amount, so the two always add up without the user doing the math.
 *
 * `lines` shape: [{ mode, otherMode, amount }] (length 1) or length 2 when split.
 * `modeOptions`: [{ value, label, disabled }] rendered as <option>s in each select.
 */
export default function PaymentSplitInput({ totalAmount, lines, onChange, modeOptions, size = '' }) {
  const total = parseFloat(totalAmount) || 0;
  const isSplit = lines.length > 1;

  const updateLine = (idx, patch) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const enableSplit = () => {
    onChange([
      { mode: lines[0]?.mode || 'CASH', otherMode: lines[0]?.otherMode || '', amount: total },
      { mode: 'UPI', otherMode: '', amount: 0 },
    ]);
  };

  const disableSplit = () => {
    onChange([{ mode: lines[0]?.mode || 'CASH', otherMode: lines[0]?.otherMode || '', amount: total }]);
  };

  // Keep line 1 as "total minus line 2" whenever the total or line 2 changes.
  useEffect(() => {
    if (!isSplit) return;
    const line2 = parseFloat(lines[1]?.amount) || 0;
    const expected = Math.max(0, +(total - line2).toFixed(2));
    if (Math.abs((parseFloat(lines[0]?.amount) || 0) - expected) > 0.005) {
      updateLine(0, { amount: expected });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, isSplit, lines[1]?.amount]);

  const sum = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const mismatch = isSplit && Math.abs(sum - total) > 0.01;

  const renderOptions = () => modeOptions.map((o, i) => (
    <option key={o.value || `sep-${i}`} value={o.value} disabled={o.disabled}>{o.label}</option>
  ));

  return (
    <div>
      <div className="d-flex gap-2 align-items-start">
        <div style={{ flex: 1 }}>
          <select
            className={`form-select ${size} fw-bold text-uppercase`}
            value={lines[0]?.mode || 'CASH'}
            onChange={e => updateLine(0, { mode: e.target.value, otherMode: '' })}
          >
            {renderOptions()}
          </select>
          {lines[0]?.mode === 'OTHER' && (
            <input
              className="form-control form-control-sm mt-1 text-uppercase fw-bold"
              placeholder="SPECIFY MODE (E.G. CHEQUE)"
              value={lines[0]?.otherMode || ''}
              onChange={e => updateLine(0, { otherMode: e.target.value.toUpperCase() })}
            />
          )}
        </div>
        {isSplit && (
          <div style={{ flex: '0 0 130px' }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text">₹</span>
              <input type="number" className="form-control fw-bold" value={lines[0]?.amount ?? 0} disabled readOnly />
            </div>
          </div>
        )}
      </div>

      {isSplit && (
        <div className="d-flex gap-2 align-items-start mt-2">
          <div style={{ flex: 1 }}>
            <select
              className={`form-select ${size} fw-bold text-uppercase`}
              value={lines[1]?.mode || 'UPI'}
              onChange={e => updateLine(1, { mode: e.target.value, otherMode: '' })}
            >
              {renderOptions()}
            </select>
            {lines[1]?.mode === 'OTHER' && (
              <input
                className="form-control form-control-sm mt-1 text-uppercase fw-bold"
                placeholder="SPECIFY MODE (E.G. CHEQUE)"
                value={lines[1]?.otherMode || ''}
                onChange={e => updateLine(1, { otherMode: e.target.value.toUpperCase() })}
              />
            )}
          </div>
          <div style={{ flex: '0 0 130px' }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text">₹</span>
              <input
                type="number" step="0.01" className="form-control fw-bold"
                value={lines[1]?.amount === 0 ? '' : lines[1]?.amount}
                onFocus={e => e.target.select()}
                onChange={e => updateLine(1, { amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <button type="button" className="btn btn-outline-danger btn-sm" title="Remove split" onClick={disableSplit}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
      )}

      <div className="mt-1">
        {!isSplit ? (
          <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none fw-bold" onClick={enableSplit} disabled={total <= 0}>
            ➕ Split payment (e.g. half cash, half online)
          </button>
        ) : mismatch ? (
          <div className="text-danger" style={{ fontSize: '.72rem', fontWeight: 700 }}>
            ⚠️ Split doesn't add up to ₹{total.toLocaleString('en-IN')}
          </div>
        ) : (
          <div className="text-success" style={{ fontSize: '.72rem', fontWeight: 700 }}>✓ Split adds up to the total</div>
        )}
      </div>
    </div>
  );
}
