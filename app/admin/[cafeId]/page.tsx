'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, QrCode, UtensilsCrossed, CheckCircle, Printer } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

export default function AdminPage() {
  const params = useParams();
  const cafeId = params.cafeId as string;

  const [cafeName, setCafeName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<'menu' | 'qr'>('menu');

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [totalTables, setTotalTables] = useState(6);

  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const fetchData = async () => {
    const { data: cafe } = await supabase.from('cafes').select('name').eq('id', cafeId).single();
    if (cafe) setCafeName(cafe.name);

    const { data: cats } = await supabase.from('menu_categories').select('*').eq('cafe_id', cafeId);
    if (cats) {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    }

    const { data: items } = await supabase.from('menu_items').select('*').eq('cafe_id', cafeId).order('created_at', { ascending: false });
    if (items) setMenuItems(items);
  };

  useEffect(() => {
    if (cafeId) fetchData();
  }, [cafeId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !categoryId) return;

    await supabase.from('menu_items').insert({
      cafe_id: cafeId,
      category_id: categoryId,
      name,
      price: parseFloat(price),
      description,
      is_veg: isVeg,
      is_available: true,
    });

    setName('');
    setPrice('');
    setDescription('');
    fetchData();
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id);
    setMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_available: !currentStatus } : item))
    );
  };

  const deleteItem = async (id: string) => {
    if (confirm('Delete this item?')) {
      await supabase.from('menu_items').delete().eq('id', id);
      setMenuItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{cafeName} — Management</h1>
          <p className="text-xs text-neutral-400">Manage Menu & Generate Table QR Codes</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'menu' ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" /> Menu Items
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'qr' ? 'bg-emerald-500 text-black' : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            <QrCode className="w-4 h-4" /> Generate QR Codes
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {activeTab === 'menu' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add New Item Form */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-fit">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-emerald-400">
                <Plus className="w-5 h-5" /> Add Menu Item
              </h2>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cold Coffee"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="120"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Crispy and fresh..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="veg"
                    checked={isVeg}
                    onChange={(e) => setIsVeg(e.target.checked)}
                    className="rounded bg-neutral-950 border-neutral-800 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="veg" className="text-xs text-neutral-300">Pure Vegetarian</label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition"
                >
                  Save Item
                </button>
              </form>
            </div>

            {/* Menu List with Out of Stock Toggle */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-base font-bold mb-4">Current Menu ({menuItems.length})</h2>
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <h3 className="font-semibold text-sm">{item.name}</h3>
                      <span className="text-emerald-400 font-mono text-xs">₹{item.price}</span>
                    </div>
                    {item.description && <p className="text-xs text-neutral-400 mt-1">{item.description}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleAvailability(item.id, item.is_available)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition ${
                        item.is_available
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                    >
                      {item.is_available ? 'Available' : 'Out of Stock'}
                    </button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-neutral-500 hover:text-red-400 transition p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* QR Codes Tab */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">How many tables?</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={totalTables}
                  onChange={(e) => setTotalTables(parseInt(e.target.value) || 1)}
                  className="w-20 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-center font-bold"
                />
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs hover:bg-emerald-400 transition"
              >
                <Printer className="w-4 h-4" /> Print All QR Cards
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {Array.from({ length: totalTables }, (_, i) => i + 1).map((tNum) => {
                const qrLink = `${baseUrl}/menu/${cafeId}?table=${tNum}`;
                return (
                  <div
                    key={tNum}
                    className="bg-white text-black rounded-2xl p-6 border-2 border-neutral-200 flex flex-col items-center text-center shadow-md print:break-inside-avoid"
                  >
                    <h3 className="text-xl font-black uppercase tracking-tight">{cafeName}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Scan to View Menu & Order</p>
                    <div className="my-5 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                      <QRCodeSVG value={qrLink} size={160} />
                    </div>
                    <div className="px-4 py-1.5 bg-black text-white text-sm font-black rounded-lg">
                      TABLE #{tNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}