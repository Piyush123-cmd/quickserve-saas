'use client';

import { useEffect, useState, Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, Plus, Minus, CheckCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  category_id: string;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

interface CafeDetails {
  id: string;
  name: string;
  slug: string;
  upi_id?: string;
}

function MenuContent({ cafeSlug }: { cafeSlug: string }) {
  const searchParams = useSearchParams();
  const tableNo = searchParams?.get('table') || '1';

  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function initCafeAndMenu() {
      if (!cafeSlug) return;
      try {
        setLoading(true);
        
        // 1. Fetch Cafe UUID using Slug
        const { data: cafeData, error: cafeError } = await supabase
          .from('cafes')
          .select('id, name, slug, upi_id')
          .eq('slug', cafeSlug)
          .single();

        if (cafeError || !cafeData) {
          setErrorMsg('Cafe not found or invalid URL');
          return;
        }

        setCafe(cafeData);

        // 2. Fetch Menu Items using Cafe UUID
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('*')
          .eq('cafe_id', cafeData.id)
          .eq('is_available', true);

        if (!menuError && menuData) {
          setMenuItems(menuData);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setErrorMsg('Failed to load menu details.');
      } finally {
        setLoading(false);
      }
    }

    initCafeAndMenu();
  }, [cafeSlug]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce(
    (sum, i) => sum + i.item.price * i.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || submitting || !cafe) return;
    setSubmitting(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          cafe_id: cafe.id, // Direct mapping to Cafe UUID
          table_no: tableNo,
          customer_name: customerName || 'Guest',
          total_amount: totalAmount,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((c) => ({
        order_id: orderData.id,
        menu_item_id: c.item.id,
        quantity: c.quantity,
        price_at_order: c.item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setOrderSuccess(true);
      setCart([]);
    } catch (err) {
      console.error(err);
      alert('Order placement failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <p className="text-red-400 font-semibold">{errorMsg}</p>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4 animate-bounce" />
        <h1 className="text-2xl font-bold mb-2">Order Placed Successfully!</h1>
        <p className="text-slate-400 mb-6">
          Your order for <span className="text-orange-400 font-semibold">Table #{tableNo}</span> at {cafe?.name} has been sent to the kitchen.
        </p>
        <button
          onClick={() => setOrderSuccess(false)}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium transition"
        >
          Order More Items
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32">
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <span>{cafe?.name || 'QuickServe'}</span>
              <Sparkles className="w-4 h-4 text-orange-400" />
            </h1>
            <p className="text-xs text-slate-400">Ordering for Table #{tableNo}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold border border-orange-500/20">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-3">
        {menuItems.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No items available right now.
          </div>
        ) : (
          menuItems.map((item) => {
            const inCart = cart.find((i) => i.item.id === item.id);
            return (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        item.is_veg ? 'bg-emerald-400' : 'bg-red-500'
                      }`}
                    />
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="text-sm font-bold text-orange-400 mt-2">
                    ₹{item.price}
                  </div>
                </div>

                {inCart ? (
                  <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 hover:bg-slate-700 rounded-lg text-slate-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">
                      {inCart.quantity}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      className="p-1 bg-orange-500 hover:bg-orange-600 rounded-lg text-white"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-orange-500 border border-slate-700 hover:border-orange-500 rounded-xl text-xs font-semibold transition"
                  >
                    ADD
                  </button>
                )}
              </div>
            );
          })
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 z-40">
          <div className="max-w-md mx-auto space-y-3">
            <input
              type="text"
              placeholder="Your Name (Optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-between px-5 transition disabled:opacity-50"
            >
              <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items | ₹{totalAmount}</span>
              <span>{submitting ? 'Placing...' : 'Place Order →'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerMenuPage({
  params,
}: {
  params: Promise<{ cafeId: string }>;
}) {
  const resolvedParams = use(params);
  const cafeSlug = resolvedParams.cafeId;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
        </div>
      }
    >
      <MenuContent cafeSlug={cafeSlug} />
    </Suspense>
  );
}