import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

export default function SetSalesMatrix() {
  const { hasFullAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState([]);
  
  // Selection mode: 'month' or 'duration'
  const [selectionMode, setSelectionMode] = useState('month');
  
  // Date states
  const currentMonthString = new Date().toISOString().slice(0, 7); // e.g. "2026-06"
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString);
  
  // For custom range
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [fromConfig, setFromConfig] = useState(firstDayStr);
  const [toConfig, setToConfig] = useState(todayStr);

  // Filters
  const [shopId, setShopId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewMode, setViewMode] = useState('count'); // 'count' or 'mop'

  // Report data from server
  const [reportData, setReportData] = useState({
    dates: [],
    products: [],
    grand_total: 0,
    grand_mop_total: 0
  });

  // Load shops for selector (if admin/owner)
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

  useEffect(() => {
    loadShops();
  }, [hasFullAccess]);

  // Load report data
  const loadReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (shopId) {
        params.shop_id = shopId;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      if (selectionMode === 'month') {
        params.month = selectedMonth;
      } else {
        params.from = fromConfig;
        params.to = toConfig;
      }

      const res = await api.get('/reports/set-sales-matrix', { params });
      setReportData(res.data);
    } catch (err) {
      toast.error('Failed to load set sales matrix report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger load on change of date filters, shop selection, or search query (with a small debounce or direct on query change)
  useEffect(() => {
    loadReport();
  }, [selectionMode, selectedMonth, fromConfig, toConfig, shopId, searchQuery]);

  // Format header dates
  const formatHeader = (dateStr) => {
    const d = new Date(dateStr);
    if (selectionMode === 'month') {
      return d.getDate(); // Just return day number 1, 2, 3...
    }
    // Return short date format like "26 Jun"
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  // Calculate day name for tooltip (e.g. Friday)
  const getDayName = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Columns sum calculation (Quantity)
  const getColumnSumQty = (dateStr) => {
    return reportData.products.reduce((sum, p) => sum + (p.sales[dateStr] || 0), 0);
  };

  // Columns sum calculation (MOP Amount)
  const getColumnSumMop = (dateStr) => {
    return reportData.products.reduce((sum, p) => sum + ((p.sales[dateStr] || 0) * (p.mop_price || 0)), 0);
  };

  return (
    <div className="container-fluid py-4 px-4 bg-light min-vh-100">
      
      {/* Premium Gradient Header */}
      <div className="mb-4 p-4 rounded-4 text-white shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-3"
           style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div>
          <h2 className="mb-1 fw-bold text-uppercase d-flex align-items-center gap-2">
            <span>📅</span> Set Sales Matrix
          </h2>
          <p className="mb-0 opacity-80" style={{ fontSize: '0.9rem' }}>
            Daily distribution grid of mobile set sales over months or custom durations.
          </p>
        </div>
        <button 
          onClick={loadReport} 
          className="btn btn-light text-dark fw-bold px-4 py-2 rounded-pill hover-scale shadow-sm text-uppercase"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Report'}
        </button>
      </div>

      {/* Control panel */}
      <div className="card border-0 bg-white shadow-sm rounded-4 p-4 mb-4">
        <div className="row g-3 align-items-end">
          
          {/* Mode Selector */}
          <div className="col-12 col-md-3">
            <label className="form-label text-muted small fw-bold mb-2">Select View Mode</label>
            <div className="btn-group w-100" role="group">
              <button
                type="button"
                className={`btn py-2 fw-semibold btn-sm ${selectionMode === 'month' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setSelectionMode('month')}
              >
                🗓️ Direct Month
              </button>
              <button
                type="button"
                className={`btn py-2 fw-semibold btn-sm ${selectionMode === 'duration' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setSelectionMode('duration')}
              >
                ⏱️ Custom Duration
              </button>
            </div>
          </div>

          {/* Month input (if mode is month) */}
          {selectionMode === 'month' && (
            <div className="col-6 col-md-2">
              <label className="form-label text-muted small fw-bold mb-1">Choose Month</label>
              <input
                type="month"
                className="form-control form-control-sm border-secondary-subtle bg-light text-dark fw-semibold"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ height: '38px' }}
              />
            </div>
          )}

          {/* Custom Duration Date Inputs (if mode is duration) */}
          {selectionMode === 'duration' && (
            <>
              <div className="col-6 col-md-2">
                <label className="form-label text-muted small fw-bold mb-1">From Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm border-secondary-subtle bg-light text-dark fw-semibold"
                  value={fromConfig}
                  onChange={e => setFromConfig(e.target.value)}
                  style={{ height: '38px' }}
                />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label text-muted small fw-bold mb-1">To Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm border-secondary-subtle bg-light text-dark fw-semibold"
                  value={toConfig}
                  onChange={e => setToConfig(e.target.value)}
                  style={{ height: '38px' }}
                />
              </div>
            </>
          )}

          {/* Display Mode Selector */}
          <div className="col-6 col-md-2">
            <label className="form-label text-muted small fw-bold mb-1">Display Mode</label>
            <div className="btn-group w-100" role="group">
              <button
                type="button"
                className={`btn py-2 fw-semibold btn-sm ${viewMode === 'count' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('count')}
              >
                🔢 Units
              </button>
              <button
                type="button"
                className={`btn py-2 fw-semibold btn-sm ${viewMode === 'mop' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('mop')}
              >
                ₹ MOP
              </button>
            </div>
          </div>

          {/* Search Set Filter */}
          <div className="col-12 col-md-3">
            <label className="form-label text-muted small fw-bold mb-1">Search Set Specific</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-secondary-subtle text-muted">🔍</span>
              <input
                type="text"
                className="form-control border-secondary-subtle bg-light text-dark fw-semibold"
                placeholder="Search set name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ height: '38px' }}
              />
            </div>
          </div>

          {/* Shop Selector */}
          {hasFullAccess() && (
            <div className="col-12 col-md-2">
              <label className="form-label text-muted small fw-bold mb-1">Shop Branch</label>
              <select
                className="form-select form-select-sm border-secondary-subtle bg-light text-dark fw-semibold"
                value={shopId}
                onChange={e => setShopId(e.target.value)}
                style={{ height: '38px' }}
              >
                <option value="">ALL BRANCHES</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* Grid Table Container */}
      <div className="card border-0 bg-white shadow-sm rounded-4 overflow-hidden mb-4">
        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5" style={{ minHeight: '300px' }}>
            <div className="spinner-border text-dark" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : reportData.products.length === 0 ? (
          <div className="text-center py-5" style={{ minHeight: '300px' }}>
            <div className="fs-1 mb-2">📦</div>
            <h4 className="fw-semibold text-muted">No Sales Records Found</h4>
            <p className="text-muted small">Try selecting another month, duration, or verify that sets are registered and sold.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxWidth: '100%' }}>
            <table className="table table-hover table-bordered align-middle mb-0" style={{ fontSize: '0.82rem' }}>
              <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th 
                    scope="col" 
                    className="p-3 bg-dark border-dark" 
                    style={{ 
                      minWidth: '220px', 
                      position: 'sticky', 
                      left: 0, 
                      zIndex: 11, 
                      borderRight: '2px solid #444' 
                    }}
                  >
                    💻 Mobile Set Name
                  </th>
                  {reportData.dates.map(dateStr => (
                    <th 
                      key={dateStr} 
                      scope="col" 
                      className="text-center p-2 border-dark"
                      style={{ minWidth: '42px' }}
                      title={getDayName(dateStr)}
                    >
                      {formatHeader(dateStr)}
                    </th>
                  ))}
                  <th 
                    scope="col" 
                    className="text-center p-3 bg-dark border-dark fw-bold" 
                    style={{ minWidth: '85px', borderLeft: '2px solid #444' }}
                  >
                    📊 Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.products.map(product => (
                  <tr key={product.product_id}>
                    <td 
                      className="fw-semibold p-3 bg-white text-dark"
                      style={{ 
                        position: 'sticky', 
                        left: 0, 
                        zIndex: 9, 
                        borderRight: '2px solid #dee2e6', 
                        boxShadow: '2px 0 5px rgba(0,0,0,0.05)'
                      }}
                    >
                      {product.product_name}
                    </td>
                    {reportData.dates.map(dateStr => {
                      const qty = product.sales[dateStr];
                      let displayVal = '';
                      if (qty) {
                        displayVal = viewMode === 'count' 
                          ? qty 
                          : `₹${(qty * product.mop_price).toLocaleString('en-IN')}`;
                      }
                      return (
                        <td 
                          key={dateStr} 
                          className="text-center p-2 fw-bold"
                          style={{ 
                            backgroundColor: qty ? '#f0fdf4' : 'transparent',
                            color: qty ? '#15803d' : 'transparent',
                            fontSize: viewMode === 'mop' ? '0.75rem' : '0.82rem',
                            whiteSpace: 'nowrap'
                          }}
                          title={`${product.product_name}: ${qty || 0} sold on ${getDayName(dateStr)} (MOP: ₹${(product.mop_price || 0).toLocaleString('en-IN')})`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                    <td 
                      className="text-center p-3 fw-bold bg-light"
                      style={{ borderLeft: '2px solid #dee2e6' }}
                    >
                      <div className="d-flex flex-column align-items-center gap-1">
                        <span className="badge bg-dark rounded-pill px-2.5 py-1.5" style={{ fontSize: '0.78rem' }}>
                          {product.total_sold} units
                        </span>
                        <span className="text-success small fw-bold" style={{ fontSize: '0.75rem' }}>
                          ₹{(product.total_mop || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {/* Column Totals Row */}
                <tr className="table-secondary fw-bold">
                  <td 
                    className="p-3" 
                    style={{ 
                      position: 'sticky', 
                      left: 0, 
                      zIndex: 9, 
                      borderRight: '2px solid #dee2e6' 
                    }}
                  >
                    📈 Total Sales
                  </td>
                  {reportData.dates.map(dateStr => {
                    const colSumQty = getColumnSumQty(dateStr);
                    const colSumMop = getColumnSumMop(dateStr);
                    return (
                      <td 
                        key={dateStr} 
                        className="text-center p-2"
                        style={{ fontSize: '0.78rem' }}
                      >
                        {colSumQty > 0 ? (
                          <div className="d-flex flex-column align-items-center">
                            <span className="text-dark">{colSumQty}</span>
                            <span className="text-success small fw-bold">₹{colSumMop.toLocaleString('en-IN')}</span>
                          </div>
                        ) : (
                          <span className="text-muted opacity-50">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td 
                    className="text-center p-3 bg-dark text-white fw-bolder"
                    style={{ borderLeft: '2px solid #dee2e6' }}
                  >
                    <div className="d-flex flex-column align-items-center gap-1">
                      <span className="badge bg-light text-dark rounded-pill px-2 py-1" style={{ fontSize: '0.78rem' }}>
                        {reportData.grand_total} units
                      </span>
                      <span className="fw-bold" style={{ fontSize: '0.78rem', color: '#4ade80' }}>
                        ₹{(reportData.grand_mop_total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick stats indicator */}
      {!loading && reportData.products.length > 0 && (
        <div className="row g-3">
          <div className="col-12 col-sm-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white hover-scale h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-bold text-uppercase">Total Sets Sold</span>
                <span className="fs-4">🛍️</span>
              </div>
              <h2 className="fw-black text-dark mb-0">{reportData.grand_total} units</h2>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white hover-scale h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-bold text-uppercase">Total MOP Value</span>
                <span className="fs-4">💰</span>
              </div>
              <h2 className="fw-black text-success mb-0">₹{(reportData.grand_mop_total || 0).toLocaleString('en-IN')}</h2>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white hover-scale h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-bold text-uppercase">Unique Sets Sold</span>
                <span className="fs-4">📱</span>
              </div>
              <h2 className="fw-black text-dark mb-0">{reportData.products.length} models</h2>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white hover-scale h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-bold text-uppercase">Active Days with Sales</span>
                <span className="fs-4">📅</span>
              </div>
              <h2 className="fw-black text-dark mb-0">
                {reportData.dates.filter(d => getColumnSumQty(d) > 0).length} / {reportData.dates.length} days
              </h2>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
