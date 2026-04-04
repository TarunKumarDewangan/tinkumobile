import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    api.get('/products', { params: { search } })
      .then(r => setProducts(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deleted');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>📱 Products</h2>
        {can('create_products') && <Link to="/products/new" className="btn btn-primary btn-sm">+ Add Product</Link>}
      </div>

      <div className="table-card">
        <div className="p-3 border-bottom d-flex gap-2">
          <input className="form-control form-control-sm" style={{ maxWidth:260 }}
            placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div> : (
          <table className="table table-hover mb-0">
            <thead><tr>
              <th>Product</th><th>SKU</th><th>Category</th>
              <th>Buy ₹</th><th>Sell ₹</th><th>Stock</th><th>Condition</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td className="fw-semibold">{p.name}</td>
                  <td><code style={{ fontSize:'0.8rem' }}>{p.sku}</code></td>
                  <td>{p.category?.name}</td>
                  <td>₹{p.purchase_price}</td>
                  <td>₹{p.selling_price}</td>
                  <td><span className={`badge ${p.current_stock > 5 ? 'bg-success' : p.current_stock > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>{p.current_stock ?? '–'}</span></td>
                  <td><span className={`badge ${p.condition === 'new' ? 'bg-info' : 'bg-secondary'}`}>{p.condition}</span></td>
                  <td>
                    {can('edit_products') && <Link to={`/products/${p.id}/edit`} className="btn btn-xs btn-outline-primary me-1" style={{ fontSize:'0.75rem', padding:'2px 8px' }}>Edit</Link>}
                    {can('delete_products') && <button className="btn btn-xs btn-outline-danger" style={{ fontSize:'0.75rem', padding:'2px 8px' }} onClick={() => deleteProduct(p.id)}>Del</button>}
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-4">No products found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
