// Demo shops for the owner dashboard.
// Three kirana shops, each with its own name, city, default language, demo
// UPI VPA and its own shelf: stock/price overrides on top of the shared
// 34-item catalogue. The demo flow must work in every shop, so the overrides
// never put Basmati Rice, Groundnut Oil or Coffee Powder back in stock, and
// never take Aashirvaad Atta, Ponni Rice or Sugar off the shelf.

import { ITEMS } from './catalog.js';

export const SHOPS = [
  {
    id: 'sri-lakshmi',
    name: 'Sri Lakshmi Stores',
    city: 'Chennai',
    state: 'Tamil Nadu',
    lang: 'ta',
    vpa: 'srilakshmi@okhdfcbank',
    tagline: 'Mylapore’s neighbourhood kirana — Tamil-first voice counter.',
    stock: {
      'rice-ponni': 120, 'sugar': 80, 'oil-sunflower': 6, 'ghee': 3,
      'tea': 4, 'banana': 8, 'cumin': 2, 'mustard': 5,
    },
    price: { 'sugar': 48, 'rice-ponni': 64 },
  },
  {
    id: 'annapurna',
    name: 'Annapurna Kirana',
    city: 'Hyderabad',
    state: 'Telangana',
    lang: 'te',
    vpa: 'annapurna@okhdfcbank',
    tagline: 'Secunderabad’s family kirana — Telugu-first voice counter.',
    stock: {
      'rice-ponni': 4, 'dal-toor': 12, 'oil-sunflower': 40, 'banana': 30,
      'eggs': 24, 'milk': 6, 'detergent': 4,
    },
    price: { 'rice-ponni': 60, 'milk': 56 },
  },
  {
    id: 'sharma-general',
    name: 'Sharma General Store',
    city: 'Bengaluru',
    state: 'Karnataka',
    lang: 'kn',
    vpa: 'sharmastore@okhdfcbank',
    tagline: 'Malleshwaram’s general store — Kannada-first voice counter.',
    stock: {
      'atta-aashirvaad': 25, 'sugar': 30, 'bread': 3, 'curd': 8,
      'detergent': 5, 'rava': 6, 'poha': 4,
    },
    price: { 'atta-aashirvaad': 58, 'bread': 48 },
  },
];

export function listShops() {
  return SHOPS;
}

export function getShop(id) {
  return SHOPS.find((s) => s.id === id) || SHOPS[0];
}

// The shop's own shelf: shared catalogue items with this shop's stock and
// price overrides applied. Names/aliases are identical across shops, so
// intent matching (which works on names) is unchanged.
export function shopCatalog(shop) {
  const s = shop || SHOPS[0];
  return ITEMS.map((item) => ({
    ...item,
    names: { ...item.names },
    aliases: [...item.aliases],
    stock: s.stock && s.stock[item.id] !== undefined ? s.stock[item.id] : item.stock,
    price: s.price && s.price[item.id] !== undefined ? s.price[item.id] : item.price,
  }));
}

export function shopItem(shop, itemId) {
  return shopCatalog(shop).find((i) => i.id === itemId) || null;
}
