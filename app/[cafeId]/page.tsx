'use client';

import { useEffect, useState, Suspense, use, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Minus, 
  CheckCircle, 
  Sparkles, 
  Sun, 
  Moon, 
  Bell, 
  History, 
  MessageSquareQuote, 
  X, 
  CreditCard, 
  Banknote, 
  Droplets, 
  Receipt, 
  UserCheck, 
  Flame, 
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  image_url?: string;
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

interface Order {
  id: string;
  table_no?: string;
  table_number?: number;
  customer_name: string;
  total_amount: number;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  created_at: string;
  special_instructions?: string;
  payment_mode?: string;
  payment_status?: string;
  order_items: {
    id: string;
    quantity: number;
    price_at_order?: number;
    price?: number;
    name?: string;
    menu_items?: { name: string };
  }[];
}

function getFallbackImage(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('tea') || n.includes('chai')) return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&auto=format&fit=crop&q=60';
  if (n.includes('coffee')) return 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=300&auto=format&fit=crop&q=60';
  if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=60';
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&auto=format&fit=crop&q=60';
  if (n.includes('fry') || n.includes('fries')) return 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=300&auto=format&fit=crop&q=60';
  if (n.includes('sandwich')) return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=60';
  if (n.includes('samosa')) return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=60';
  if (n.includes('pasta')) return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&auto=format&fit=crop&q=60';
  if (n.includes('cake') || n.includes('pastry')) return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&auto=format&fit=crop&q=60';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60';
}

