// ─────────────────────────────────────
// products.js — Product catalogue data
// ─────────────────────────────────────

const products = [
  {
    id: 1, cat: 'flights', icon: '✈️',
    color: 'linear-gradient(135deg,#e8f0ff,#d0dcff)',
    name: 'NYC → LAX Economy',
    desc: 'Direct flight, AI-curated lowest fare',
    price: 179, oldPrice: 249, badge: 'AI Pick', badgeType: '', qty: 0
  },
  {
    id: 2, cat: 'flights', icon: '🛫',
    color: 'linear-gradient(135deg,#e8f0ff,#d0dcff)',
    name: 'JFK → LHR Business',
    desc: 'Non-stop, premium business class deal',
    price: 1299, oldPrice: 1890, badge: 'Sale', badgeType: 'sale', qty: 0
  },
  {
    id: 3, cat: 'lounge', icon: '🛋️',
    color: 'linear-gradient(135deg,#fff0f5,#ffd6e8)',
    name: 'Priority Lounge Pass',
    desc: 'Access 1,200+ lounges worldwide',
    price: 49, oldPrice: null, badge: 'New', badgeType: 'new', qty: 0
  },
  {
    id: 4, cat: 'lounge', icon: '🥂',
    color: 'linear-gradient(135deg,#fff8e8,#ffecc0)',
    name: 'Premium Lounge Bundle',
    desc: 'Unlimited access for 30 days',
    price: 129, oldPrice: 199, badge: 'Sale', badgeType: 'sale', qty: 0
  },
  {
    id: 5, cat: 'upgrades', icon: '⬆️',
    color: 'linear-gradient(135deg,#e8fff5,#c0f5e0)',
    name: 'Seat Upgrade Credit',
    desc: '$100 credit for seat upgrades on any airline',
    price: 89, oldPrice: null, badge: '', badgeType: '', qty: 0
  },
  {
    id: 6, cat: 'upgrades', icon: '🎧',
    color: 'linear-gradient(135deg,#f0e8ff,#dcc0ff)',
    name: 'In-Flight Premium Kit',
    desc: 'Noise-cancelling headphones + amenity kit',
    price: 59, oldPrice: 79, badge: 'Sale', badgeType: 'sale', qty: 0
  },
  {
    id: 7, cat: 'essentials', icon: '🎒',
    color: 'linear-gradient(135deg,#e8f5ff,#c0e0ff)',
    name: 'Smart Travel Backpack',
    desc: 'Carry-on approved, USB charging, anti-theft',
    price: 119, oldPrice: null, badge: 'New', badgeType: 'new', qty: 0
  },
  {
    id: 8, cat: 'essentials', icon: '🔌',
    color: 'linear-gradient(135deg,#fff5e8,#ffdfc0)',
    name: 'Universal Travel Adapter',
    desc: 'Works in 150+ countries, 4 USB ports',
    price: 34, oldPrice: 44, badge: 'Sale', badgeType: 'sale', qty: 0
  },
  {
    id: 9, cat: 'insurance', icon: '🛡️',
    color: 'linear-gradient(135deg,#e8ffee,#c0f0ce)',
    name: 'Trip Protection Basic',
    desc: 'Coverage for cancellations & delays',
    price: 29, oldPrice: null, badge: '', badgeType: '', qty: 0
  },
  {
    id: 10, cat: 'insurance', icon: '🏥',
    color: 'linear-gradient(135deg,#ffe8e8,#ffc0c0)',
    name: 'Full Travel Insurance',
    desc: 'Medical, luggage, trip cancellation & more',
    price: 89, oldPrice: 129, badge: 'Best Value', badgeType: '', qty: 0
  },
  {
    id: 11, cat: 'flights', icon: '🚀',
    color: 'linear-gradient(135deg,#e8e8ff,#c8c0ff)',
    name: 'Flexible Fare Bundle',
    desc: 'Change your flight up to 3 times free',
    price: 249, oldPrice: 399, badge: 'AI Pick', badgeType: '', qty: 0
  },
  {
    id: 12, cat: 'essentials', icon: '💼',
    color: 'linear-gradient(135deg,#f5f0e8,#eeddc0)',
    name: 'Premium Luggage Tag Set',
    desc: 'Smart NFC tags with AirLume tracking',
    price: 24, oldPrice: null, badge: 'New', badgeType: 'new', qty: 0
  }
];
