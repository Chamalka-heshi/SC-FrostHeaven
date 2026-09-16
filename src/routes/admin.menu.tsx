import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Cake,
  PlusCircle,
  Search,
  Filter,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Upload,
  Sparkles,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  DollarSign,
  Tag,
  FolderPlus,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  MENU_CATEGORIES,
  MENU_BADGES,
  type MenuItem,
  type MenuCategory,
  type MenuBadge,
  slugify,
} from "@/lib/menu-api";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({
    meta: [
      { title: "Menu & Cake Management — SC Frost Heaven Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminMenuPage,
});

export function formatLKR(amount: number): string {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States (Add / Edit)
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategory, setFormCategory] = useState<string>("Cakes");
  const [formPrice, setFormPrice] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formBadge, setFormBadge] = useState<string>("");
  const [formAvailable, setFormAvailable] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all menu items
  const loadMenu = useCallback(async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);
      else setLoading(true);

      const data = await fetchMenuItems(false);
      setItems(data);
      if (showRefreshToast) {
        toast.success("Menu items refreshed.");
      }
    } catch (err: unknown) {
      console.error("Failed to load menu items:", err);
      toast.error("Failed to load menu items.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size must be less than 10MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Open Add Dialog
  const openAddDialog = () => {
    setFormTitle("");
    setFormSlug("");
    setFormCategory("Cakes");
    setFormPrice("");
    setFormDescription("");
    setFormBadge("");
    setFormAvailable(true);
    setImageFile(null);
    setImagePreview(null);
    setIsAddOpen(true);
  };

  // Open Edit Dialog
  const openEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormSlug(item.slug);
    setFormCategory(item.category);
    setFormPrice(item.price_lkr.toString());
    setFormDescription(item.description || "");
    setFormBadge(item.badge || "");
    setFormAvailable(item.is_available);
    setImageFile(null);
    setImagePreview(item.image_url);
  };

  // Handle Title Change & auto-slug
  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (!editingItem) {
      setFormSlug(slugify(val));
    }
  };

  // Submit Add Cake
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter a cake title.");
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price in LKR.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createMenuItem(
        {
          title: formTitle.trim(),
          slug: formSlug.trim() || slugify(formTitle),
          category: formCategory,
          price_lkr: priceNum,
          description: formDescription.trim() || null,
          badge: formBadge.trim() || null,
          is_available: formAvailable,
          image_url: null,
          display_order: items.length + 1,
        },
        imageFile,
      );

      toast.success(`"${formTitle}" added to the bakery menu!`);
      setIsAddOpen(false);
      loadMenu();
    } catch (err: unknown) {
      console.error("Error creating cake:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create cake.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Cake
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!formTitle.trim()) {
      toast.error("Please enter a cake title.");
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price in LKR.");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateMenuItem(
        editingItem.id,
        {
          title: formTitle.trim(),
          slug: formSlug.trim() || slugify(formTitle),
          category: formCategory,
          price_lkr: priceNum,
          description: formDescription.trim() || null,
          badge: formBadge.trim() || null,
          is_available: formAvailable,
          image_url: imagePreview,
        },
        imageFile,
      );

      toast.success(`"${formTitle}" updated successfully!`);
      setEditingItem(null);
      loadMenu();
    } catch (err: unknown) {
      console.error("Error updating cake:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update cake.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Availability directly
  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const nextStatus = !item.is_available;
      await updateMenuItem(item.id, { is_available: nextStatus });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: nextStatus } : i)),
      );
      toast.success(`"${item.title}" is now ${nextStatus ? "Available" : "Hidden / Sold Out"}.`);
    } catch (err) {
      toast.error("Failed to toggle availability status.");
    }
  };

  // Confirm Delete Cake
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;

    try {
      setIsSubmitting(true);
      await deleteMenuItem(deletingItem.id);
      toast.success(`"${deletingItem.title}" removed from menu.`);
      setDeletingItem(null);
      loadMenu();
    } catch (err: unknown) {
      console.error("Error deleting cake:", err);
      toast.error("Failed to delete cake.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      // Search
      if (q) {
        const titleMatch = item.title.toLowerCase().includes(q);
        const descMatch = (item.description || "").toLowerCase().includes(q);
        const badgeMatch = (item.badge || "").toLowerCase().includes(q);
        const catMatch = item.category.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !badgeMatch && !catMatch) return false;
      }
      // Category
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }
      // Availability
      if (availabilityFilter === "available" && !item.is_available) return false;
      if (availabilityFilter === "unavailable" && item.is_available) return false;

      return true;
    });
  }, [items, searchQuery, selectedCategory, availabilityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.is_available).length;
    const unavailable = total - available;
    const categoriesCount = new Set(items.map((i) => i.category)).size;
    return { total, available, unavailable, categoriesCount };
  }, [items]);

  return (
    <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <Cake className="h-4 w-4" />
            <span>Bakery Catalog Management</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mt-1">
            Menu & Cake Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, price, and showcase handcrafted cakes and desserts for customer online ordering.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMenu(true)}
            disabled={refreshing || loading}
            className="rounded-full shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={openAddDialog}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all font-medium"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>Add New Cake</span>
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Products</span>
            <Cake className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.total}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Available on Menu</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.available}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Sold Out / Hidden</span>
            <XCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.unavailable}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Categories</span>
            <Tag className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.categoriesCount}</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-border/70 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search cakes by title, description, or badge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 rounded-full border-border/70 bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="All">All Categories</option>
            {MENU_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Availability Filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as any)}
            className="h-9 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Availability</option>
            <option value="available">Available Only</option>
            <option value="unavailable">Sold Out / Hidden</option>
          </select>
        </div>
      </div>

      {/* CAKES GRID */}
      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">Loading bakery menu items...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Cake className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No menu items found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {searchQuery || selectedCategory !== "All"
              ? "Try adjusting your search query or category filters."
              : "Start by adding your first signature cake or dessert to the menu."}
          </p>
          <Button onClick={openAddDialog} className="mt-5 rounded-full bg-primary text-primary-foreground">
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>Add Your First Cake</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 ${
                item.is_available
                  ? "border-border/80 bg-card hover:border-primary/40 hover:shadow-soft"
                  : "border-border/40 bg-card/60 opacity-80"
              }`}
            >
              {/* Product Image Header */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/50">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-10 w-10 stroke-1" />
                    <span className="text-xs mt-1">No picture uploaded</span>
                  </div>
                )}

                {/* Badge Overlay */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {item.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground backdrop-blur-xs shadow-xs">
                      <Sparkles className="h-3 w-3" />
                      {item.badge}
                    </span>
                  )}
                  <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium text-foreground backdrop-blur-xs shadow-xs">
                    {item.category}
                  </span>
                </div>

                {/* Availability Badge */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => handleToggleAvailability(item)}
                    title={item.is_available ? "Click to mark as Sold Out" : "Click to mark as Available"}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-xs shadow-xs transition-colors ${
                      item.is_available
                        ? "bg-emerald-500/90 text-white hover:bg-emerald-600"
                        : "bg-amber-500/90 text-white hover:bg-amber-600"
                    }`}
                  >
                    {item.is_available ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Available</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Sold Out</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Product Info Body */}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                </div>

                <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.description || "No description provided."}
                </p>

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block">Price</span>
                    <span className="text-xl font-bold text-primary">
                      {formatLKR(item.price_lkr)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                      className="h-8 rounded-full border-border/80 px-3 hover:bg-primary/10 hover:text-primary text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingItem(item)}
                      className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD CAKE MODAL                                                            */}
      {/* ========================================================================= */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-card p-6 sm:p-8 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => !isSubmitting && setIsAddOpen(false)}
              className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Cake className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Add New Cake to Menu</h2>
                <p className="text-xs text-muted-foreground">Fill in details and upload a photo for customers to order.</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-6 space-y-5">
              {/* Image Upload Area */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Cake Picture (Upload from device)
                </Label>
                <div className="mt-2 flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border shadow-xs">
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-28 w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center p-2"
                    >
                      <Upload className="h-6 w-6 text-primary mb-1" />
                      <span className="text-[11px] font-medium text-muted-foreground">Upload Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">High resolution cake photo</p>
                    <p>Supports PNG, JPG, or WebP up to 10MB.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 rounded-full text-xs"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      <span>{imagePreview ? "Change Photo" : "Choose Photo"}</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Title & Category */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-medium">Cake Name / Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Belgian Dark Chocolate Ganache Cake"
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs font-medium">Category *</Label>
                  <select
                    id="category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {MENU_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price & Badge */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-xs font-medium">Price in LKR (Rs.) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      LKR
                    </span>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="12500"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      required
                      className="pl-12 rounded-xl text-base font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="badge" className="text-xs font-medium">Highlight Badge / Tag (Optional)</Label>
                  <select
                    id="badge"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">None (Standard)</option>
                    {MENU_BADGES.map((badge) => (
                      <option key={badge} value={badge}>
                        {badge}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-medium">Flavor Notes & Description</Label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Describe layers, sponge flavor, frosting, handcrafted toppings, and serving size..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Availability Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/70">
                <div>
                  <p className="text-sm font-medium text-foreground">Available for Customer Orders</p>
                  <p className="text-xs text-muted-foreground">Show this cake in the public /menu and enable direct add-to-cart.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="h-5 w-5 rounded-md accent-primary cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-full px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 font-medium shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Saving Cake...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      <span>Add Cake to Menu</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT CAKE MODAL                                                           */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-card p-6 sm:p-8 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => !isSubmitting && setEditingItem(null)}
              className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Edit3 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Edit Menu Cake</h2>
                <p className="text-xs text-muted-foreground">Update pricing, photos, flavor notes, or availability.</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-6 space-y-5">
              {/* Image Upload Area */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Cake Picture
                </Label>
                <div className="mt-2 flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border shadow-xs">
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={removeSelectedImage}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-28 w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center p-2"
                    >
                      <Upload className="h-6 w-6 text-primary mb-1" />
                      <span className="text-[11px] font-medium text-muted-foreground">Upload Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Current cake photo</p>
                    <p>Click below to replace with a new image.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 rounded-full text-xs"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      <span>Replace Photo</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Title & Category */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title" className="text-xs font-medium">Cake Name / Title *</Label>
                  <Input
                    id="edit-title"
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-category" className="text-xs font-medium">Category *</Label>
                  <select
                    id="edit-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {MENU_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price & Badge */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-price" className="text-xs font-medium">Price in LKR (Rs.) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      LKR
                    </span>
                    <Input
                      id="edit-price"
                      type="number"
                      min="0"
                      step="100"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      required
                      className="pl-12 rounded-xl text-base font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-badge" className="text-xs font-medium">Highlight Badge / Tag (Optional)</Label>
                  <select
                    id="edit-badge"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">None (Standard)</option>
                    {MENU_BADGES.map((badge) => (
                      <option key={badge} value={badge}>
                        {badge}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-description" className="text-xs font-medium">Flavor Notes & Description</Label>
                <textarea
                  id="edit-description"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Availability Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/70">
                <div>
                  <p className="text-sm font-medium text-foreground">Available for Customer Orders</p>
                  <p className="text-xs text-muted-foreground">Toggle off to mark as Sold Out / Hidden from /menu.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="h-5 w-5 rounded-md accent-primary cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  disabled={isSubmitting}
                  className="rounded-full px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 font-medium shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-semibold text-foreground">Remove Cake from Menu?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Are you sure you want to permanently delete <strong className="text-foreground font-medium">"{deletingItem.title}"</strong>?
              This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeletingItem(null)}
                disabled={isSubmitting}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="rounded-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete Cake</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
