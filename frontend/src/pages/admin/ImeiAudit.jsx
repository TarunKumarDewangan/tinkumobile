import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import pinGate from '../../utils/pinGate';

export default function ImeiAudit() {
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixingKey, setFixingKey] = useState(null);

  const scan = () => {
    setLoading(true);
    api.get('/imei-audit')
      .then(r => setIssues(r.data.issues))
      .catch(e => toast.error(e.response?.data?.message || 'Scan failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { scan(); }, []);

  const handleFix = async (issue) => {
    if (!await pinGate.confirm()) return;
    const key = `${issue.purchase_item_id}-${issue.imei}`;
    setFixingKey(key);
    try {
      await api.post('/imei-audit/fix', { purchase_item_id: issue.purchase_item_id, imei: issue.imei });
      toast.success('Fixed — stock will update immediately.');
      scan();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Fix failed');
    } finally {
      setFixingKey(null);
    }
  };

  const phantom = (issues || []).filter(i => i.type === 'phantom_stock');
  const duplicates = (issues || []).filter(i => i.type === 'duplicate_unsold_stock');

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center">
        <h2>🔍 IMEI Audit</h2>
        <button className="btn btn-outline-primary btn-sm" onClick={scan} disabled={loading}>
          {loading ? 'Scanning...' : '↻ Re-scan'}
        </button>
      </div>

      <div className="alert alert-secondary small">
        Checks for the "same physical phone recorded under two different products" data
        problem — usually from quick-adding a new product instead of picking the existing
        one for a repeat IMEI. This can make a phone that's actually sold still show up as
        available stock. New purchases are now blocked from creating this, but existing
        data can still have old cases — run this whenever Stocks looks wrong.
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : !issues ? null : issues.length === 0 ? (
        <div className="table-card p-4 text-center text-muted">
          ✅ No issues found — every purchased IMEI's stock status is consistent.
        </div>
      ) : (
        <>
          {phantom.length > 0 && (
            <div className="table-card mb-3">
              <div className="p-3 border-bottom">
                <strong>Phantom Stock</strong> — sold under a different product, still showing as available ({phantom.length})
              </div>
              <table className="table table-bordered table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>IMEI</th>
                    <th>Shows available under</th>
                    <th>Actually sold under</th>
                    <th>Sale Invoice</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {phantom.map(i => {
                    const key = `${i.purchase_item_id}-${i.imei}`;
                    return (
                      <tr key={key}>
                        <td className="font-monospace">{i.imei}</td>
                        <td>{i.purchased_product_name} <span className="text-muted x-small">(#{i.purchased_product_id}, {i.purchase_invoice_no})</span></td>
                        <td>{i.sold_product_name} <span className="text-muted x-small">(#{i.sold_product_id})</span></td>
                        <td>{i.sale_invoice_no}{i.sale_date ? ` — ${new Date(i.sale_date).toLocaleDateString()}` : ''}</td>
                        <td>
                          <button
                            className="btn btn-xs btn-outline-danger"
                            disabled={fixingKey === key}
                            onClick={() => handleFix(i)}
                          >
                            {fixingKey === key ? 'Fixing...' : 'Fix — remove from stock'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="table-card mb-3">
              <div className="p-3 border-bottom">
                <strong>Duplicate Stock</strong> — same IMEI purchased under 2+ products, neither sold — likely double-counted ({duplicates.length})
              </div>
              <table className="table table-bordered mb-0 align-middle">
                <thead>
                  <tr>
                    <th>IMEI</th>
                    <th>Recorded under</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map(i => (
                    <tr key={i.imei}>
                      <td className="font-monospace">{i.imei}</td>
                      <td>
                        {i.entries.map(e => (
                          <div key={e.purchase_item_id}>
                            {e.product_name} <span className="text-muted x-small">(#{e.product_id}, {e.invoice_no})</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 small text-muted">
                Not auto-fixable — decide which product is correct, then remove the IMEI from the wrong one via Edit Purchase.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
