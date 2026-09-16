import { supabase } from "@/lib/supabase";

export interface MenuItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  price_lkr: number;
  image_url: string | null;
  badge: string | null;
  is_available: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export const MENU_CATEGORIES = [
  "Cakes",
  "Cupcakes",
  "Wedding Cakes",
  "Desserts",
  "Cookies",
  "Specialties",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

import type { ShopifyProduct } from "@/lib/shopify";

export const MENU_BADGES = [
  "Best Seller",
  "Signature",
  "Popular",
  "New",
  "Chef's Special",
] as const;

export type MenuBadge = (typeof MENU_BADGES)[number];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Adapter to convert a Supabase MenuItem into a standard ShopifyProduct structure
 * for seamless integration with existing ProductCard, CartDrawer, and detail views.
 */
export function menuItemToShopifyProduct(item: MenuItem): ShopifyProduct {
  const priceStr = (item.price_lkr || 0).toFixed(2);
  return {
    node: {
      id: `menu-item-${item.id}`,
      title: item.title,
      description: item.description || "",
      handle: item.slug,
      productType: item.category,
      tags: item.badge ? [item.badge] : [],
      priceRange: {
        minVariantPrice: {
          amount: priceStr,
          currencyCode: "LKR",
        },
      },
      images: {
        edges: item.image_url
          ? [
              {
                node: {
                  url: item.image_url,
                  altText: item.title,
                },
              },
            ]
          : [],
      },
      variants: {
        edges: [
          {
            node: {
              id: `menu-item-var-${item.id}`,
              title: item.title,
              price: {
                amount: priceStr,
                currencyCode: "LKR",
              },
              availableForSale: item.is_available,
              selectedOptions: [
                {
                  name: "Category",
                  value: item.category,
                },
              ],
            },
          },
        ],
      },
      options: [
        {
          name: "Category",
          values: [item.category],
        },
      ],
    },
  };
}

/**
 * Fetch all menu items from Supabase
 */
export async function fetchMenuItems(onlyAvailable = false): Promise<MenuItem[]> {
  let query = supabase
    .from("menu_items")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (onlyAvailable) {
    query = query.eq("is_available", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching menu items:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch a single menu item by slug
 */
export async function fetchMenuItemBySlug(slug: string): Promise<MenuItem | null> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    return null;
  }
  return data;
}

/**
 * Upload an image file to the Supabase menu-images bucket
 */
export async function uploadMenuImage(file: File): Promise<string | null> {
  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `cakes/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading menu image:", uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from("menu-images").getPublicUrl(filePath);
  return data?.publicUrl || null;
}

/**
 * Create a new menu item (Admin only)
 */
export async function createMenuItem(
  item: Omit<MenuItem, "id" | "created_at" | "updated_at">,
  imageFile?: File | null,
): Promise<MenuItem> {
  let imageUrl = item.image_url;

  if (imageFile) {
    const uploadedUrl = await uploadMenuImage(imageFile);
    if (uploadedUrl) imageUrl = uploadedUrl;
  }

  // Ensure unique slug
  let finalSlug = item.slug || slugify(item.title);
  if (!finalSlug) finalSlug = `cake-${Date.now()}`;

  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      title: item.title,
      slug: finalSlug,
      description: item.description,
      category: item.category || "Cakes",
      price_lkr: Math.max(0, Math.round(item.price_lkr)),
      image_url: imageUrl,
      badge: item.badge || null,
      is_available: item.is_available ?? true,
      display_order: item.display_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating menu item:", error);
    throw error;
  }

  return data;
}

/**
 * Update an existing menu item (Admin only)
 */
export async function updateMenuItem(
  id: string,
  updates: Partial<Omit<MenuItem, "id" | "created_at" | "updated_at">>,
  imageFile?: File | null,
): Promise<MenuItem> {
  let imageUrl = updates.image_url;

  if (imageFile) {
    const uploadedUrl = await uploadMenuImage(imageFile);
    if (uploadedUrl) imageUrl = uploadedUrl;
  }

  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (imageUrl !== undefined) {
    payload.image_url = imageUrl;
  }

  if (updates.price_lkr !== undefined) {
    payload.price_lkr = Math.max(0, Math.round(updates.price_lkr));
  }

  const { data, error } = await supabase
    .from("menu_items")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating menu item:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a menu item (Admin only)
 */
export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) {
    console.error("Error deleting menu item:", error);
    throw error;
  }
}
