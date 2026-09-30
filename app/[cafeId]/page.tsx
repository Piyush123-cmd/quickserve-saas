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
  Square,
  FileText,
  Download,
  AlertOctagon,
  PhoneCall,
  Utensils,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category?: string;
  is_veg: boolean;
  is_available: boolean;
  is_customisable?: boolean;
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
  logo_url?: string;
  upi_id?: string;
  is_active?: boolean;
  is_subscription_active?: boolean;
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

function getCategoryIcon(categoryName: string): string {
  const cat = categoryName.toLowerCase();
  if (cat.includes('drink') || cat.includes('beverage') || cat.includes('brew')) return '🥤';
  if (cat.includes('coffee') || cat.includes('tea') || cat.includes('chai')) return '☕';
  if (cat.includes('fast food') || cat.includes('burger') || cat.includes('pizza')) return '🍔';
  if (cat.includes('snack') || cat.includes('starter') || cat.includes('fry')) return '🍟';
  if (cat.includes('dessert') || cat.includes('cake') || cat.includes('sweet')) return '🍰';
  if (cat.includes('salad') || cat.includes('healthy')) return '🥗';
  if (cat.includes('egg')) return '🍳';
  return '🍽️';
}

function getFallbackImage(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('tea') || n.includes('chai')) return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&auto=format&fit=crop&q=60';
  if (n.includes('coffee')) return 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=300&auto=format&fit=crop&q=60';
  if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=60';
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&auto=format&fit=crop&q=60';
  if (n.includes('fry') || n.includes('fries')) return 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=300&auto=format&fit=crop&q=60';
  if (n.includes('sandwich')) return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=60';
  if (n.includes('pasta')) return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&auto=format&fit=crop&q=60';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60';
}

