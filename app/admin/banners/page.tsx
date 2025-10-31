"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "react-hot-toast"
import { Plus, Pencil, Trash2 } from "lucide-react"

type Banner = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  is_active: boolean
  display_order: number
  valid_from: string | null
  valid_until: string | null
  created_at: string | null
  updated_at: string | null
  special_offer_id: string | null
  restaurant_id: string | null
  imageMetadata?: {
    size: number
    dimensions: { width: number; height: number }
  }
}

type Restaurant = {
  id: string
  name: string
}

type SpecialOffer = {
  id: string
  title: string
  restaurant_id: string | null
}

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// Helper function to fetch image metadata
const fetchImageMetadata = async (url: string): Promise<{ size: number; dimensions: { width: number; height: number } }> => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        resolve({
          size: blob.size,
          dimensions: { width: img.width, height: img.height }
        })
      }
      img.onerror = () => {
        resolve({
          size: blob.size,
          dimensions: { width: 0, height: 0 }
        })
      }
      img.src = url
    })
  } catch (error) {
    return { size: 0, dimensions: { width: 0, height: 0 } }
  }
}

export default function AdminBannersPage() {
  const supabase = createClient()
  const [banners, setBanners] = useState<Banner[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editBanner, setEditBanner] = useState<Banner | null>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const { data: bannersData, error: bannersError } = await supabase
        .from("banners")
        .select("*")
        .order("display_order", { ascending: true })

      if (bannersError) throw bannersError
      const bannersList = (bannersData as Banner[]) || []

      // Fetch metadata for all banner images
      const bannersWithMetadata = await Promise.all(
        bannersList.map(async (banner) => {
          if (banner.image_url) {
            const metadata = await fetchImageMetadata(banner.image_url)
            return { ...banner, imageMetadata: metadata }
          }
          return banner
        })
      )

      setBanners(bannersWithMetadata)

      const { data: restros, error: restrosError } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name")

      if (restrosError) throw restrosError
      setRestaurants((restros as Restaurant[]) || [])

      const { data: offers, error: offersError } = await supabase
        .from("special_offers")
        .select("id, title, restaurant_id")
        .order("title")

      if (offersError) throw offersError
      setSpecialOffers((offers as SpecialOffer[]) || [])
    } catch (error) {
      console.error(error)
      toast.error("Failed to load banners")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openNewDialog = () => {
    setEditBanner(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (banner: Banner) => {
    setEditBanner(banner)
    setIsDialogOpen(true)
  }

  const handleDelete = async (banner: Banner) => {
    if (!confirm("Delete this banner?")) return
    try {
      // If the banner has an image in our storage bucket, remove it first
      if (banner.image_url && banner.image_url.includes('/storage/v1/object/public/special-offers/')) {
        const url = new URL(banner.image_url)
        const pathStart = url.pathname.indexOf('/special-offers/')
        const objectPath = pathStart >= 0 ? url.pathname.slice(pathStart + '/special-offers/'.length) : ''
        if (objectPath) {
          await supabase.storage.from('special-offers').remove([objectPath])
        }
      }

      const { error } = await supabase.from("banners").delete().eq("id", banner.id)
      if (error) throw error
      toast.success("Deleted")
      fetchData()
    } catch (error) {
      console.error(error)
      toast.error("Delete failed")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Banners</h2>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" /> Add Banner
        </Button>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div>Loading…</div>
        ) : banners.length === 0 ? (
          <div className="text-sm text-muted-foreground">No banners found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((b) => (
              <div key={b.id} className="border rounded-lg p-3 bg-white">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="font-medium">{b.title}</div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(b)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {b.image_url ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image_url} alt={b.title} className="w-full h-32 object-cover rounded" />
                      {b.imageMetadata && (
                        <div className="text-xs text-muted-foreground space-y-0.5 px-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Size:</span>
                            <span>{formatFileSize(b.imageMetadata.size)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Dimensions:</span>
                            <span>{b.imageMetadata.dimensions.width} × {b.imageMetadata.dimensions.height}px</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Status: {b.is_active ? "Active" : "Inactive"}</div>
                    <div>Order: {b.display_order}</div>
                    {b.restaurant_id && <div>Restaurant linked</div>}
                    {b.special_offer_id && <div>Special offer linked</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <BannerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        banner={editBanner}
        restaurants={restaurants}
        specialOffers={specialOffers}
        onSaved={() => {
          setIsDialogOpen(false)
          fetchData()
        }}
      />
    </div>
  )
}

function BannerDialog({
  open,
  onOpenChange,
  banner,
  restaurants,
  specialOffers,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  banner: Banner | null
  restaurants: Restaurant[]
  specialOffers: SpecialOffer[]
  onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = Boolean(banner)
  const [title, setTitle] = useState(banner?.title || "")
  const [description, setDescription] = useState(banner?.description || "")
  const [imageUrl, setImageUrl] = useState(banner?.image_url || "")
  const [isActive, setIsActive] = useState(banner?.is_active ?? true)
  const [displayOrder, setDisplayOrder] = useState(banner?.display_order?.toString() || "0")
  const [restaurantId, setRestaurantId] = useState<string | null>(banner?.restaurant_id || null)
  const [specialOfferId, setSpecialOfferId] = useState<string | null>(banner?.special_offer_id || null)

  // Date/Time state - separate for better control
  const [validFromDate, setValidFromDate] = useState("")
  const [validFromTime, setValidFromTime] = useState("")
  const [validUntilDate, setValidUntilDate] = useState("")
  const [validUntilTime, setValidUntilTime] = useState("")

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageMetadata, setImageMetadata] = useState<{ size: number; dimensions: { width: number; height: number } } | null>(null)

  // Helper functions to convert between dd/mm/yyyy and ISO
  const formatDateToDDMMYYYY = (isoDate: string | null): string => {
    if (!isoDate) return ""
    const date = new Date(isoDate)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const formatTimeToHHMM = (isoDate: string | null): string => {
    if (!isoDate) return ""
    const date = new Date(isoDate)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const parseDDMMYYYY = (dateStr: string, timeStr: string): string | null => {
    if (!dateStr) return null
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null

    const day = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1 // JavaScript months are 0-indexed
    const year = parseInt(parts[2])

    // Validate date parts
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null
    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900) return null

    const [hours, minutes] = timeStr ? timeStr.split(':').map(Number) : [0, 0]

    const date = new Date(year, month, day, hours || 0, minutes || 0)
    return date.toISOString()
  }

  // Format date input as user types (add slashes automatically)
  const handleDateInput = (value: string, setter: (val: string) => void) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')

    // Format as DD/MM/YYYY
    let formatted = digits
    if (digits.length >= 2) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2)
    }
    if (digits.length >= 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8)
    }

    setter(formatted)
  }

  useEffect(() => {
    setTitle(banner?.title || "")
    setDescription(banner?.description || "")
    setImageUrl(banner?.image_url || "")
    setIsActive(banner?.is_active ?? true)
    setDisplayOrder(banner?.display_order?.toString() || "0")
    setRestaurantId(banner?.restaurant_id || null)
    setSpecialOfferId(banner?.special_offer_id || null)
    setImageMetadata(banner?.imageMetadata || null)

    // Parse dates
    setValidFromDate(formatDateToDDMMYYYY(banner?.valid_from || null))
    setValidFromTime(formatTimeToHHMM(banner?.valid_from || null))
    setValidUntilDate(formatDateToDDMMYYYY(banner?.valid_until || null))
    setValidUntilTime(formatTimeToHHMM(banner?.valid_until || null))

    // Fetch metadata if image URL exists
    if (banner?.image_url) {
      fetchImageMetadata(banner.image_url).then(setImageMetadata)
    }
  }, [banner])

  // Clear special offer when restaurant changes
  useEffect(() => {
    if (restaurantId && specialOfferId) {
      const selectedOffer = specialOffers.find(o => o.id === specialOfferId)
      if (selectedOffer && selectedOffer.restaurant_id !== restaurantId) {
        setSpecialOfferId(null)
      }
    }
  }, [restaurantId, specialOfferId, specialOffers])

  // Filter special offers by selected restaurant
  const filteredSpecialOffers = useMemo(() => {
    if (!restaurantId) return []
    return specialOffers.filter(o => o.restaurant_id === restaurantId)
  }, [restaurantId, specialOffers])

  const canSave = useMemo(() => {
    if (!title) return false
    return true
  }, [title])

  const handleSave = async () => {
    try {
      setSaving(true)
      const payload: Partial<Banner> = {
        title,
        description,
        image_url: imageUrl || null,
        is_active: isActive,
        display_order: parseInt(displayOrder) || 0,
        restaurant_id: restaurantId || null,
        special_offer_id: specialOfferId || null,
        valid_from: parseDDMMYYYY(validFromDate, validFromTime),
        valid_until: parseDDMMYYYY(validUntilDate, validUntilTime),
      }

      if (isEdit && banner) {
        const { error } = await supabase
          .from("banners")
          .update(payload)
          .eq("id", banner.id)
        if (error) throw error
        toast.success("Banner updated")
      } else {
        const { error } = await supabase
          .from("banners")
          .insert(payload)
        if (error) throw error
        toast.success("Banner created")
      }

      onSaved()
    } catch (error) {
      console.error(error)
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File) => {
    if (!file) return
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase
        .storage
        .from('special-offers')
        .upload(filePath, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: pub } = supabase
        .storage
        .from('special-offers')
        .getPublicUrl(filePath)

      if (pub?.publicUrl) {
        setImageUrl(pub.publicUrl)
        // Fetch metadata for newly uploaded image
        const metadata = await fetchImageMetadata(pub.publicUrl)
        setImageMetadata(metadata)
        toast.success('Image uploaded')
      } else {
        toast.error('Failed to get public URL')
      }
    } catch (e) {
      console.error(e)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Banner" : "Add Banner"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Basic Information</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10% OFF This Weekend" />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={description || ""}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a brief description..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Banner Image</h3>
            <div className="grid gap-3">
              {imageUrl ? (
                <div className="space-y-3">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg border-2 border-border" />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setImageUrl("")
                        setImageMetadata(null)
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                  {imageMetadata && (
                    <div className="text-sm text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">File Size:</span>
                        <span>{formatFileSize(imageMetadata.size)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Dimensions:</span>
                        <span>{imageMetadata.dimensions.width} × {imageMetadata.dimensions.height}px</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">No image selected</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    {uploading ? (
                      <>
                        <span className="animate-pulse">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Upload Image</span>
                      </>
                    )}
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadImage(file)
                    }}
                    disabled={uploading}
                  />
                </Label>
                <p className="text-xs text-muted-foreground text-center">Or paste an image URL below</p>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onBlur={async (e) => {
                    const url = e.target.value
                    if (url && url.startsWith('http')) {
                      const metadata = await fetchImageMetadata(url)
                      setImageMetadata(metadata)
                    }
                  }}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Display Settings</h3>
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Label>Active Status</Label>
                  <div className="text-xs text-muted-foreground">Show this banner to users</div>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="grid gap-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
              </div>
            </div>
          </div>

          {/* Restaurant & Special Offer Linking */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Link to Restaurant & Offers</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Restaurant (Optional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={restaurantId || undefined}
                    onValueChange={(v) => setRestaurantId(v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {restaurantId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRestaurantId(null)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Link this banner to a specific restaurant</p>
              </div>

              {restaurantId && (
                <div className="grid gap-2">
                  <Label>Special Offer (Optional)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={specialOfferId || undefined}
                      onValueChange={(v) => setSpecialOfferId(v)}
                      disabled={filteredSpecialOffers.length === 0}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={filteredSpecialOffers.length === 0 ? "No offers available for this restaurant" : "Select special offer"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSpecialOffers.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {specialOfferId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSpecialOfferId(null)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredSpecialOffers.length === 0
                      ? "No special offers found for the selected restaurant"
                      : "Link this banner to a specific offer"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Validity Period */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Validity Period (Optional)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Valid From</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={validFromDate}
                    onChange={(e) => handleDateInput(e.target.value, setValidFromDate)}
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className="flex-1"
                  />
                  <Input
                    type="time"
                    value={validFromTime}
                    onChange={(e) => setValidFromTime(e.target.value)}
                    className="w-32"
                  />
                </div>


              </div>
              <div className="grid gap-2">
                <Label>Valid Until</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={validUntilDate}
                    onChange={(e) => handleDateInput(e.target.value, setValidUntilDate)}
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className="flex-1"
                  />
                  <Input
                    type="time"
                    value={validUntilTime}
                    onChange={(e) => setValidUntilTime(e.target.value)}
                    className="w-32"
                  />
                </div>
               
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSave || saving} onClick={handleSave}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Banner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


