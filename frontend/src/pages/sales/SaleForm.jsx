import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import debounce from 'lodash/debounce';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

// Simple UUID v4 generator for idempotency
function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Numerically solves for the monthly reducing-balance rate r that makes
// P*r*(1+r)^n/((1+r)^n-1) == emi. No closed form exists for r, so this
// bisects — emi is strictly increasing in r for r >= 0, so it converges
// reliably. Returns the rate annualized as a percentage. This is a live
// preview only; the backend re-derives the authoritative rate the same way
// when a total-payable figure is submitted instead of a rate.
function solveReducingRate(principal, emi, months) {
  if (!principal || !months || emi <= principal / months) return 0;
  let lo = 0, hi = 5; // 500%/month upper bound — comfortably above any real input
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const calcEmi = mid === 0
      ? principal / months
      : principal * mid * Math.pow(1 + mid, months) / (Math.pow(1 + mid, months) - 1);
    if (calcEmi < emi) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

export default function SaleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOwner, hasFullAccess } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(null);
  
  // Generate idempotency key once on mount
  if (!idempotencyKey.current) {
    idempotencyKey.current = generateIdempotencyKey();
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isOldMobileSale = location.pathname.includes('/old-mobiles');
  const category_group = searchParams.get('category_group') || (isOldMobileSale ? 'old_mobile' : 'new_mobile');

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops]       = useState([]);
  const [staff, setStaff]       = useState([]);

  const shouldDefaultGstOn = (product) => {
    if (category_group === 'other') return false;
    if (!product) return true;
    const slug = (product.category?.slug || product.category?.name || '').toLowerCase();
    return ['mobile-new', 'mobile-old'].includes(slug);
  };

  const [form, setForm] = useState({ 
    shop_id: '',
    customer_id: '', 
    sold_by_id: '',
    sale_date: new Date().toISOString().slice(0,10), 
    bill_type: 'pakka', 
    payment_method: 'CASH',
    other_mode: '',
    discount: 0,
    total_paid: 0,
    exchange_paid: 0,
    cgst_rate: 9,
    sgst_rate: 9,
    calculate_gst: true,
    cash_discount: 0,
    is_cash_discount_on_bill: true,
    rounding_mode: 'auto',
    round_off: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    is_gst_manual: false,
    notes: '',
    // Finance / EMI
    financer_id: '',
    down_payment: 0,
    finance_amount: 0,
    finance_payment_status: 'RECEIVED',
  });
  const [items, setItems] = useState([]);
  
  // Exchange credit state
  const [customerCredit, setCustomerCredit] = useState(0);
  
  // External Finance / EMI (Bajaj, HDB, etc.)
  const [useFinance, setUseFinance] = useState(false);
  const [financers, setFinancers] = useState([]);
  const [showFinancerModal, setShowFinancerModal] = useState(false);
  const [newFinancer, setNewFinancer] = useState({ name: '', phone: '', gst_number: '', description: '' });

  // Shop Finance (Personal EMI / Favor)
  const [useShopFinance, setUseShopFinance] = useState(false);
  const [shopFinanceType, setShopFinanceType] = useState('PERSONAL');
  const [shopFinance, setShopFinance] = useState({
    down_payment: 0, principal: 0, interest_rate: 0, interest_type: 'FLAT',
    total_payable: 0, tenure_months: 12, emi_start_date: '',
  });
  // Whether the Interest % field or the Total Payable field is the one the
  // user is actively driving — the other one auto-fills from it.
  const [emiInputMode, setEmiInputMode] = useState('RATE'); // 'RATE' | 'TOTAL'
  
  // Internal state to track if round_off is manually overridden
  const [isManualRound, setIsManualRound] = useState(false);
  const [isManualGst, setIsManualGst] = useState(false);

  // Customer Search & Add
  const [customerInputText, setCustomerInputText] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useMemo(
    () => debounce((val) => setCustomerSearch(val), 350),
    []
  );
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [priceMode, setPriceMode] = useState('RETAIL');
  const [showCustModal, setShowCustModal] = useState(false);
  const [newEntity, setNewEntity] = useState({
    name: '',
    type: 'CUSTOMER',
    phone: '',
    email: '',
    gst_number: '',
    opening_balance: 0,
    balance_type: 'RECEIVABLE',
    description: '',
    voucher_code: '',
    events: []
  });
  const [customTypes, setCustomTypes] = useState([]);
  const [entitySubmitting, setEntitySubmitting] = useState(false);
  // IMEI Scan Search
  const [scanProductId, setScanProductId] = useState('');
  const [imeiScanner, setImeiScanner] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const imeiInputRef = useRef(null);
  const productSearchRef = useRef(null);

  // Fetch financers list from entities with type=FINANCER
  const fetchFinancers = async () => {
    try {
      const res = await api.get('/entities', { params: { type: 'FINANCER' } });
      setFinancers(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchInitialData();
    fetchFinancers();
    if (id) loadSale();
    
    const clickOutside = (e) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target)) {
        setShowProductList(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const custRes = await api.get('/customers');
      setCustomers(custRes.data);
      
      const staffRes = await api.get('/users');
      setStaff(staffRes.data);
      
      const entRes = await api.get('/entities').catch(() => ({ data: [] }));
      const types = (entRes.data || []).map(e => e.type).filter(Boolean);
      const uniqueCustomTypes = Array.from(new Set(types)).filter(
        t => !['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'OTHER'].includes(t)
      );
      setCustomTypes(uniqueCustomTypes);
      
      if (hasFullAccess()) {
        const shopsRes = await api.get('/shops');
        setShops(shopsRes.data);
        if (!id && shopsRes.data.length > 0) {
            setForm(prev => ({ ...prev, shop_id: shopsRes.data[0].id }));
            loadProducts(shopsRes.data[0].id);
        }
      } else {
        setForm(prev => ({ ...prev, shop_id: user.shop_id }));
        loadProducts(user.shop_id);
      }
    } catch (e) { toast.error('Error loading data'); }
  };

  useEffect(() => {
    const imei = searchParams.get('imei');
    const productIdParam = searchParams.get('product_id');
    
    if (imei && products.length > 0) {
      handleImeiPreFill(imei);
    } else if (productIdParam && products.length > 0 && items.length === 0) {
      const p = products.find(prod => 
        (prod.product_id && prod.product_id.toString() === productIdParam) ||
        (prod.id && prod.id.toString() === productIdParam)
      );
      if (p) {
        setItems([{
          selection_id: p.id,
          product_id: p.product_id || p.id,
          product_name: p.name || '',
          brand_name: (p.brand?.name || p.attributes?.brand || '').trim(),
          imei: p.imei || p.attributes?.imei || '',
          imeis: [p.imei || p.attributes?.imei || ''],
          ram: p.attributes?.ram || '',
          storage: p.attributes?.storage || '',
          color: p.attributes?.color || '',
          description: p.attributes?.description || '',
          quantity: 1,
          unit_price: p.selling_price || 0,
          base_price: p.purchase_price || 0,
          min_selling_price: p.min_selling_price || 0,
          max_selling_price: p.max_selling_price || 0
        }]);
        const newParams = {};
        if (category_group) {
          newParams.category_group = category_group;
        } else {
          newParams.category = 'mobile-old';
        }
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [products]);

  const handleImeiPreFill = async (imei) => {
    try {
      const { data } = await api.get(`/products?imei=${imei}&group_by_config=false`);
      if (data && data.length > 0) {
        const p = data[0];
        // Find best matching product variation in frontend products list
        let matchedProduct = products.find(px => 
          px.name.toUpperCase() === p.name.toUpperCase() &&
          String(px.attributes?.ram || '') === String(p.attributes?.ram || '') &&
          String(px.attributes?.storage || '') === String(p.attributes?.storage || '') &&
          String(px.attributes?.color || '').toUpperCase() === String(p.attributes?.color || '').toUpperCase()
        );
        
        const selId = matchedProduct ? matchedProduct.id : (p.product_id || p.id);
        const prodId = matchedProduct ? (matchedProduct.product_id || matchedProduct.id) : (p.product_id || p.id);

        setItems([{
          selection_id: selId,
          product_id: prodId,
          product_name: p.name || '',
          brand_name: (p.brand?.name || p.attributes?.brand || '').trim(),
          imei: p.imei || p.attributes?.imei || imei,
          imeis: [p.imei || p.attributes?.imei || imei],
          ram: p.attributes?.ram || '',
          storage: p.attributes?.storage || '',
          color: p.attributes?.color || '',
          description: p.attributes?.description || '',
          quantity: 1,
          unit_price: p.selling_price,
          base_price: p.purchase_price || 0,
          min_selling_price: p.min_selling_price || 0,
          max_selling_price: p.max_selling_price || 0
        }]);
      }
    } catch (e) {}
  };

  const loadSale = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/sale-invoices/${id}`);
      setForm({
        shop_id: data.shop_id,
        customer_id: data.customer_id,
        sale_date: data.sale_date,
        bill_type: data.bill_type,
        payment_method: data.payment_method,
        other_mode: data.other_mode || '',
        discount: data.discount,
        total_paid: data.total_paid,
        exchange_paid: data.exchange_paid || 0,
        cgst_rate: data.cgst_rate || 9,
        sgst_rate: data.sgst_rate || 9,
        calculate_gst: data.calculate_gst ?? true,
        cash_discount: data.cash_discount || 0,
        is_cash_discount_on_bill: data.is_cash_discount_on_bill ?? true,
        rounding_mode: data.rounding_mode,
        round_off: data.round_off || 0,
        cgst_amount: data.cgst_amount || 0,
        sgst_amount: data.sgst_amount || 0,
        is_gst_manual: data.is_gst_manual ?? false,
        notes: data.notes || '',
        sold_by_id: data.sold_by_id || '',
        // Finance / EMI
        financer_id: data.financer_id || '',
        down_payment: data.down_payment || 0,
        finance_amount: data.finance_amount || 0,
        finance_payment_status: data.finance_payment_status || 'RECEIVED',
      });
      if (data.finance_amount > 0) {
        setUseFinance(true);
      }
      if (data.rounding_mode === 'manual') setIsManualRound(true);
      if (data.is_gst_manual) setIsManualGst(true);
      setItems(data.items?.map(i => {
        const itemQty = i.quantity || 1;
        const itemImeis = i.imeis || Array(itemQty).fill('').map((_, idx) => idx === 0 ? (i.imei || '') : '');
        return {
          selection_id: i.product_id,
          product_id: i.product_id,
          product_name: i.product?.name || '',
          brand_name: (i.product?.brand?.name || i.product?.attributes?.brand || '').trim(),
          imei: i.imei || '',
          imeis: itemImeis,
          ram: i.ram || '',
          storage: i.storage || '',
          color: i.color || '',
          description: i.description || '',
          quantity: itemQty,
          unit_price: i.unit_price,
          apply_gst: i.apply_gst ?? shouldDefaultGstOn(i.product),
          base_price: i.product?.purchase_price || 0,
          min_selling_price: i.product?.min_selling_price || 0,
          max_selling_price: i.product?.max_selling_price || 0
        };
      }));
      setCustomerSearch(data.customer?.name || '');
      setCustomerInputText(data.customer?.name || '');
      setSelectedCustomer(data.customer || null);
      if (data.customer) {
        const params = new URLSearchParams({ customer_id: data.customer.id });
        if (id) params.set('exclude_sale_invoice_id', id);
        api.get(`/entities/customer-ledger?${params}`)
          .then(res => {
            const bal = parseFloat(res.data.entity?.net_balance || 0);
            const initialCreditUsed = parseFloat(data.exchange_paid || 0);
            if (bal < 0) {
              setCustomerCredit(Math.abs(bal));
            } else {
              setCustomerCredit(initialCreditUsed);
            }
          })
          .catch(() => {});
      }
      if (data.customer?.category === 'SHOP') setPriceMode('WHOLESALE');
      loadProducts(data.shop_id);
    } catch (e) { toast.error('Error loading sale'); }
    finally { setLoading(false); }
  };

  const loadProducts = async (shopId) => {
    if (!shopId) return;
    try {
      const params = { shop_id: shopId, category_group };
      
      if (category_group === 'new_mobile') {
        params.group_by_config = 'false';
      }
      
      if (category_group === 'old_mobile') {
        // Old mobile exchange purchases go into Product+Inventory directly (not PurchaseItem).
        // Use the standard product list endpoint (no group_by_config) which reads from products table.
        const { data } = await api.get('/products', { params });
        const productsData = data.data || data;

        // Map to sale-form item format — filter out items with 0 stock
        const mapped = productsData
          .filter(p => (p.stock ?? 0) > 0) // Only show products with available stock
          .map(p => ({
            id: `item_${p.id}_0`,
            product_id: p.id,
            name: p.name,
            imei: p.imei,
            attributes: p.attributes || {},
            current_stock: p.stock ?? 0,
            selling_price: p.selling_price,
            wholeseller_price: p.wholeseller_price,
            purchase_price: p.purchase_price,
            min_selling_price: p.min_selling_price,
            max_selling_price: p.max_selling_price,
            category: p.category
          }));
        setProducts(mapped);
      } else {
        const { data } = await api.get('/products', { params });
        setProducts(data);
      }
    } catch (e) { toast.error('Error loading products'); }
  };

  const fetchScannedProduct = async (val, shopId, prodId) => {
    try {
      const params = { imei: val, group_by_config: 'false', shop_id: shopId };
      if (prodId) params.product_id = prodId;
      
      const { data } = await api.get('/products', { params });
      if (data && data.length > 0) {
          setScanResult(data[0]);
      } else { setScanResult(null); }
    } catch (e) { setScanResult(null); }
  };

  const debouncedImeiSearch = useMemo(
    () => debounce((val, shopId, prodId) => fetchScannedProduct(val, shopId, prodId), 400),
    []
  );

  const handleImeiScan = async (val) => {
    setImeiScanner(val);
    if (val.length >= 4) { // Faster search threshold
        debouncedImeiSearch(val, form.shop_id, scanProductId);
    } else { 
        debouncedImeiSearch.cancel();
        setScanResult(null); 
    }
  };
  const addScannedItem = (existing = null) => {
    const p = existing || scanResult;
    if (!p) return;

    // Find best matching product variation in frontend products list
    let matchedProduct = products.find(px => 
      px.name.toUpperCase() === p.name.toUpperCase() &&
      String(px.attributes?.ram || '') === String(p.attributes?.ram || '') &&
      String(px.attributes?.storage || '') === String(p.attributes?.storage || '') &&
      String(px.attributes?.color || '').toUpperCase() === String(p.attributes?.color || '').toUpperCase()
    );
    
    const selId = matchedProduct ? matchedProduct.id : (p.product_id || p.id);
    const prodId = matchedProduct ? (matchedProduct.product_id || matchedProduct.id) : (p.product_id || p.id);

    const firstImei = p.imei || p.attributes?.imei || p.attributes?.imeis?.[0] || '';
    const allImeis = p.attributes?.imeis?.filter(Boolean).length
      ? [...p.attributes.imeis.filter(Boolean)]
      : [firstImei];
    const newItem = {
        selection_id: selId,
        product_id: prodId,
        product_name: p.name || '',
        brand_name: (p.brand?.name || p.attributes?.brand || '').trim(),
        imei: firstImei,
        imeis: allImeis,
        ram: p.attributes?.ram || '',
        storage: p.attributes?.storage || '',
        color: p.attributes?.color || '',
        description: p.attributes?.description || '',
        quantity: 1,
        unit_price: (priceMode === 'WHOLESALE' && p.wholeseller_price > 0) ? p.wholeseller_price : (p.selling_price || 0),
        base_price: p.purchase_price || 0,
        min_selling_price: p.min_selling_price || 0,
        max_selling_price: p.max_selling_price || 0,
        apply_gst: shouldDefaultGstOn(p)
    };
    if (!items.find(it => it.imei && it.imei === newItem.imei)) {
       setItems([...items, newItem]);
    } else {
        toast.info(newItem.imei ? 'IMEI already in list' : 'Item already in list');
    }
    setImeiScanner('');
    setScanResult(null);
    toast.success('✅ Item added');
  };

  const handleScanAction = async () => {
    if (scanResult) {
        addScannedItem();
    } else if (imeiScanner.length >= 4) {
        // Immediate search if Enter pressed before auto-search finished
        try {
            const params = { imei: imeiScanner, group_by_config: 'false', shop_id: form.shop_id };
            if (scanProductId) params.product_id = scanProductId;
            const { data } = await api.get('/products', { params });
            if (data && data.length > 0) {
                addScannedItem(data[0]);
            } else {
                toast.error('No item found with this IMEI');
            }
        } catch (e) {}
    }
  };
  const addItem = () => setItems([...items, { selection_id: '', product_id: '', product_name: '', imei: '', imeis: [''], ram: '', storage: '', color: '', description: '', quantity: 1, unit_price: '', base_price: 0, min_selling_price: 0, max_selling_price: 0, apply_gst: category_group !== 'other' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const getMatchingStockItems = (item, excludeImeiIdx) => {
    if (!item.product_name) return [];
    return products.filter(p => {
      const nameMatches = p.name && item.product_name && p.name.toUpperCase() === item.product_name.toUpperCase();
      const idMatches = p.product_id && item.product_id && p.product_id == item.product_id;
      if (!nameMatches && !idMatches) return false;
      
      const ramMatches = !item.ram || (p.attributes?.ram && p.attributes.ram.toUpperCase() === item.ram.toUpperCase());
      const storageMatches = !item.storage || (p.attributes?.storage && p.attributes.storage.toUpperCase() === item.storage.toUpperCase());
      const colorMatches = !item.color || (p.attributes?.color && p.attributes.color.toUpperCase() === item.color.toUpperCase());
      
      const imeiVal = p.imei || p.attributes?.imei;
      if (!imeiVal) return false;
      
      // Exclude if this IMEI is already selected elsewhere in the form
      const isAlreadySelected = items.some((it, itIdx) => {
        const itImeis = it.imeis || [it.imei];
        return itImeis.some((im, imIdx) => {
          // Don't exclude if it's the current input slot we are filtering for
          if (itIdx === items.indexOf(item) && imIdx === excludeImeiIdx) return false;
          return im === imeiVal;
        });
      });
      
      return ramMatches && storageMatches && colorMatches && !isAlreadySelected;
    });
  };

  const updateItemImei = (itemIdx, imeiIdx, val) => {
    const arr = [...items];
    if (!arr[itemIdx].imeis) {
      arr[itemIdx].imeis = Array(arr[itemIdx].quantity || 1).fill('').map((_, idx) => idx === 0 ? (arr[itemIdx].imei || '') : '');
    }
    arr[itemIdx].imeis[imeiIdx] = val;
    if (imeiIdx === 0) {
      arr[itemIdx].imei = val;
    }
    setItems(arr);
  };
  
  const updateItem = (i, field, val) => {
    const arr = [...items];
    arr[i][field] = val;
    
    // If it's the product selection field (can be ID or Name from datalist)
    if (field === 'product_id' || field === 'selection_id') {
      // Find product by ID or by generated Name string
      const p = products.find(p => 
        p.id == val || 
        getProductOptionLabel(p).toUpperCase() === val.toUpperCase()
      );

      if (p) {
          arr[i].selection_id = p.id;
          arr[i].product_id = p.product_id || p.id;
          arr[i].product_name = p.name || '';
          arr[i].brand_name = (p.brand?.name || p.attributes?.brand || '').trim();
          arr[i].unit_price = (priceMode === 'WHOLESALE' && p.wholeseller_price > 0) ? p.wholeseller_price : (p.selling_price || 0);
          arr[i].base_price = p.purchase_price || 0;
          arr[i].min_selling_price = p.min_selling_price || 0,
          arr[i].max_selling_price = p.max_selling_price || 0;
          arr[i].apply_gst = shouldDefaultGstOn(p);
          if (p.attributes) {
              arr[i].ram = p.attributes.ram || '';
              arr[i].storage = p.attributes.storage || '';
              arr[i].color = p.attributes.color || '';
              arr[i].description = p.attributes.description || '';
              const fi = p.imei || p.attributes.imei || p.attributes.imeis?.[0] || '';
              arr[i].imei = fi;
              arr[i].imeis = p.attributes.imeis?.filter(Boolean).length ? [...p.attributes.imeis.filter(Boolean)] : [fi];
          }
      } else {
          arr[i].product_id = '';
          arr[i].product_name = '';
      }
    }
    if (field === 'quantity') {
      const qty = parseInt(val) || 1;
      if (category_group !== 'other') {
        const currentImeis = arr[i].imeis || [arr[i].imei || ''];
        const newImeis = [...currentImeis];
        if (newImeis.length < qty) {
          while (newImeis.length < qty) {
            newImeis.push('');
          }
        } else if (newImeis.length > qty) {
          newImeis.splice(qty);
        }
        arr[i].imeis = newImeis;
      }
    }
    if (field === 'imei') {
      if (!arr[i].imeis) arr[i].imeis = [];
      arr[i].imeis[0] = val;
    }
    setItems(arr);
  };

  // Calculations
  const totalInclusive = items.reduce((s, i) => s + (i.quantity * i.unit_price || 0), 0);
  const taxableInclusive = items.filter(i => i.apply_gst !== false).reduce((s, i) => s + (i.quantity * i.unit_price || 0), 0);

  let subtotal = totalInclusive;
  let autoCgstAmount = 0;
  let autoSgstAmount = 0;

  if (form.calculate_gst) {
      const cgstR = parseFloat(form.cgst_rate) || 0;
      const sgstR = parseFloat(form.sgst_rate) || 0;
      const totalGstRate = cgstR + sgstR;
      
      const calcTaxableSubtotal = taxableInclusive / (1 + (totalGstRate / 100));
      const totalGstAmount = taxableInclusive - calcTaxableSubtotal;
      
      if (totalGstRate > 0) {
         // Round taxes to 2 decimals
         autoCgstAmount = Math.round(totalGstAmount * (cgstR / totalGstRate) * 100) / 100;
         autoSgstAmount = Math.round(totalGstAmount * (sgstR / totalGstRate) * 100) / 100;
      }
  }

  const cgstAmount = isManualGst ? (parseFloat(form.cgst_amount) || 0) : autoCgstAmount;
  const sgstAmount = isManualGst ? (parseFloat(form.sgst_amount) || 0) : autoSgstAmount;
  subtotal = Math.round((totalInclusive - cgstAmount - sgstAmount) * 100) / 100;

  const rawTotal = subtotal + cgstAmount + sgstAmount - (parseFloat(form.discount) || 0) - (form.is_cash_discount_on_bill ? (parseFloat(form.cash_discount) || 0) : 0);
  
  // Rounding Logic
  useEffect(() => {
    if (!isManualRound) {
        let roundedValue = Math.round(rawTotal);
        if (form.rounding_mode === 'up') roundedValue = Math.ceil(rawTotal);
        else if (form.rounding_mode === 'down') roundedValue = Math.floor(rawTotal);
        
        const diff = roundedValue - rawTotal;
        setForm(f => ({ ...f, round_off: parseFloat(diff.toFixed(2)) }));
    }
  }, [rawTotal, form.rounding_mode, isManualRound]);

  const grandTotal = rawTotal + (parseFloat(form.round_off) || 0);

  // Shop Finance EMI calculator — supports both input directions (rate ->
  // total, or total -> implied rate) and both interest models (flat simple
  // interest vs reducing-balance amortization). This is a live preview only;
  // the backend recomputes the authoritative figures the same way on submit.
  const shopFinanceCalc = useMemo(() => {
    const p = parseFloat(shopFinance.principal) || 0;
    const n = parseInt(shopFinance.tenure_months) || 0;
    const type = shopFinance.interest_type || 'FLAT';
    const empty = { monthlyEmi: 0, totalPayable: p, impliedRate: 0 };

    if (!p || !n || shopFinanceType !== 'PERSONAL') return empty;

    if (emiInputMode === 'TOTAL') {
      const targetTotal = parseFloat(shopFinance.total_payable) || 0;
      if (targetTotal <= p) return { monthlyEmi: parseFloat((p / n).toFixed(2)), totalPayable: p, impliedRate: 0 };

      const emi = parseFloat((targetTotal / n).toFixed(2));
      const impliedRate = type === 'FLAT'
        ? ((targetTotal - p) * 12) / (p * n) * 100
        : solveReducingRate(p, emi, n);

      return { monthlyEmi: emi, totalPayable: parseFloat(targetTotal.toFixed(2)), impliedRate: parseFloat(impliedRate.toFixed(4)) };
    }

    // RATE mode (default)
    const r = parseFloat(shopFinance.interest_rate) || 0;
    if (!r) return { monthlyEmi: parseFloat((p / n).toFixed(2)), totalPayable: p, impliedRate: 0 };

    if (type === 'FLAT') {
      const interest = p * (r / 100) * (n / 12);
      const totalPayable = parseFloat((p + interest).toFixed(2));
      return { monthlyEmi: parseFloat((totalPayable / n).toFixed(2)), totalPayable, impliedRate: r };
    }

    const rate = r / 12 / 100;
    const emi  = p * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1);
    return { monthlyEmi: parseFloat(emi.toFixed(2)), totalPayable: parseFloat((emi * n).toFixed(2)), impliedRate: r };
  }, [shopFinance.principal, shopFinance.interest_rate, shopFinance.interest_type, shopFinance.total_payable, shopFinance.tenure_months, shopFinanceType, emiInputMode]);

  // Auto-calculate exchange payment split when grand total or credit changes
  useEffect(() => {
    if (form.payment_method === 'EXCHANGE') {
      setForm(prev => ({
        ...prev,
        exchange_paid: Math.min(grandTotal, customerCredit),
        total_paid: 0
      }));
    } else if (form.payment_method === 'EXCHANGE + CASH') {
      const exchangePaid = Math.min(grandTotal, customerCredit);
      setForm(prev => ({
        ...prev,
        exchange_paid: exchangePaid,
        total_paid: Math.max(0, grandTotal - exchangePaid)
      }));
    } else if (form.payment_method === 'EXCHANGE + UPI') {
      const exchangePaid = Math.min(grandTotal, customerCredit);
      setForm(prev => ({
        ...prev,
        exchange_paid: exchangePaid,
        total_paid: Math.max(0, grandTotal - exchangePaid)
      }));
    }
  }, [grandTotal, customerCredit, form.payment_method]);

  const totalProfit = items.reduce((s, item) => {
    const itemGstRate = item.apply_gst !== false ? (form.calculate_gst ? (parseFloat(form.cgst_rate || 0) + parseFloat(form.sgst_rate || 0)) : 0) : 0;
    const rateExcl = item.unit_price / (1 + (itemGstRate / 100));
    return s + ((rateExcl - item.base_price) * item.quantity || 0);
  }, 0) - (parseFloat(form.discount) || 0) - (form.is_cash_discount_on_bill ? (parseFloat(form.cash_discount) || 0) : 0);
  const profitColor = totalProfit > 0 ? 'text-success' : 'text-danger';

  const handleRoundClick = (type) => {
    setForm(prev => ({ ...prev, rounding_mode: type }));
    setIsManualRound(false);
  };

  // Customer Handling
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const handleSelectCustomer = (c) => {
    setForm({ ...form, customer_id: c.id });
    setCustomerSearch(c.name);
    setCustomerInputText(c.name);
    setSelectedCustomer(c);
    setPriceMode(c.category === 'SHOP' ? 'WHOLESALE' : 'RETAIL');
    if (c.id) {
      const params = new URLSearchParams({ customer_id: c.id });
      if (id) params.set('exclude_sale_invoice_id', id);
      api.get(`/entities/customer-ledger?${params}`)
        .then(res => {
          const bal = parseFloat(res.data.entity?.net_balance || 0);
          if (bal < 0) {
            setCustomerCredit(Math.abs(bal));
          } else {
            setCustomerCredit(0);
          }
        })
        .catch(() => setCustomerCredit(0));
    } else {
      setCustomerCredit(0);
    }
  };

  const handlePaymentMethodChange = (method) => {
    let exchangePaid = form.exchange_paid;
    let totalPaid = form.total_paid;
    let otherMode = form.other_mode;

    if (method === 'EXCHANGE') {
      exchangePaid = Math.min(grandTotal, customerCredit);
      totalPaid = 0;
    } else if (method === 'EXCHANGE + CASH') {
      exchangePaid = Math.min(grandTotal, customerCredit);
      totalPaid = Math.max(0, grandTotal - exchangePaid);
    } else if (method === 'EXCHANGE + UPI') {
      exchangePaid = Math.min(grandTotal, customerCredit);
      totalPaid = Math.max(0, grandTotal - exchangePaid);
      otherMode = 'PHONEPE';
    } else {
      exchangePaid = 0;
      totalPaid = grandTotal;
    }

    setForm(prev => ({
      ...prev,
      payment_method: method,
      exchange_paid: exchangePaid,
      total_paid: totalPaid,
      other_mode: otherMode
    }));
  };

  const handlePriceModeToggle = (mode) => {
      setPriceMode(mode);
      setItems(prevItems => prevItems.map(it => {
          if (!it.selection_id) return it;
          const p = products.find(px => px.id == it.selection_id);
          if (!p) return it;
          const newPrice = (mode === 'WHOLESALE' && p.wholeseller_price > 0) ? p.wholeseller_price : (p.selling_price || 0);
          return { ...it, unit_price: newPrice };
      }));
      toast.info(`🏷️ Switched to ${mode} pricing mode`);
  };

  const handleQuickEntityAdd = async (e) => {
    e.preventDefault();
    if (entitySubmitting) return;
    setEntitySubmitting(true);
    try {
      const { data } = await api.post('/entities', newEntity);
      toast.success('✅ Entity added successfully!');
      
      if (data.relation_type === 'App\\Models\\Customer' || data.type === 'CUSTOMER' || data.type === 'SHOP_CUSTOMER') {
        const newCustomerObj = {
          id: data.relation_id,
          name: data.name,
          phone: data.phone || '',
          email: data.email || '',
          gst_no: data.gst_number || '',
          address: data.description || '',
          category: data.type === 'SHOP_CUSTOMER' ? 'SHOP' : 'REGULAR',
          voucher_code: data.voucher_code || '',
          events: data.events || []
        };
        setCustomers(prev => [...prev, newCustomerObj]);
        handleSelectCustomer(newCustomerObj);
      } else {
        toast.info('Entity created successfully, but since it is not a customer, it cannot be selected for this sale.');
      }
      
      setShowCustModal(false);
      setNewEntity({
        name: '',
        type: 'CUSTOMER',
        phone: '',
        email: '',
        gst_number: '',
        opening_balance: 0,
        balance_type: 'RECEIVABLE',
        description: '',
        voucher_code: '',
        events: []
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add entity');
    } finally {
      setEntitySubmitting(false);
    }
  };

  const addCustEvent = () => setNewEntity({ ...newEntity, events: [...(newEntity.events || []), { type: '', name: '', date: '' }] });
  const removeCustEvent = (i) => setNewEntity({ ...newEntity, events: newEntity.events.filter((_, idx) => idx !== i) });
  const updateCustEvent = (i, field, val) => {
    const evs = [...newEntity.events];
    evs[i][field] = val;
    setNewEntity({ ...newEntity, events: evs });
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      if (e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
        e.preventDefault();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.warning('Please select a customer');
    if (submitting) return; // Prevent double-submit
    setSubmitting(true);
    
    setLoading(true);
    try {
      const finalItems = [];
      items.forEach(item => {
        if (category_group !== 'other' && item.quantity > 1) {
          const qty = item.quantity;
          const imeis = item.imeis || [item.imei || ''];
          for (let k = 0; k < qty; k++) {
            finalItems.push({
              ...item,
              quantity: 1,
              imei: imeis[k] || '',
            });
          }
        } else {
          finalItems.push(item);
        }
      });

      let finalForm = {
        ...form,
        idempotency_key: idempotencyKey.current,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        round_off: parseFloat(form.round_off) || 0,
        is_gst_manual: isManualGst,
        items: finalItems
      };
      if (form.payment_method === 'OTHER' && form.other_mode) {
          finalForm.payment_method = form.other_mode;
      }

      // Attach shop finance plan data if enabled (new sale only)
      if (!id && useShopFinance && shopFinance.principal > 0) {
          finalForm.shop_finance = {
              type:           shopFinanceType,
              down_payment:   shopFinance.down_payment,
              principal:      shopFinance.principal,
              interest_type:  shopFinanceType === 'PERSONAL' ? shopFinance.interest_type : null,
              // Only send the field the user actually drove — the backend
              // derives the other one (and the authoritative EMI) from it.
              interest_rate:  shopFinanceType === 'PERSONAL' && emiInputMode === 'RATE' ? (shopFinance.interest_rate || 0) : null,
              total_payable:  shopFinanceType === 'PERSONAL' && emiInputMode === 'TOTAL' ? (shopFinance.total_payable || 0) : null,
              tenure_months:  shopFinanceType === 'PERSONAL' ? (shopFinance.tenure_months || null) : null,
              emi_start_date: shopFinanceType === 'PERSONAL' ? (shopFinance.emi_start_date || null) : null,
          };
      }

      if (id) {
        await api.put(`/sale-invoices/${id}`, finalForm);
        toast.success('✅ Sale updated successfully');
      } else {
        await api.post('/sale-invoices', finalForm);
        toast.success('✅ Sale recorded successfully');
      }
      if (category_group === 'other') {
        navigate('/sales?category_group=other');
      } else {
        navigate(isOldMobileSale ? '/old-mobiles/sales' : '/sales');
      }
    } catch (e) { 
        toast.error(e.response?.data?.message || 'Error saving sale'); 
    } finally {
        setLoading(false);
        setSubmitting(false);
    }
  };

  const getProductFullName = (p) => {
    const brandName = (p.brand?.name || p.attributes?.brand || '').trim().toUpperCase();
    const prodName = (p.name || '').trim().toUpperCase();
    return brandName ? `${brandName} ${prodName}` : prodName;
  };

  const getProductOptionLabel = (p) => {
    const parts = [];
    if (p.attributes?.ram) parts.push(p.attributes.ram);
    if (p.attributes?.storage) parts.push(p.attributes.storage);
    if (p.attributes?.color) parts.push(p.attributes.color);
    const attrs = parts.length > 0 ? ` (${parts.join('/')})` : '';
    const imeiVal = p.imei || p.attributes?.imei || p.attributes?.imeis?.[0];
    const imeiStr = imeiVal ? ` / IMEI: ${imeiVal}` : '';
    return `${getProductFullName(p)}${attrs}${imeiStr}`;
  };
  const getProductDisplayName = (item) => {
    let found = products.find(px => px.id == item.selection_id);
    if (!found && item.product_id) {
      found = products.find(px => px.id == item.product_id || px.product_id == item.product_id);
    }
    
    if (!found && item.product_name) {
      found = products.find(px => 
        px.name?.toUpperCase() === item.product_name?.toUpperCase() &&
        String(px.attributes?.ram || '') === String(item.ram || '') &&
        String(px.attributes?.storage || '') === String(item.storage || '') &&
        String(px.attributes?.color || '').toUpperCase() === String(item.color || '').toUpperCase()
      );
    }

    if (found) {
      const brandStr = found.brand?.name || found.attributes?.brand || '';
      return `${brandStr ? brandStr + ' ' : ''}${found.name}`.trim().toUpperCase();
    }
    if (item.product_name) {
      const brandStr = item.brand_name ? `${item.brand_name.toUpperCase()} ` : '';
      return `${brandStr}${item.product_name.toUpperCase()}`.trim();
    }
    return item.selection_id || '';
  };
  const isDefaultType = ['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR'].includes(newEntity.type);
  const isCustomType = customTypes.includes(newEntity.type);
  const showCustomInput = newEntity.type === 'OTHER' || (!isDefaultType && !isCustomType && newEntity.type !== '');

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">
              {category_group === 'other' 
                ? (id ? '✍️ EDIT OTHER SALE' : '➕ OTHER SALE ENTRY')
                : (isOldMobileSale ? (id ? '✍️ EDIT 2ND HAND SALE' : '➕ 2ND HAND SALE ENTRY') : (id ? '✍️ EDIT SALE' : '➕ NEW SALE ENTRY'))
              }
           </h2>
           <p className="text-muted small mb-0">RECORD PRODUCT SALES, CONFIGURATIONS AND GST</p>
        </div>
        <button onClick={() => navigate(category_group === 'other' ? '/sales?category_group=other' : (isOldMobileSale ? '/old-mobiles/sales' : '/sales'))} className="btn btn-outline-secondary btn-sm text-uppercase fw-bold">← Back to List</button>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className="row g-3">
          {/* LEFT COLUMN: Sale Details */}
          <div className="col-12 col-xl-8">
             <div className="card shadow-sm border-0 bg-white rounded-3 mb-3">
                <div className="card-body p-4">
                    <div className="row g-3">
                        {hasFullAccess() && (
                            <div className="col-12">
                                <label className="form-label small fw-bold text-primary">SELECT SHOP <span className="text-danger">*</span></label>
                                <select className="form-select border-primary fw-bold" required value={form.shop_id} onChange={e => { setForm({...form, shop_id: e.target.value}); loadProducts(e.target.value); }}>
                                    <option value="">— SELECT BRANCH —</option>
                                    {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="col-12">
                            <label className="form-label small fw-bold text-success">SOLD BY / DEALER PERSON <span className="text-danger">*</span></label>
                            <select className="form-select border-success fw-bold" required value={form.sold_by_id} onChange={e => setForm({...form, sold_by_id: e.target.value})}>
                                <option value="">— SELECT STAFF —</option>
                                {staff.filter(s => {
                                    if (form.shop_id && s.shop_id != form.shop_id) return false;
                                    const roles = s.roles?.map(r => typeof r === 'object' ? r.name : r) || [];
                                    return !roles.some(r => r.toLowerCase() === 'admin');
                                }).map(s => (
                                    <option key={s.id} value={s.id}>{s.name.toUpperCase()} ({s.roles?.[0]?.name?.toUpperCase() || 'STAFF'})</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 text-uppercase">
                            <label className="form-label small fw-bold">CUSTOMER DETAILS <span className="text-danger">*</span></label>
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search"></i></span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 text-uppercase" 
                                    placeholder="TYPE NAME OR PHONE TO SEARCH..." 
                                    value={customerInputText}
                                    onChange={e => { 
                                        setCustomerInputText(e.target.value); 
                                        debouncedCustomerSearch(e.target.value); 
                                        setForm({...form, customer_id: ''}); 
                                        setCustomerCredit(0);
                                    }}
                                />
                                <button type="button" className="btn btn-primary fw-bold" onClick={() => setShowCustModal(true)} title="Add New Customer">+</button>
                            </div>
                            {customerSearch && !form.customer_id && filteredCustomers.length > 0 && (
                                <div className="list-group shadow-sm mt-1 position-absolute w-100 z-3 border" style={{ maxWidth: '95%' }}>
                                    {filteredCustomers.slice(0, 5).map(c => (
                                        <button key={c.id} type="button" className="list-group-item list-group-item-action py-2 text-uppercase" onClick={() => handleSelectCustomer(c)}>
                                            <div className="fw-bold">{c.name}</div>
                                            <div className="x-small text-muted">📞 {c.phone} | {c.address || 'NO ADDRESS'}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Price Mode Toggle Block */}
                        <div className="col-12 mt-3 pt-3 border-top">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 bg-light p-3 rounded-3 border">
                                <div>
                                    <label className="form-label small fw-bold text-dark mb-0 d-block">🏷️ APPLIED PRICING MODE</label>
                                    <span className="x-small text-muted">Toggling automatically updates the item prices below</span>
                                </div>
                                <div className="btn-group shadow-sm" role="group">
                                    <button 
                                        type="button" 
                                        className={`btn btn-sm fw-bold px-3 ${priceMode === 'RETAIL' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
                                        onClick={() => handlePriceModeToggle('RETAIL')}
                                    >
                                        RETAIL RATE
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`btn btn-sm fw-bold px-3 ${priceMode === 'WHOLESALE' ? 'btn-warning text-dark' : 'btn-outline-secondary bg-white'}`}
                                        onClick={() => handlePriceModeToggle('WHOLESALE')}
                                    >
                                        WHOLESALE RATE
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
             </div>

             <div className="card shadow-sm border-0 bg-white rounded-3 mb-3">
                <div className="card-header bg-white border-0 py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <h5 className="mb-0 fw-bold text-uppercase">🛒 Items for Sale</h5>
                    <div className="d-flex flex-column align-items-end flex-grow-1">
                        <div className="d-flex gap-2 align-items-center">
                            <div className="d-flex flex-column align-items-end">
                                {scanResult && (
                                    <div className="text-info x-small fw-bold border border-info rounded px-2 py-1 bg-info bg-opacity-10 mb-1 animate-fade-in shadow-sm">
                                        <i className="bi bi-check-circle-fill me-1"></i>
                                        {scanResult.name} ({scanResult.attributes?.ram || '-'}/{scanResult.attributes?.storage || '-'}/{scanResult.attributes?.color || '-'}) | IMEI: {scanResult.imei || scanResult.attributes?.imei || '-'}
                                    </div>
                                )}
                                <div className="input-group input-group-sm" style={{ width: '500px' }}>
                                    <div className="position-relative flex-grow-1" style={{ width: '40%' }} ref={productSearchRef}>
                                        <input 
                                            type="text"
                                            className="form-control border-info fw-bold bg-info bg-opacity-10 text-uppercase h-100" 
                                            placeholder="🔍 SEARCH ITEM..." 
                                            value={productSearch}
                                            onChange={e => { setProductSearch(e.target.value); setShowProductList(true); }}
                                            onFocus={() => setShowProductList(true)}
                                        />
                                        {showProductList && (
                                            <div className="list-group shadow-sm mt-1 position-absolute w-100 z-3 border animate-fade-in" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {products
                                                    .filter(p => {
                                                        const fullName = getProductFullName(p);
                                                        const q = productSearch.toUpperCase();
                                                        const imeiMatch =
                                                            (p.imei && p.imei.includes(q)) ||
                                                            (p.attributes?.imei && p.attributes.imei.includes(q)) ||
                                                            (Array.isArray(p.attributes?.imeis) && p.attributes.imeis.some(im => im && im.includes(q)));
                                                        return !productSearch || fullName.includes(q) || imeiMatch;
                                                    })
                                                    .slice(0, 20)
                                                    .map(p => {
                                                        const fullName = getProductFullName(p);
                                                        const configStr = (p.attributes?.ram || p.attributes?.storage || p.attributes?.color)
                                                            ? `(${p.attributes.ram || '-'}/${p.attributes.storage || '-'}/${p.attributes.color || '-'})`
                                                            : '';
                                                        const firstImei = p.imei || p.attributes?.imei || p.attributes?.imeis?.[0] || '';
                                                        const imeiSuffix = firstImei ? ` / IMEI: ${firstImei}` : '';
                                                        const stockStr = p.stock !== undefined ? ` | Stock: ${p.stock}` : (p.current_stock !== undefined ? ` | Stock: ${p.current_stock}` : '');
                                                        return (
                                                            <button key={p.id} type="button" className="list-group-item list-group-item-action py-2 text-uppercase small"
                                                                onClick={() => {
                                                                    addScannedItem(p);
                                                                    setProductSearch('');
                                                                    setShowProductList(false);
                                                                }}>
                                                                <div className="fw-bold">{fullName} {configStr}</div>
                                                                <div className="x-small text-muted">{imeiSuffix} | 💰 ₹{p.selling_price}{stockStr}</div>
                                                            </button>
                                                        );
                                                    })}
                                                {products.length === 0 && <div className="list-group-item disabled x-small py-3">NO PRODUCTS FOUND</div>}
                                            </div>
                                        )}
                                    </div>
                                    <span 
                                        className="input-group-text bg-info border-info text-white border-start-0 cursor-pointer" 
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => imeiInputRef.current?.focus()}
                                        title="Click to Scan"
                                    >
                                        <i className="bi bi-upc-scan"></i>
                                    </span>
                                    <input 
                                        ref={imeiInputRef}
                                        type="text" 
                                        className="form-control border-info fw-bold" 
                                        placeholder="SCAN IMEI..." 
                                        value={imeiScanner}
                                        autoFocus
                                        onChange={e => handleImeiScan(e.target.value.toUpperCase())}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleScanAction();
                                            }
                                        }}
                                    />
                                    {(scanResult || imeiScanner.length >= 4) && <button type="button" className="btn btn-info text-white fw-bold px-3" onClick={handleScanAction}>+ ADD</button>}
                                </div>
                            </div>
                            <button type="button" className="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onClick={addItem}>+ MANUAL</button>
                        </div>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle" style={{ minWidth: '915px' }}>
                        <thead className="bg-light text-uppercase x-small fw-bold">
                            <tr>
                                <th style={{ width: '320px' }} className="ps-4">Product & Configuration</th>
                                <th style={{ width: '60px' }} className="text-center">QTY</th>
                                <th style={{ width: '120px' }} className="text-end">RATE (INCL)</th>
                                <th style={{ width: '100px' }} className="text-end">RATE (EXCL)</th>
                                <th style={{ width: '65px' }} className="text-center">GST %</th>
                                <th style={{ width: '100px' }} className="text-end">TOTAL (EXCL)</th>
                                <th style={{ width: '110px' }} className="text-end">NET TOTAL</th>
                                <th style={{ width: '40px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => {
                                const itemGstRate = item.apply_gst !== false ? (form.calculate_gst ? (parseFloat(form.cgst_rate || 0) + parseFloat(form.sgst_rate || 0)) : 0) : 0;
                                const rateExcl = item.unit_price / (1 + (itemGstRate / 100));
                                const pProfit = (rateExcl - item.base_price) * item.quantity;
                                const totalExcl = rateExcl * item.quantity;
                                const netTotal = item.unit_price * item.quantity;
                                return (
                                    <tr key={i}>
                                        <td className="ps-4 py-3">
                                            <input 
                                                list={`productOptions-${i}`}
                                                className="form-control form-control-sm text-uppercase fw-bold mb-1 shadow-sm border-primary" 
                                                placeholder="🔍 TYPE PRODUCT NAME OR IMEI..."
                                                required 
                                                value={getProductDisplayName(item)} 
                                                onChange={e => updateItem(i, 'selection_id', e.target.value)}
                                            />
                                            <datalist id={`productOptions-${i}`}>
                                                {products.map(p => (
                                                    <option key={p.id} value={getProductOptionLabel(p)} />
                                                ))}
                                            </datalist>
                                            
                                            <div className="row g-1 text-uppercase">
                                                <div className="col-12 mb-1">
                                                    <label className="x-small fw-bold text-primary mb-0">
                                                        {category_group === 'other' ? 'SERIAL / BATCH (OPTIONAL)' : 'IMEI/SERIAL NUMBER'}
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        list={`stockImeis-${i}-0`}
                                                        className="form-control form-control-sm fw-bold border-primary shadow-sm" 
                                                        placeholder={category_group === 'other' ? 'ENTER SERIAL OR BATCH...' : 'ENTER 15-DIGIT IMEI...'} 
                                                        value={item.imei || ''} 
                                                        onChange={e => updateItem(i,'imei', e.target.value.toUpperCase())} 
                                                    />
                                                    <datalist id={`stockImeis-${i}-0`}>
                                                        {getMatchingStockItems(item, 0).map(p => (
                                                            <option key={p.id} value={p.imei || p.attributes?.imei || ''} />
                                                        ))}
                                                    </datalist>
                                                </div>
                                                {category_group !== 'other' && item.quantity > 1 && Array.from({ length: item.quantity - 1 }).map((_, imeiIdxPlusOne) => {
                                                    const imeiIdx = imeiIdxPlusOne + 1;
                                                    const imeiVal = (item.imeis && item.imeis[imeiIdx]) || '';
                                                    return (
                                                        <div className="col-12 mb-1" key={imeiIdx}>
                                                            <label className="x-small fw-bold text-primary mb-0">IMEI/SERIAL NUMBER {imeiIdx + 1}</label>
                                                            <input 
                                                                type="text" 
                                                                list={`stockImeis-${i}-${imeiIdx}`}
                                                                className="form-control form-control-sm fw-bold border-primary shadow-sm" 
                                                                placeholder={`ENTER IMEI ${imeiIdx + 1}...`} 
                                                                value={imeiVal} 
                                                                onChange={e => updateItemImei(i, imeiIdx, e.target.value.toUpperCase())} 
                                                            />
                                                            <datalist id={`stockImeis-${i}-${imeiIdx}`}>
                                                                {getMatchingStockItems(item, imeiIdx).map(p => (
                                                                    <option key={p.id} value={p.imei || p.attributes?.imei || ''} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    );
                                                })}
                                                <div className="col-3">
                                                    <input type="text" className="form-control form-control-xs" placeholder="RAM" value={item.ram} onChange={e => updateItem(i,'ram', e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-3">
                                                    <input type="text" className="form-control form-control-xs" placeholder="STOR." value={item.storage} onChange={e => updateItem(i,'storage', e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-6">
                                                    <input type="text" className="form-control form-control-xs" placeholder="COLOR" value={item.color} onChange={e => updateItem(i,'color', e.target.value.toUpperCase())} />
                                                </div>
                                                <div className="col-12 mt-1">
                                                    <input 
                                                        type="text" 
                                                        className="form-control form-control-xs" 
                                                        placeholder="DESCRIPTION" 
                                                        value={item.description || ''} 
                                                        onChange={e => updateItem(i, 'description', e.target.value.toUpperCase())} 
                                                    />
                                                </div>
                                            </div>

                                            <div className={`x-small mt-2 fw-bold ${pProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                                EST. MARGIN: ₹{pProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td>
                                            <input type="number" className="form-control form-control-sm fw-bold border-2 text-center" min="1" required value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value))} />
                                        </td>
                                        <td>
                                            <div className="input-group input-group-sm mb-1">
                                                <span className="input-group-text" style={{ padding: '2px 4px', fontSize: '0.7rem' }}>₹</span>
                                                <input type="number" step="0.01" className="form-control text-end fw-bold" style={{ padding: '2px 4px', fontSize: '0.72rem' }} required value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value))} />
                                            </div>
                                            {priceMode === 'WHOLESALE' && (
                                                <div className="text-center text-warning text-dark x-small fw-bold mb-1" style={{ fontSize: '10px' }}>
                                                    <i className="bi bi-tag-fill me-1"></i>WHOLESALE
                                                </div>
                                            )}
                                            <div className="x-small fw-bold text-muted text-center border rounded bg-light px-1" style={{ fontSize: '10px' }}>
                                                RANGE: <span className="text-danger">₹{item.min_selling_price}</span> - <span className="text-info">₹{item.max_selling_price}</span>
                                            </div>
                                        </td>
                                        <td className="text-end text-muted fw-bold align-middle">₹{rateExcl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="text-center fw-bold text-muted align-middle">
                                            <div className="d-flex flex-column align-items-center">
                                                <span style={{ fontSize: '0.72rem' }}>{itemGstRate}%</span>
                                                <div className="form-check form-switch p-0 m-0 mt-1">
                                                    <input 
                                                        className="form-check-input ms-0" 
                                                        type="checkbox"
                                                        style={{ width: '20px', height: '10px', cursor: 'pointer' }}
                                                        checked={item.apply_gst !== false}
                                                        onChange={e => updateItem(i, 'apply_gst', e.target.checked)} 
                                                        title="Apply GST to this product"
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-end fw-bold text-dark align-middle">₹{totalExcl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="text-end fw-bold text-primary align-middle fs-6">₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="pe-3 text-center" style={{ width: '50px' }}>
                                            <button type="button" className="btn btn-danger btn-sm rounded-3 shadow-sm px-2" onClick={() => removeItem(i)} title="Remove Item">
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>

          {/* RIGHT COLUMN: Summary & Payment */}
          <div className="col-12 col-xl-4">
             <div className="card shadow-sm border-0 rounded-4 mb-3" style={{background:'#f8fafc', border:'1px solid #e2e8f0'}}>
                <div className="card-body p-3 text-uppercase">

                    {/* ── Header: Title + Date + Bill Type ── */}
                    <div className="d-flex align-items-center justify-content-between mb-2" style={{gap:8}}>
                        <span className="fw-black text-dark" style={{fontSize:'.82rem',letterSpacing:.5}}>💰 BILL SUMMARY</span>
                        <div className="d-flex align-items-center gap-1">
                            <input
                                type="date"
                                className="form-control form-control-sm fw-bold border-0 bg-white shadow-sm"
                                style={{fontSize:'.72rem', width:'130px', borderRadius:8}}
                                value={form.sale_date}
                                onChange={e => setForm({...form, sale_date: e.target.value})}
                            />
                            <select
                                className="form-select form-select-sm fw-bold border-0 bg-white shadow-sm"
                                style={{fontSize:'.72rem', width:'96px', borderRadius:8, color: form.bill_type === 'pakka' ? '#6366f1' : '#f59e0b'}}
                                value={form.bill_type}
                                onChange={e => setForm({...form, bill_type: e.target.value})}
                            >
                                <option value="kaccha">KACCHA</option>
                                <option value="pakka">PAKKA</option>
                            </select>
                        </div>
                    </div>

                    {/* ── Row 1: GST Toggle + CGST + SGST + Payment + Rounding all in 2-col grid ── */}
                    <div style={{background:'#fff', borderRadius:10, padding:'10px 12px', marginBottom:10, border:'1px solid #e8ecf0'}}>
                        {/* GST Toggle row */}
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span style={{fontSize:'.68rem', fontWeight:700, color:'#64748b'}}>CALCULATE GST?</span>
                            <div className="form-check form-switch p-0 m-0">
                                <input className="form-check-input ms-0" type="checkbox"
                                    checked={form.calculate_gst}
                                    onChange={e => setForm({...form, calculate_gst: e.target.checked})} />
                            </div>
                        </div>
                        {/* CGST + SGST side by side */}
                        <div className="row g-1">
                            <div className="col-6">
                                <label style={{fontSize:'.6rem', fontWeight:700, color:'#94a3b8', display:'block', marginBottom:2}}>CGST %</label>
                                <input type="number" step="0.01"
                                    className="form-control form-control-sm fw-bold text-center"
                                    style={{fontSize:'.78rem', borderRadius:6}}
                                    value={form.cgst_rate}
                                    onChange={e => setForm({...form, cgst_rate: e.target.value})}
                                    disabled={!form.calculate_gst} />
                            </div>
                            <div className="col-6">
                                <label style={{fontSize:'.6rem', fontWeight:700, color:'#94a3b8', display:'block', marginBottom:2}}>SGST %</label>
                                <input type="number" step="0.01"
                                    className="form-control form-control-sm fw-bold text-center"
                                    style={{fontSize:'.78rem', borderRadius:6}}
                                    value={form.sgst_rate}
                                    onChange={e => setForm({...form, sgst_rate: e.target.value})}
                                    disabled={!form.calculate_gst} />
                            </div>
                        </div>
                    </div>

                    {/* ── Rounding ── */}
                    <div className="mb-2">
                        <label style={{fontSize:'.6rem', fontWeight:700, color:'#94a3b8', display:'block', marginBottom:2}}>ROUNDING</label>
                        <select className="form-select form-select-sm" style={{fontSize:'.73rem'}} value={form.rounding_mode} onChange={e => { setForm({...form, rounding_mode: e.target.value}); setIsManualRound(false); }}>
                            <option value="auto">AUTO</option>
                            <option value="up">ROUND UP</option>
                            <option value="down">ROUND DOWN</option>
                            <option value="manual">MANUAL</option>
                        </select>
                    </div>

                    {/* ── Totals Table ── */}
                    <div style={{background:'#fff', borderRadius:10, border:'1px solid #e8ecf0', overflow:'hidden', marginBottom:10}}>
                        <table style={{width:'100%', borderCollapse:'collapse'}}>
                            <tbody>
                                <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                                    <td style={{padding:'6px 10px', fontSize:'.7rem', fontWeight:700, color:'#64748b'}}>SUBTOTAL</td>
                                    <td style={{padding:'6px 10px', fontSize:'.78rem', fontWeight:800, textAlign:'right', color:'#1e293b'}}>₹{subtotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                </tr>
                                <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                                    <td style={{padding:'6px 10px', fontSize:'.7rem', fontWeight:700, color:'#64748b'}}>CGST ({form.cgst_rate}%)</td>
                                    <td style={{padding:'6px 10px', textAlign:'right'}}>
                                        {isManualGst ? (
                                            <div className="d-flex align-items-center gap-1 justify-content-end">
                                                <input type="number" step="0.01"
                                                    className="form-control form-control-sm text-end fw-bold border-primary"
                                                    style={{width:'90px', height:'26px', fontSize:'.72rem'}}
                                                    value={form.cgst_amount}
                                                    onChange={e => setForm({...form, cgst_amount: parseFloat(e.target.value)||0})} />
                                                <button type="button" className="btn btn-link p-0 text-danger" style={{fontSize:'.7rem'}} onClick={() => {setIsManualGst(false); setForm(f => ({...f, is_gst_manual:false}))}}>↺</button>
                                            </div>
                                        ) : (
                                            <span className="fw-bold" style={{fontSize:'.78rem', cursor:'pointer', color:'#475569', textDecoration:'underline dotted'}} onClick={() => {setIsManualGst(true); setForm(f => ({...f, cgst_amount: cgstAmount.toFixed(2), is_gst_manual:true}))}} title="Click to edit manually">₹{cgstAmount.toLocaleString('en-IN', {minimumFractionDigits:2})} ✏️</span>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{borderBottom:'1px solid #f1f5f9'}}>
                                    <td style={{padding:'6px 10px', fontSize:'.7rem', fontWeight:700, color:'#64748b'}}>SGST ({form.sgst_rate}%)</td>
                                    <td style={{padding:'6px 10px', textAlign:'right'}}>
                                        {isManualGst ? (
                                            <div className="d-flex align-items-center gap-1 justify-content-end">
                                                <input type="number" step="0.01"
                                                    className="form-control form-control-sm text-end fw-bold border-primary"
                                                    style={{width:'90px', height:'26px', fontSize:'.72rem'}}
                                                    value={form.sgst_amount}
                                                    onChange={e => setForm({...form, sgst_amount: parseFloat(e.target.value)||0})} />
                                                <button type="button" className="btn btn-link p-0 text-danger" style={{fontSize:'.7rem'}} onClick={() => {setIsManualGst(false); setForm(f => ({...f, is_gst_manual:false}))}}>↺</button>
                                            </div>
                                        ) : (
                                            <span className="fw-bold" style={{fontSize:'.78rem', cursor:'pointer', color:'#475569', textDecoration:'underline dotted'}} onClick={() => {setIsManualGst(true); setForm(f => ({...f, sgst_amount: sgstAmount.toFixed(2), is_gst_manual:true}))}} title="Click to edit manually">₹{sgstAmount.toLocaleString('en-IN', {minimumFractionDigits:2})} ✏️</span>
                                        )}
                                    </td>
                                </tr>
                                {/* Cash Discount row */}
                                <tr style={{borderBottom:'1px solid #f1f5f9', background:'#f0fdf4'}}>
                                    <td style={{padding:'6px 10px'}}>
                                        <span style={{fontSize:'.68rem', fontWeight:700, color:'#16a34a', display:'block'}}>CASH DISCOUNT</span>
                                        <span style={{fontSize:'.58rem', color:'#86efac'}}>✅ DEDUCTED FROM BILL</span>
                                    </td>
                                    <td style={{padding:'6px 10px', textAlign:'right'}}>
                                        <input type="number"
                                            className="form-control form-control-sm text-end fw-bold border-success"
                                            style={{width:'100px', height:'28px', fontSize:'.78rem', display:'inline-block', color:'#16a34a'}}
                                            value={form.cash_discount === 0 ? '' : form.cash_discount}
                                            onFocus={e => e.target.select()}
                                            onChange={e => setForm({...form, cash_discount: e.target.value})} />
                                    </td>
                                </tr>
                                {/* Additional Discount row */}
                                <tr style={{borderBottom:'1px solid #f1f5f9', background:'#fff5f5'}}>
                                    <td style={{padding:'6px 10px', fontSize:'.68rem', fontWeight:700, color:'#dc2626'}}>DISCOUNT (EXTRA)</td>
                                    <td style={{padding:'6px 10px', textAlign:'right'}}>
                                        <input type="number"
                                            className="form-control form-control-sm text-end fw-bold border-danger"
                                            style={{width:'100px', height:'28px', fontSize:'.78rem', display:'inline-block', color:'#dc2626'}}
                                            value={form.discount === 0 ? '' : form.discount}
                                            onFocus={e => e.target.select()}
                                            onChange={e => setForm({...form, discount: e.target.value})} />
                                    </td>
                                </tr>
                                {/* Round Off row */}
                                <tr style={{background:'#eef2ff'}}>
                                    <td style={{padding:'6px 10px'}}>
                                        <span style={{fontSize:'.68rem', fontWeight:700, color:'#4f46e5', display:'block'}}>ROUND OFF</span>
                                        <div className="d-flex gap-1 mt-1">
                                            <button type="button" className="btn btn-xs fw-bold" style={{fontSize:'.55rem', padding:'1px 6px', background:'#dcfce7', color:'#16a34a', border:'1px solid #86efac', borderRadius:5}} onClick={() => handleRoundClick('up')}>↑ UP</button>
                                            <button type="button" className="btn btn-xs fw-bold" style={{fontSize:'.55rem', padding:'1px 6px', background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:5}} onClick={() => handleRoundClick('down')}>↓ DOWN</button>
                                        </div>
                                    </td>
                                    <td style={{padding:'6px 10px', textAlign:'right'}}>
                                        <div className="d-flex align-items-center justify-content-end gap-1">
                                            <button type="button" className="btn btn-xs btn-light border fw-bold" style={{fontSize:'.65rem', padding:'1px 5px'}} onClick={() => { setForm(f => ({...f, round_off: (parseFloat(f.round_off)||0) - 1, rounding_mode:'manual'})); setIsManualRound(true); }}>-1</button>
                                            <input type="number" step="0.01"
                                                className="form-control form-control-sm text-end fw-bold border-primary"
                                                style={{width:'70px', height:'28px', fontSize:'.78rem'}}
                                                value={form.round_off === 0 ? '' : form.round_off}
                                                onFocus={e => e.target.select()}
                                                onChange={e => { setForm({...form, round_off: parseFloat(e.target.value)||0, rounding_mode:'manual'}); setIsManualRound(true); }} />
                                            <button type="button" className="btn btn-xs btn-light border fw-bold" style={{fontSize:'.65rem', padding:'1px 5px'}} onClick={() => { setForm(f => ({...f, round_off: (parseFloat(f.round_off)||0) + 1, rounding_mode:'manual'})); setIsManualRound(true); }}>+1</button>
                                        </div>
                                        {(form.round_off !== 0 || form.rounding_mode !== 'auto') && (
                                            <button type="button" className="btn btn-link p-0 mt-1" style={{fontSize:'.6rem', display:'block', marginLeft:'auto'}}
                                                onClick={() => { setIsManualRound(false); setForm(f => ({...f, rounding_mode:'auto'})); }}>↺ RESET</button>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Grand Total ── */}
                    <div style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)', borderRadius:12, padding:'12px 14px', marginBottom:10}}>
                        <div className="d-flex justify-content-between align-items-center">
                            <span style={{fontWeight:900, fontSize:'.9rem', color:'rgba(255,255,255,.85)', letterSpacing:.5}}>GRAND TOTAL</span>
                            <span style={{fontWeight:900, fontSize:'1.5rem', color:'#fff'}}>₹{grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                        </div>
                        <div className="d-flex justify-content-between mt-1" style={{borderTop:'1px solid rgba(255,255,255,.2)', paddingTop:6}}>
                            <span style={{fontSize:'.62rem', color:'rgba(255,255,255,.6)', fontWeight:700}}>EST. PROFIT</span>
                            <span style={{fontSize:'.72rem', fontWeight:800, color: totalProfit >= 0 ? '#86efac' : '#fca5a5'}}>₹{totalProfit.toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                        </div>
                    </div>

                    {/* ── Finance / EMI Section ── */}
                    <div style={{background:'#fff', borderRadius:10, border:'1px solid #e8ecf0', marginBottom:10, overflow:'hidden'}}>
                        {/* Toggle header */}
                        <div className="d-flex justify-content-between align-items-center" style={{padding:'8px 12px', background: useFinance ? '#fef3c7' : '#f8fafc', borderBottom: useFinance ? '1px solid #fcd34d' : 'none'}}>
                            <div>
                                <span style={{fontSize:'.75rem', fontWeight:800, color: useFinance ? '#92400e' : '#64748b'}}>🏦 FINANCE / EMI</span>
                                {!useFinance && <span style={{fontSize:'.6rem', color:'#94a3b8', marginLeft:6}}>Bajaj / HDB / etc.</span>}
                            </div>
                            <div className="form-check form-switch p-0 m-0">
                                <input className="form-check-input ms-0" type="checkbox" checked={useFinance}
                                    onChange={e => {
                                        const on = e.target.checked;
                                        setUseFinance(on);
                                        if (!on) {
                                            setForm(f => ({ ...f, financer_id: '', down_payment: 0, finance_amount: 0, finance_payment_status: 'RECEIVED' }));
                                        }
                                    }} />
                            </div>
                        </div>

                        {useFinance && (
                            <div style={{padding:'10px 12px'}}>
                                {/* Financer Dropdown */}
                                <div className="mb-2">
                                    <label style={{fontSize:'.65rem', fontWeight:700, color:'#92400e', display:'block', marginBottom:3}}>FINANCE COMPANY</label>
                                    <div className="d-flex gap-1">
                                        <select
                                            className="form-select form-select-sm fw-bold"
                                            style={{fontSize:'.73rem', borderColor:'#fcd34d'}}
                                            value={form.financer_id}
                                            onChange={e => {
                                                const finAmt = grandTotal - parseFloat(form.down_payment || 0);
                                                setForm(f => ({ ...f, financer_id: e.target.value, finance_amount: finAmt > 0 ? parseFloat(finAmt.toFixed(2)) : 0 }));
                                            }}
                                        >
                                            <option value="">— Select Financer —</option>
                                            {financers.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}{f.description ? ` (${f.description})` : ''}</option>
                                            ))}
                                        </select>
                                        <button type="button" className="btn btn-sm fw-bold" style={{background:'#fcd34d', color:'#92400e', borderRadius:6, whiteSpace:'nowrap', fontSize:'.65rem'}} onClick={() => setShowFinancerModal(true)} title="Add new financer">
                                            + NEW
                                        </button>
                                    </div>
                                </div>

                                {/* Down Payment + Finance Amount side by side */}
                                <div className="row g-1 mb-2">
                                    <div className="col-6">
                                        <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>DOWN PAYMENT (CASH)</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text" style={{fontSize:'.7rem'}}>₹</span>
                                            <input type="number" step="0.01" min="0" max={grandTotal}
                                                className="form-control fw-bold text-end"
                                                style={{fontSize:'.78rem', borderColor:'#86efac', color:'#16a34a'}}
                                                value={form.down_payment === 0 ? '' : form.down_payment}
                                                onFocus={e => e.target.select()}
                                                onChange={e => {
                                                    const dp = parseFloat(e.target.value) || 0;
                                                    const fa = Math.max(0, grandTotal - dp);
                                                    setForm(f => ({ ...f, down_payment: dp, finance_amount: parseFloat(fa.toFixed(2)), total_paid: dp }));
                                                }} />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>FINANCE AMOUNT</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text" style={{fontSize:'.7rem'}}>₹</span>
                                            <input type="number" step="0.01" min="0"
                                                className="form-control fw-bold text-end"
                                                style={{fontSize:'.78rem', borderColor:'#fcd34d', color:'#92400e', background:'#fffbeb'}}
                                                value={form.finance_amount === 0 ? '' : form.finance_amount}
                                                onFocus={e => e.target.select()}
                                                onChange={e => setForm(f => ({ ...f, finance_amount: parseFloat(e.target.value) || 0 }))} />
                                        </div>
                                        <div style={{fontSize:'.58rem', color:'#94a3b8', marginTop:2}}>Auto = Total − Down</div>
                                    </div>
                                </div>

                                {/* Payment Status toggle */}
                                <div style={{background:'#fffbeb', borderRadius:8, padding:'8px 10px', border:'1px solid #fde68a'}}>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <span style={{fontSize:'.68rem', fontWeight:700, color:'#92400e'}}>FINANCE PAYMENT</span><br/>
                                            <span style={{fontSize:'.6rem', color: form.finance_payment_status === 'RECEIVED' ? '#16a34a' : '#dc2626', fontWeight:700}}>
                                                {form.finance_payment_status === 'RECEIVED' ? '✅ RECEIVED NOW' : '⏳ WILL COME LATER'}
                                            </span>
                                        </div>
                                        <div className="btn-group btn-group-sm">
                                            <button type="button" className="btn btn-xs fw-bold"
                                                style={{fontSize:'.6rem', padding:'2px 8px', background: form.finance_payment_status === 'RECEIVED' ? '#16a34a' : '#e2e8f0', color: form.finance_payment_status === 'RECEIVED' ? '#fff' : '#64748b', border:'none', borderRadius:'6px 0 0 6px'}}
                                                onClick={() => setForm(f => ({...f, finance_payment_status:'RECEIVED'}))}>
                                                NOW
                                            </button>
                                            <button type="button" className="btn btn-xs fw-bold"
                                                style={{fontSize:'.6rem', padding:'2px 8px', background: form.finance_payment_status === 'PENDING' ? '#dc2626' : '#e2e8f0', color: form.finance_payment_status === 'PENDING' ? '#fff' : '#64748b', border:'none', borderRadius:'0 6px 6px 0'}}
                                                onClick={() => setForm(f => ({...f, finance_payment_status:'PENDING'}))}>
                                                LATER
                                            </button>
                                        </div>
                                    </div>
                                    {form.finance_payment_status === 'PENDING' && (
                                        <div style={{fontSize:'.6rem', color:'#dc2626', marginTop:4, fontWeight:600}}>⚠️ Finance amount will show as RECEIVABLE in {financers.find(f=>f.id==form.financer_id)?.name || 'financer'}'s ledger</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Shop Finance Section (Personal EMI / Favor) ── */}
                    <div style={{background:'#fff', borderRadius:10, border:'1px solid #e8ecf0', marginBottom:10, overflow:'hidden'}}>
                        <div className="d-flex justify-content-between align-items-center" style={{padding:'8px 12px', background: useShopFinance ? '#eff6ff' : '#f8fafc', borderBottom: useShopFinance ? '1px solid #bfdbfe' : 'none'}}>
                            <div>
                                <span style={{fontSize:'.75rem', fontWeight:800, color: useShopFinance ? '#1d4ed8' : '#64748b'}}>💳 SHOP FINANCE</span>
                                {!useShopFinance && <span style={{fontSize:'.6rem', color:'#94a3b8', marginLeft:6}}>Personal EMI / Favor</span>}
                            </div>
                            <div className="form-check form-switch p-0 m-0">
                                <input className="form-check-input ms-0" type="checkbox" checked={useShopFinance}
                                    onChange={e => {
                                        const on = e.target.checked;
                                        setUseShopFinance(on);
                                        if (on) {
                                            const remaining = Math.max(0, grandTotal - parseFloat(form.total_paid || 0));
                                            setShopFinance(f => ({ ...f, principal: parseFloat(remaining.toFixed(2)) }));
                                        }
                                    }} />
                            </div>
                        </div>

                        {useShopFinance && (
                            <div style={{padding:'10px 12px'}}>
                                {/* Type toggle */}
                                <div className="d-flex gap-2 mb-3">
                                    <button type="button"
                                        onClick={() => setShopFinanceType('PERSONAL')}
                                        style={{flex:1, padding:'6px 0', fontSize:'.68rem', fontWeight:800, borderRadius:8, border:'none',
                                            background: shopFinanceType === 'PERSONAL' ? '#1d4ed8' : '#e2e8f0',
                                            color: shopFinanceType === 'PERSONAL' ? '#fff' : '#64748b'}}>
                                        📅 PERSONAL EMI
                                    </button>
                                    <button type="button"
                                        onClick={() => setShopFinanceType('FAVOR')}
                                        style={{flex:1, padding:'6px 0', fontSize:'.68rem', fontWeight:800, borderRadius:8, border:'none',
                                            background: shopFinanceType === 'FAVOR' ? '#0891b2' : '#e2e8f0',
                                            color: shopFinanceType === 'FAVOR' ? '#fff' : '#64748b'}}>
                                        🤝 FAVOR (FLEXIBLE)
                                    </button>
                                </div>

                                {/* Down Payment + Principal */}
                                <div className="row g-1 mb-2">
                                    <div className="col-6">
                                        <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>DOWN PAYMENT</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text" style={{fontSize:'.7rem'}}>₹</span>
                                            <input type="number" step="0.01" min="0"
                                                className="form-control fw-bold text-end"
                                                style={{fontSize:'.78rem', borderColor:'#86efac', color:'#16a34a'}}
                                                value={shopFinance.down_payment || ''}
                                                onFocus={e => e.target.select()}
                                                onChange={e => {
                                                    const dp = parseFloat(e.target.value) || 0;
                                                    const pr = Math.max(0, grandTotal - dp);
                                                    setShopFinance(f => ({ ...f, down_payment: dp, principal: parseFloat(pr.toFixed(2)) }));
                                                }} />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>FINANCED AMOUNT</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text" style={{fontSize:'.7rem'}}>₹</span>
                                            <input type="number" step="0.01" min="0"
                                                className="form-control fw-bold text-end"
                                                style={{fontSize:'.78rem', borderColor:'#bfdbfe', color:'#1d4ed8', background:'#eff6ff'}}
                                                value={shopFinance.principal || ''}
                                                onFocus={e => e.target.select()}
                                                onChange={e => setShopFinance(f => ({ ...f, principal: parseFloat(e.target.value) || 0 }))} />
                                        </div>
                                    </div>
                                </div>

                                {/* Personal EMI fields */}
                                {shopFinanceType === 'PERSONAL' && (
                                    <>
                                        {/* Flat vs Reducing-balance interest toggle */}
                                        <div className="d-flex gap-1 mb-2">
                                            {['FLAT', 'REDUCING'].map(t => (
                                                <button key={t} type="button"
                                                    onClick={() => setShopFinance(f => ({ ...f, interest_type: t }))}
                                                    style={{
                                                        flex: 1, fontSize: '.64rem', fontWeight: 800, padding: '4px 6px',
                                                        borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer',
                                                        background: shopFinance.interest_type === t ? '#1d4ed8' : '#f8fafc',
                                                        color: shopFinance.interest_type === t ? '#fff' : '#64748b',
                                                    }}>
                                                    {t === 'FLAT' ? 'FLAT RATE' : 'REDUCING BALANCE'}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{fontSize: '.6rem', color: '#94a3b8', marginBottom: 6}}>
                                            {shopFinance.interest_type === 'FLAT'
                                                ? 'Flat: interest charged once on the full amount for the whole tenure.'
                                                : 'Reducing: interest recalculated each month on the outstanding balance.'}
                                        </div>

                                        <div className="row g-1 mb-2">
                                            <div className="col-6">
                                                <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>INTEREST % p.a.</label>
                                                <input type="number" step="0.1" min="0" className="form-control form-control-sm fw-bold text-end"
                                                    style={{fontSize:'.78rem', borderColor: emiInputMode === 'RATE' ? '#fcd34d' : '#e2e8f0', background: emiInputMode === 'RATE' ? '#fff' : '#f8fafc'}}
                                                    value={emiInputMode === 'RATE' ? (shopFinance.interest_rate || '') : (shopFinanceCalc.impliedRate ? shopFinanceCalc.impliedRate.toFixed(2) : '')}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => {
                                                        setEmiInputMode('RATE');
                                                        setShopFinance(f => ({ ...f, interest_rate: parseFloat(e.target.value) || 0 }));
                                                    }} />
                                            </div>
                                            <div className="col-6">
                                                <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>TOTAL PAYABLE (₹)</label>
                                                <input type="number" step="1" min="0" className="form-control form-control-sm fw-bold text-end"
                                                    style={{fontSize:'.78rem', borderColor: emiInputMode === 'TOTAL' ? '#fcd34d' : '#e2e8f0', background: emiInputMode === 'TOTAL' ? '#fff' : '#f8fafc'}}
                                                    value={emiInputMode === 'TOTAL' ? (shopFinance.total_payable || '') : (shopFinanceCalc.totalPayable || '')}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => {
                                                        setEmiInputMode('TOTAL');
                                                        setShopFinance(f => ({ ...f, total_payable: parseFloat(e.target.value) || 0 }));
                                                    }} />
                                            </div>
                                        </div>
                                        <div style={{fontSize: '.58rem', color: '#94a3b8', marginBottom: 6}}>
                                            Fill either field — the other one (and the interest rate this implies) fills in automatically.
                                        </div>

                                        <div className="row g-1 mb-2">
                                            <div className="col-6">
                                                <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>TENURE (MONTHS)</label>
                                                <input type="number" step="1" min="1" max="360" className="form-control form-control-sm fw-bold text-end"
                                                    style={{fontSize:'.78rem', borderColor:'#fcd34d'}}
                                                    value={shopFinance.tenure_months || ''}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => setShopFinance(f => ({ ...f, tenure_months: parseInt(e.target.value) || 0 }))} />
                                            </div>
                                            <div className="col-6">
                                                <label style={{fontSize:'.6rem', fontWeight:700, color:'#64748b', display:'block', marginBottom:2}}>1st EMI DATE</label>
                                                <input type="date" className="form-control form-control-sm"
                                                    style={{fontSize:'.72rem'}}
                                                    value={shopFinance.emi_start_date}
                                                    onChange={e => setShopFinance(f => ({ ...f, emi_start_date: e.target.value }))} />
                                            </div>
                                        </div>

                                        {/* EMI preview card */}
                                        {shopFinanceCalc.monthlyEmi > 0 && (
                                            <div style={{background:'#eff6ff', borderRadius:8, padding:'8px 12px', border:'1px solid #bfdbfe'}}>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <div style={{fontSize:'.62rem', color:'#1d4ed8', fontWeight:700}}>MONTHLY EMI</div>
                                                        <div style={{fontSize:'1.1rem', fontWeight:900, color:'#1d4ed8'}}>
                                                            ₹{shopFinanceCalc.monthlyEmi.toLocaleString('en-IN')}
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div style={{fontSize:'.62rem', color:'#64748b', fontWeight:700}}>× {shopFinance.tenure_months} MONTHS</div>
                                                        <div style={{fontSize:'.62rem', color:'#64748b', fontWeight:700}}>= TOTAL PAYABLE</div>
                                                    </div>
                                                    <div className="text-end">
                                                        <div style={{fontSize:'.62rem', color:'#64748b', fontWeight:700}}>TOTAL PAYABLE</div>
                                                        <div style={{fontSize:'1.1rem', fontWeight:900, color:'#0f172a'}}>
                                                            ₹{shopFinanceCalc.totalPayable.toLocaleString('en-IN')}
                                                        </div>
                                                        {shopFinanceCalc.totalPayable > shopFinance.principal && (
                                                            <div style={{fontSize:'.58rem', color:'#dc2626'}}>
                                                                Interest: ₹{(shopFinanceCalc.totalPayable - shopFinance.principal).toLocaleString('en-IN')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Favor info */}
                                {shopFinanceType === 'FAVOR' && (
                                    <div style={{background:'#ecfeff', borderRadius:8, padding:'8px 12px', border:'1px solid #a5f3fc', fontSize:'.68rem', color:'#0891b2', fontWeight:600}}>
                                        🤝 Flexible repayment — customer can pay any time in any amount.<br/>
                                        No interest. Balance = ₹{(parseFloat(shopFinance.principal) || 0).toLocaleString('en-IN')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {customerCredit > 0 && (
                        <div className="mb-2 p-2 rounded-3" style={{background:'#ecfeff', border:'1px solid #67e8f9'}}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <label style={{fontSize:'.68rem', fontWeight:700, color:'#0891b2', margin:0}}>EXCHANGE CREDIT USED</label>
                                <span className="badge" style={{background:'#cffafe', color:'#0891b2', fontSize:'.6rem'}}>Available: ₹{customerCredit.toLocaleString()}</span>
                            </div>
                            <input type="number" step="0.01" className="form-control fw-bold border-info" style={{fontSize:'1.2rem', color:'#0891b2'}} placeholder="₹ 0.00"
                                max={customerCredit}
                                value={form.exchange_paid === 0 ? '' : form.exchange_paid}
                                onFocus={e => e.target.select()}
                                onChange={e => { let val = parseFloat(e.target.value)||0; if(val > customerCredit) val = customerCredit; setForm({...form, exchange_paid: val}); }} />
                            <div style={{fontSize:'.6rem', color:'#0891b2', marginTop:4, fontWeight:600}}>This amount is settled from the customer's ledger.</div>
                        </div>
                    )}

                    {/* ── Payment Mode & Amount Paid ── */}
                    <div className="mb-2 p-3 rounded-3" style={{background:'#f8fafc', border:'1px solid #e2e8f0'}}>
                        {!form.payment_method?.startsWith('EXCHANGE') && (
                            <div className="mb-2">
                                <label style={{fontSize:'.68rem', fontWeight:700, color:'#475569', display:'block', marginBottom:4}}>PAYMENT MODE</label>
                                <select className="form-select form-select-sm fw-bold text-uppercase border-primary" style={{fontSize:'.78rem', borderRadius:8}} value={form.payment_method} onChange={e => handlePaymentMethodChange(e.target.value)}>
                                    <option value="CASH">CASH</option>
                                    <option value="PHONEPE">PHONEPE</option>
                                    <option value="GPAY">GPAY</option>
                                    <option value="BANK / NEFT">BANK / NEFT</option>
                                    {customerCredit > 0 && (
                                        <>
                                            <option value="EXCHANGE">EXCHANGE CREDIT</option>
                                            <option value="EXCHANGE + CASH">EXCHANGE + CASH</option>
                                            <option value="EXCHANGE + UPI">EXCHANGE + UPI</option>
                                        </>
                                    )}
                                    <option value="OTHER">OTHER</option>
                                </select>
                                {form.payment_method === 'OTHER' && (
                                    <input className="form-control form-control-sm mt-1 text-uppercase fw-bold border-primary" style={{fontSize:'.72rem'}}
                                        placeholder="SPECIFY MODE (E.G. CHEQUE)"
                                        value={form.other_mode}
                                        onChange={e => setForm({...form, other_mode: e.target.value.toUpperCase()})} />
                                )}
                            </div>
                        )}

                        <label style={{fontSize:'.68rem', fontWeight:700, color:'#16a34a', display:'block', marginBottom:4}}>{useFinance ? 'DOWN PAYMENT (CASH COLLECTED)' : 'AMOUNT PAID (INITIAL)'}</label>
                        <input type="number" step="0.01"
                            className="form-control fw-bold border-success"
                            style={{fontSize:'1.6rem', fontWeight:900, color:'#16a34a', background:'#f0fdf4', borderRadius:10}}
                            placeholder="₹ 0.00"
                            value={form.total_paid === 0 ? '' : form.total_paid}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setForm(f => ({
                                    ...f,
                                    total_paid: e.target.value,
                                    ...(useFinance ? { down_payment: val, finance_amount: Math.max(0, parseFloat((grandTotal - val).toFixed(2))) } : {})
                                }));
                            }} />
                        
                        {/* Pending balance — exclude finance_amount if RECEIVED */}
                        {(() => {
                            const financePaid = useFinance && form.finance_payment_status === 'RECEIVED' ? parseFloat(form.finance_amount || 0) : 0;
                            const pending = grandTotal - parseFloat(form.total_paid||0) - parseFloat(form.exchange_paid||0) - financePaid;
                            return pending > 0.01 ? (
                                <div style={{fontSize:'.72rem', color:'#dc2626', fontWeight:700, marginTop:4}}>PENDING BALANCE: ₹{pending.toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
                            ) : null;
                        })()}
                    </div>
                    {/* ── Notes ── */}
                    <div className="mb-3">
                        <label style={{fontSize:'.65rem', fontWeight:700, color:'#94a3b8', display:'block', marginBottom:3}}>NOTES / REMARKS</label>
                        <textarea className="form-control x-small text-uppercase" rows={2} style={{fontSize:'.7rem', borderRadius:8}} placeholder="E.G. ANY SPECIAL INSTRUCTIONS..."
                            value={form.notes} onChange={e => setForm({...form, notes: e.target.value.toUpperCase()})} />
                    </div>

                    <button type="submit" className="btn w-100 py-3 fw-black text-uppercase shadow rounded-3" style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', letterSpacing:.8, fontSize:'.85rem'}} disabled={loading || submitting}>
                        {loading || submitting ? 'Processing...' : id ? 'UPDATE SALE INVOICE' : 'CONFIRM & SAVE SALE'}
                    </button>
                </div>
             </div>
          </div>
        </div>
      </form>

      {/* Mini Modal: Add Customer -> Using Entity Add Modal */}
      <Modal show={showCustModal} onHide={() => setShowCustModal(false)} centered className="text-uppercase modal-dialog-scrollable">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fw-bold text-uppercase" style={{ fontSize: '1rem' }}>New Entity</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleQuickEntityAdd}>
          <Modal.Body className="p-4">
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-bold small text-muted text-uppercase">Entity Name *</label>
                <input 
                  type="text" 
                  className="form-control text-uppercase" 
                  required 
                  value={newEntity.name}
                  onChange={e => setNewEntity({...newEntity, name: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Category *</label>
                <select 
                  className="form-select fw-semibold text-uppercase"
                  required
                  value={
                    isDefaultType || isCustomType
                      ? newEntity.type
                      : (newEntity.type ? 'OTHER' : '')
                  }
                  onChange={e => setNewEntity({...newEntity, type: e.target.value})}
                >
                  <option value="">Select Category...</option>
                  <option value="CUSTOMER">NORMAL CUSTOMER</option>
                  <option value="SHOP_CUSTOMER">SHOP CUSTOMER</option>
                  <option value="SHOP">SHOP</option>
                  <option value="SUPPLIER">SUPPLIER</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  {customTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="OTHER">OTHER / CUSTOM TYPE</option>
                </select>
              </div>

              {showCustomInput && (
                <div className="col-12">
                  <label className="form-label fw-bold small text-muted text-uppercase">Custom Category / Type *</label>
                  <input 
                    type="text" 
                    className="form-control fw-bold text-uppercase"
                    required
                    placeholder="Type custom category name..."
                    value={newEntity.type === 'OTHER' ? '' : newEntity.type}
                    onChange={e => setNewEntity({...newEntity, type: e.target.value.toUpperCase()})}
                  />
                </div>
              )}
              <div className="col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Phone</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={newEntity.phone}
                  onChange={e => setNewEntity({...newEntity, phone: e.target.value})}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">GST Number</label>
                <input 
                  type="text" 
                  className="form-control text-uppercase"
                  placeholder="Optional"
                  value={newEntity.gst_number}
                  onChange={e => setNewEntity({...newEntity, gst_number: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Opening Balance</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={newEntity.opening_balance}
                  onChange={e => setNewEntity({...newEntity, opening_balance: e.target.value})}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Balance Type</label>
                <select 
                  className="form-select text-uppercase"
                  value={newEntity.balance_type}
                  onChange={e => setNewEntity({...newEntity, balance_type: e.target.value})}
                >
                  <option value="RECEIVABLE">THEY OWE ME (Receivable)</option>
                  <option value="PAYABLE">I OWE THEM (Payable)</option>
                </select>
              </div>

              {['CUSTOMER', 'SHOP_CUSTOMER'].includes(newEntity.type) && (
                <>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-muted text-uppercase">Email</label>
                    <input 
                      type="email" 
                      className="form-control text-uppercase"
                      placeholder="Email address"
                      value={newEntity.email || ''}
                      onChange={e => setNewEntity({...newEntity, email: e.target.value})}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-muted text-uppercase">Voucher Code</label>
                    <input 
                      type="text" 
                      className="form-control text-primary fw-semibold text-uppercase"
                      placeholder="Voucher Code"
                      value={newEntity.voucher_code || ''}
                      onChange={e => setNewEntity({...newEntity, voucher_code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="col-12 mt-3 pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                        🎂 Customer Events
                      </h6>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary fw-bold" 
                        onClick={addCustEvent}
                        style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '4px 12px' }}
                      >
                        + Add Event
                      </button>
                    </div>
                    <p className="text-muted x-small text-uppercase mb-3 fw-semibold" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                      Click "+ Add Event" to track birthdays, etc.
                    </p>

                    <div className="row g-2">
                      {(newEntity.events || []).map((ev, idx) => (
                        <div key={idx} className="col-12 p-3 bg-light rounded border mb-2">
                          <div className="row g-2 align-items-center">
                            
                            <div className="col-md-4">
                              <select 
                                className="form-select form-select-sm fw-semibold text-uppercase" 
                                value={ev.type} 
                                onChange={e => {
                                  const newEvents = [...newEntity.events];
                                  newEvents[idx].type = e.target.value;
                                  setNewEntity({...newEntity, events: newEvents});
                                }}
                              >
                                <option value="">Select Type</option>
                                <option value="dob">DOB</option>
                                <option value="anniversary">Anniversary</option>
                                <option value="other">Other</option>
                              </select>
                            </div>

                            {ev.type === 'other' && (
                              <div className="col-md-3">
                                <input 
                                  className="form-control form-control-sm fw-semibold text-uppercase" 
                                  placeholder="Event Name" 
                                  value={ev.name || ''} 
                                  onChange={e => {
                                    const newEvents = [...newEntity.events];
                                    newEvents[idx].name = e.target.value.toUpperCase();
                                    setNewEntity({...newEntity, events: newEvents});
                                  }}
                                />
                              </div>
                            )}

                            <div className={`col-md-${ev.type === 'other' ? '4' : '7'}`}>
                              <input 
                                className="form-control form-control-sm fw-semibold" 
                                type="date" 
                                value={ev.date} 
                                onChange={e => {
                                  const newEvents = [...newEntity.events];
                                  newEvents[idx].date = e.target.value;
                                  setNewEntity({...newEntity, events: newEvents});
                                }}
                              />
                            </div>

                            <div className="col-md-1 text-end">
                              <button 
                                type="button" 
                                className="btn btn-sm btn-link text-danger p-0 border-0 bg-transparent" 
                                onClick={() => {
                                  const newEvents = newEntity.events.filter((_, i) => i !== idx);
                                  setNewEntity({...newEntity, events: newEvents});
                                }}
                              >
                                ✕
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="col-12">
                <label className="form-label fw-bold small text-muted text-uppercase">Description / Notes</label>
                <textarea 
                  className="form-control text-uppercase"
                  rows="2"
                  value={newEntity.description}
                  onChange={e => setNewEntity({...newEntity, description: e.target.value.toUpperCase()})}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 p-4 pt-0">
            <Button variant="light" onClick={() => setShowCustModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" className="fw-bold px-4" disabled={entitySubmitting}>
              {entitySubmitting ? 'SAVING...' : 'SAVE ACCOUNT'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Mini Modal: Add New Financer */}
      <Modal show={showFinancerModal} onHide={() => setShowFinancerModal(false)} centered size="sm">
          <Modal.Header closeButton style={{background:'#fef3c7', borderBottom:'1px solid #fcd34d'}}>
              <Modal.Title className="fw-bold small text-uppercase" style={{color:'#92400e'}}>🏦 ADD FINANCE COMPANY</Modal.Title>
          </Modal.Header>
          <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                  const { data } = await api.post('/entities', {
                      ...newFinancer,
                      type: 'FINANCER',
                      balance_type: 'RECEIVABLE',
                      opening_balance: 0,
                  });
                  setFinancers(prev => [...prev, data]);
                  setForm(f => ({ ...f, financer_id: data.id }));
                  setShowFinancerModal(false);
                  setNewFinancer({ name: '', phone: '', gst_number: '', description: '' });
                  toast.success('✅ Finance company added');
              } catch (err) {
                  toast.error(err.response?.data?.message || 'Error adding financer');
              }
          }}>
              <Modal.Body className="p-3">
                  <div className="row g-2 text-uppercase">
                      <div className="col-12">
                          <label className="form-label x-small fw-bold">Company Name <span className="text-danger">*</span></label>
                          <input type="text" className="form-control form-control-sm fw-bold" required
                              placeholder="E.G. BAJAJ FINANCE" value={newFinancer.name}
                              onChange={e => setNewFinancer({...newFinancer, name: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-6">
                          <label className="form-label x-small fw-bold">Phone</label>
                          <input type="text" className="form-control form-control-sm" value={newFinancer.phone}
                              onChange={e => setNewFinancer({...newFinancer, phone: e.target.value})} />
                      </div>
                      <div className="col-6">
                          <label className="form-label x-small fw-bold">GST Number</label>
                          <input type="text" className="form-control form-control-sm" placeholder="OPTIONAL"
                              value={newFinancer.gst_number}
                              onChange={e => setNewFinancer({...newFinancer, gst_number: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="col-12">
                          <label className="form-label x-small fw-bold">Note / Branch</label>
                          <input type="text" className="form-control form-control-sm" placeholder="E.G. MAIN BRANCH"
                              value={newFinancer.description}
                              onChange={e => setNewFinancer({...newFinancer, description: e.target.value.toUpperCase()})} />
                      </div>
                  </div>
              </Modal.Body>
              <Modal.Footer style={{background:'#fef3c7', borderTop:'1px solid #fcd34d'}} className="py-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowFinancerModal(false)}>CANCEL</Button>
                  <Button type="submit" size="sm" style={{background:'#92400e', border:'none'}} className="fw-bold">CREATE</Button>
              </Modal.Footer>
          </form>
      </Modal>

      <style>{`
          .x-small { font-size: 0.7rem; }
          .form-control-xs { padding: 0.25rem 0.25rem; font-size: 0.65rem; height: auto; text-align: center; }
          .fw-black { font-weight: 900; }
          .z-3 { z-index: 1030; }
          .shadow-primary { box-shadow: 0 4px 15px rgba(13, 110, 253, 0.25) !important; }
          .btn-xs { padding: 0.1rem 0.4rem; font-size: 0.65rem; }
      `}</style>
    </div>
  );
}
