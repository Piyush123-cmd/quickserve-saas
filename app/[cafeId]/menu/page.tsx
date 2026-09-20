'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_veg: boolean;
  category_id: string | null;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Cafe {
  id: string;
  name: string;
  slug: string;
}

export default function CustomerMenuPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const cafeSlug = params?.cafeId as string;
  const tableNum = searchParams?.get('table') || 'Counter';

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [customerName, setCustomerName] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!cafeSlug) return;

    async function loadCafeAndMenu() {
      setLoading(true);
      setErrorMsg(null);
      try {
        // 1. Fetch Cafe Details by slug
        const { data: cafeData, error: cafeErr } = await supabase
          .from('cafes')
          .select('id, name, slug')
          .eq('slug', cafeSlug)
          .maybeSingle();

        if (cafeErr) throw cafeErr;
        if (!cafeData) {
          setErrorMsg('Cafe not found');
          return;
        }

        setCafe(cafeData);

        // 2. Fetch Categories for this cafe
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('id, name')
          .eq('cafe_id', cafeData.id);

        if (catErr) console.warn('Category fetch error:', catErr);
        setCategories(catData || []);

        // 3. Fetch Menu Items for this cafe
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('cafe_id', cafeData.id)
          .eq('is_available', true);

        if (itemErr) throw itemErr;
        setMenuItems(itemData || []);

      } catch (err: any) {
        console.error('Data Load Error:', err);
        setErrorMsg(err.message || 'Error loading menu');
      } finally {
        setLoading(false);
      }
    }

    loadCafeAndMenu();
  }, [cafeSlug]);

  // Cart operations
  const updateCart = (itemId: string, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      if (newQty === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: newQty };
    });
  };

  const totalItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const cartItemsList = Object.entries(cart).map(([id, qty]) => {
    const item = menuItems.find((i) => i.id === id);
    return { item, qty, total: (item?.price || 0) * qty };
  });

  const cartGrandTotal = cartItemsList.reduce((sum, ci) => sum + ci.total, 0);

  // Filter Menu Items
  const filteredItems = menuItems.filter((item) => {
    // Search query filter
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Category filter
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
      return false;
    }
    // Diet filter
    if (dietFilter === 'veg' && !item.is_veg) return false;
    if (dietFilter === 'non-veg' && item.is_veg) return false;

    return true;
  });

  // Place Order
  const handlePlaceOrder = async () => {
    if (!cafe || totalItemsCount === 0) return;
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsPlacingOrder(true);
    try {
      // 1. Insert Order
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          cafe_id: cafe.id,
          table_number: tableNum,
          customer_name: customerName,
          total_amount: cartGrandTotal,
          status: 'pending',
          notes: customerNotes || null,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert Order Items
      const orderItemsToInsert = cartItemsList.map((ci) => ({
        order_id: orderData.id,
        menu_item_id: ci.item?.id,
        quantity: ci.qty,
        price_per_unit: ci.item?.price,
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsErr) throw itemsErr;

      setOrderSuccess(true);
      setCart({});
      setCustomerNotes('');
    } catch (err: any) {
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Menu...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !cafe) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Cafe Not Found</h1>
        <p className="text-gray-400 mb-4">{errorMsg || 'Please scan a valid QR code.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0D14] text-gray-100 font-sans pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#121824]/90 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-orange-500">{cafe.name}</h1>
          <p className="text-xs text-gray-400">Ordering for Table #{tableNum}</p>
        </div>
        <div className="bg-gray-800/80 px-3 py-1.5 rounded-full text-xs font-medium text-orange-400 border border-gray-700">
          🛒 {totalItemsCount} Items
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4">
        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search dish (e.g. Burger, Chai)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161F2E] border border-gray-800 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
          <span className="absolute left-3 top-2.5 text-gray-500 text-sm">🔍</span>
        </div>

        {/* Veg / Non-Veg Filters */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setDietFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              dietFilter === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-[#161F2E] text-gray-400 border border-gray-800'
            }`}
          >
            All ({menuItems.length})
          </button>
          <button
            onClick={() => setDietFilter('veg')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              dietFilter === 'veg'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#161F2E] text-emerald-400 border border-gray-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Veg
          </button>
          <button
            onClick={() => setDietFilter('non-veg')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              dietFilter === 'non-veg'
                ? 'bg-rose-600 text-white'
                : 'bg-[#161F2E] text-rose-400 border border-gray-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Non-Veg
          </button>
        </div>

        {/* Categories Tab */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-white text-black font-bold'
                  : 'bg-[#161F2E] text-gray-300 border border-gray-800'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-white text-black font-bold'
                    : 'bg-[#161F2E] text-gray-300 border border-gray-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items List */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              No items available in this section.
            </div>
          ) : (
            filteredItems.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className="bg-[#121824] border border-gray-800/80 rounded-2xl p-4 flex gap-4 items-center shadow-lg"
                >
                  {/* Left Side: Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      ></span>
                      <h3 className="font-semibold text-white text-base">{item.name}</h3>
                    </div>
                    <p className="text-orange-400 font-bold text-sm mb-1">₹{item.price}</p>
                    {item.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>
                    )}
                  </div>

                  {/* Right Side: Image + ADD Button */}
                  <div className="relative w-28 h-24 flex-shrink-0 flex flex-col items-center">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-xl border border-gray-800"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1A2332] rounded-xl flex items-center justify-center text-xs text-gray-600 border border-gray-800">
                        No Image
                      </div>
                    )}

                    {/* Quantity Control Overlay Button */}
                    <div className="absolute -bottom-2 bg-[#1A2332] border border-gray-700 rounded-lg shadow-xl px-2 py-1 flex items-center gap-3">
                      {qty > 0 ? (
                        <>
                          <button
                            onClick={() => updateCart(item.id, -1)}
                            className="text-orange-400 font-bold text-base px-1 hover:text-white"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-white min-w-[14px] text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => updateCart(item.id, 1)}
                            className="text-orange-400 font-bold text-base px-1 hover:text-white"
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => updateCart(item.id, 1)}
                          className="text-xs font-bold text-orange-400 hover:text-orange-300 px-2 py-0.5"
                        >
                          ADD +
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Checkout Drawer */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#121824] border-t border-gray-800 p-4 shadow-2xl">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total ({totalItemsCount} items)</span>
              <span className="text-xl font-extrabold text-orange-400">₹{cartGrandTotal}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Your Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-[#161F2E] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                placeholder="Notes (e.g. Less spicy)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="bg-[#161F2E] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPlacingOrder ? 'Placing Order...' : 'Place Order 🚀'}
            </button>
          </div>
        </div>
      )}

      {/* Order Success Popup */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-gray-800 rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🎉
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Order Received!</h2>
            <p className="text-xs text-gray-400 mb-6">
              Your order has been sent to the kitchen for Table #{tableNum}.
            </p>
            <button
              onClick={() => setOrderSuccess(false)}
              className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}