function MenuContent({ cafeSlug }: { cafeSlug: string }) {
  const searchParams = useSearchParams();
  const tableNo = searchParams?.get('table') || '1';

  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI States
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Checkout Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [upiPaymentConfirmed, setUpiPaymentConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Modals
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [assistanceSent, setAssistanceSent] = useState(false);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [customerOrderIds, setCustomerOrderIds] = useState<string[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('quickserve_theme');
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');

    async function initData() {
      if (!cafeSlug) return;
      try {
        setLoading(true);
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

        const { data: menuData } = await supabase
          .from('menu_items')
          .select('*')
          .eq('cafe_id', cafeData.id)
          .eq('is_available', true);

        if (menuData) setMenuItems(menuData);

        const saved = localStorage.getItem(`quickserve_orders_${cafeData.id}`);
        if (saved) setCustomerOrderIds(JSON.parse(saved));

        fetchOrders(cafeData.id);

        const channel = supabase
          .channel(`customer_orders_${cafeData.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'orders',
              filter: `cafe_id=eq.${cafeData.id}`,
            },
            () => {
              fetchOrders(cafeData.id);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load menu details.');
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [cafeSlug]);

  const fetchOrders = async (cafeId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_items(name))')
      .eq('cafe_id', cafeId)
      .order('created_at', { ascending: false });
    if (data) setOrders(data as unknown as Order[]);
  };

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem('quickserve_theme', next ? 'dark' : 'light');
  };

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

  const totalAmount = cart.reduce((sum, i) => sum + i.item.price * i.quantity, 0);
  const cafeUPI = cafe?.upi_id || 'test1@upi';
  const upiPaymentUrl = `upi://pay?pa=${cafeUPI}&pn=${encodeURIComponent(cafe?.name || 'Cafe')}&am=${totalAmount}&cu=INR&tn=Table${tableNo}_Order`;

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || submitting || !cafe) return;

    if (selectedPaymentMode === 'upi' && !upiPaymentConfirmed) {
      alert('⚠️ Kripya UPI scan karke "I Have Paid" checkbox par tick karein!');
      return;
    }

    setSubmitting(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          cafe_id: cafe.id,
          table_no: tableNo,
          table_number: parseInt(tableNo, 10) || 1,
          customer_name: customerName || (customerPhone ? `Guest (${customerPhone})` : 'Guest'),
          total_amount: totalAmount,
          payment_mode: selectedPaymentMode,
          payment_status: selectedPaymentMode === 'upi' ? 'paid' : 'pending',
          status: 'pending',
          special_instructions: specialInstructions.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((c) => ({
        order_id: orderData.id,
        menu_item_id: c.item.id,
        quantity: c.quantity,
        price_at_order: c.item.price,
        price: c.item.price,
        name: c.item.name,
      }));

      await supabase.from('order_items').insert(orderItems);

      const updatedIds = [orderData.id, ...customerOrderIds];
      setCustomerOrderIds(updatedIds);
      localStorage.setItem(`quickserve_orders_${cafe.id}`, JSON.stringify(updatedIds));

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setShowCheckoutModal(false);
      setCart([]);
      setSpecialInstructions('');
      setUpiPaymentConfirmed(false);
      fetchOrders(cafe.id);
    } catch (err) {
      console.error(err);
      alert('Order placement failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAssistance = async (type: string) => {
    if (!cafe) return;
    await supabase.from('service_requests').insert({
      cafe_id: cafe.id,
      table_number: parseInt(tableNo, 10) || 1,
      request_type: type,
      status: 'pending',
    });
    setAssistanceSent(true);
    setTimeout(() => {
      setAssistanceSent(false);
      setShowAssistanceModal(false);
    }, 1800);
  };

  const filteredItems = useMemo(() => {
    return menuItems
      .filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((i) => {
        if (filterType === 'veg') return i.is_veg;
        if (filterType === 'non-veg') return !i.is_veg;
        return true;
      });
  }, [menuItems, searchQuery, filterType]);

  const myOrders = orders.filter((o) => customerOrderIds.includes(o.id));
  const activeMyOrder = myOrders.find((o) => o.status === 'pending' || o.status === 'preparing');

  const theme = {
    header: isDarkMode 
      ? 'bg-slate-900/90 border-slate-800 text-white' 
      : 'bg-white/95 border-orange-200 text-slate-900 shadow-sm',
    card: isDarkMode 
      ? 'bg-slate-900/80 border-slate-800 text-white' 
      : 'bg-white border-orange-200/80 text-slate-900 shadow-md',
    panel: isDarkMode 
      ? 'bg-slate-900 border-slate-800 text-white' 
      : 'bg-white border-orange-300 text-slate-900 shadow-xl',
    input: isDarkMode 
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
      : 'bg-orange-50/60 border-orange-300 text-slate-900 placeholder-slate-400',
    subText: isDarkMode ? 'text-slate-400' : 'text-slate-600',
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
        <p className="text-red-400 font-bold">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen font-sans pb-32 transition-colors duration-200"
      style={{ backgroundColor: isDarkMode ? '#020617' : '#FFFAF5' }}
    >
      {/* HEADER */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md p-3.5 ${theme.header}`}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold flex items-center gap-1.5">
              <span>{cafe?.name || 'QuickServe'}</span>
              <Sparkles className="w-4 h-4 text-orange-500" />
            </h1>
            <p className={`text-xs ${theme.subText}`}>Table #{tableNo}</p>
          </div>

          <div className="flex items-center gap-2">
            {myOrders.length > 0 && (
              <button
                onClick={() => setShowMyOrdersModal(true)}
                className="px-2.5 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/30 rounded-full text-xs font-semibold flex items-center gap-1 transition"
              >
                <History className="w-3.5 h-3.5" />
                <span>Orders ({myOrders.length})</span>
              </button>
            )}

            <button
              onClick={() => setShowAssistanceModal(true)}
              className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow transition"
            >
              <Bell className="w-3.5 h-3.5 animate-bounce" /> Call Waiter
            </button>

            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-xl border transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-orange-100 border-orange-300 text-orange-700'}`}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* LIVE ORDER TRACKER BANNER */}
        {activeMyOrder && (
          <div
            onClick={() => setShowMyOrdersModal(true)}
            className={`border p-3.5 rounded-2xl cursor-pointer transition shadow-md ${
              isDarkMode ? 'bg-orange-500/10 border-orange-500/40 text-white' : 'bg-white border-orange-300 text-slate-900 shadow-md'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-orange-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 animate-pulse text-orange-500" /> Live Kitchen Tracker
              </span>
              <span className={`text-[10px] underline ${theme.subText}`}>View Order Ticket</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className={`p-1.5 rounded-lg text-[10px] font-bold border ${activeMyOrder.status === 'pending' ? 'bg-orange-500 text-white border-orange-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'}`}>
                1. Received 🕒
              </div>
              <div className={`p-1.5 rounded-lg text-[10px] font-bold border ${activeMyOrder.status === 'preparing' ? 'bg-orange-500 text-white border-orange-400 animate-pulse' : 'bg-slate-800/20 text-slate-400 border-slate-700'}`}>
                2. Cooking 🍳
              </div>
              <div className="p-1.5 rounded-lg text-[10px] font-bold border bg-slate-800/20 text-slate-400 border-slate-700">
                3. Ready 🍽️
              </div>
            </div>
          </div>
        )}

        {/* SEARCH & FILTERS */}
        <div className={`border p-3.5 rounded-2xl space-y-3 ${theme.panel}`}>
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${theme.subText}`} />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${theme.input}`}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${filterType === 'all' ? 'bg-orange-500 text-white' : 'bg-orange-500/10 text-orange-600'}`}
            >
              All ({menuItems.length})
            </button>
            <button
              onClick={() => setFilterType('veg')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${filterType === 'veg' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Veg
            </button>
            <button
              onClick={() => setFilterType('non-veg')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${filterType === 'non-veg' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-600'}`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" /> Non-Veg
            </button>
          </div>
        </div>

        {/* DISHES LIST WITH IMAGES */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className={`text-center py-12 text-xs ${theme.subText}`}>No dishes found.</div>
          ) : (
            filteredItems.map((item) => {
              const inCart = cart.find((i) => i.item.id === item.id);
              const imgUrl = item.image_url || getFallbackImage(item.name);

              return (
                <div key={item.id} className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 ${theme.card}`}>
                  <div className="flex-1 pr-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <h3 className="font-bold text-sm">{item.name}</h3>
                    </div>
                    <div className="text-sm font-black text-orange-500">₹{item.price}</div>
                    {item.description && (
                      <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${theme.subText}`}>{item.description}</p>
                    )}
                  </div>

                  <div className="relative shrink-0 flex flex-col items-center">
                    <img
                      src={imgUrl}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-2xl border border-orange-200/50 shadow-sm"
                      loading="lazy"
                    />
                    <div className="absolute -bottom-2">
                      {inCart ? (
                        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-white rounded-xl px-2 py-1 shadow-lg">
                          <button onClick={() => removeFromCart(item.id)} className="p-0.5 hover:text-orange-400">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{inCart.quantity}</span>
                          <button onClick={() => addToCart(item)} className="p-0.5 text-orange-500">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="px-4 py-1 bg-white hover:bg-orange-500 text-slate-900 hover:text-white border border-orange-300 shadow-md font-black text-xs rounded-xl uppercase tracking-wider transition"
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

      {/* BOTTOM CART BAR */}
      {cart.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 p-4 border-t z-40 backdrop-blur-lg ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-orange-300 shadow-2xl'}`}>
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-between px-5 text-sm transition active:scale-98"
            >
              <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items | ₹{totalAmount}</span>
              <span>Proceed to Pay →</span>
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT & PAYMENT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto ${theme.panel}`}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm">Checkout & Pay</h3>
              <button onClick={() => setShowCheckoutModal(false)} className={theme.subText}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Your Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs ${theme.input}`}
              />
              <input
                type="tel"
                placeholder="Mobile Number (for e-Bill on WhatsApp)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs ${theme.input}`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[11px] font-semibold flex items-center gap-1 ${theme.subText}`}>
                <MessageSquareQuote className="w-3.5 h-3.5 text-orange-500" /> Special Cooking Instructions
              </label>
              <textarea
                placeholder="e.g. Extra spicy, less sugar, make it quick..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs h-16 resize-none ${theme.input}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedPaymentMode('cash');
                  setUpiPaymentConfirmed(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition ${selectedPaymentMode === 'cash' ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
              >
                <Banknote className="w-5 h-5" />
                <span>Pay Counter (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMode('upi')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition ${selectedPaymentMode === 'upi' ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Pay via UPI QR</span>
              </button>
            </div>

            {selectedPaymentMode === 'upi' && (
              <div className="p-4 rounded-xl border bg-white text-slate-900 text-center space-y-3 shadow-md">
                <p className="text-xs font-bold text-orange-600">Scan & Pay ₹{totalAmount}</p>
                <div className="p-2 bg-white rounded-xl inline-block border border-orange-200 shadow-sm">
                  <QRCodeSVG value={upiPaymentUrl} size={150} />
                </div>
                <p className="text-[11px] font-mono text-slate-700 font-bold">{cafeUPI}</p>
                <a
                  href={upiPaymentUrl}
                  onClick={() => setUpiPaymentConfirmed(true)}
                  className="block w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition"
                >
                  Pay Directly via GPay / PhonePe App
                </a>

                <div 
                  onClick={() => setUpiPaymentConfirmed(!upiPaymentConfirmed)}
                  className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200 cursor-pointer"
                >
                  {upiPaymentConfirmed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-[11px] font-bold text-slate-700">
                    I Have Completed Payment via UPI
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={submitting || (selectedPaymentMode === 'upi' && !upiPaymentConfirmed)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting 
                ? 'Placing Order...' 
                : (selectedPaymentMode === 'upi' && !upiPaymentConfirmed)
                ? 'Complete UPI Payment Above First'
                : `Confirm Order (₹${totalAmount})`}
            </button>
          </div>
        </div>
      )}

      {/* CALL WAITER MODAL */}
      {showAssistanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border w-full max-w-xs rounded-2xl p-5 space-y-4 text-center ${theme.panel}`}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">Table #{tableNo} Assistance</h3>
              <button onClick={() => setShowAssistanceModal(false)} className={theme.subText}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {assistanceSent ? (
              <div className="py-6 space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-bold">Staff Alerted!</p>
                <p className={`text-xs ${theme.subText}`}>Someone is coming to Table #{tableNo}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  onClick={() => handleSendAssistance('Call Waiter')}
                  className="p-3 border rounded-xl flex items-center gap-3 text-xs font-semibold bg-slate-800 hover:bg-orange-500/20 border-slate-700 text-white transition"
                >
                  <UserCheck className="w-4 h-4 text-orange-500" />
                  <span>Call Waiter to Table</span>
                </button>
                <button
                  onClick={() => handleSendAssistance('Bring Drinking Water')}
                  className="p-3 border rounded-xl flex items-center gap-3 text-xs font-semibold bg-slate-800 hover:bg-blue-500/20 border-slate-700 text-white transition"
                >
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span>Need Drinking Water</span>
                </button>
                <button
                  onClick={() => handleSendAssistance('Bring Table Bill')}
                  className="p-3 border rounded-xl flex items-center gap-3 text-xs font-semibold bg-slate-800 hover:bg-emerald-500/20 border-slate-700 text-white transition"
                >
                  <Receipt className="w-4 h-4 text-emerald-500" />
                  <span>Request Final Bill</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY ORDERS MODAL */}
      {showMyOrdersModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto ${theme.panel}`}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <History className="w-4 h-4 text-orange-500" /> My Orders (Table #{tableNo})
              </h3>
              <button onClick={() => setShowMyOrdersModal(false)} className={theme.subText}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {myOrders.length === 0 ? (
              <div className={`text-center py-8 text-xs ${theme.subText}`}>No active orders.</div>
            ) : (
              <div className="space-y-3">
                {myOrders.map((ord, idx) => (
                  <div key={ord.id} className="border border-slate-800 rounded-xl p-3.5 space-y-2 bg-slate-950 text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">Order #{myOrders.length - idx}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${ord.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 animate-pulse'}`}>
                        {ord.status === 'completed' ? 'Served' : ord.status === 'preparing' ? 'Cooking' : 'Received'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800 text-xs text-slate-300">
                      {ord.order_items?.map((item) => (
                        <div key={item.id} className="py-1 flex justify-between">
                          <span>{item.name || item.menu_items?.name || 'Dish'}</span>
                          <span className="font-bold text-orange-400">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {ord.special_instructions && (
                      <p className="text-[11px] text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                        Note: {ord.special_instructions}
                      </p>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
                      <span className="font-bold">Total: ₹{ord.total_amount}</span>
                      <span className="text-[10px] font-mono text-emerald-400">{ord.payment_mode?.toUpperCase() || 'CASH'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerMenuPage({ params }: { params: Promise<{ cafeId: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div></div>}>
      <MenuContent cafeSlug={resolvedParams.cafeId} />
    </Suspense>
  );
}