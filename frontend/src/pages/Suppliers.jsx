import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { 
    setLoading(true); 
    api.get('/suppliers')
      .then(r => setList(r.data))
      .catch(() => toast.error('Failed to load suppliers'))
      .finally(() => setLoading(false)); 
  };
  
  useEffect(() => { load(); }, []);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-1 text-uppercase fw-bold text-primary">🏭 Suppliers</h2>
          <p className="text-muted small mb-0">Manage your inventory sources and supplier details</p>
        </div>
      </div>

      <div className="card shadow-sm border-0 overflow-hidden" style={{ borderRadius: '15px' }}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr className="text-uppercase small fw-bold text-muted" style={{ letterSpacing: '0.5px' }}>
                <th className="ps-4 py-3">#</th>
                <th className="py-3">Supplier Info</th>
                <th className="py-3">GST No</th>
                <th className="py-3">Address</th>
                <th className="py-3">Type</th>
                <th className="text-end pe-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border text-primary pulse-animation" style={{ width: '1.5rem', height: '1.5rem' }} />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted small italic">No suppliers found.</td>
                </tr>
              ) : (
                list.map((s, i) => (
                  <tr key={s.id} className="transition-all">
                    <td className="ps-4 small text-muted">{i+1}</td>
                    <td>
                      <div className="fw-bold text-dark">{s.name}</div>
                      <div className="small text-muted d-flex align-items-center gap-1">
                        <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {s.phone}
                      </div>
                    </td>
                    <td>
                      {s.gst_no ? (
                        <span className="badge bg-light text-dark border fw-semibold font-monospace" style={{ fontSize: '0.75rem' }}>{s.gst_no}</span>
                      ) : (
                        <span className="text-muted opacity-25">—</span>
                      )}
                    </td>
                    <td className="small text-muted text-truncate" style={{ maxWidth: '250px' }}>{s.address}</td>
                    <td>
                      {s.is_online_shop ? (
                        <span className="badge bg-info-subtle text-info border border-info-subtle px-3 py-1 rounded-pill" style={{ fontSize: '0.65rem' }}>
                          🌐 ONLINE
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill" style={{ fontSize: '0.65rem' }}>
                          🏠 LOCAL
                        </span>
                      )}
                    </td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-2">
                        {s.entity?.id ? (
                          <Link 
                            to={`/accounts/entity-ledger?id=${s.entity.id}&name=${encodeURIComponent(s.name)}`} 
                            className="btn btn-sm btn-outline-info fw-semibold"
                            style={{ fontSize: '0.75rem' }}
                          >
                            Ledger
                          </Link>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <style>{`
        .transition-all { transition: all 0.2s ease-in-out; }
        .table-hover tbody tr:hover { background-color: rgba(99, 102, 241, 0.03); transform: scale(1.002); }
        .font-monospace { font-family: 'JetBrains Mono', 'Courier New', monospace; }
      `}</style>
    </div>
  );
}
