'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Plus, Minus, CheckCircle, Utensils } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  is_veg: boolean;
  image_url: string;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function CustomerMenuPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cafeId = params.cafeId as string;
  const tableNo = searchParams.get('table') || '1';

  const [cafeName, setCafeName] = useState('Loading...');
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch Cafe Details
      const { data: cafe } = await supabase.from('cafes').select('name').eq('id', cafeId).single();
      if (cafe) setCafeName(cafe.name);

      // 2. Fetch Categories
      const { data: cats } = await supabase.from('menu_categories').select('*').eq('cafe_id', cafeId).order('sort_order');
      if (cats) setCategories(cats);

      // 3. Fetch Menu Items
      const { data: items } = await supabase.from('menu_items').select('*').eq('cafe_id', cafeId).eq('is_available', true);
      if (items) setMenuItems(items);
    }
    if (cafeId) fetchData();
  }, [cafeId]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);

    try {
      // 1. Insert Order
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          cafe_id: cafeId,
          table_number: parseInt(tableNo, 10),
          total_amount: totalAmount,
          status: 'NEW',
          payment_status: 'PENDING',
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert Order Items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Success
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setCart([]);
      setOrderSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Order place karne me problem aayi, dubara try karein!');
    } finally {
      setIsOrdering(false);
    }
  };

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((item) => item.category_id === selectedCategory);

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="w-20 h-20 text-emerald-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-bold">Order Received!</h1>
        <p className="text-neutral-400 mt-2">
          Table <strong>#{tableNo}</strong> ka order kitchen me ja chuka hai.
        </p>
        <button
          onClick={() => setOrderSuccess(false)}
          className="mt-6 px-6 py-2.5 bg-emerald-500 text-black font-semibold rounded-xl hover:bg-emerald-400 transition"
        >
          Aur kuch order karein
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-32">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-neutral-900/80 backdrop-blur border-b border-neutral-800 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Utensils className="w-5 h-5 text-emerald-500" /> {cafeName}
            </h1>
            <p className="text-xs text-neutral-400">Ordering for Table #{tableNo}</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/20 font-medium">
            Dine-In
          </span>
        </div>
      </header>

      {/* Category Pills */}
      <div className="sticky top-[69px] z-10 bg-neutral-950/90 backdrop-blur border-b border-neutral-800/50 py-3 px-4 overflow-x-auto no-scrollbar">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-emerald-500 text-black font-semibold'
                : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {filteredItems.map((item) => {
          const cartItem = cart.find((i) => i.id === item.id);
          return (
            <div
              key={item.id}
              className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-4 flex gap-3.5 items-center justify-between"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      item.is_veg ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  <h3 className="font-medium text-sm text-neutral-100 truncate">{item.name}</h3>
                </div>
                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{item.description}</p>
                <span className="inline-block mt-2 font-bold text-sm text-emerald-400">
                  ₹{item.price}
                </span>
              </div>

              <div className="relative w-24 h-24 flex-shrink-0 flex flex-col items-center">
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'}
                  alt={item.name}
                  className="w-24 h-24 object-cover rounded-xl border border-neutral-800"
                />
                <div className="absolute -bottom-2 bg-neutral-950 border border-neutral-700 rounded-lg shadow-lg flex items-center overflow-hidden">
                  {cartItem ? (
                    <div className="flex items-center gap-2 px-2 py-0.5">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-emerald-400 hover:text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-white min-w-3 text-center">
                        {cartItem.quantity}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="text-emerald-400 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="px-3 py-1 bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition"
                    >
                      ADD
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Floating Cart Drawer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-900/90 backdrop-blur border-t border-neutral-800 z-30">
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-neutral-400">Total ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <p className="text-lg font-bold text-white">₹{totalAmount}</p>
            </div>
            <button
              onClick={placeOrder}
              disabled={isOrdering}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              {isOrdering ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}