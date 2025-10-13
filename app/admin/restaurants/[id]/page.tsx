'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EnhancedRestaurantImageUpload } from '@/components/ui/enhanced-restaurant-image-upload'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Restaurant {
  id: string
  name: string
  description: string
  address: string
  phone_number: string
  whatsapp_number?: string
  instagram_handle?: string
  cuisine_type: string
  price_range: number
  booking_policy: 'instant' | 'request'
  featured: boolean
  main_image_url?: string | null
  image_urls?: string[] | null
  cancellation_window?: number
  table_turnover?: number
  min_age?: number
}

export default function AdminRestaurantEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone_number: '',
    whatsapp_number: '',
    instagram_handle: '',
    cuisine_type: '',
    price_range: 2,
    booking_policy: 'request' as 'instant' | 'request',
    featured: false,
    main_image_url: '' as string,
    image_urls: [] as string[],
    cancellation_window: 2,
    table_turnover: 90,
    min_age: 0,
  })

  useEffect(() => {
    const fetchRestaurant = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        setRestaurant(data as Restaurant)
        setFormData({
          name: data.name || '',
          description: data.description || '',
          address: data.address || '',
          phone_number: data.phone_number || '',
          whatsapp_number: data.whatsapp_number || '',
          instagram_handle: data.instagram_handle || '',
          cuisine_type: data.cuisine_type || '',
          price_range: data.price_range || 2,
          booking_policy: (data.booking_policy || 'request') as 'instant' | 'request',
          featured: !!data.featured,
          main_image_url: data.main_image_url || '',
          image_urls: Array.isArray(data.image_urls) ? data.image_urls.filter(Boolean) : [],
          cancellation_window: data.cancellation_window_hours || 2,
          table_turnover: data.table_turnover_minutes || 90,
          min_age: data.minimum_age || 0,
        })
      } catch (e) {
        console.error('Failed to load restaurant', e)
        toast.error('Failed to load restaurant')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchRestaurant()
  }, [id, supabase])

  const handleSave = async () => {
    if (!restaurant) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          address: formData.address.trim(),
          phone_number: formData.phone_number.trim(),
          whatsapp_number: formData.whatsapp_number.trim() || null,
          instagram_handle: formData.instagram_handle.trim() || null,
          cuisine_type: formData.cuisine_type.trim(),
          price_range: formData.price_range,
          booking_policy: formData.booking_policy,
          featured: formData.featured,
          main_image_url: formData.main_image_url || null,
          image_urls: formData.image_urls || [],
          cancellation_window_hours: formData.cancellation_window,
          table_turnover_minutes: formData.table_turnover,
          minimum_age: formData.min_age === 0 ? null : formData.min_age,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id)

      if (error) throw error

      toast.success('Restaurant updated')
      router.push('/admin/restaurants')
    } catch (e) {
      console.error('Failed to update restaurant', e)
      toast.error('Failed to update restaurant')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">Loading...</div>
    )
  }

  if (!restaurant) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.push('/admin/restaurants')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Restaurants
        </Button>
        <Card>
          <CardContent className="p-6">Restaurant not found.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/admin/restaurants')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Restaurant</CardTitle>
          <CardDescription>Update details for this restaurant. All fields are pre-filled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Restaurant Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cuisine">Cuisine Type *</Label>
              <Input id="cuisine" value={formData.cuisine_type} onChange={(e) => setFormData({ ...formData, cuisine_type: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input id="phone" value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input id="whatsapp" value={formData.whatsapp_number} onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })} placeholder="WhatsApp number (optional)" />
            </div>
            <div>
              <Label htmlFor="instagram">Instagram Handle</Label>
              <Input id="instagram" value={formData.instagram_handle} onChange={(e) => setFormData({ ...formData, instagram_handle: e.target.value })} placeholder="restaurantname (optional)" />
            </div>
            <div>
              <Label>Price Range</Label>
              <Select value={formData.price_range.toString()} onValueChange={(v) => setFormData({ ...formData, price_range: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">$ - Budget Friendly</SelectItem>
                  <SelectItem value="2">$$ - Moderate</SelectItem>
                  <SelectItem value="3">$$$ - Upscale</SelectItem>
                  <SelectItem value="4">$$$$ - Fine Dining</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Address *</Label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Booking Policy</Label>
              <Select value={formData.booking_policy} onValueChange={(v) => setFormData({ ...formData, booking_policy: v as 'instant' | 'request' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant Confirmation</SelectItem>
                  <SelectItem value="request">Request Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cancellation Window (hours)</Label>
              <Select value={formData.cancellation_window.toString()} onValueChange={(v) => setFormData({ ...formData, cancellation_window: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No cancellation allowed</SelectItem>
                  <SelectItem value="1">1 hour before</SelectItem>
                  <SelectItem value="2">2 hours before</SelectItem>
                  <SelectItem value="4">4 hours before</SelectItem>
                  <SelectItem value="8">8 hours before</SelectItem>
                  <SelectItem value="12">12 hours before</SelectItem>
                  <SelectItem value="24">24 hours before</SelectItem>
                  <SelectItem value="48">48 hours before</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Table Turnover (minutes)</Label>
              <Select value={formData.table_turnover.toString()} onValueChange={(v) => setFormData({ ...formData, table_turnover: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="75">75 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="105">105 minutes</SelectItem>
                  <SelectItem value="120">120 minutes</SelectItem>
                  <SelectItem value="150">150 minutes</SelectItem>
                  <SelectItem value="180">180 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Minimum Age</Label>
              <Select value={formData.min_age.toString()} onValueChange={(v) => setFormData({ ...formData, min_age: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No age restriction</SelectItem>
                  <SelectItem value="16">16+ years</SelectItem>
                  <SelectItem value="18">18+ years</SelectItem>
                  <SelectItem value="21">21+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch id="featured" checked={formData.featured} onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })} />
              <Label htmlFor="featured">Featured Restaurant</Label>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Images</Label>
            <EnhancedRestaurantImageUpload
              restaurantId={restaurant.id}
              mainImageUrl={formData.main_image_url || ''}
              images={formData.image_urls || []}
              onMainImageChange={(url) => setFormData((p) => ({ ...p, main_image_url: url }))}
              onImagesChange={(urls) => setFormData((p) => ({ ...p, image_urls: urls }))}
              maxImages={12}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


