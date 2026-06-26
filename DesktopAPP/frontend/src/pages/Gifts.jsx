import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

export default function Gifts() {
  const [inventory, setInventory] = useState([]);
  const load = () => api.get('/gift-inventory').then(r => setInventory(r.data));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header"><h2>🎁 Gift Inventory</h2></div>
      <div className="table-card">
        <table className="table table-hover mb-0">
          <thead><tr><th>Gift Name</th><th>SKU</th><th>Purchase ₹</th><th>Stock</th></tr></thead>
          <tbody>
            {inventory.map(g => (
              <tr key={g.id}>
                <td className="fw-semibold">{g.gift_product?.name}</td>
                <td><code>{g.gift_product?.sku}</code></td>
                <td>₹{g.gift_product?.purchase_price}</td>
                <td><span className={`badge ${g.stock > 5 ? 'bg-success' : g.stock > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>{g.stock}</span></td>
              </tr>
            ))}
            {inventory.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted">No gift inventory</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
