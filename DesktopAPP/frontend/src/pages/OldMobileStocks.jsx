import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

export default function OldMobileStocks() {
  const { user, isOwner, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Load shops
  useEffect(() => {
    api.get('/shops')
      .then(res => {
        setShops(res.data);
        if (res.data.length > 0) {
          const userShop = res.data.find(s => s.id === user.shop_id);
          setSelectedShop(userShop ? userShop.id : res.data[0].id);
        }
      })
      .catch(err => console.error(err));
  }, [user]);

  // Load products when shop changes
  const loadStocks = () => {
    if (!selectedShop) return;
    setLoading(true);
    
    // Fetch products for the shop
    api.get('/products', { 
      params: { 
        shop_id: selectedShop
      } 
    })
      .then(res => {
        const data = res.data.data || res.data;
        // Filter: only Category "Mobile Old" and stock > 0
        const oldMobiles = data.filter(p => 
          (p.category?.slug === 'MOBILE-OLD' || p.category?.name?.toUpperCase() === 'MOBILE OLD' || p.category?.slug === 'mobile-old') &&
          (p.stock > 0)
        );
        setProducts(oldMobiles);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStocks();
  }, [selectedShop]);

  const handleDelete = async (id) => {
    if(!window.confirm('Are you sure you want to delete this device?')) return;
    try {
        await api.delete(`/products/${id}`);
        toast.success('Device deleted successfully');
        loadStocks();
    } catch(err) {
        toast.error('Failed to delete device');
    }
  };

  // Filtered by search query on front-end for quick feedback
  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.imei?.includes(search) ||
    p.attributes?.color?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 text-dark d-flex align-items-center gap-2">
            <span>📦</span> 2nd Mobile Stocks
          </h2>
          <p className="text-muted mb-0">Live stock of second-hand and exchange mobile devices.</p>
        </div>

        <div className="d-flex gap-3 align-items-center">
          {hasFullAccess() && (
            <div style={{ minWidth: '200px' }}>
              <select 
                className="form-select bg-light text-dark border-secondary-subtle fw-semibold"
                value={selectedShop} 
                onChange={e => setSelectedShop(e.target.value)}
              >
                {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
            </div>
          )}
          <button onClick={loadStocks} className="btn btn-outline-light d-flex align-items-center gap-2">
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 p-3 mb-4">
        <div className="row g-2">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text bg-light border-secondary-subtle text-muted">🔍</span>
              <input 
                type="text" 
                className="form-control bg-light text-dark border-secondary-subtle"
                placeholder="Search by Model, Color or IMEI..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="card border-0 bg-white border border-secondary-subtle-subtle shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table  table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="py-3 px-4 text-muted">Device Name</th>
                  <th className="py-3 text-muted">IMEI / Serial</th>
                  <th className="py-3 text-muted">Specs</th>
                  <th className="py-3 text-muted">Color</th>
                  <th className="py-3 text-muted">Purchase Price</th>
                  <th className="py-3 text-muted">Target Selling Price</th>
                  <th className="py-3 px-4 text-muted text-center">Available Stock</th>
                  <th className="py-3 px-4 text-muted text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className="border-bottom-dark">
                    <td className="py-3 px-4">
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-dark font-bold" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>
                          📱
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{p.name}</div>
                          <code className="text-xs text-muted">{p.sku}</code>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      {p.imei || p.attributes?.imei ? (
                        <code className="text-info">
                          <Link to={`/old-mobiles/sales/new?category=mobile-old&imei=${p.imei || p.attributes?.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{p.imei || p.attributes?.imei}</Link>
                        </code>
                      ) : '—'}
                    </td>
                    <td className="py-3">
                      <div className="d-flex gap-1">
                        {p.attributes?.ram && <span className="badge bg-secondary rounded-pill">{p.attributes.ram} RAM</span>}
                        {p.attributes?.storage && <span className="badge bg-secondary rounded-pill">{p.attributes.storage} ROM</span>}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="text-dark fw-semibold">{p.attributes?.color || '—'}</span>
                    </td>
                    <td className="py-3 fw-bold text-success">
                      ₹{parseFloat(p.purchase_price).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 fw-bold text-warning">
                      ₹{parseFloat(p.selling_price).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="badge bg-success rounded-pill px-3 py-1 fw-bold">
                        {p.stock} Devices
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button onClick={() => navigate(`/products/${p.id}/edit`)} className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold">✏️ EDIT</button>
                        <button onClick={() => navigate(`/old-mobiles/sales/new?category=mobile-old&product_id=${p.id}`)} className="btn btn-sm btn-success shadow-sm rounded-pill px-3 fw-bold">🛒 SELL</button>
                        {hasFullAccess() && (
                          <button onClick={() => handleDelete(p.id)} className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold">🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      <div className="fs-1 mb-2">📭</div>
                      No second-hand mobile devices currently in stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
