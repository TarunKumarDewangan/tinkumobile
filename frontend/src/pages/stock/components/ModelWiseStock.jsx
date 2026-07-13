import React, { useState } from 'react';

export default function ModelWiseStock({ products, loading, filters }) {
  const [showModels, setShowModels] = useState(true);
  const [quickSearch, setQuickSearch] = useState('');

  // Group products by Brand and then by Model + Config
  const groupedData = products.reduce((acc, p) => {
    let brand = (p.brand?.name || p.attributes?.brand || '').trim();
    if (!brand) {
      brand = p.name ? p.name.split(' ')[0] : 'OTHER';
    }
    brand = brand.toUpperCase();

    const modelAttr = (p.attributes?.model || '').trim();
    let model = modelAttr;
    if (!model) {
      model = p.name || 'UNKNOWN';
      if (model.toUpperCase().startsWith(brand)) {
        model = model.substring(brand.length).trim();
      }
    }
    model = model.toUpperCase();
    const ram = p.attributes?.ram || '';
    const storage = p.attributes?.storage || '';
    const config = ram || storage ? `(${ram}${ram && storage ? '/' : ''}${storage})` : '';
    const modelWithConfig = `${model} ${config}`.trim();
    const stock = parseInt(p.current_stock || 0);

    // Apply Quick Search Filter
    const searchMatch = !quickSearch ||
      brand.includes(quickSearch.toUpperCase()) ||
      modelWithConfig.toUpperCase().includes(quickSearch.toUpperCase());

    if (!searchMatch) return acc;

    if (!acc[brand]) acc[brand] = { total: 0, models: {} };
    if (!acc[brand].models[modelWithConfig]) acc[brand].models[modelWithConfig] = { stock: 0, colors: new Set(), imeis: new Set() };

    const group = acc[brand].models[modelWithConfig];
    group.stock += stock;
    acc[brand].total += stock;

    const color = (p.attributes?.color || '').trim();
    if (color) group.colors.add(color.toUpperCase());

    const rawImeis = p.attributes?.imeis || (p.attributes?.imei || p.imei ? [p.attributes?.imei || p.imei] : []);
    rawImeis.filter(Boolean).forEach(imei => group.imeis.add(imei));

    return acc;
  }, {});

  const sortedBrands = Object.keys(groupedData).sort();
  const totalCompanies = sortedBrands.length;
  const totalModels = Object.values(groupedData).reduce((sum, b) => sum + Object.keys(b.models).length, 0);
  const grandTotalStock = Object.values(groupedData).reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="fade-in">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div className="d-flex align-items-center gap-3">
            <div className="text-muted small fw-bold text-uppercase letter-spacing-1">
                📊 Inventory Distribution
            </div>
            <div className="position-relative" style={{ width: '250px' }}>
                <input 
                    type="text" 
                    className="pm-finput" 
                    placeholder="⚡ QUICK FILTER (E.G. MOTO A60)..."
                    value={quickSearch}
                    onChange={e => setQuickSearch(e.target.value)}
                    style={{ background: '#f0f9ff', borderColor: '#bae6fd', fontSize: '.7rem', padding: '6px 12px' }}
                />
                {quickSearch && <span className="position-absolute end-0 top-50 translate-middle-y me-2 cursor-pointer text-muted" onClick={() => setQuickSearch('')} style={{fontSize:'.8rem'}}>✕</span>}
            </div>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:10,background:'#fff',padding:'6px 14px',borderRadius:10,cursor:'pointer',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}>
          <input 
            type="checkbox" 
            checked={showModels}
            onChange={e => setShowModels(e.target.checked)}
            style={{accentColor:'#6366f1',width:16,height:16}}
          />
          <span style={{fontSize:'.7rem',fontWeight:800,color:'#475569',letterSpacing:.5}}>SHOW MODEL DETAILS</span>
        </label>
      </div>

      <div className="pm-table-wrap">
        <div className="table-responsive">
          <table className="pm-table">
            <thead>
              <tr>
                <th className="ps-4" style={{ width: '40%' }}>Company / Brand</th>
                <th style={{ width: '40%' }}>{showModels ? 'Model & Configuration' : ''}</th>
                <th className="text-center" style={{ width: '20%' }}>Total Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
              ) : sortedBrands.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-5 text-muted fw-bold">No stock data available</td></tr>
              ) : (
                <>
                  <tr style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderBottom: '2px solid #e2e8f0' }}>
                    <td className="ps-4 text-uppercase" style={{ fontSize: '.8rem', fontWeight: 800, color: '#475569' }}>
                      📈 SUMMARY: {totalCompanies} COMPANIES
                    </td>
                    <td className="text-uppercase" style={{ fontSize: '.8rem', fontWeight: 800, color: '#475569' }}>
                      {totalModels} TOTAL VARIANTS
                    </td>
                    <td className="text-center">
                      <span className="pm-badge" style={{ background: '#1e293b', color: '#fff', fontSize: '.85rem', padding: '5px 12px' }}>
                        {grandTotalStock} PCS TOTAL
                      </span>
                    </td>
                  </tr>
                  {sortedBrands.map(brand => (
                    <React.Fragment key={brand}>
                  <tr style={{ background: '#f8fafc', borderLeft: '4px solid #6366f1' }}>
                    <td className="ps-4 fw-800 text-primary" style={{ fontSize: '.85rem' }}>
                      🏢 {brand}
                    </td>
                    <td className="text-muted small italic">
                      {showModels ? `${Object.keys(groupedData[brand].models).length} Variants` : ''}
                    </td>
                    <td className="text-center">
                      <span className="pm-badge" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: '800', fontSize: '.75rem' }}>
                        {groupedData[brand].total} PCS
                      </span>
                    </td>
                  </tr>
                  {showModels && Object.keys(groupedData[brand].models).sort().map(modelConfig => {
                    const group = groupedData[brand].models[modelConfig];
                    const colors = Array.from(group.colors);
                    const imeis = Array.from(group.imeis);
                    return (
                    <tr key={brand + modelConfig}>
                      <td className="ps-5"></td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#334155', fontSize: '.78rem' }}>
                          📱 {modelConfig}
                        </div>
                        {(colors.length > 0 || imeis.length > 0) && (
                          <div style={{ marginTop: 3, fontSize: '.68rem', color: '#64748b' }}>
                            {colors.length > 0 && <span>🎨 {colors.join(', ')}</span>}
                            {colors.length > 0 && imeis.length > 0 && <span> · </span>}
                            {imeis.length > 0 && <span className="font-monospace">🆔 {imeis.join(', ')}</span>}
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <span className="pm-badge" style={{
                          background: group.stock > 0 ? '#f0fdf4' : '#fee2e2',
                          color: group.stock > 0 ? '#166534' : '#991b1b',
                          border: `1px solid ${group.stock > 0 ? '#bbf7d0' : '#fecaca'}`,
                          minWidth: '60px',
                          fontSize: '.7rem'
                        }}>
                          {group.stock} PCS
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              </>
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