// Standard FSSAI Veg & Non-Veg Icon Component
function VegNonVegIcon({ isVeg }: { isVeg: boolean }) {
  return (
    <div className={`w-4 h-4 border-2 flex items-center justify-center shrink-0 rounded-[3px] p-[1px] ${
      isVeg ? 'border-emerald-600' : 'border-red-600'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        isVeg ? 'bg-emerald-600' : 'bg-red-600'
      }`} />
    </div>
  );
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'assistance'>('menu');

  // Checkout Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [upiPaymentConfirmed, setUpiPaymentConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Success & Bill Modals
  const [placedOrderDetails, setPlacedOrderDetails] = useState<Order | null>(null);
  const [showBillModal, setShowBillModal] = useState<Order | null>(null);

  // Modals
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [assistanceSent, setAssistanceSent] = useState(false);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [sessionOrderIds, setSessionOrderIds] = useState<string[]>([]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const savedTheme = localStorage.getItem('quickserve_theme');
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');

    async function initData() {
      if (!cafeSlug) return;
      try {
        setLoading(true);
        const { data: cafeData, error: cafeError } = await supabase
          .from('cafes')
          .select('*')
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

        // FIX: Session-based order tracking so new sessions/scans don't show old orders
        const sessionKey = `qs_session_orders_${cafeData.id}_t${tableNo}`;
        const savedSession = sessionStorage.getItem(sessionKey);
        if (savedSession) {
          setSessionOrderIds(JSON.parse(savedSession));
        } else {
          setSessionOrderIds([]);
        }

        fetchOrders(cafeData.id);

        const channel = supabase
          .channel(`customer_orders_${cafeData.id}_t${tableNo}`)
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
  }, [cafeSlug, tableNo]);

  const fetchOrders = async (cafeId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_items(name))')
      .eq('cafe_id', cafeId)
      .eq('table_no', tableNo)
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
      alert('⚠️ Please scan UPI QR and check "I Have Completed Payment via UPI" checkbox.');
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
          customer_phone: customerPhone || null,
          total_amount: totalAmount,
          payment_mode: selectedPaymentMode,
          payment_status: 'pending',
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

      const fullOrderObj: Order = {
        ...orderData,
        order_items: orderItems.map((i) => ({ ...i, id: i.menu_item_id, menu_items: { name: i.name } })),
      };

      const updatedIds = [orderData.id, ...sessionOrderIds];
      setSessionOrderIds(updatedIds);
      sessionStorage.setItem(`qs_session_orders_${cafe.id}_t${tableNo}`, JSON.stringify(updatedIds));

      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setShowCheckoutModal(false);
      setPlacedOrderDetails(fullOrderObj);
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

  // Dynamic Horizontal Categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    menuItems.forEach((item) => {
      if (item.category && item.category.trim() !== '') {
        cats.add(item.category.trim());
      }
    });
    return ['All', ...Array.from(cats)];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems
      .filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((i) => {
        if (filterType === 'veg') return i.is_veg;
        if (filterType === 'non-veg') return !i.is_veg;
        return true;
      })
      .filter((i) => {
        if (selectedCategory === 'All') return true;
        return (i.category || 'Main Menu') === selectedCategory;
      });
  }, [menuItems, searchQuery, filterType, selectedCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'Main Menu';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  const toggleCategoryAccordion = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const myOrders = orders.filter((o) => sessionOrderIds.includes(o.id));
  const activeMyOrder = myOrders.find((o) => o.status === 'pending' || o.status === 'preparing');

  const theme = {
    fontHeader: { fontFamily: "'Plus Jakarta Sans', sans-serif" },
    fontBody: { fontFamily: "'Inter', sans-serif" },
    header: isDarkMode 
      ? 'bg-slate-900/90 border-slate-800 text-white' 
      : 'bg-[#FEEEEC]/95 border-[#FAD7D2] text-slate-900 shadow-sm',
    card: isDarkMode 
      ? 'bg-slate-900/80 border-slate-800 text-white' 
      : 'bg-white border-[#FAD7D2] text-slate-900 shadow-md',
    panel: isDarkMode 
      ? 'bg-slate-900 border-slate-800 text-white' 
      : 'bg-white border-[#FAD7D2] text-slate-900 shadow-xl',
    input: isDarkMode 
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
      : 'bg-[#FFF7F2] border-[#FAD7D2] text-slate-900 placeholder-slate-400',
    subText: isDarkMode ? 'text-slate-400' : 'text-slate-600',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEEEEC] text-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  const isSubscriptionActive = cafe?.is_active ?? cafe?.is_subscription_active ?? true;

  if (cafe && isSubscriptionActive === false) {
    return (
      <div className="min-h-screen bg-[#FEEEEC] text-slate-900 flex items-center justify-center p-6 text-center" style={theme.fontBody}>
        <div className="max-w-md bg-white border border-red-200 rounded-3xl p-8 space-y-4 shadow-2xl">
          <AlertOctagon className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
          <h2 className="text-xl font-black text-red-500" style={theme.fontHeader}>Subscription Plan Expired 🚫</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            The QuickServe SaaS active subscription for <strong className="text-slate-900">{cafe.name}</strong> is currently paused or expired.
          </p>
          <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-[11px] text-slate-500">
            To restore live digital menu & QR ordering services, please contact QuickServe Enterprise Support.
          </div>
          <a
            href="tel:+919876543210"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition shadow-lg"
          >
            <PhoneCall className="w-4 h-4" /> Contact QuickServe Support
          </a>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#FEEEEC] text-slate-900 flex items-center justify-center p-6 text-center" style={theme.fontBody}>
        <p className="text-red-500 font-bold">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen pb-36 transition-colors duration-200"
      style={{ backgroundColor: isDarkMode ? '#020617' : '#FEEEEC', ...theme.fontBody }}
    >
      {/* HEADER WITH CAFE LOGO */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md p-3.5 ${theme.header}`}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {cafe?.logo_url ? (
              <img
                src={cafe.logo_url}
                alt={cafe.name}
                className="w-10 h-10 rounded-2xl object-cover border border-orange-500/30 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 font-black text-sm">
                {cafe?.name?.slice(0, 2).toUpperCase() || 'QS'}
              </div>
            )}
            <div>
              <h1 className="text-base font-extrabold flex items-center gap-1" style={theme.fontHeader}>
                <span>{cafe?.name || 'QuickServe'}</span>
                <Sparkles className="w-4 h-4 text-orange-500" />
              </h1>
              <p className={`text-[11px] font-semibold ${theme.subText}`}>Table #{tableNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssistanceModal(true)}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"
            >
              <Bell className="w-3.5 h-3.5 animate-bounce" /> Waiter
            </button>

            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-xl border transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-[#FAD7D2] text-orange-600 shadow-sm'}`}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* REALTIME DYNAMIC KITCHEN TRACKER BANNER */}
        {activeMyOrder && (
          <div
            onClick={() => setShowMyOrdersModal(true)}
            className={`border p-3.5 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
              isDarkMode ? 'bg-orange-500/10 border-orange-500/40 text-white' : 'bg-white border-orange-300 text-slate-900 shadow-md'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-orange-500 flex items-center gap-1" style={theme.fontHeader}>
                <Flame className="w-4 h-4 animate-pulse text-orange-500" /> Live Kitchen Order Status
              </span>
              <span className={`text-[10px] underline font-bold ${theme.subText}`}>View Ticket</span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className={`p-2 rounded-xl text-[11px] font-bold border transition ${
                activeMyOrder.status === 'pending' 
                  ? 'bg-orange-500 text-white border-orange-400 animate-pulse shadow-md' 
                  : 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
              }`}>
                1. Accepted 🕒
              </div>
              
              <div className={`p-2 rounded-xl text-[11px] font-bold border transition ${
                activeMyOrder.status === 'preparing' 
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse shadow-md' 
                  : activeMyOrder.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}>
                2. Cooking 🍳
              </div>

              <div className={`p-2 rounded-xl text-[11px] font-bold border transition ${
                activeMyOrder.status === 'completed'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md animate-bounce'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}>
                3. Ready 🍽️
              </div>
            </div>
          </div>
        )}

        {/* SEARCH & PETPOOJA STYLE OUTLINE CATEGORIES WITH TOP-RIGHT TICK BADGE */}
        <div className={`border p-3.5 rounded-2xl space-y-3 ${theme.panel}`}>
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${theme.subText}`} />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-orange-500 transition ${theme.input}`}
            />
          </div>

          {/* PETPOOJA STYLE HORIZONTAL SCROLLABLE CARDS WITH OUTLINE & TOP-RIGHT TICK BADGE */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`relative min-w-[90px] h-[75px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1 transition-all duration-200 border-2 ${
                    isSelected
                      ? 'bg-white border-orange-500 shadow-md text-orange-600 scale-105'
                      : isDarkMode 
                      ? 'bg-slate-800/90 border-slate-700 text-slate-300 hover:border-orange-400' 
                      : 'bg-white/90 border-slate-200 text-slate-600 hover:border-orange-300'
                  }`}
                >
                  {/* TOP-RIGHT CORNER TICK BADGE */}
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-md animate-in zoom-in-50">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}

                  <span className="text-xl">{cat === 'All' ? '✨' : getCategoryIcon(cat)}</span>
                  <span className="text-[11px] font-bold tracking-tight text-center line-clamp-1">
                    {cat}
                  </span>
                </button>
              );
            })}
          </div>

          {/* VEG / NON-VEG STANDARD FSSAI TOGGLES */}
          <div className="flex gap-2 pt-1 border-t border-orange-200/30">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${filterType === 'all' ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}
            >
              All ({menuItems.length})
            </button>
            <button
              onClick={() => setFilterType('veg')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition border ${filterType === 'veg' ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'border-emerald-600/30 text-emerald-600'}`}
            >
              <VegNonVegIcon isVeg={true} /> Pure Veg
            </button>
            <button
              onClick={() => setFilterType('non-veg')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition border ${filterType === 'non-veg' ? 'bg-red-600 text-white border-red-600 shadow' : 'border-red-600/30 text-red-600'}`}
            >
              <VegNonVegIcon isVeg={false} /> Non-Veg
            </button>
          </div>
        </div>

        {/* ACCORDION CATEGORIZED DISHES */}
        <div className="space-y-4">
          {Object.keys(groupedItems).length === 0 ? (
            <div className={`text-center py-12 text-xs ${theme.subText}`}>No dishes found.</div>
          ) : (
            Object.entries(groupedItems).map(([catName, items]) => {
              const isCollapsed = collapsedCategories[catName];
              return (
                <div key={catName} className="space-y-3">
                  <button
                    onClick={() => toggleCategoryAccordion(catName)}
                    className="w-full flex justify-between items-center py-2 px-1 border-b border-orange-200/40 text-left transition"
                  >
                    <h2 className="text-sm font-extrabold text-orange-500 flex items-center gap-2" style={theme.fontHeader}>
                      <span>{getCategoryIcon(catName)}</span>
                      <span>{catName} ({items.length})</span>
                    </h2>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-orange-500" /> : <ChevronUp className="w-4 h-4 text-orange-500" />}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-3">
                      {items.map((item) => {
                        const inCart = cart.find((i) => i.item.id === item.id);
                        const imgUrl = item.image_url || getFallbackImage(item.name);
                        const isDescExpanded = expandedDescriptions[item.id];

                        return (
                          <div key={item.id} className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all duration-300 hover:shadow-lg ${theme.card}`}>
                            <div className="flex-1 pr-1">
                              <div className="flex items-center gap-2 mb-1">
                                <VegNonVegIcon isVeg={item.is_veg} />
                                <h3 className="font-extrabold text-sm" style={theme.fontHeader}>{item.name}</h3>
                              </div>

                              <div className="text-sm font-black text-orange-500">₹{item.price.toFixed(2)}</div>

                              {item.description && (
                                <div className="mt-1">
                                  <p className={`text-xs leading-relaxed ${isDescExpanded ? '' : 'line-clamp-2'} ${theme.subText}`}>
                                    {item.description}
                                  </p>
                                  {item.description.length > 60 && (
                                    <button
                                      onClick={() => toggleDescription(item.id)}
                                      className="text-[10px] font-bold text-orange-500 mt-0.5 hover:underline"
                                    >
                                      {isDescExpanded ? 'Show Less' : 'Read More'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="relative shrink-0 flex flex-col items-center">
                              <img
                                src={imgUrl}
                                alt={item.name}
                                className="w-24 h-24 object-cover rounded-2xl border border-orange-200/50 shadow-sm"
                                loading="lazy"
                              />
                              <div className="absolute -bottom-2 flex flex-col items-center">
                                {inCart ? (
                                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-white rounded-xl px-2.5 py-1 shadow-lg">
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
                                    className="px-4 py-1.5 bg-white hover:bg-orange-500 text-orange-600 hover:text-white border border-orange-400 shadow-md font-extrabold text-xs rounded-xl uppercase tracking-wider transition-all duration-300 hover:scale-105"
                                  >
                                    + ADD
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* BOTTOM FLOATING CART BAR */}
      {cart.length > 0 && (
        <div className={`fixed bottom-16 left-0 right-0 p-3 border-t z-40 backdrop-blur-lg transition-all ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-orange-200 shadow-2xl'}`}>
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold rounded-2xl shadow-xl flex items-center justify-between px-5 text-sm transition-all duration-300 hover:scale-[1.01] active:scale-95"
              style={theme.fontHeader}
            >
              <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items | ₹{totalAmount}</span>
              <span className="flex items-center gap-1">Proceed to Pay →</span>
            </button>
          </div>
        </div>
      )}

      {/* PERSISTENT BOTTOM NAVIGATION BAR */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t z-50 backdrop-blur-md px-6 py-2.5 ${theme.header}`}>
        <div className="max-w-md mx-auto flex justify-between items-center text-center">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition ${
              activeTab === 'menu' ? 'text-orange-500 scale-105' : theme.subText
            }`}
          >
            <Utensils className="w-5 h-5" />
            <span>Menu</span>
          </button>

          <button
            onClick={() => setShowMyOrdersModal(true)}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold relative transition ${
              activeTab === 'orders' ? 'text-orange-500 scale-105' : theme.subText
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Orders ({myOrders.length})</span>
            {myOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {myOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAssistanceModal(true)}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition ${theme.subText}`}
          >
            <Bell className="w-5 h-5" />
            <span>Call Waiter</span>
          </button>

          <button
            onClick={() => {
              if (activeMyOrder) setShowBillModal(activeMyOrder);
              else alert('No active bill available.');
            }}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition ${theme.subText}`}
          >
            <FileText className="w-5 h-5" />
            <span>Pay Bill</span>
          </button>
        </div>
      </nav>

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border w-full max-w-sm rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto ${theme.panel}`}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-sm" style={theme.fontHeader}>Checkout & Pay</h3>
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
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 text-xs font-extrabold transition ${selectedPaymentMode === 'cash' ? 'border-orange-500 bg-orange-500/10 text-orange-600' : 'border-slate-300 bg-slate-50 text-slate-500'}`}
              >
                <Banknote className="w-5 h-5" />
                <span>Pay Counter (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMode('upi')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 text-xs font-extrabold transition ${selectedPaymentMode === 'upi' ? 'border-orange-500 bg-orange-500/10 text-orange-600' : 'border-slate-300 bg-slate-50 text-slate-500'}`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Pay via UPI QR</span>
              </button>
            </div>

            {selectedPaymentMode === 'upi' && (
              <div className="p-4 rounded-2xl border bg-white text-slate-900 text-center space-y-3 shadow-md">
                <p className="text-xs font-bold text-orange-600" style={theme.fontHeader}>Scan & Pay ₹{totalAmount}</p>
                <div className="p-2 bg-white rounded-2xl inline-block border border-orange-200 shadow-sm">
                  <QRCodeSVG value={upiPaymentUrl} size={150} />
                </div>
                <p className="text-[11px] font-mono text-slate-700 font-bold">{cafeUPI}</p>
                <a
                  href={upiPaymentUrl}
                  onClick={() => setUpiPaymentConfirmed(true)}
                  className="block w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition"
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
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl text-xs font-extrabold transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={theme.fontHeader}
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

      {/* POST ORDER SUCCESS MODAL */}
      {placedOrderDetails && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-orange-500/40 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 text-white shadow-2xl">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
            
            <div>
              <h2 className="text-xl font-black text-orange-500" style={theme.fontHeader}>Order Placed Successfully! 🍳</h2>
              <p className="text-xs text-slate-300 mt-1">Table #{tableNo} • Order status: Accepted 🕒</p>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-1.5 text-xs">
              <div className="flex justify-between font-bold text-slate-300">
                <span>Total Amount:</span>
                <span className="text-orange-400">₹{placedOrderDetails.total_amount}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Payment Mode:</span>
                <span className="uppercase font-mono">{placedOrderDetails.payment_mode}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowBillModal(placedOrderDetails);
                  setPlacedOrderDetails(null);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <FileText className="w-4 h-4" /> View & Download Digital Bill 📄
              </button>

              <button
                onClick={() => setPlacedOrderDetails(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition"
              >
                Back to Menu & Track Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE DIGITAL BILL MODAL */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl print:m-0 print:shadow-none">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h2 className="font-black text-lg text-slate-900" style={theme.fontHeader}>{cafe?.name || 'QuickServe Cafe'}</h2>
                <p className="text-[10px] text-slate-500">Digital Tax Invoice & Receipt</p>
              </div>
              <button onClick={() => setShowBillModal(null)} className="text-slate-400 hover:text-slate-700 print:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
                <span className="font-bold">Table #{tableNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment: {showBillModal.payment_mode?.toUpperCase()}</span>
                <span className="font-mono">Ref #{showBillModal.id.slice(0, 8)}</span>
              </div>
            </div>

            <div className="border-t border-b divide-y py-2 text-xs">
              {showBillModal.order_items?.map((it, idx) => (
                <div key={idx} className="py-1.5 flex justify-between font-medium">
                  <span>{it.name || it.menu_items?.name || 'Item'} x{it.quantity}</span>
                  <span className="font-bold">₹{(it.price || 0) * it.quantity}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-sm font-black pt-1">
              <span>Grand Total:</span>
              <span className="text-orange-600">₹{showBillModal.total_amount}</span>
            </div>

            <div className="space-y-2 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" /> Print / Save PDF Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALL WAITER MODAL */}
      {showAssistanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border w-full max-w-xs rounded-3xl p-5 space-y-4 text-center ${theme.panel}`}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm" style={theme.fontHeader}>Table #{tableNo} Assistance</h3>
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
                  className={`p-3 border rounded-2xl flex items-center gap-3 text-xs font-bold transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-[#FFF7F2] border-[#FAD7D2] text-slate-800'}`}
                >
                  <UserCheck className="w-4 h-4 text-orange-500" />
                  <span>Call Waiter to Table</span>
                </button>
                <button
                  onClick={() => handleSendAssistance('Bring Drinking Water')}
                  className={`p-3 border rounded-2xl flex items-center gap-3 text-xs font-bold transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-[#FFF7F2] border-[#FAD7D2] text-slate-800'}`}
                >
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span>Need Drinking Water</span>
                </button>
                <button
                  onClick={() => handleSendAssistance('Bring Table Bill')}
                  className={`p-3 border rounded-2xl flex items-center gap-3 text-xs font-bold transition ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-[#FFF7F2] border-[#FAD7D2] text-slate-800'}`}
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
          <div className={`border w-full max-w-md rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto ${theme.panel}`}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm flex items-center gap-1.5" style={theme.fontHeader}>
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
                  <div key={ord.id} className={`border rounded-2xl p-3.5 space-y-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-[#FFF7F2] border-[#FAD7D2] text-slate-900'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">Order #{myOrders.length - idx}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                        ord.status === 'completed' 
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' 
                          : ord.status === 'preparing'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse'
                          : 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                      }`}>
                        {ord.status === 'completed' ? 'Ready 🍽️' : ord.status === 'preparing' ? 'Cooking 🍳' : 'Accepted 🕒'}
                      </span>
                    </div>

                    <div className="divide-y text-xs text-slate-600">
                      {ord.order_items?.map((item) => (
                        <div key={item.id} className="py-1 flex justify-between">
                          <span>{item.name || item.menu_items?.name || 'Dish'}</span>
                          <span className="font-bold text-orange-500">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t text-xs">
                      <span className="font-bold">Total: ₹{ord.total_amount}</span>
                      <button
                        onClick={() => setShowBillModal(ord)}
                        className="text-[10px] bg-orange-500 text-white hover:bg-orange-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow transition"
                      >
                        <FileText className="w-3 h-3" /> Digital Bill
                      </button>
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
    <Suspense fallback={<div className="min-h-screen bg-[#FEEEEC] text-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div></div>}>
      <MenuContent cafeSlug={resolvedParams.cafeId} />
    </Suspense>
  );
}