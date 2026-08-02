import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import pinGate from '../../utils/pinGate';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';

const STATUS_BADGE = {
  PENDING: { bg: '#fef3c7', color: '#92400e' },
  RECEIVED: { bg: '#dcfce7', color: '#166534' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b' },
};

const configLabel = (g) => [g.ram, g.storage, g.color].filter(Boolean).join(' / ') || 'Standard';

export default function StockTransfers() {
  const { user, hasFullAccess } = useAuth();

  const [shops, setShops] = useState([]);
  const [fromShopId, setFromShopId] = useState(hasFullAccess() ? '' : (user?.shop_id || ''));
  const [toShopId, setToShopId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [selectedImeis, setSelectedImeis] = useState([]);
  const [bulkQty, setBulkQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const [transfers, setTransfers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stock-transfers/shops').then(r => setShops(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setProductId(''); setGroups([]); setGroupIdx(0); setSelectedImeis([]);
    if (!fromShopId) { setProducts([]); return; }
    api.get('/stock-transfers/products-at', { params: { shop_id: fromShopId } })
      .then(r => setProducts(r.data))
      .catch(() => setProducts([]));
  }, [fromShopId]);

  useEffect(() => {
    setGroupIdx(0); setSelectedImeis([]); setBulkQty(1);
    if (!fromShopId || !productId) { setGroups([]); return; }
    api.get('/stock-transfers/stock-at', { params: { shop_id: fromShopId, product_id: productId } })
      .then(r => setGroups(r.data))
      .catch(() => setGroups([]));
  }, [fromShopId, productId]);

  const loadTransfers = useCallback(() => {
    setLoading(true);
    api.get('/stock-transfers', { params: statusFilter ? { status: statusFilter } : {} })
      .then(r => setTransfers(r.data))
      .catch(() => toast.error('Failed to load transfers'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { loadTransfers(); }, [loadTransfers]);

  const activeGroup = groups[groupIdx] || null;
  const nonImeiAvailable = activeGroup ? activeGroup.available_qty - activeGroup.imeis.length : 0;

  const toggleImei = (imei) => {
    setSelectedImeis(prev => prev.includes(imei) ? prev.filter(v => v !== imei) : [...prev, imei]);
  };

  const resetSelection = () => {
    setProductId(''); setGroups([]); setGroupIdx(0); setSelectedImeis([]); setBulkQty(1); setNotes('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromShopId || !toShopId || !productId || !activeGroup) {
      toast.error('Please select from shop, to shop, product, and config.');
      return;
    }
    if (fromShopId == toShopId) {
      toast.error('From and To shop must be different.');
      return;
    }
    const payload = {
      from_shop_id: fromShopId, to_shop_id: toShopId, product_id: productId,
      transfer_date: transferDate, notes,
    };
    if (selectedImeis.length > 0) {
      payload.imeis = selectedImeis;
    } else if (nonImeiAvailable > 0 && bulkQty > 0) {
      payload.quantity = bulkQty;
      payload.ram = activeGroup.ram; payload.storage = activeGroup.storage; payload.color = activeGroup.color;
    } else {
      toast.error('Select at least one IMEI, or enter a quantity.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/stock-transfers', payload);
      toast.success('Transfer sent! It will show as Received once the destination shop confirms.');
      resetSelection();
      loadTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create transfer');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (t) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.post(`/stock-transfers/${t.id}/receive`);
      toast.success('Transfer marked as received — stock added to your shop.');
      loadTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to receive transfer');
    }
  };

  const handleCancel = async (t) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.post(`/stock-transfers/${t.id}/cancel`);
      toast.success('Transfer cancelled — stock restored to the sending shop.');
      loadTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel transfer');
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="mb-0 fw-bold text-uppercase">🚚 Stock Transfers</h2>
        <p className="text-muted small mb-0 text-uppercase">Move real stock (IMEI/batch) between shops/branches</p>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-header bg-dark text-white py-2">
          <strong>New Transfer</strong>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-uppercase">From Shop</label>
                {hasFullAccess() ? (
                  <select className="form-select" value={fromShopId} onChange={e => setFromShopId(e.target.value)} required>
                    <option value="">Select...</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <input className="form-control" disabled value={shops.find(s => s.id == fromShopId)?.name || 'Your Shop'} />
                )}
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-uppercase">To Shop</label>
                <select className="form-select" value={toShopId} onChange={e => setToShopId(e.target.value)} required>
                  <option value="">Select...</option>
                  {shops.filter(s => s.id != fromShopId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-uppercase">Transfer Date</label>
                <input type="date" className="form-control" value={transferDate} onChange={e => setTransferDate(e.target.value)} required />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-uppercase">Notes</label>
                <input className="form-control" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold text-uppercase">Product (in stock at From Shop)</label>
                <select className="form-select" value={productId} onChange={e => setProductId(e.target.value)} required disabled={!fromShopId}>
                  <option value="">{fromShopId ? 'Select product...' : 'Select From Shop first'}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{(p.brand ? p.brand + ' ' : '') + p.name}</option>)}
                </select>
              </div>
              {groups.length > 1 && (
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-bold text-uppercase">Configuration</label>
                  <select className="form-select" value={groupIdx} onChange={e => { setGroupIdx(Number(e.target.value)); setSelectedImeis([]); setBulkQty(1); }}>
                    {groups.map((g, idx) => <option key={idx} value={idx}>{configLabel(g)} — Available: {g.available_qty}</option>)}
                  </select>
                </div>
              )}
            </div>

            {activeGroup && (
              <div className="mt-3 p-3 border rounded bg-light">
                <div className="fw-bold small text-uppercase mb-2">
                  {configLabel(activeGroup)} — {activeGroup.available_qty} available
                </div>

                {activeGroup.imeis.length > 0 && (
                  <div className="mb-3">
                    <div className="x-small text-muted mb-1">Select unit(s) by IMEI to send:</div>
                    <div className="d-flex flex-wrap gap-2">
                      {activeGroup.imeis.map(u => (
                        <label key={u.imei} className={`btn btn-sm ${selectedImeis.includes(u.imei) ? 'btn-primary' : 'btn-outline-secondary'}`} style={{ cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            className="d-none"
                            checked={selectedImeis.includes(u.imei)}
                            onChange={() => toggleImei(u.imei)}
                          />
                          {u.imei}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {nonImeiAvailable > 0 && selectedImeis.length === 0 && (
                  <div>
                    <label className="form-label small fw-bold text-uppercase">Quantity (non-serialized, available: {nonImeiAvailable})</label>
                    <input
                      type="number" min="1" max={nonImeiAvailable} className="form-control" style={{ maxWidth: 160 }}
                      value={bulkQty} onChange={e => setBulkQty(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-3">
              <button type="submit" className="btn btn-primary fw-bold" disabled={saving || !activeGroup}>
                {saving ? <span className="spinner-border spinner-border-sm me-2" /> : '🚚 '}
                Send Transfer
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-dark text-white py-2 d-flex justify-content-between align-items-center">
          <strong>Transfer History</strong>
          <select className="form-select form-select-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead className="table-dark text-uppercase">
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>From → To</th>
                <th className="text-center">Qty</th>
                <th>IMEI</th>
                <th className="text-center">Status</th>
                <th>Sent By</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : transfers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-5 text-muted fw-bold">No transfers found</td></tr>
              ) : transfers.map(t => {
                const badge = STATUS_BADGE[t.status] || {};
                const brand = t.product?.brand?.name || '';
                const canReceive = t.status === 'PENDING' && (hasFullAccess() || t.to_shop_id === user?.shop_id);
                const canCancel = t.status === 'PENDING' && (hasFullAccess() || t.from_shop_id === user?.shop_id);
                return (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.transfer_date)}</td>
                    <td className="fw-bold">{(brand ? brand + ' ' : '') + (t.product?.name || 'Unknown')}</td>
                    <td className="x-small">
                      <span className="fw-bold">{t.from_shop?.name}</span> → <span className="fw-bold">{t.to_shop?.name}</span>
                    </td>
                    <td className="text-center fw-bold">{t.quantity}</td>
                    <td className="x-small">{t.imei || '-'}</td>
                    <td className="text-center">
                      <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: '.7rem' }}>{t.status}</span>
                    </td>
                    <td className="x-small">{t.initiator?.name}</td>
                    <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                      {canReceive && (
                        <button className="btn btn-sm btn-success me-1" onClick={() => handleReceive(t)}>✅ Receive</button>
                      )}
                      {canCancel && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(t)}>✖ Cancel</button>
                      )}
                      {t.status === 'RECEIVED' && <span className="x-small text-muted">by {t.receiver?.name}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
