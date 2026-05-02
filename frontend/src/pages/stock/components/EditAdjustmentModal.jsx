export default function EditAdjustmentModal({ editingAdj, editForm, setEditForm, handleUpdate, setEditingAdj, loading }) {
  if (!editingAdj) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 1050, backdropFilter: 'blur(4px)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <form className="modal-content border-0 shadow-lg" style={{ borderRadius: 16, overflow: 'hidden' }} onSubmit={handleUpdate}>
          <div className="modal-header" style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: 'none', padding: '16px 24px' }}>
            <h6 className="modal-title text-uppercase fw-800 m-0" style={{ color: '#fff', fontSize: '.85rem', letterSpacing: 1 }}>Edit Stock Adjustment</h6>
            <button type="button" className="btn-close btn-close-white" style={{ fontSize: '.75rem' }} onClick={() => setEditingAdj(null)}></button>
          </div>
          <div className="modal-body p-4">
            <div className="mb-3">
              <span className="pf-lbl">Product</span>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontWeight: 800, color: '#1e293b', fontSize: '.88rem' }}>
                {editingAdj.product?.name?.toUpperCase()}
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <span className="pf-lbl">Quantity</span>
                <input type="number" className="pf-inp" required value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: parseInt(e.target.value) || 1})} />
              </div>
              <div className="col-6">
                <span className="pf-lbl">Date</span>
                <input type="date" className="pf-inp" required value={editForm.adjustment_date} onChange={e => setEditForm({...editForm, adjustment_date: e.target.value})} />
              </div>
            </div>
            <div className="mb-3">
              <span className="pf-lbl">DP ₹ (Dealer Price)</span>
              <input type="number" step="0.01" className="pf-inp" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: e.target.value})} />
            </div>
            <div className="mb-0">
              <span className="pf-lbl">Notes</span>
              <textarea className="pf-inp" rows={3} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value.toUpperCase()})} />
            </div>
          </div>
          <div className="modal-footer border-0 p-3" style={{ background: '#f8fafc' }}>
            <button type="button" className="pm-clear-btn" style={{ padding: '8px 20px' }} onClick={() => setEditingAdj(null)}>Cancel</button>
            <button type="submit" disabled={loading} className="pf-submit" style={{ padding: '8px 24px', fontSize: '.75rem' }}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
