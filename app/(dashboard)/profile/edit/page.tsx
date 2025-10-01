// app/(dashboard)/profile/edit/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "react-hot-toast"
import { 
  Save,
  Store,
  Upload,
  X,
  ArrowLeft
} from "lucide-react"
import { EnhancedRestaurantImageUpload } from "@/components/ui/enhanced-restaurant-image-upload"

// Type definitions
type Restaurant = {
  id: string
  name: string
  description?: string
  phone_number?: string
  whatsapp_number?: string
  website_url?: string
  instagram_handle?: string
  address: string
  cuisine_type: string
  price_range: number
  dietary_options?: string[]
  ambiance_tags?: string[]
  parking_available: boolean
  valet_parking: boolean
  outdoor_seating: boolean
  shisha_available: boolean
  main_image_url?: string
  image_urls?: string[]
  email?: string
  menu_url?: string
  booking_window_days?: number
  max_party_size?: number
  min_party_size?: number
  featured?: boolean
  status?: string
  auto_decline_enabled?: boolean
  request_expiry_hours?: number
  cancellation_window_hours?: number
  table_turnover_minutes?: number
  minimum_age?: number
}

// Form schema
const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  phone_number: z.string().optional(),
  whatsapp_number: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal("")),
  instagram_handle: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  cuisine_type: z.string().min(1, "Please select a cuisine type"),
  price_range: z.number().min(1).max(4),
  dietary_options: z.array(z.string()),
  ambiance_tags: z.array(z.string()),
  parking_available: z.boolean(),
  valet_parking: z.boolean(),
  outdoor_seating: z.boolean(),
  shisha_available: z.boolean(),
  email: z.string().email().optional().or(z.literal("")),
  menu_url: z.string().url().optional().or(z.literal("")),
  booking_window_days: z.number().min(1).max(365),
  max_party_size: z.number().min(1).max(50),
  min_party_size: z.number().min(1).max(10),
  status: z.enum(["active", "inactive", "suspended"]),
  auto_decline_enabled: z.boolean(),
  request_expiry_hours: z.number().min(1).max(168),
  cancellation_window_hours: z.number().min(1).max(72),
  table_turnover_minutes: z.number().min(30).max(480),
  minimum_age: z.number().min(0).max(99),
})

type ProfileFormData = z.infer<typeof profileFormSchema>

const CUISINE_TYPES = [
  "Lebanese",
  "Mediterranean",
  "Italian",
  "French",
  "Japanese",
  "Chinese",
  "Indian",
  "Mexican",
  "American",
  "Seafood",
  "Steakhouse",
  "Fusion",
  "Vegetarian",
  "Cafe",
]

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "halal",
  "kosher",
  "dairy-free",
  "nut-free",
]

