import { OverlayTrigger, Popover } from 'react-bootstrap';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const imeiLabel = (imei) => {
  if (!imei) return null;
  const list = imei.split(',').map(s => s.trim()).filter(Boolean);
  return list.length > 1 ? `${list.length} IMEIs` : `IMEI ${list[0]}`;
};

// Wraps a ledger row's narration: when the row carries an invoice breakdown
// (sale/purchase rows from /ledgers/statement), hovering — or tapping/focusing
// on touch devices — shows what each item cost and how it adds up to the row.
export default function NarrationBreakdown({ breakdown, children }) {
  if (!breakdown?.items?.length) return children;

  const popover = (
    <Popover id={`breakdown-${breakdown.invoice_no}`} style={{ maxWidth: 380 }}>
      <Popover.Header as="div" className="small fw-bold">Invoice #{breakdown.invoice_no}</Popover.Header>
      <Popover.Body className="p-2">
        <table className="table table-sm mb-0 small">
          <tbody>
            {breakdown.items.map((it, i) => (
              <tr key={i}>
                <td>
                  <div className="fw-semibold">{it.name}</div>
                  {(it.specs || it.imei) && (
                    <div className="text-muted" style={{ fontSize: '.7rem' }}>
                      {[it.specs, imeiLabel(it.imei)].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {it.qty > 1 && (
                    <div className="text-muted" style={{ fontSize: '.7rem' }}>{it.qty} × {inr(it.rate)}</div>
                  )}
                </td>
                <td className="text-end text-nowrap">{inr(it.amount)}</td>
              </tr>
            ))}
            {breakdown.lines.map((l, i) => (
              <tr key={`line-${i}`} className="text-muted">
                <td>{l.label}</td>
                <td className="text-end text-nowrap">{l.amount < 0 ? '−' : '+'}{inr(Math.abs(l.amount))}</td>
              </tr>
            ))}
            <tr className="fw-bold">
              <td>Total</td>
              <td className="text-end text-nowrap">{inr(breakdown.total)}</td>
            </tr>
          </tbody>
        </table>
        {breakdown.gst_included && (
          <div className="text-muted mt-1" style={{ fontSize: '.7rem' }}>Prices include GST of {inr(breakdown.gst_included)}</div>
        )}
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger trigger={['hover', 'focus']} placement="auto" overlay={popover}>
      <span tabIndex={0} style={{ cursor: 'help', borderBottom: '1px dashed currentColor' }}>{children}</span>
    </OverlayTrigger>
  );
}
