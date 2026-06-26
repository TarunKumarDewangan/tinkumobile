import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function CombinedSalesReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedBrands, setExpandedBrands] = useState({});
  const [shops, setShops] = useState([]);
  const [brandSearch, setBrandSearch] = useState('');
  const { hasFullAccess } = useAuth();

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    shop_id: '',
  });

  const loadShops = async () => {
    if (hasFullAccess()) {
      try {
        const res = await api.get('/shops');
        setShops(res.data);
      } catch (err) {
        console.error('Error loading shops:', err);
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/combined-sales', { params: filters });
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load combined sales report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, [hasFullAccess]);

  useEffect(() => {
    loadData();
  }, [filters]);

  const toggleBrand = (brandId) => {
    setExpandedBrands(prev => ({
      ...prev,
      [brandId]: !prev[brandId]
    }));
  };

  // Helper to set predefined date filters
  const setPeriod = (period) => {
    const today = new Date();
    let from = '';
    let to = today.toISOString().split('T')[0];

    if (period === 'today') {
      from = to;
    } else if (period === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      from = yesterday.toISOString().split('T')[0];
      to = from;
    } else if (period === 'week') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      from = lastWeek.toISOString().split('T')[0];
    } else if (period === 'month') {
      const lastMonth = new Date();
      lastMonth.setMonth(today.getMonth() - 1);
      from = lastMonth.toISOString().split('T')[0];
    } else if (period === 'clear') {
      from = '';
      to = '';
    }

    setFilters(prev => ({ ...prev, from, to }));
  };

  // Client-side brand name search filter
  const filteredData = data.filter(item => 
    (item.brand_name || '').toLowerCase().includes(brandSearch.toLowerCase())
  );

  // Totals calculations
  const totalNewSold = filteredData.reduce((sum, item) => sum + (item.new_sold || 0), 0);
  const totalOldSold = filteredData.reduce((sum, item) => sum + (item.old_sold || 0), 0);
  const grandTotalSold = totalNewSold + totalOldSold;

  const totalNewStock = filteredData.reduce((sum, item) => sum + (item.new_stock || 0), 0);
  const totalOldStock = filteredData.reduce((sum, item) => sum + (item.old_stock || 0), 0);
  const grandTotalStock = totalNewStock + totalOldStock;

  const topSellingBrand = filteredData.length > 0 ? filteredData[0] : null;

  return (
    <div className="container-fluid py-4 px-4 bg-light min-vh-100">
      
      {/* Premium Gradient Header */}
      <div className="mb-4 p-4 rounded-4 text-white shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-3"
           style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
        <div>
          <h2 className="mb-1 fw-bold text-uppercase d-flex align-items-center gap-2">
            <span>📊</span> Combined Sales & Stock Report
          </h2>
          <p className="mb-0 opacity-80" style={{ fontSize: '0.9rem' }}>
            Brand and model level sales analytics for new and second hand mobiles with active inventory tracking.
          </p>
        </div>
        <button 
          onClick={loadData} 
          className="btn btn-light text-primary fw-bold px-4 py-2 rounded-pill hover-scale shadow-sm text-uppercase"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Report'}
        </button>
      </div>

      {/* KPI Cards section */}
      <div className="row g-3 mb-4">
        {/* KPI 1 */}
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 card-glow hover-scale">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-bold text-uppercase">Total Mobiles Sold</span>
              <span className="fs-3">📱</span>
            </div>
            <h2 className="fw-black text-dark mb-1">{grandTotalSold.toLocaleString()}</h2>
            <div className="d-flex gap-3 text-muted small mt-2">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">New: {totalNewSold}</span>
              <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">Used: {totalOldSold}</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 card-glow hover-scale">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-bold text-uppercase">Existing Stock (Remaining)</span>
              <span className="fs-3">📦</span>
            </div>
            <h2 className="fw-black text-dark mb-1">{grandTotalStock.toLocaleString()}</h2>
            <div className="d-flex gap-3 text-muted small mt-2">
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">New: {totalNewStock}</span>
              <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">Used: {totalOldStock}</span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 card-glow hover-scale">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-bold text-uppercase">Top Selling Brand</span>
              <span className="fs-3">🏆</span>
            </div>
            <h2 className="fw-black text-indigo mb-1">
              {topSellingBrand ? topSellingBrand.brand_name.toUpperCase() : 'N/A'}
            </h2>
            <div className="text-muted small mt-2">
              {topSellingBrand ? (
                <span>Sales: <strong>{topSellingBrand.total_sold} units</strong> ({topSellingBrand.new_sold} new, {topSellingBrand.old_sold} used)</span>
              ) : (
                <span>No sales recorded yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className="card border-0 bg-white shadow-sm rounded-4 p-4 mb-4">
        <div className="row g-3 align-items-end text-uppercase">
          {/* Quick Date Presets */}
          <div className="col-12 col-lg-4">
            <label className="form-label text-muted small fw-bold mb-2">Quick Period Presets</label>
            <div className="d-flex flex-wrap gap-2">
              <button onClick={() => setPeriod('today')} className="btn btn-sm btn-outline-primary px-3 rounded-pill fw-bold">Today</button>
              <button onClick={() => setPeriod('yesterday')} className="btn btn-sm btn-outline-primary px-3 rounded-pill fw-bold">Yesterday</button>
              <button onClick={() => setPeriod('week')} className="btn btn-sm btn-outline-primary px-3 rounded-pill fw-bold">Last 7 Days</button>
              <button onClick={() => setPeriod('month')} className="btn btn-sm btn-outline-primary px-3 rounded-pill fw-bold">Last 30 Days</button>
              <button onClick={() => setPeriod('clear')} className="btn btn-sm btn-outline-secondary px-3 rounded-pill fw-bold">Clear Date</button>
            </div>
          </div>

          {/* Exact From Date */}
          <div className="col-6 col-md-3 col-lg-2">
            <label className="form-label text-muted small fw-bold mb-1">From Date</label>
            <input 
              type="date" 
              className="form-control border-secondary-subtle bg-light text-dark" 
              value={filters.from} 
              onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))} 
            />
          </div>

          {/* Exact To Date */}
          <div className="col-6 col-md-3 col-lg-2">
            <label className="form-label text-muted small fw-bold mb-1">To Date</label>
            <input 
              type="date" 
              className="form-control border-secondary-subtle bg-light text-dark" 
              value={filters.to} 
              onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))} 
            />
          </div>

          {/* Brand Filter */}
          <div className="col-12 col-md-3 col-lg-2">
            <label className="form-label text-muted small fw-bold mb-1">Brand Filter</label>
            <input 
              type="text"
              className="form-control border-secondary-subtle bg-light text-dark fw-bold text-uppercase" 
              placeholder="Type Brand..."
              value={brandSearch} 
              onChange={e => setBrandSearch(e.target.value)}
            />
          </div>

          {/* Shop Selector */}
          {hasFullAccess() && (
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label text-muted small fw-bold mb-1">Shop Branch</label>
              <select 
                className="form-select border-secondary-subtle bg-light text-dark fw-bold" 
                value={filters.shop_id} 
                onChange={e => setFilters(prev => ({ ...prev, shop_id: e.target.value }))}
              >
                <option value="">ALL BRANCHES</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Report Table */}
      <div className="card border-0 bg-white shadow-sm rounded-4 overflow-hidden mb-4">
        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 custom-combined-table">
              <thead className="bg-light text-uppercase">
                <tr className="border-bottom">
                  <th className="py-3 px-4" style={{ width: '40px' }}></th>
                  <th className="py-3 px-2 text-dark fw-bold">Brand Name</th>
                  <th className="py-3 text-center text-primary fw-bold">New Sold</th>
                  <th className="py-3 text-center text-secondary fw-bold">Used Sold</th>
                  <th className="py-3 text-center text-dark fw-bold bg-light-subtle border-start border-end">Total Sold</th>
                  <th className="py-3 text-center text-success fw-bold">New Stock</th>
                  <th className="py-3 text-center text-warning fw-bold">Used Stock</th>
                  <th className="py-3 text-center text-dark fw-bold bg-light-subtle border-start">Total Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(item => {
                  const brandKey = item.brand_id || 'unbranded';
                  const isExpanded = expandedBrands[brandKey];
                  return (
                    <React.Fragment key={brandKey}>
                      <tr 
                        className="cursor-pointer border-bottom"
                        onClick={() => toggleBrand(brandKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="py-3 px-4 text-center text-muted">
                          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                            ▶
                          </span>
                        </td>
                        <td className="py-3 px-2 fw-bold text-dark fs-6">
                          {item.brand_name.toUpperCase()}
                        </td>
                        <td className="py-3 text-center text-primary fw-bold">
                          {item.new_sold}
                        </td>
                        <td className="py-3 text-center text-secondary fw-bold">
                          {item.old_sold}
                        </td>
                        <td className="py-3 text-center fw-black text-dark bg-light-subtle border-start border-end">
                          {item.total_sold}
                        </td>
                        <td className="py-3 text-center text-success fw-bold">
                          {item.new_stock}
                        </td>
                        <td className="py-3 text-center text-warning fw-bold">
                          {item.old_stock}
                        </td>
                        <td className="py-3 text-center fw-black text-dark bg-light-subtle border-start">
                          {item.total_stock}
                        </td>
                      </tr>

                      {/* Expandable Model Detailed Breakdown */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0 bg-light-subtle">
                            <div className="px-5 py-3 border-bottom bg-light">
                              <h6 className="fw-bold mb-3 text-uppercase text-secondary d-flex align-items-center gap-2">
                                <span>📱</span> {item.brand_name.toUpperCase()} Models Breakdown & Inventory status
                              </h6>
                              <div className="table-responsive rounded-3 border border-secondary-subtle">
                                <table className="table table-sm table-hover mb-0 bg-white">
                                  <thead className="table-light text-uppercase">
                                    <tr>
                                      <th className="py-2 px-3">Model/Product Name</th>
                                      <th className="py-2 text-center" style={{ width: '160px' }}>Type</th>
                                      <th className="py-2 text-center" style={{ width: '140px' }}>Units Sold</th>
                                      <th className="py-2 text-center" style={{ width: '140px' }}>Remaining Stock</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.products && item.products.length > 0 ? (
                                      item.products.map(p => (
                                        <tr key={p.product_id}>
                                          <td className="py-2 px-3 fw-semibold text-dark">{p.product_name}</td>
                                          <td className="py-2 text-center">
                                            <span className={`badge px-3 rounded-pill text-uppercase ${p.type === 'Second Hand' ? 'bg-warning-subtle text-warning border border-warning-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'}`}>
                                              {p.type}
                                            </span>
                                          </td>
                                          <td className="py-2 text-center fw-bold text-dark">{p.sold}</td>
                                          <td className="py-2 text-center">
                                            <span className={`fw-bold ${p.stock <= 2 ? 'text-danger' : p.stock <= 5 ? 'text-warning' : 'text-success'}`}>
                                              {p.stock}
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={4} className="text-center py-3 text-muted italic">
                                          No model level records found.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      <div className="fs-1 mb-2">📋</div>
                      No combined mobile sales records found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="table-light fw-bold border-top border-secondary">
                <tr className="text-dark">
                  <td colSpan={2} className="py-3 px-4 text-end fw-black">TOTALS:</td>
                  <td className="py-3 text-center text-primary fw-black fs-5">{totalNewSold}</td>
                  <td className="py-3 text-center text-secondary fw-black fs-5">{totalOldSold}</td>
                  <td className="py-3 text-center text-dark fw-black bg-secondary-subtle border-start border-end fs-4">{grandTotalSold}</td>
                  <td className="py-3 text-center text-success fw-black fs-5">{totalNewStock}</td>
                  <td className="py-3 text-center text-warning fw-black fs-5">{totalOldStock}</td>
                  <td className="py-3 text-center text-dark fw-black bg-secondary-subtle border-start fs-4">{grandTotalStock}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Styled custom table style properties */}
      <style>{`
        .custom-combined-table th {
          border-bottom: 2px solid #cbd5e1 !important;
          font-weight: 700;
        }
        .fw-black {
          font-weight: 900;
        }
        .card-glow {
          transition: all 0.25s ease-in-out;
        }
        .card-glow:hover {
          box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.15) !important;
        }
        .hover-scale {
          transition: transform 0.2s ease-in-out;
        }
        .hover-scale:hover {
          transform: translateY(-2px);
        }
        .text-indigo {
          color: #4f46e5;
        }
        .bg-light-subtle {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  );
}
