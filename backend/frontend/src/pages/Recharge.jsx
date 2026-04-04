import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function Recharge() {
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [tab, setTab] = useState('sales');

  useEffect(() => {
    api.get('/recharge-purchases').then(r => setPurchases(r.data));
    api.get('/recharge-sales').then(r => setSales(r.data));
  }, []);

  return (
    <div>
      <div className="page-header"><h2>⚡ Recharge</h2></div>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button className={`nav-link ${tab==='sales'?'active':''}`} onClick={() => setTab('sales')}>Sales</button></li>
        <li className="nav-item"><button className={`nav-link ${tab==='purchases'?'active':''}`} onClick={() => setTab('purchases')}>Purchases</button></li>
      </ul>
      <div className="table-card">
        <table className="table table-hover mb-0">
          <thead>
            {tab === 'sales' ? <tr><th>Date</th><th>Customer</th><th>Mobile#</th><th>Operator</th><th>Amount</th><th>Selling Price</th></tr>
              : <tr><th>Date</th><th>Supplier</th><th>Operator</th><th>Amount</th><th>Cost</th><th>Profit</th></tr>}
          </thead>
          <tbody>
            {tab === 'sales' && sales.map(s => (
              <tr key={s.id}><td>{formatDate(s.sale_date)}</td><td>{s.customer?.name}</td><td>{s.mobile_number}</td><td>{s.operator}</td><td>₹{s.amount}</td><td>₹{s.selling_price}</td></tr>
            ))}
            {tab === 'purchases' && purchases.map(p => (
              <tr key={p.id}><td>{formatDate(p.purchase_date)}</td><td>{p.supplier?.name}</td><td>{p.operator}</td><td>₹{p.amount}</td><td>₹{p.cost_price}</td><td>₹{(p.amount - p.cost_price).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
