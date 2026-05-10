import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import useInventory from './stock/hooks/useInventory';
import StockFilters from './stock/components/StockFilters';
import StockList from './stock/components/StockList';
import OpeningStockForm from './stock/components/OpeningStockForm';
import StockHistory from './stock/components/StockHistory';
import EditAdjustmentModal from './stock/components/EditAdjustmentModal';
import ModelWiseStock from './stock/components/ModelWiseStock';
import DataBackupModal from '../components/DataBackupModal';

export default function StockEntry() {
  const [tab, setTab] = useState('stocks');
  const [filters, setFilters] = useState({
    search: '', supplier_id: '', from: '', to: '', ram: '', storage: '', color: '', model: '', imei: '', group_by_config: true
  });
  const [form, setForm] = useState({
    product_id: '', quantity: 1, reason: 'opening_stock', purchase_price: '', notes: '', adjustment_date: new Date().toISOString().slice(0,10), shop_id: '',
  });
  const [openingStockItems, setOpeningStockItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [editingAdj, setEditingAdj] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: 1, purchase_price: '', notes: '', adjustment_date: '' });
  const [loading, setLoading] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);

  const { user, isOwner } = useAuth();
  const inventory = useInventory(filters, form, setForm);

  const handleFilterChange = (name, value) => setFilters(prev => ({ ...prev, [name]: value }));
  const clearFilters = () => setFilters({
    search: '', supplier_id: '', from: '', to: '', ram: '', storage: '', color: '', model: '', imei: '', group_by_config: true
  });

  const loadHistory = useCallback(() => {
    setHistLoading(true);
    api.get('/stock-adjustments').then(r => setHistory(r.data)).finally(() => setHistLoading(false));
  }, []);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        await api.put(`/stock-adjustments/${editingAdj.id}`, editForm);
        toast.success('Adjustment updated successfully!');
        setEditingAdj(null);
        loadHistory();
        inventory.refresh();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error updating adjustment');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this adjustment? Inventory will be reverted.')) return;
    setLoading(true);
    try {
        await api.delete(`/stock-adjustments/${id}`);
        toast.success('Adjustment deleted and stock reverted!');
        loadHistory();
        inventory.refresh();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error deleting adjustment');
    } finally {
        setLoading(false);
    }
  };

  const handleBulkDelete = async (ids) => {
    if (!window.confirm(`Are you sure you want to delete ${ids.length} selected adjustments? Inventory will be reverted.`)) return;
    setLoading(true);
    try {
        await api.post('/stock-adjustments/bulk-delete', { ids });
        toast.success(`Successfully deleted ${ids.length} adjustments!`);
        loadHistory();
        inventory.refresh();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error bulk deleting adjustments');
    } finally {
        setLoading(false);
    }
  };


  const PS = `
    .pm-wrap{background:#f1f5f9;min-height:100vh;padding:20px;}
    .pm-hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;padding:22px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;}
    .pm-hero h2{color:#fff;font-size:1.15rem;font-weight:800;letter-spacing:1px;margin:0;}
    .pm-hero p{color:rgba(255,255,255,.5);font-size:.7rem;margin:2px 0 0;letter-spacing:.5px;}
    .pm-tab-bar{display:flex;gap:6px;margin-bottom:16px;}
    .pm-tab{padding:8px 18px;border-radius:10px;font-size:.75rem;font-weight:700;letter-spacing:.5px;cursor:pointer;border:2px solid transparent;transition:all .18s;text-transform:uppercase;border:none;}
    .pm-tab.active{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 3px 10px rgba(99,102,241,.3);}
    .pm-tab:not(.active){background:#fff;color:#64748b;border:1.5px solid #e2e8f0;}
    .pm-tab:not(.active):hover{border-color:#6366f1;color:#6366f1;}
    .pm-filters{background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);}
    .pm-flabel{font-size:.63rem;font-weight:800;letter-spacing:.8px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;display:block;}
    .pm-finput{font-size:.78rem;border:1.5px solid #e2e8f0;border-radius:8px;padding:5px 10px;width:100%;background:#f8fafc;transition:border-color .15s;}
    .pm-finput:focus{outline:none;border-color:#6366f1;background:#fff;}
    .pm-table-wrap{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);}
    .pm-table{width:100%;border-collapse:collapse;font-size:.78rem;}
    .pm-table thead tr{background:linear-gradient(135deg,#1e293b,#0f172a);}
    .pm-table thead th{color:rgba(255,255,255,.7);font-size:.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:11px 14px;border:none;}
    .pm-table tbody tr{border-bottom:1px solid #f1f5f9;transition:background .1s;}
    .pm-table tbody tr:hover{background:#f8fafc;}
    .pm-table td{padding:11px 14px;vertical-align:middle;border:none;color:#334155;}
    .pm-badge{font-size:.6rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px;display:inline-block;}
    .pm-clear-btn{font-size:.7rem;font-weight:700;padding:5px 12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;transition:all .15s;}
    .pm-clear-btn:hover{border-color:#ef4444;color:#ef4444;}
    
    .pf-card{background:#fff;border-radius:14px;padding:18px 22px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);position:relative;border:none;}
    .pf-sec{font-size:.72rem;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
    .pf-lbl{font-size:.62rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;display:block;}
    .pf-inp{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:6px 10px;font-size:.78rem;font-weight:600;color:#1e293b;transition:all .15s;}
    .pf-inp:focus{outline:none;border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
    .pf-item{background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:12px;border:1.5px solid #e2e8f0;position:relative;transition:all .15s;}
    .pf-item:hover{border-color:#cbd5e1;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.03);}
    .pf-price-lbl{font-size:.58rem;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-bottom:3px;display:block;}
    .pf-bulk{background:#f5f3ff;color:#6366f1;border:1.5px dashed #c7d2fe;padding:6px 14px;border-radius:10px;font-size:.7rem;font-weight:700;cursor:pointer;transition:all .15s;}
    .pf-bulk:hover{background:#ede9fe;border-color:#6366f1;}
    .pf-submit{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-weight:700;font-size:.82rem;letter-spacing:.5px;cursor:pointer;box-shadow:0 4px 12px rgba(99,102,241,.3);transition:all .15s;}
    .pf-submit:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(99,102,241,.4);}
    .pf-submit:disabled{background:#cbd5e1;box-shadow:none;cursor:not-allowed;}
    .pf-submit.green{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 12px rgba(16,185,129,.3);}
    .pf-submit.green:hover{box-shadow:0 6px 16px rgba(16,185,129,.4);}
  `;

  return (
    <div className="pm-wrap">
      <style>{PS}</style>

      <div className="pm-hero">
        <div>
          <h2>📦 STOCKS</h2>
          <p>Comprehensive Inventory & Stock Management</p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          {isOwner() && (
            <button className="pf-bulk" onClick={() => setShowBackupModal(true)} style={{background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.15)', color:'#fff', padding:'6px 14px'}}>
              📥 BACKUP / RESTORE
            </button>
          )}
          <div className="d-none d-md-block ms-3">
            <span style={{color:'rgba(255,255,255,.4)',fontSize:'.65rem',fontWeight:700,letterSpacing:1}}>SHORTCUT: ALT + S</span>
          </div>
        </div>
      </div>

      <div className="pm-tab-bar">
        <button className={`pm-tab ${tab==='stocks'?'active':''}`} onClick={() => setTab('stocks')}>📦 ALL STOCKS</button>
        <button className={`pm-tab ${tab==='entry'?'active':''}`} onClick={() => setTab('entry')}>📥 ENTRY BEFORE SYSTEM STARTED</button>
        <button className={`pm-tab ${tab==='history'?'active':''}`} onClick={() => setTab('history')}>🕓 HISTORY</button>
        <button className={`pm-tab ${tab==='model-wise'?'active':''}`} onClick={() => setTab('model-wise')}>📊 MODEL WISE STOCK</button>
      </div>

      {(tab === 'stocks' || tab === 'model-wise') && (
        <>
            <StockFilters 
                filters={filters} 
                handleFilterChange={handleFilterChange} 
                clearFilters={clearFilters} 
                suppliers={inventory.suppliers} 
                imeiList={inventory.imeiList} 
            />
            {tab === 'stocks' ? (
                <StockList 
                    products={inventory.products} 
                    loading={inventory.loading} 
                    filters={filters} 
                    handleFilterChange={handleFilterChange} 
                    refresh={inventory.refresh} 
                />
            ) : (
                <ModelWiseStock 
                    products={inventory.products}
                    loading={inventory.loading}
                    filters={filters}
                />
            )}
        </>
      )}

      {tab === 'entry' && (
        <OpeningStockForm 
            openingStockItems={openingStockItems}
            setOpeningStockItems={setOpeningStockItems}
            form={form}
            setForm={setForm}
            shops={inventory.shops}
            baseProducts={inventory.baseProducts}
            categories={inventory.categories}
            isOwner={isOwner()}
            loading={loading}
            setLoading={setLoading}
            onSuccess={inventory.refresh}
        />
      )}

      {tab === 'history' && (
        <StockHistory 
            history={history}
            histLoading={histLoading}
            setEditingAdj={setEditingAdj}
            setEditForm={setEditForm}
            handleDelete={handleDelete}
            handleBulkDelete={handleBulkDelete}
        />
      )}


      <EditAdjustmentModal 
        editingAdj={editingAdj}
        editForm={editForm}
        setEditForm={setEditForm}
        handleUpdate={handleUpdate}
        setEditingAdj={setEditingAdj}
        loading={loading}
      />

      <DataBackupModal 
        isOpen={showBackupModal} 
        onClose={() => setShowBackupModal(false)}
        onRefresh={() => { inventory.refresh(); if(tab === 'history') loadHistory(); }}
        title="Inventory & Stock Backup"
        endpoint="/stocks"
        typeLabel="Inventory"
      />
    </div>
  );
}
