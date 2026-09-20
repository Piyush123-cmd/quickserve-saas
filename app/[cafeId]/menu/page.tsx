'use client';

import React, { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Utensils,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  X,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  category_id?: string;
}

interface CafeDetails {
  id: string;
  name: string;
  slug: string;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

export default function CustomerMenuPage({
  params,
}: {
  params: Promise<{ cafeId: string }>;
}) {
  const resolvedParams = use(params);
  const cafeSlug = resolvedParams?.cafeId;
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';

  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customer Info State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [orderPlacing, setOrderPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    async function fetchMenuData() {
      if (!cafeSlug) {
        setLoading(false);
        setErrorMessage('Cafe Slug missing in URL.');
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        // Fetch Cafe
        const { data: cafeData, error: cafeErr } = await supabase
          .from('cafes')
          .select('id, name, slug')
          .eq('slug', cafeSlug)
          .maybeSingle();

        if (cafeErr) {
          console.error('Cafe fetch error:', cafeErr);
          setErrorMessage(`Database Error: ${cafeErr.message}`);
          return;
        }

        if (!cafeData) {
          setErrorMessage(`Cafe slug "${cafeSlug}" database me nahi mila.`);
          return;
        }

        setCafe(cafeData);

        // Fetch Categories
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('*')
          .eq('cafe_id', cafeData.id);

        if (catErr) {
          console.warn('Categories not found or table missing:', catErr.message);
        } else if (catData) {
          setCategories(catData);
        }

        // Fetch Menu Items
        const { data: itemData, error: itemErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('cafe_id', cafeData.id)
          .eq('is_available', true);

        if (itemErr) {
          console.error('Menu Items Fetch Error:', itemErr.message);
        } else if (itemData) {
          setMenuItems(itemData);
        }
      } catch (err: any) {
        console.error('Unexpected error fetching menu:', err);
        setErrorMessage(err?.message || 'Something went wrong while fetching data.');
      } finally {
        setLoading(false);
      }
    }

    fetchMenuData();
  }, [cafeSlug]);

  const updateCart = (item: MenuItem, delta: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.item.id === item.id);
      if (!existing) {
        if (delta > 0) return [...prevCart, { item, quantity: 1 }];
        return prevCart;
      }
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prevCart.filter((ci) => ci.item.id !== item.id);
      }
      return prevCart.map((ci) =>
        ci.item.id === item.id ? { ...ci, quantity: newQty } : ci
      );
    });
  };

  const totalAmount = cart.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);
  const totalItemsCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafe || cart.length === 0) return;

    try {
      setOrderPlacing(true);

      const orderPayload: Record<string, any> = {
        cafe_id: cafe.id,
        table_number: parseInt(tableNumber) || 1,
        customer_name: customerName || 'Guest',
        customer_phone: customerPhone || null,
        total_amount: totalAmount,
        status: 'pending',
      };

      if (notes.trim()) {
        orderPayload.notes = notes.trim();
      }

      // Create Order
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderErr) {
        console.error('Order Insert Error details:', JSON.stringify(orderErr, null, 2));
        throw new Error(orderErr.message || orderErr.details || 'Order insert failed');
      }

      // Insert Order Items (with fallback for column names)
      const orderItems = cart.map((ci) => ({
        order_id: orderData.id,
        menu_item_id: ci.item.id,
        quantity: ci.quantity,
        price_per_item: ci.item.price,
        price: ci.item.price,
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsErr) {
        console.error('Order Items Insert Error details:', JSON.stringify(itemsErr, null, 2));
        throw new Error(
          itemsErr.message ||
            itemsErr.details ||
            `Order items insert failed: ${itemsErr.hint || ''}`
        );
      }

      setCart([]);
      setIsCartOpen(false);
      setOrderSuccess(true);
    } catch (err: any) {
      console.error('Failed to place order:', err);
      const errMsg =
        err?.message ||
        err?.details ||
        JSON.stringify(err, Object.getOwnPropertyNames(err));
      alert(`Order Failed Error Details:\n${errMsg}`);
    } finally {
      setOrderPlacing(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesVeg = vegOnly ? item.is_veg : true;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesVeg && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-orange-500" />
          <p className="text-xs text-slate-400">Loading Menu...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !cafe) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-200">Cafe Not Found</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
          {errorMessage || 'Requested Cafe details fetch nahi ho paaye.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32 max-w-md mx-auto relative shadow-2xl">
      {/* Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              <Utensils className="text-orange-500 w-5 h-5" /> {cafe.name}
            </h1>
            <p className="text-xs text-slate-400">Digital QR Menu</p>
          </div>
          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold px-3 py-1 rounded-full">
            Table #{tableNumber}
          </span>
        </div>

        {/* Search & Veg Filter */}
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
              vegOnly
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Veg Only
          </button>
        </div>

        {/* Categories Chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mt-3 no-scrollbar pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Menu List */}
      <main className="p-4 space-y-3">
        {filteredItems.length === 0 ? (
          <p className="text-center py-10 text-slate-500 text-sm">
            {menuItems.length === 0
              ? 'Abhi menu items available nahi hain.'
              : 'Koi dish nahi mili.'}
          </p>
        ) : (
          filteredItems.map((item) => {
            const cartItem = cart.find((ci) => ci.item.id === item.id);
            const qty = cartItem ? cartItem.quantity : 0;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-2xl flex justify-between items-center gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.is_veg ? 'bg-emerald-400' : 'bg-red-500'
                      }`}
                    />
                    <h3 className="font-semibold text-sm text-white">{item.name}</h3>
                  </div>
                  <p className="text-orange-400 text-xs font-bold mt-0.5">₹{item.price}</p>
                  {item.description && (
                    <p className="text-slate-400 text-[11px] mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Add / Stepper Button */}
                <div className="shrink-0">
                  {qty === 0 ? (
                    <button
                      onClick={() => updateCart(item, 1)}
                      className="px-4 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/30 font-semibold text-xs rounded-xl hover:bg-orange-500 hover:text-white transition"
                    >
                      ADD
                    </button>
                  ) : (
                    <div className="flex items-center bg-orange-500 text-white rounded-xl px-2 py-1 gap-2 font-bold text-xs">
                      <button onClick={() => updateCart(item, -1)} className="p-0.5">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span>{qty}</span>
                      <button onClick={() => updateCart(item, 1)} className="p-0.5">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Floating Cart Button */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 max-w-md mx-auto px-4 z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white p-3.5 rounded-2xl font-semibold flex items-center justify-between shadow-xl transition"
          >
            <div className="flex items-center gap-2 text-xs">
              <ShoppingBag className="w-4 h-4" />
              <span>
                {totalItemsCount} {totalItemsCount === 1 ? 'Item' : 'Items'} | ₹{totalAmount}
              </span>
            </div>
            <span className="text-xs flex items-center gap-1">
              View Cart <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      {/* Cart Modal / Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-end justify-center">
          <div className="bg-slate-900 border-t border-slate-800 w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="font-bold text-base flex items-center gap-2">
                <ShoppingBag className="text-orange-500 w-4 h-4" /> Your Order Summary
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3">
              {cart.map(({ item, quantity }) => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-slate-400">
                      ₹{item.price} × {quantity}
                    </p>
                  </div>
                  <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 gap-2 font-bold text-xs">
                    <button onClick={() => updateCart(item, -1)}>
                      <Minus className="w-3 h-3 text-slate-400" />
                    </button>
                    <span>{quantity}</span>
                    <button onClick={() => updateCart(item, 1)}>
                      <Plus className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Form Details */}
            <form onSubmit={handlePlaceOrder} className="space-y-3 pt-3 border-t border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="10 digit number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Cooking Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Less spicy, Extra cheese"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex justify-between items-center text-sm font-bold">
                <span>Total Amount:</span>
                <span className="text-orange-400">₹{totalAmount}</span>
              </div>

              <button
                type="submit"
                disabled={orderPlacing}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                {orderPlacing
                  ? 'Placing Order...'
                  : `Confirm & Place Order (Table #${tableNumber})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 max-w-xs w-full">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h2 className="text-lg font-bold">Order Sent to Kitchen! 🎉</h2>
            <p className="text-xs text-slate-400">
              Aapka order Table #{tableNumber} par record ho gaya hai.
            </p>
            <button
              onClick={() => setOrderSuccess(false)}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-xs font-semibold text-white transition"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}