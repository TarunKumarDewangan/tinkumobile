export default function StockFilters({ filters, handleFilterChange, clearFilters, suppliers, imeiList }) {
  return (
      <div className="pm-filters">
      <div className="row g-2 align-items-end">
        <div className="col-12 col-md-3">
          <span className="pm-flabel">🔍 Search Product / SKU</span>
          <input 
            type="text" 
            className="pm-finput"
            placeholder="TYPE TO SEARCH..." 
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value.toUpperCase())}
          />
        </div>
        <div className="col-6 col-md-2">
          <span className="pm-flabel">👩‍💼 Supplier</span>
          <select 
            className="pm-finput"
            value={filters.supplier_id}
            onChange={e => handleFilterChange('supplier_id', e.target.value)}
          >
            <option value="">ALL SUPPLIERS</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <span className="pm-flabel">📅 From</span>
          <input 
            type="date" 
            className="pm-finput"
            value={filters.from}
            onChange={e => handleFilterChange('from', e.target.value)}
          />
        </div>
        <div className="col-6 col-md-2">
          <span className="pm-flabel">📅 To</span>
          <input 
            type="date" 
            className="pm-finput"
            value={filters.to}
            onChange={e => handleFilterChange('to', e.target.value)}
          />
        </div>
        <div className="col-auto">
           <button className="pm-clear-btn" onClick={clearFilters}>Clear</button>
        </div>
        <div className="col-auto">
           <label style={{display:'flex',alignItems:'center',gap:8,background:'#f1f5f9',padding:'6px 12px',borderRadius:10,cursor:'pointer',border:'1.5px solid #e2e8f0'}}>
              <input 
                type="checkbox" 
                checked={filters.group_by_config}
                onChange={e => handleFilterChange('group_by_config', e.target.checked)}
                style={{accentColor:'#6366f1',width:16,height:16}}
              />
              <span style={{fontSize:'.65rem',fontWeight:800,color:'#475569'}}>GROUP BY CONFIG</span>
           </label>
        </div>
      </div>

      <div className="row g-2 align-items-end mt-2 pt-2 border-top border-light">
         <div className="col-6 col-md-3">
            <span className="pm-flabel">📱 Model / Brand</span>
            <input 
              type="text" 
              className="pm-finput"
              placeholder="E.G. VIVO V70" 
              value={filters.model}
              onChange={e => handleFilterChange('model', e.target.value.toUpperCase())}
            />
         </div>
         <div className="col-6 col-md-2">
            <span className="pm-flabel">🎨 Color</span>
            <input 
              type="text" 
              className="pm-finput"
              placeholder="E.G. BLACK" 
              value={filters.color}
              onChange={e => handleFilterChange('color', e.target.value.toUpperCase())}
            />
         </div>
         <div className="col-6 col-md-2">
            <span className="pm-flabel">🚀 RAM</span>
            <input 
              type="text" 
              className="pm-finput"
              placeholder="E.G. 8GB" 
              value={filters.ram}
              onChange={e => handleFilterChange('ram', e.target.value.toUpperCase())}
            />
         </div>
         <div className="col-6 col-md-2">
            <span className="pm-flabel">💾 Storage</span>
            <input 
              type="text" 
              className="pm-finput"
              placeholder="E.G. 128GB" 
              value={filters.storage}
              onChange={e => handleFilterChange('storage', e.target.value.toUpperCase())}
            />
         </div>
         <div className="col-12 col-md-3">
            <span className="pm-flabel">🆔 IMEI Number</span>
            <input 
              list="stockImeiOptions"
              type="text" 
              className="pm-finput"
              placeholder="E.G. 3546..." 
              value={filters.imei}
              onChange={e => handleFilterChange('imei', e.target.value.toUpperCase())}
            />
            <datalist id="stockImeiOptions">
              {imeiList.map((i, idx) => <option key={idx} value={i} />)}
            </datalist>
         </div>
      </div>
    </div>
  );
}
