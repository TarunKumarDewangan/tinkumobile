import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pinGate from '../../utils/pinGate';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function TrashManager() {
  const navigate = useNavigate();
  const { hasFullAccess } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('retailer');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const modelTypes = [
    { value: 'retailer', label: 'Retailers' },
    { value: 'drop', label: 'Daily Drops' },
    { value: 'recovery', label: 'Recoveries' },
    { value: 'product', label: 'Products' },
    { value: 'customer', label: 'Customers' },
    { value: 'supplier', label: 'Suppliers' },
    { value: 'purchase_invoice', label: 'Purchase Invoices' },
    { value: 'sale_invoice', label: 'Sale Invoices' },
    { value: 'user', label: 'Users' },
    { value: 'transaction', label: 'Cashbook' },
    { value: 'entity', label: 'Entities' },
  ];

  useEffect(() => {
    if (hasFullAccess()) {
      fetchDeletedItems();
    }
  }, [type, page]);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/trash?type=${type}&page=${page}`);
      setItems(data.data);
      setLastPage(data.last_page);
    } catch (error) {
        if (error.response?.status !== 404) {
            toast.error('Failed to fetch deleted items');
        }
        setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    if (!await pinGate.confirm()) return;

    try {
      await axios.post('/trash/restore', { type, id });
      toast.success('Item restored successfully');
      fetchDeletedItems();
    } catch (error) {
      toast.error('Failed to restore item');
    }
  };

  const handleForceDelete = async (item) => {
    const label = item.name || item.invoice_no || `ID ${item.id}`;
    if (!window.confirm(`Permanently erase "${label}"?\n\nThis cannot be undone — it will be completely removed from the database, not just hidden. Only do this for records stuck blocking something (like a reused IMEI or phone number).`)) {
      return;
    }
    if (!await pinGate.confirm()) return;

    try {
      await axios.post('/trash/force-delete', { type, id: item.id });
      toast.success('Item permanently erased');
      fetchDeletedItems();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to permanently erase item');
    }
  };

  if (!hasFullAccess()) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger">Unauthorized Access</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => navigate(-1)}>← Back</button>
          <div>
              <h2 className="h4 mb-0 text-uppercase fw-bold text-danger">Trash Management</h2>
              <p className="text-muted small mb-0">Recover soft-deleted records, or permanently erase ones stuck blocking something (e.g. a reused IMEI or phone number)</p>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4 bg-light">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label x-small text-uppercase fw-bold text-muted">Select Category to Recover</label>
              <div className="d-flex flex-wrap gap-2">
                {modelTypes.map(m => (
                  <button 
                    key={m.value}
                    className={`btn btn-sm ${type === m.value ? 'btn-danger' : 'btn-outline-secondary'}`}
                    onClick={() => { setType(m.value); setPage(1); }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-uppercase">
              <tr>
                <th className="ps-4">Deleted At</th>
                <th>Details</th>
                <th>Identity</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-danger"/></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-5 text-muted small">No deleted {type.replace('_', ' ')}s found</td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  <td className="ps-4 small">
                    {new Date(item.deleted_at).toLocaleString('en-GB')}
                  </td>
                  <td>
                    <div className="fw-bold small">{item.category || item.name || item.invoice_no || `ID: ${item.id}`}</div>
                    <div className="x-small text-muted">
                        {item.amount ? `₹${item.amount} | ` : ''}
                        {item.description || item.msisdn || item.phone || item.email || item.refill_date || ''}
                    </div>
                  </td>
                  <td className="small text-muted">
                    ID: {item.id}
                  </td>
                  <td className="text-end pe-4">
                    <div className="d-flex justify-content-end gap-2">
                      <button className="btn btn-sm btn-success text-uppercase fw-bold x-small" onClick={() => handleRestore(item.id)}>
                        RESTORE
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger text-uppercase fw-bold x-small"
                        title="Permanently remove from the database — use only if this record is stuck blocking something"
                        onClick={() => handleForceDelete(item)}
                      >
                        ERASE PERMANENTLY
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center bg-white py-3">
            <button className="btn btn-outline-danger btn-sm px-4" disabled={page === 1} onClick={() => setPage(p => p - 1)}>PREVIOUS</button>
            <span className="text-muted small text-uppercase fw-bold">Page {page} of {lastPage}</span>
            <button className="btn btn-outline-danger btn-sm px-4" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>NEXT</button>
          </div>
        )}
      </div>
    </div>
  );
}