const AMBIANCE_TAGS = [
  "casual",
  "fine dining",
  "family-friendly",
  "romantic",
  "business",
  "trendy",
  "cozy",
  "lively",
]

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [mainImageUrl, setMainImageUrl] = useState<string>("")
  const [imageUrls, setImageUrls] = useState<string[]>([])

  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id, role")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          // Check if user has permission to edit
          if (staffData.role !== 'owner' && staffData.role !== 'manager') {
            toast.error("You don't have permission to edit restaurant profile")
            router.push("/profile")
            return
          }
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase, router])

  // Fetch restaurant data
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant-profile", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single()

      if (error) throw error
      return data as Restaurant
    },
    enabled: !!restaurantId,
  })

  // Form
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      description: "",
      phone_number: "",
      whatsapp_number: "",
      website_url: "",
      instagram_handle: "",
      address: "",
      cuisine_type: "",
      price_range: 2,
      dietary_options: [],
      ambiance_tags: [],
      parking_available: false,
      valet_parking: false,
      outdoor_seating: false,
      shisha_available: false,
      email: "",
      menu_url: "",
      booking_window_days: 30,
      max_party_size: 10,
      min_party_size: 1,
      status: "active",
      auto_decline_enabled: true,
      request_expiry_hours: 24,
      cancellation_window_hours: 24,
      table_turnover_minutes: 120,
      minimum_age: 0,
    },
  })

  // Update form when restaurant data loads
  useEffect(() => {
    if (restaurant) {
      form.reset({
        name: restaurant.name || "",
        description: restaurant.description || "",
        phone_number: restaurant.phone_number || "",
        whatsapp_number: restaurant.whatsapp_number || "",
        website_url: restaurant.website_url || "",
        instagram_handle: restaurant.instagram_handle || "",
        address: restaurant.address || "",
        cuisine_type: restaurant.cuisine_type || "",
        price_range: Number(restaurant.price_range) || 2,
        dietary_options: restaurant.dietary_options || [],
        ambiance_tags: restaurant.ambiance_tags || [],
        parking_available: Boolean(restaurant.parking_available),
        valet_parking: Boolean(restaurant.valet_parking),
        outdoor_seating: Boolean(restaurant.outdoor_seating),
        shisha_available: Boolean(restaurant.shisha_available),
        email: restaurant.email || "",
        menu_url: restaurant.menu_url || "",
        booking_window_days: restaurant.booking_window_days || 30,
        max_party_size: restaurant.max_party_size || 10,
        min_party_size: restaurant.min_party_size || 1,
        status: (restaurant.status as "active" | "inactive" | "suspended") || "active",
        auto_decline_enabled: Boolean(restaurant.auto_decline_enabled),
        request_expiry_hours: restaurant.request_expiry_hours || 24,
        cancellation_window_hours: restaurant.cancellation_window_hours || 24,
        table_turnover_minutes: restaurant.table_turnover_minutes || 120,
        minimum_age: restaurant.minimum_age || 0,
      })
      
      // Set image states
      if (restaurant.main_image_url) {
        setMainImageUrl(restaurant.main_image_url)
      }
      if (restaurant.image_urls && restaurant.image_urls.length > 0) {
        setImageUrls(restaurant.image_urls)
      }
    }
  }, [restaurant, form])

  // Update restaurant mutation
  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const { error } = await supabase
        .from("restaurants")
        .update({
          ...data,
          minimum_age: data.minimum_age || null,
          main_image_url: mainImageUrl || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", restaurantId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-profile"] })
      queryClient.invalidateQueries({ queryKey: ["restaurant"] })
      toast.success("Profile updated successfully")
      router.push("/profile")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile")
    },
  })



  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push("/profile")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Restaurant Profile</h1>
          <p className="text-muted-foreground">
            Update your restaurant information
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => updateRestaurantMutation.mutate(data))} className="space-y-6">
          {/* Restaurant Images Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Images</CardTitle>
              <CardDescription>
                Upload and manage your restaurant images. Select any image as your main image (logo) and reorder gallery images as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedRestaurantImageUpload
                restaurantId={restaurantId}
                mainImageUrl={mainImageUrl}
                images={imageUrls}
                onMainImageChange={setMainImageUrl}
                onImagesChange={setImageUrls}
                maxImages={10}
                maxFileSize={5}
              />
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={updateRestaurantMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={updateRestaurantMutation.isPending}
                        rows={4}
                        placeholder="Tell customers about your restaurant..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cuisine_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuisine Type</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cuisine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CUISINE_TYPES.map((cuisine) => (
                            <SelectItem key={cuisine} value={cuisine}>
                              {cuisine}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="price_range"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Range</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "2"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select price range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">$ - Budget Friendly</SelectItem>
                          <SelectItem value="2">$$ - Moderate</SelectItem>
                          <SelectItem value="3">$$$ - Upscale</SelectItem>
                          <SelectItem value="4">$$$$ - Fine Dining</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={updateRestaurantMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={updateRestaurantMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="whatsapp_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Number</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={updateRestaurantMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          disabled={updateRestaurantMutation.isPending}
                          placeholder="contact@restaurant.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="menu_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Online Menu URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={updateRestaurantMutation.isPending}
                          placeholder="https://menu.restaurant.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="website_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          disabled={updateRestaurantMutation.isPending}
                          placeholder="https://example.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="instagram_handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram Handle</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={updateRestaurantMutation.isPending}
                          placeholder="restaurant"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Features & Amenities */}
          <Card>
            <CardHeader>
              <CardTitle>Features & Amenities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="dietary_options"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dietary Options</FormLabel>
                    <FormDescription>
                      Select all dietary options your restaurant accommodates
                    </FormDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DIETARY_OPTIONS.map((option) => (
                        <Badge
                          key={option}
                          variant={field.value.includes(option) ? "default" : "outline"}
                          className="cursor-pointer capitalize"
                          onClick={() => {
                            if (!updateRestaurantMutation.isPending) {
                              if (field.value.includes(option)) {
                                field.onChange(field.value.filter((o) => o !== option))
                              } else {
                                field.onChange([...field.value, option])
                              }
                            }
                          }}
                        >
                          {option}
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="ambiance_tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiance Tags</FormLabel>
                    <FormDescription>
                      Select tags that describe your restaurant's atmosphere
                    </FormDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {AMBIANCE_TAGS.map((tag) => (
                        <Badge
                          key={tag}
                          variant={field.value.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer capitalize"
                          onClick={() => {
                            if (!updateRestaurantMutation.isPending) {
                              if (field.value.includes(tag)) {
                                field.onChange(field.value.filter((t) => t !== tag))
                              } else {
                                field.onChange([...field.value, tag])
                              }
                            }
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="parking_available"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Parking Available</FormLabel>
                        <FormDescription>
                          On-site parking for customers
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateRestaurantMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="valet_parking"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Valet Parking</FormLabel>
                        <FormDescription>
                          Valet parking service available
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateRestaurantMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="outdoor_seating"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Outdoor Seating</FormLabel>
                        <FormDescription>
                          Patio or terrace seating available
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateRestaurantMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="shisha_available"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Shisha Available</FormLabel>
                        <FormDescription>
                          Hookah/shisha service offered
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateRestaurantMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Booking Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Booking Settings</CardTitle>
              <CardDescription>
                Configure how bookings work for your restaurant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="booking_window_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking Window (days ahead)</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "30"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select booking window" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How far in advance customers can book
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="request_expiry_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Expiry (hours)</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "24"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select expiry time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How long booking requests stay valid
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cancellation_window_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cancellation Window (hours)</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "24"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cancellation window" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                          <SelectItem value="72">72 hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How long before booking time customers can cancel
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_party_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Party Size</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "10"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select max party size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="2">2 people</SelectItem>
                          <SelectItem value="4">4 people</SelectItem>
                          <SelectItem value="6">6 people</SelectItem>
                          <SelectItem value="8">8 people</SelectItem>
                          <SelectItem value="10">10 people</SelectItem>
                          <SelectItem value="12">12 people</SelectItem>
                          <SelectItem value="15">15 people</SelectItem>
                          <SelectItem value="20">20 people</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="min_party_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Party Size</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "1"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select min party size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 person</SelectItem>
                          <SelectItem value="2">2 people</SelectItem>
                          <SelectItem value="3">3 people</SelectItem>
                          <SelectItem value="4">4 people</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minimum_age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Age</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="99"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? 0 : parseInt(value) || 0)
                          }}
                          disabled={updateRestaurantMutation.isPending}
                          placeholder="Enter minimum age (leave empty for no restriction)"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum age requirement for bookings (0 or empty = no restriction)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="auto_decline_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto-decline Requests</FormLabel>
                        <FormDescription>
                          Automatically decline expired booking requests
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateRestaurantMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

              </div>
            </CardContent>
          </Card>

          {/* Operational Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Operational Settings</CardTitle>
              <CardDescription>
                Configure operational parameters for your restaurant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="table_turnover_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table Turnover (minutes)</FormLabel>
                      <Select
                        value={field.value ? field.value.toString() : "120"}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select turnover time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="60">60 minutes</SelectItem>
                          <SelectItem value="90">90 minutes</SelectItem>
                          <SelectItem value="120">120 minutes</SelectItem>
                          <SelectItem value="150">150 minutes</SelectItem>
                          <SelectItem value="180">180 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Average time customers spend at tables
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant Status</FormLabel>
                      <Select
                        value={field.value || "active"}
                        onValueChange={field.onChange}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Current operational status
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/profile")}
              disabled={updateRestaurantMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateRestaurantMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}