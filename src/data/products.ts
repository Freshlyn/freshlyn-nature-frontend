export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  stock_quantity: number;
  unit: string;
  is_available: boolean;
  created_at: string;
}

export const products: Product[] = [
  { id: 'prod_001', name: 'Milk', description: 'Fresh whole milk, 1 gallon', price: 2.99, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop', stock_quantity: 50, unit: 'gallon', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_002', name: 'Bread', description: 'Whole wheat bread loaf', price: 1.99, category: 'bakery', image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop', stock_quantity: 30, unit: 'loaf', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_003', name: 'Eggs', description: 'Large brown eggs, dozen', price: 3.49, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&auto=format&fit=crop', stock_quantity: 40, unit: 'dozen', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_004', name: 'Ghee', description: 'Pure cow ghee', price: 12.99, category: 'pantry', image_url: 'https://images.unsplash.com/photo-1631209121750-a9f656d4e194?w=400&auto=format&fit=crop', stock_quantity: 25, unit: 'jar', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_005', name: 'Paneer', description: 'Fresh paneer blocks', price: 4.99, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&auto=format&fit=crop', stock_quantity: 20, unit: 'block', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_006', name: 'Cheese', description: 'Cheddar cheese block', price: 5.49, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=400&auto=format&fit=crop', stock_quantity: 35, unit: 'block', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_007', name: 'Basmati Rice', description: 'Premium long grain rice, 10lb', price: 15.99, category: 'pantry', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop', stock_quantity: 60, unit: 'bag', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_008', name: 'Wheat Flour', description: 'Whole wheat flour, 5lb', price: 8.99, category: 'pantry', image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&auto=format&fit=crop', stock_quantity: 45, unit: 'bag', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_009', name: 'Sugar', description: 'White sugar, 2lb', price: 2.49, category: 'pantry', image_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400&auto=format&fit=crop', stock_quantity: 55, unit: 'bag', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_010', name: 'Spices Mix', description: 'Assorted indian spices', price: 4.99, category: 'pantry', image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop', stock_quantity: 30, unit: 'pack', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_011', name: 'Potato Chips', description: 'Classic salted chips', price: 1.49, category: 'snacks', image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop', stock_quantity: 100, unit: 'bag', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_012', name: 'Bananas', description: 'Fresh ripe bananas, bunch', price: 1.29, category: 'produce', image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&auto=format&fit=crop', stock_quantity: 80, unit: 'bunch', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_013', name: 'Tomatoes', description: 'Fresh red tomatoes, 1lb', price: 2.49, category: 'produce', image_url: 'https://images.unsplash.com/photo-1546470427-e26264be0b0e?w=400&auto=format&fit=crop', stock_quantity: 70, unit: 'lb', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_014', name: 'Onions', description: 'Yellow onions, 2lb bag', price: 1.99, category: 'produce', image_url: 'https://images.unsplash.com/photo-1618512496248-a07e4909e4e0?w=400&auto=format&fit=crop', stock_quantity: 65, unit: 'bag', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_015', name: 'Potatoes', description: 'Russet potatoes, 5lb bag', price: 3.99, category: 'produce', image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82abe63a?w=400&auto=format&fit=crop', stock_quantity: 50, unit: 'bag', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_016', name: 'Cookies', description: 'Chocolate chip cookies pack', price: 3.99, category: 'snacks', image_url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop', stock_quantity: 40, unit: 'pack', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_017', name: 'Croissants', description: 'Fresh butter croissants, 4 pack', price: 4.99, category: 'bakery', image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop', stock_quantity: 25, unit: 'pack', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_018', name: 'Yogurt', description: 'Greek yogurt, plain', price: 4.49, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&auto=format&fit=crop', stock_quantity: 45, unit: 'cup', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_019', name: 'Orange Juice', description: 'Fresh squeezed, 1L', price: 5.99, category: 'beverages', image_url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&auto=format&fit=crop', stock_quantity: 35, unit: 'bottle', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_020', name: 'Peanut Butter', description: 'Creamy peanut butter, 16oz', price: 4.99, category: 'pantry', image_url: 'https://images.unsplash.com/photo-1600189020840-464d23d56743?w=400&auto=format&fit=crop', stock_quantity: 30, unit: 'jar', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_021', name: 'Coconut', description: 'Fresh brown coconut', price: 1.49, category: 'produce', image_url: 'https://images.unsplash.com/photo-1580984969071-a8da8c33df00?w=400&auto=format&fit=crop', stock_quantity: 100, unit: 'unit', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_022', name: 'Curd', description: 'Fresh homestyle curd/dahi', price: 2.99, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&auto=format&fit=crop', stock_quantity: 80, unit: 'cup', is_available: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'prod_023', name: 'Buttermilk', description: 'Fresh churned buttermilk', price: 3.49, category: 'dairy', image_url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&auto=format&fit=crop', stock_quantity: 60, unit: 'bottle', is_available: true, created_at: '2024-01-01T00:00:00Z' },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  if (!category || category === 'all') return products.filter((p) => p.is_available);
  return products.filter((p) => p.category.toLowerCase() === category.toLowerCase() && p.is_available);
}

export function searchProducts(query: string, category?: string): Product[] {
  let filtered =
    category && category !== 'all'
      ? products.filter((p) => p.category.toLowerCase() === category.toLowerCase() && p.is_available)
      : products.filter((p) => p.is_available);

  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery),
    );
  }

  return filtered;
}

export function getAllCategories(): string[] {
  const categories = new Set(products.map((p) => p.category));
  return ['all', ...Array.from(categories)];
}
