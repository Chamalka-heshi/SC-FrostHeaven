-- Migration: 20260916000002_fix_vanilla_cake_image_url.sql
-- Description: Update Vanilla Bean Velvet Ribbon Cake image URL to a verified high-definition photo

UPDATE public.menu_items
SET image_url = 'https://images.unsplash.com/photo-1542826438-bd32f43d626f?q=80&w=1000&auto=format&fit=crop',
    updated_at = now()
WHERE slug = 'vanilla-bean-velvet-ribbon-cake';
