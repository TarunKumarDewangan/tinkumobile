import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../api/axios';
import Modal from '../../../components/Modal';

export default function StockList({ products, loading, filters, handleFilterChange, refresh }) {
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalItems = products.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = products.slice(startIndex, endIndex);

  const openEdit = (p) => {
      setEditingItem(p);
      setEditForm({
          imei: p.attributes?.imei || '',
          color: p.attributes?.color || '',
          ram: p.attributes?.ram || '',
          storage: p.attributes?.storage || '',
          selling_price: p.selling_price || '',
          wholeseller_price: p.wholeseller_price || '',
          min_selling_price: p.min_selling_price || '',
          incentive_amount: p.incentive_amount || '',
          unit_price: p.purchase_price || ''
      });
  };

  const submitEdit = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
          await api.put(`/products/stock/${editingItem.id}`, editForm);
          toast.success('Stock updated successfully');
          setEditingItem(null);
          refresh();
      } catch (err) {
          toast.error(err.response?.data?.message || 'Update failed');
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async (id) => {
      if(!window.confirm('WARNING: Are you sure you want to delete this stock item? This will revert the inventory count and update the purchase invoice totals.')) return;
      try {
          await api.delete(`/products/stock/${id}`);
          toast.success('Stock item deleted successfully');
          refresh();
      } catch (err) {
          toast.error(err.response?.data?.message || 'Delete failed');
      }
  };
  return (
    <div className="fade-in">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <label style={{display:'flex',alignItems:'center',gap:10,background:'#fff',padding:'8px 18px',borderRadius:12,cursor:'pointer',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}>
          <input 
            type="checkbox" 
            checked={filters.group_by_config}
            onChange={e => handleFilterChange('group_by_config', e.target.checked)}
            style={{accentColor:'#6366f1',width:18,height:18}}
          />
          <span style={{fontSize:'.75rem',fontWeight:800,color:'#475569',letterSpacing:.5}}>GROUP BY SAME CONFIGURATION</span>
        </label>
        
        <button className="pm-clear-btn" style={{borderColor:'#6366f1',color:'#6366f1',background:'#f5f3ff'}}>
          📊 VIEW FULL REPORT
        </button>
      </div>

      <div className="pm-table-wrap">
        <div className="table-responsive">
          <table className="custom-tally-table">
            <thead>
              <tr>
                <th className="ps-4">Product Name</th>
                <th>Configuration</th>
                <th>IMEI / SN</th>
                <th>Location</th>
                <th className="text-center">Stock</th>
                <th className="text-end">Price</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
              ) : currentItems.map(p => (
                <tr key={p.id} className="tally-row">
                  <td className="ps-4">
                    <div className="fw-bold text-dark" style={{ fontSize: '.88rem' }}>
                      {p.brand ? p.brand.name.toUpperCase() + ' ' : ''}{p.name.toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-1 flex-wrap">
                      <span className="pm-badge text-uppercase" style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                        {p.attributes?.color || '-'}
                      </span>
                      <span className="pm-badge" style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                        {p.attributes?.ram || '-' } / {p.attributes?.storage || '-'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {filters.group_by_config ? (
                        p.attributes?.imeis?.length > 0 ? (
                          p.attributes.imeis.map((imei, idx) => (
                            <span key={idx} className="pm-badge" 
                                  style={{background:'#f8fafc',color:'#1e293b',border:'1px solid #cbd5e1',fontSize:'.65rem', cursor:'pointer'}}
                                  onClick={() => navigate(`/sales/new?imei=${imei}`)}
                                  title="Click to sell this IMEI"
                            >
                              {imei}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted small">—</span>
                        )
                      ) : (
                        p.attributes?.imei ? (
                          <span className="pm-badge" 
                                style={{background:'#f8fafc',color:'#1e293b',border:'1px solid #cbd5e1',fontSize:'.65rem', cursor:'pointer'}}
                                onClick={() => navigate(`/sales/new?imei=${p.attributes.imei}`)}
                                title="Click to sell this IMEI"
                          >
                            {p.attributes.imei}
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )
                      )}
                    </div>
                  </td>
                  <td>
                    <div 
                      className="d-flex align-items-center clickable-location" 
                      style={{ cursor: 'pointer', fontSize: '.75rem', fontWeight: 600 }}
                      onClick={async () => {
                        const loc = window.prompt("Enter Location for " + p.name, p.location || '');
                        if (loc !== null) {
                          try {
                            await api.put(`/products/${p.product_id || p.id}`, { location: loc });
                            refresh();
                            toast.success("Location updated!");
                          } catch(e) { toast.error("Failed to update location"); }
                        }
                      }}
                    >
                      <span className="me-1">📍</span>
                      <span className={p.location ? 'text-dark fw-bold' : 'text-secondary text-decoration-underline'}>
                        {p.location ? p.location.toUpperCase() : 'SET LOCATION'}
                      </span>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="pm-badge" style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                      {p.current_stock} PCS
                    </span>
                  </td>
                  <td className="text-end fw-bold" style={{ fontSize: '.9rem', color: '#1e293b' }}>
                    ₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="text-end pe-4">
                    {!filters.group_by_config && p.id && (
                      <div className="d-flex justify-content-end gap-1 flex-wrap">
                        {p.attributes?.imei && (
                          <button 
                            className="btn btn-outline-success btn-xs rounded-pill px-3 fw-bold"
                            onClick={() => navigate(`/sales/new?imei=${p.attributes.imei}`)}
                          >
                            SELL
                          </button>
                        )}
                        <button 
                          className="btn btn-outline-secondary btn-xs rounded-pill px-3 fw-bold"
                          onClick={() => openEdit(p)}
                        >
                          EDIT
                        </button>
                        <button 
                          className="btn btn-outline-danger btn-xs rounded-pill px-3 fw-bold"
                          onClick={() => handleDelete(p.id)}
                        >
                          DEL
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {products.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center py-5 text-muted fw-bold">No matching stocks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-3 px-2 flex-wrap gap-2 no-print">
          <div className="text-muted small">
            Showing <strong className="text-dark">{startIndex + 1}</strong> to{' '}
            <strong className="text-dark">{endIndex}</strong> of{' '}
            <strong className="text-dark">{totalItems}</strong> entries
          </div>
          <div className="d-flex align-items-center gap-1">
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              style={{ fontSize: '0.72rem', fontWeight: 'bold' }}
            >
              First
            </button>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              style={{ fontSize: '0.72rem', fontWeight: 'bold' }}
            >
              Prev
            </button>
            
            {(() => {
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - 2);
              let end = Math.min(totalPages, start + maxVisible - 1);
              
              if (end - start + 1 < maxVisible) {
                start = Math.max(1, end - maxVisible + 1);
              }
              
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }
              
              return pages.map(pageNum => (
                <button
                  key={pageNum}
                  className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center ${currentPage === pageNum ? 'btn-primary text-white shadow-sm' : 'btn-outline-secondary'}`}
                  style={{ width: '32px', height: '32px', fontSize: '0.72rem', fontWeight: 'bold' }}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ));
            })()}

            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              style={{ fontSize: '0.72rem', fontWeight: 'bold' }}
            >
              Next
            </button>
            <button
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              style={{ fontSize: '0.72rem', fontWeight: 'bold' }}
            >
              Last
            </button>
          </div>
        </div>
      )}

      <Modal show={!!editingItem} onClose={() => setEditingItem(null)} title="EDIT STOCK ITEM">
        {editingItem && (
          <form onSubmit={submitEdit}>
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label text-uppercase small fw-bold text-muted">IMEI / SN</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editForm.imei} 
                  onChange={e => setEditForm({...editForm, imei: e.target.value})} 
                />
              </div>
              <div className="col-md-4">
                <label className="form-label text-uppercase small fw-bold text-muted">Color</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editForm.color} 
                  onChange={e => setEditForm({...editForm, color: e.target.value})} 
                />
              </div>
              <div className="col-md-4">
                <label className="form-label text-uppercase small fw-bold text-muted">RAM</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editForm.ram} 
                  onChange={e => setEditForm({...editForm, ram: e.target.value})} 
                />
              </div>
              <div className="col-md-4">
                <label className="form-label text-uppercase small fw-bold text-muted">Storage</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editForm.storage} 
                  onChange={e => setEditForm({...editForm, storage: e.target.value})} 
                />
              </div>
              
              <div className="col-md-12 pt-2"><hr className="my-0 text-muted" style={{opacity:0.15}} /></div>
              
              <div className="col-md-4">
                <label className="form-label text-uppercase small fw-bold" style={{color:'#059669'}}>MOP (Selling) ₹</label>
                <input 
                  type="number" 
                  className="form-control fw-bold" 
                  style={{borderColor:'#6ee7b7',color:'#059669'}}
                  value={editForm.selling_price} 
                  onChange={e => setEditForm({...editForm, selling_price: e.target.value})} 
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label text-uppercase small fw-bold" style={{color:'#6366f1'}}>Wholesale ₹</label>
                <input 
                  type="number" 
                  className="form-control" 
                  style={{borderColor:'#a5b4fc'}}
                  value={editForm.wholeseller_price} 
                  onChange={e => setEditForm({...editForm, wholeseller_price: e.target.value})} 
                />
              </div>
              <div className="col-md-4">
                <label className="form-label text-uppercase small fw-bold" style={{color:'#dc2626'}}>Min Price ₹</label>
                <input 
                  type="number" 
                  className="form-control" 
                  style={{borderColor:'#fca5a5'}}
                  value={editForm.min_selling_price} 
                  onChange={e => setEditForm({...editForm, min_selling_price: e.target.value})} 
                />
              </div>

              <div className="col-md-6">
                <label className="form-label text-uppercase small fw-bold" style={{color:'#d97706'}}>Margin / Com ₹</label>
                <input 
                  type="number" 
                  className="form-control" 
                  style={{borderColor:'#fcd34d'}}
                  value={editForm.incentive_amount} 
                  onChange={e => setEditForm({...editForm, incentive_amount: e.target.value})} 
                />
              </div>
              <div className="col-md-6">
                <label className="form-label text-uppercase small fw-bold text-muted">Purchase Rate (ex-GST) ₹</label>
                <input 
                  type="number" 
                  className="form-control bg-light" 
                  value={editForm.unit_price} 
                  onChange={e => setEditForm({...editForm, unit_price: e.target.value})} 
                  placeholder="Keep unchanged"
                />
              </div>
            </div>
            
            <div className="alert alert-warning mt-4 mb-0 x-small py-2 border-warning-subtle text-uppercase fw-bold">
              Note: Editing configuration (Color, RAM, Storage) will affect all identical units received in the same invoice.
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-light fw-bold" onClick={() => setEditingItem(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary fw-bold" disabled={saving}>
                {saving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </form>
        )}
      </Modal>
      <style>{`
        .custom-tally-table {
          width: 100%;
          border-collapse: collapse !important;
          border: 1px solid #cbd5e1 !important;
        }
        .custom-tally-table thead th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f8fafc;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.65rem 0.5rem;
          border-bottom: 2px solid #cbd5e1 !important;
          border-right: 1px solid #cbd5e1 !important;
        }
        .custom-tally-table thead th:last-child {
          border-right: none !important;
        }
        .custom-tally-table tbody tr td {
          padding: 0.6rem 0.5rem;
          border-bottom: 1px solid #cbd5e1 !important;
          border-right: 1px solid #cbd5e1 !important;
          vertical-align: middle;
        }
        .custom-tally-table tbody tr td:last-child {
          border-right: none !important;
        }
        .custom-tally-table tbody tr.tally-row:hover {
          background-color: #f1f5f9 !important;
        }
        .clickable-location:hover {
          text-decoration: underline !important;
        }
        .btn-xs { font-size: 0.7rem; padding: 2px 8px; }
      `}</style>
    </div>
  );
}
