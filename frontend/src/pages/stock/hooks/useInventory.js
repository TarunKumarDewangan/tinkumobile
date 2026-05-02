import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';

export default function useInventory(filters, form, setForm) {
    const [products, setProducts] = useState([]);
    const [baseProducts, setBaseProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [currentStock, setCurrentStock] = useState({});
    const [shops, setShops] = useState([]);
    const [categories, setCategories] = useState([]);
    const [imeiList, setImeiList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { isOwner } = useAuth();
    const initialShopSet = useRef(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [prodRes, baseProdRes, stockRes] = await Promise.all([
                api.get('/products', { params: filters }),
                api.get('/products'),
                api.get('/stock-levels')
            ]);
            setProducts(prodRes.data.data || prodRes.data);
            setBaseProducts(baseProdRes.data.data || baseProdRes.data);
            const map = {};
            stockRes.data.forEach(inv => { map[inv.product_id] = inv.stock; });
            setCurrentStock(map);

            if (isOwner()) {
                const r = await api.get('/shops');
                setShops(r.data);
                if (r.data.length > 0 && !form?.shop_id && !initialShopSet.current) {
                    initialShopSet.current = true;
                    if (setForm) setForm(f => ({ ...f, shop_id: r.data[0].id }));
                }
            }
        } catch (e) {
            toast.error("Failed to load inventory data");
        } finally {
            setLoading(false);
        }
    }, [filters, form?.shop_id, isOwner, setForm]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {});
        api.get('/purchase-invoices/unique-imeis').then(r => setImeiList(r.data)).catch(() => {});
        api.get('/categories').then(r => setCategories(r.data)).catch(() => {});
    }, []);

    return {
        products,
        baseProducts,
        suppliers,
        currentStock,
        shops,
        categories,
        imeiList,
        loading,
        refresh: loadData
    };
}
