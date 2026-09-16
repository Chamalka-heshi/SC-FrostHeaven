-- ==============================================================================
-- Migration: 20260916000001_phase9a_menu_items_and_storage.sql
-- Description: Phase 9A - Menu Items Catalog Table & Storage Bucket for Cake Photos
-- ==============================================================================

-- 1. CREATE public.menu_items TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL DEFAULT 'Cakes',
  price_lkr INTEGER NOT NULL CHECK (price_lkr >= 0),
  image_url TEXT NULL,
  badge TEXT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_slug ON public.menu_items(slug);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR public.menu_items
DROP POLICY IF EXISTS "Public can view available menu items or admins all" ON public.menu_items;
CREATE POLICY "Public can view available menu items or admins all"
  ON public.menu_items
  FOR SELECT
  TO public
  USING (
    is_available = true
    OR (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can insert menu_items" ON public.menu_items;
CREATE POLICY "Admins can insert menu_items"
  ON public.menu_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update menu_items" ON public.menu_items;
CREATE POLICY "Admins can update menu_items"
  ON public.menu_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete menu_items" ON public.menu_items;
CREATE POLICY "Admins can delete menu_items"
  ON public.menu_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 4. SETUP STORAGE BUCKET: menu-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage RLS policies for menu-images
DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;
CREATE POLICY "Public can view menu images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Admins can upload menu images" ON storage.objects;
CREATE POLICY "Admins can upload menu images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update menu images" ON storage.objects;
CREATE POLICY "Admins can update menu images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete menu images" ON storage.objects;
CREATE POLICY "Admins can delete menu images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 5. SEED INITIAL SIGNATURE CAKES & DESSERTS (if table is empty)
INSERT INTO public.menu_items (title, slug, description, category, price_lkr, image_url, badge, is_available, display_order)
SELECT v.title, v.slug, v.description, v.category, v.price_lkr, v.image_url, v.badge, v.is_available, v.display_order
FROM (VALUES
  (
    'Signature Belgian Chocolate Ganache Cake',
    'belgian-chocolate-ganache-cake',
    'Rich layers of moist dark chocolate sponge enveloped in silky Belgian chocolate ganache and chocolate curls.',
    'Cakes',
    12500,
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=1000&auto=format&fit=crop',
    'Best Seller',
    true,
    1
  ),
  (
    'Vanilla Bean Velvet Ribbon Cake',
    'vanilla-bean-velvet-ribbon-cake',
    'Classic Sri Lankan style fluffy butter ribbon cake with Madagascar vanilla bean buttercream and handcrafted sugar blossoms.',
    'Cakes',
    9800,
    'https://images.unsplash.com/photo-1535141192574-5d4897c13136?q=80&w=1000&auto=format&fit=crop',
    'Popular',
    true,
    2
  ),
  (
    'Strawberry Rosewater Chiffon Cake',
    'strawberry-rosewater-chiffon-cake',
    'Featherlight strawberry chiffon infused with rosewater cream and topped with fresh Nuwara Eliya strawberries.',
    'Cakes',
    11500,
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=1000&auto=format&fit=crop',
    'Signature',
    true,
    3
  ),
  (
    'Artisanal Pastel Cupcake Box (6 Pcs)',
    'artisanal-pastel-cupcake-box-6pcs',
    'Assortment of vanilla bean, red velvet, salted caramel, and chocolate fudge cupcakes with delicate piped rosettes.',
    'Cupcakes',
    4200,
    'https://images.unsplash.com/photo-1587668178277-295251f900ce?q=80&w=1000&auto=format&fit=crop',
    'New',
    true,
    4
  ),
  (
    'Lotus Biscoff Caramel Drizzle Cake',
    'lotus-biscoff-caramel-drizzle-cake',
    'Spiced speculoos sponge layered with creamy Biscoff spread, caramel crunch pearls, and gold leaf accents.',
    'Cakes',
    13800,
    'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=1000&auto=format&fit=crop',
    'Best Seller',
    true,
    5
  ),
  (
    'French Macaron Gift Collection (12 Pcs)',
    'french-macaron-gift-collection-12pcs',
    'Delicate crisp almond meringue shells with pistachio, raspberry, salted dark chocolate, and lemon curd fillings.',
    'Desserts',
    5600,
    'https://images.unsplash.com/photo-1569864358642-9d1684040f43?q=80&w=1000&auto=format&fit=crop',
    'Popular',
    true,
    6
  )
) AS v(title, slug, description, category, price_lkr, image_url, badge, is_available, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items WHERE public.menu_items.slug = v.slug
);
