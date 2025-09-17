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
  cuisine_type: string
  opening_time: string
  closing_time: string
  price_range: number
  booking_policy: 'instant' | 'request'
  featured: boolean
  main_image_url?: string | null
  image_urls?: string[] | null
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
    cuisine_type: '',
    opening_time: '09:00',
    closing_time: '22:00',
    price_range: 2,
    booking_policy: 'request' as 'instant' | 'request',
    featured: false,
    main_image_url: '' as string,
    image_urls: [] as string[],
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
          cuisine_type: data.cuisine_type || '',
          opening_time: data.opening_time || '09:00',
          closing_time: data.closing_time || '22:00',
          price_range: data.price_range || 2,
          booking_policy: (data.booking_policy || 'request') as 'instant' | 'request',
          featured: !!data.featured,
          main_image_url: data.main_image_url || '',
          image_urls: Array.isArray(data.image_urls) ? data.image_urls.filter(Boolean) : [],
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
          cuisine_type: formData.cuisine_type.trim(),
          opening_time: formData.opening_time,
          closing_time: formData.closing_time,
          price_range: formData.price_range,
          booking_policy: formData.booking_policy,
          featured: formData.featured,
          main_image_url: formData.main_image_url || null,
          image_urls: formData.image_urls || [],
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
            <div>
              <Label>Opening Time</Label>
              <Input type="time" value={formData.opening_time} onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })} />
            </div>
            <div>
              <Label>Closing Time</Label>
              <Input type="time" value={formData.closing_time} onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })} />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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


