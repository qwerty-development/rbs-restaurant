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
import type { Restaurant } from "@/types"

// Form schema
const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  phone_number: z.string().optional(),
  whatsapp_number: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal("")),
  instagram_handle: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  cuisine_type: z.string(),
  price_range: z.number().min(1).max(4),
  dietary_options: z.array(z.string()),
  parking_available: z.boolean(),
  valet_parking: z.boolean(),
  outdoor_seating: z.boolean(),
  shisha_available: z.boolean(),
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

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")

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
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch restaurant data
  const { data: restaurant, isLoading }:any = useQuery({
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
      parking_available: false,
      valet_parking: false,
      outdoor_seating: false,
      shisha_available: false,
    },
  })

  // Update form when restaurant data loads
  useEffect(() => {
    if (restaurant) {
      form.reset({
        name: restaurant.name,
        description: restaurant.description,
        phone_number: restaurant.phone_number || "",
        whatsapp_number: restaurant.whatsapp_number || "",
        website_url: restaurant.website_url || "",
        instagram_handle: restaurant.instagram_handle || "",
        address: restaurant.address,
        cuisine_type: restaurant.cuisine_type,
        price_range: restaurant.price_range,
        dietary_options: restaurant.dietary_options || [],
        parking_available: restaurant.parking_available,
        valet_parking: restaurant.valet_parking,
        outdoor_seating: restaurant.outdoor_seating,
        shisha_available: restaurant.shisha_available,
      })
      
      if (restaurant.main_image_url) {
        setImagePreview(restaurant.main_image_url)
      }
    }
  }, [restaurant, form])

  // Update restaurant mutation
  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      let main_image_url = restaurant?.main_image_url

      // Upload image if changed
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${restaurantId}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('restaurant-images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('restaurant-images')
          .getPublicUrl(fileName)

        main_image_url = publicUrl
      }

      const { error } = await supabase
        .from("restaurants")
        .update({
          ...data,
          main_image_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", restaurantId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-profile"] })
      toast.success("Profile updated successfully")
      router.push("/profile")
    },
    onError: () => {
      toast.error("Failed to update profile")
    },
  })

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB")
        return
      }
      
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(restaurant?.main_image_url || null)
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Edit Profile</h1>
          <p className="text-muted-foreground">
            Update your restaurant information
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => updateRestaurantMutation.mutate(data))} className="space-y-6">
          {/* Main Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Image</CardTitle>
              <CardDescription>
                Upload a main image for your restaurant (max 5MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={imagePreview || undefined} />
                  <AvatarFallback>
                    <Store className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                  
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={removeImage}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                  
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>
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
                        value={field.value}
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
                        value={field.value.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={updateRestaurantMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  name="website_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={updateRestaurantMutation.isPending} />
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
                          placeholder="@restaurant"
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
                            if (field.value.includes(option)) {
                              field.onChange(field.value.filter((o) => o !== option))
                            } else {
                              field.onChange([...field.value, option])
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