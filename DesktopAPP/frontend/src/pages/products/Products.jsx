import { useState, useEffect } from 'react';
import pinGate from '../../utils/pinGate';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const category_group = searchParams.get('category_group');

  const load = () => {
    setLoading(true);
    api.get('/products', { params: { search, category_group } })
      .then(r => setProducts(r.data.data || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, category_group]);

  const getProductFullName = (p) => {
    const brandName = (p.brand?.name || p.attributes?.brand || '').trim().toUpperCase();
    const prodName = (p.name || '').trim().toUpperCase();
    return brandName ? `${brandName} ${prodName}` : prodName;
  };

  const deleteProduct = async (id) => {
    if (!await pinGate.confirm()) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deleted');
    load();
  };

  const title = category_group === 'other' ? '🗃️ Other Products' : '📱 Products';

  return (
    <div>
      <div className="page-header">
        <h2>{title}</h2>
        {can('create_products') && (
          <Link to={category_group ? `/products/new?category_group=${category_group}` : '/products/new'} className="btn btn-primary btn-sm">
            + Add Product
          </Link>
        )}
      </div>

      <div className="table-card">
        <div className="p-3 border-bottom d-flex gap-2">
          <input className="form-control form-control-sm" style={{ maxWidth:260 }}
            placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div> : (
          <table className="table table-bordered table-hover mb-0">
            <thead><tr>
              <th>Product</th><th>SKU</th><th>Category</th>
              <th>Buy ₹</th><th>Sell ₹</th><th>Stock</th><th>Location</th><th>Condition</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td className="fw-semibold">{getProductFullName(p)}</td>
                  <td><code style={{ fontSize:'0.8rem' }}>{p.sku}</code></td>
                  <td>
                    {p.category?.name}
                    {p.subcategory && (
                      <span className="text-muted d-block" style={{ fontSize: '0.72rem', marginTop: '2px', fontWeight: 500 }}>
                        {p.subcategory}
                      </span>
                    )}
                  </td>
                  <td>₹{p.purchase_price}</td>
                  <td>₹{p.selling_price}</td>
                  <td>
                    {(() => {
                      const stockCount = p.stock !== undefined ? p.stock : (p.current_stock !== undefined ? p.current_stock : 0);
                      return (
                        <span className="badge bg-light text-dark border fw-semibold" style={{ fontSize: '0.8rem' }}>
                          {stockCount}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <div 
                      className="d-flex align-items-center" 
                      style={{ cursor: 'pointer', fontSize: '.85rem' }}
                      onClick={async () => {
                        const fullName = getProductFullName(p);
                        const loc = window.prompt("Enter Location for " + fullName, p.location || '');
                        if (loc !== null) {
                          try {
                            await api.put(`/products/${p.id}`, { location: loc });
                            load();
                            toast.success("Location updated!");
                          } catch(e) { toast.error("Failed to update location"); }
                        }
                      }}
                    >
                      <span className="me-1">📍</span>
                      <span className={p.location ? 'text-dark fw-semibold' : 'text-muted text-decoration-underline'}>
                        {p.location ? p.location.toUpperCase() : 'SET'}
                      </span>
                    </div>
                  </td>
                  <td><span className="badge bg-light text-dark border text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>{p.condition}</span></td>
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      {category_group === 'other' && (
                        <Link to={`/sales/new?category_group=other&product_id=${p.id}`} className="btn btn-xs btn-outline-secondary fw-semibold" style={{ fontSize:'0.75rem', padding:'2px 8px' }}>⚡ Sell</Link>
                      )}
                      {can('edit_products') && <Link to={category_group ? `/products/${p.id}/edit?category_group=${category_group}` : `/products/${p.id}/edit`} className="btn btn-xs btn-outline-secondary fw-semibold" style={{ fontSize:'0.75rem', padding:'2px 8px' }}>Edit</Link>}
                      {can('delete_products') && <button className="btn btn-xs btn-outline-secondary fw-semibold" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => deleteProduct(p.id)}>Del</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={9} className="text-center text-muted py-4">No products found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <style>{`
        .table-bordered th, .table-bordered td {
          border-color: #e2e8f0 !important;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}
