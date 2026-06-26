import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';

export default function useInventory(filters, form, setForm) {
    const [products, setProducts] = useState([]);
    const [baseProducts, setBaseProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [shops, setShops] = useState([]);
    const [categories, setCategories] = useState([]);
    const [imeiList, setImeiList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { hasFullAccess } = useAuth();
    const initialShopSet = useRef(false);

    // Fetch filtered products only when filters change (debounced or on trigger)
    const loadFilteredProducts = useCallback(async () => {
        setLoading(true);
        try {
            const prodRes = await api.get('/products', { params: filters });
            setProducts(prodRes.data.data || prodRes.data);
        } catch (e) {
            toast.error("Failed to load inventory products");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadFilteredProducts();
    }, [loadFilteredProducts]);

    // Fetch static metadata once on mount
    useEffect(() => {
        // Load base products
        api.get('/products')
            .then(r => setBaseProducts(r.data.data || r.data))
            .catch(() => {});

        // Load suppliers
        api.get('/suppliers')
            .then(r => setSuppliers(r.data))
            .catch(() => {});

        // Load unique IMEIs
        api.get('/purchase-invoices/unique-imeis')
            .then(r => setImeiList(r.data))
            .catch(() => {});

        // Load categories
        api.get('/categories')
            .then(r => setCategories(r.data))
            .catch(() => {});

        // Load shops
        if (hasFullAccess()) {
            api.get('/shops')
                .then(r => {
                    setShops(r.data);
                    if (r.data.length > 0 && !form?.shop_id && !initialShopSet.current) {
                        initialShopSet.current = true;
                        if (setForm) setForm(f => ({ ...f, shop_id: r.data[0].id }));
                    }
                })
                .catch(() => {});
        }
    }, [hasFullAccess, setForm, form?.shop_id]);

    return {
        products,
        baseProducts,
        suppliers,
        shops,
        categories,
        imeiList,
        loading,
        refresh: loadFilteredProducts
    };
}
