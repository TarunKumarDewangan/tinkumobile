import { formatDate } from '../../../utils/formatters';

const REASONS = [
  { value: 'opening_stock',     label: '🏁 Opening Stock' },
  { value: 'previous_purchase', label: '📦 Previous Purchase' },
  { value: 'correction_add',    label: '➕ Stock Correction (Add)' },
  { value: 'correction_remove', label: '➖ Stock Correction (Remove)' },
  { value: 'damage_write_off',  label: '💔 Damage / Write-off' },
  { value: 'return_to_supplier',label: '🔄 Return to Supplier' },
];

export default function StockHistory({ 
  history, 
  histLoading, 
  setEditingAdj, 
  setEditForm, 
  handleDelete 
}) {
  return (
    <div className="pm-table-wrap">
      <div className="table-responsive">
        {histLoading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : (
          <table className="pm-table">
            <thead>
              <tr>
                <th className="ps-4">Date</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>Buy Price</th>
                <th>Notes</th>
                <th>By</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(adj => (
                <tr key={adj.id}>
                  <td className="ps-4 text-muted" style={{ fontSize:'.72rem', whiteSpace:'nowrap', fontWeight:700 }}>{formatDate(adj.adjustment_date)}</td>
                  <td>
                    <div style={{fontWeight:800, color:'#1e293b', fontSize:'.82rem'}}>{adj.product?.name}</div>
                    <div className="text-muted" style={{ fontSize:'.65rem' }}>{adj.product?.sku}</div>
                  </td>
                  <td>
                    <span className="pm-badge" style={{background: adj.type==='add'?'#dcfce7':'#fee2e2', color: adj.type==='add'?'#166534':'#991b1b', border:'1px solid transparent'}}>
                      {adj.type === 'add' ? '➕ ADD' : '➖ REMOVE'}
                    </span>
                  </td>
                  <td className="fw-800" style={{color:'#1e293b'}}>{adj.quantity}</td>
                  <td style={{ fontSize:'.75rem', fontWeight:600, color:'#475569' }}>
                    {REASONS.find(r => r.value === adj.reason)?.label?.toUpperCase() || adj.reason?.toUpperCase()}
                  </td>
                  <td className="fw-700" style={{color:'#059669'}}>
                    {adj.purchase_price ? `₹${parseFloat(adj.purchase_price).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td style={{ maxWidth:150, fontSize:'.72rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#64748b' }}>
                    {adj.notes || '—'}
                  </td>
                  <td style={{ fontSize:'.72rem', fontWeight:700, color:'#6366f1' }}>{adj.user?.name?.toUpperCase()}</td>
                  <td className="text-end pe-4">
                    <div className="d-flex gap-1 justify-content-end">
                      <button className="pm-clear-btn" style={{padding:'3px 8px', fontSize:'.7rem'}} onClick={() => {
                        setEditingAdj(adj);
                        setEditForm({
                          quantity: adj.quantity,
                           purchase_price: adj.purchase_price || '',
                           notes: adj.notes || '',
                           adjustment_date: adj.adjustment_date
                        });
                      }}>✏️</button>
                      <button className="pm-clear-btn" style={{padding:'3px 8px', fontSize:'.7rem'}} onClick={() => handleDelete(adj.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={9} className="text-center py-5 text-muted fw-bold">No stock adjustments recorded yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
