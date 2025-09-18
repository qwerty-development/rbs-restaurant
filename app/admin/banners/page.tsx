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

type SpecialOffer = {
  id: string
  restaurant_id: string | null
  title: string
  description: string | null
  discount_percentage: string | null
  valid_from: string | null
  valid_until: string | null
  terms_conditions: string | null
  minimum_party_size: string | null
  applicable_days: string | null
  created_at: string | null
  img_url: string | null
  is_clickable: boolean | null
}

type Restaurant = {
  id: string
  name: string
}

export default function AdminBannersPage() {
  const supabase = createClient()
  const [banners, setBanners] = useState<SpecialOffer[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editBanner, setEditBanner] = useState<SpecialOffer | null>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const { data: offers, error: offersError } = await supabase
        .from("special_offers")
        .select("*")
        .order("created_at", { ascending: false })

      if (offersError) throw offersError
      setBanners((offers as SpecialOffer[]) || [])

      const { data: restros, error: restrosError } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name")

      if (restrosError) throw restrosError
      setRestaurants((restros as Restaurant[]) || [])
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

  const openEditDialog = (banner: SpecialOffer) => {
    setEditBanner(banner)
    setIsDialogOpen(true)
  }

  const handleDelete = async (banner: SpecialOffer) => {
    if (!confirm("Delete this banner?")) return
    try {
      // If the banner has an image in our storage bucket, remove it first
      if (banner.img_url && banner.img_url.includes('/storage/v1/object/public/special-offers/')) {
        const url = new URL(banner.img_url)
        const pathStart = url.pathname.indexOf('/special-offers/')
        const objectPath = pathStart >= 0 ? url.pathname.slice(pathStart + '/special-offers/'.length) : ''
        if (objectPath) {
          await supabase.storage.from('special-offers').remove([objectPath])
        }
      }

      const { error } = await supabase.from("special_offers").delete().eq("id", banner.id)
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
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{b.title}</div>
                    {b.img_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.img_url} alt={b.title} className="w-full h-32 object-cover rounded" />
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {b.is_clickable ? "Linked" : "Not linked"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(b)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  banner: SpecialOffer | null
  restaurants: Restaurant[]
  onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = Boolean(banner)
  const [title, setTitle] = useState(banner?.title || "")
  const [description, setDescription] = useState(banner?.description || "")
  const [imgUrl, setImgUrl] = useState(banner?.img_url || "")
  const [isClickable, setIsClickable] = useState(Boolean(banner?.is_clickable))
  const [restaurantId, setRestaurantId] = useState<string | null>(banner?.restaurant_id || null)
  const [validFrom, setValidFrom] = useState(banner?.valid_from?.slice(0, 16) || "")
  const [validUntil, setValidUntil] = useState(banner?.valid_until?.slice(0, 16) || "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setTitle(banner?.title || "")
    setDescription(banner?.description || "")
    setImgUrl(banner?.img_url || "")
    setIsClickable(Boolean(banner?.is_clickable))
    setRestaurantId(banner?.restaurant_id || null)
    setValidFrom(banner?.valid_from?.slice(0, 16) || "")
    setValidUntil(banner?.valid_until?.slice(0, 16) || "")
  }, [banner])

  const canSave = useMemo(() => {
    if (!title) return false
    if (isClickable && !restaurantId) return false
    return true
  }, [title, isClickable, restaurantId])

  const handleSave = async () => {
    try {
      setSaving(true)
      const payload: Partial<SpecialOffer> = {
        title,
        description,
        img_url: imgUrl || null,
        is_clickable: isClickable,
        restaurant_id: isClickable ? restaurantId : null,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      }

      if (isEdit && banner) {
        const { error } = await supabase
          .from("special_offers")
          .update(payload)
          .eq("id", banner.id)
        if (error) throw error
        toast.success("Banner updated")
      } else {
        const { error } = await supabase
          .from("special_offers")
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
        setImgUrl(pub.publicUrl)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Banner" : "Add Banner"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10% OFF" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description || ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Image URL</Label>
            <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://..." />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(file)
                }}
              />
              {uploading ? (
                <span className="text-xs text-muted-foreground">Uploading...</span>
              ) : (
                <span className="text-xs text-muted-foreground">Or upload an image</span>
              )}
            </div>
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl} alt="Preview" className="w-full h-32 object-cover rounded border" />
            ) : null}
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Linked</Label>
              <div className="text-xs text-muted-foreground">Toggle to link to a restaurant</div>
            </div>
            <Switch checked={isClickable} onCheckedChange={setIsClickable} />
          </div>
          {isClickable ? (
            <div className="grid gap-2">
              <Label>Restaurant</Label>
              <Select value={restaurantId || ""} onValueChange={(v) => setRestaurantId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Valid from</Label>
              <Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Valid until</Label>
              <Input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSave || saving} onClick={handleSave}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


