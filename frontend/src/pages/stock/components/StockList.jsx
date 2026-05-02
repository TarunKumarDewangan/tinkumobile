import { toast } from 'react-toastify';
import api from '../../../api/axios';

export default function StockList({ products, loading, filters, handleFilterChange, refresh }) {
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
          <table className="pm-table">
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
              ) : products.map(p => (
                <tr key={p.id}>
                  <td className="ps-4">
                    <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '.88rem' }}>
                      {p.name.toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-1 flex-wrap">
                      <span className="pm-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                        {p.attributes?.color?.toUpperCase() || '-'}
                      </span>
                      <span className="pm-badge" style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                        {p.attributes?.ram || '-' } / {p.attributes?.storage || '-'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {filters.group_by_config ? (
                        p.attributes?.imeis?.length > 0 ? (
                          p.attributes.imeis.map((imei, idx) => (
                            <span key={idx} className="pm-badge" style={{background:'#f8fafc',color:'#6366f1',border:'1px solid #e2e8f0',fontSize:'.58rem'}}>
                              {imei}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted small">—</span>
                        )
                      ) : (
                        p.attributes?.imei ? (
                          <span className="pm-badge" style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe'}}>
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
                      <span className={p.location ? 'text-dark fw-800' : 'text-primary'}>
                        {p.location ? p.location.toUpperCase() : 'SET LOCATION'}
                      </span>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="pm-badge" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                      {p.current_stock} PCS
                    </span>
                  </td>
                  <td className="text-end fw-800" style={{ fontSize: '.9rem', color: '#1e293b' }}>
                    ₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="text-end pe-4">
                    {!filters.group_by_config && p.attributes?.imei && (
                      <button 
                        className="pm-clear-btn"
                        style={{padding:'3px 10px',fontSize:'.65rem',borderColor:'#10b981',color:'#10b981',background:'#f0fdf4'}}
                        onClick={() => window.location.href = `/sales/new?imei=${p.attributes.imei}`}
                      >
                        SELL
                      </button>
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
    </div>
  );
}
