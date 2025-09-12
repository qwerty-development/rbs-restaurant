// app/(dashboard)/settings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { 
  Settings, 
  Store, 
  Clock, 
  DollarSign, 
  Globe,
  Bell,
  Shield,
  Calendar,
  MapPin,
  Phone,
  Instagram,
  Link2,
  Save,
  ChevronRight,
  Smartphone,
  Download
} from "lucide-react"
import Link from "next/link"
import { PushNotificationManager } from "@/components/pwa/push-notification-manager"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { LocationManager } from "@/components/location/location-manager"
import { MigrationWidget } from "@/components/migration/migration-widget"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"

// Type definitions
type Restaurant = {
  id: string
  name: string
  description?: string
  address: string
  phone_number?: string
  whatsapp_number?: string
  website_url?: string
  instagram_handle?: string
  booking_window_days: number
  cancellation_window_hours: number
  table_turnover_minutes: number
  booking_policy: "instant" | "request"
  price_range: number
  cuisine_type: string
  dietary_options?: string[]
  parking_available: boolean
  valet_parking: boolean
  outdoor_seating: boolean
  shisha_available: boolean
}

// Form schemas
const generalSettingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  phone_number: z.string().optional(),
  whatsapp_number: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal("")),
  instagram_handle: z.string().optional(),
  address: z.string().min(5, "Address is required"),
})

const operationalSettingsSchema = z.object({
  booking_window_days: z.number().min(1).max(90),
  cancellation_window_hours: z.number().min(1).max(48),
  table_turnover_minutes: z.number().min(30).max(240),
  booking_policy: z.enum(["instant", "request"]),
})

const pricingSettingsSchema = z.object({
  price_range: z.number().min(1).max(4),
  cuisine_type: z.string(),
  dietary_options: z.array(z.string()),
  parking_available: z.boolean(),
  valet_parking: z.boolean(),
  outdoor_seating: z.boolean(),
  shisha_available: z.boolean(),
})

type GeneralSettingsData = z.infer<typeof generalSettingsSchema>
type OperationalSettingsData = z.infer<typeof operationalSettingsSchema>
type PricingSettingsData = z.infer<typeof pricingSettingsSchema>

export default function SettingsPage() {
  const { tier, currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("general")

  // Get restaurant data
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch restaurant data
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", restaurantId],
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

  // Forms
  const generalForm = useForm<GeneralSettingsData>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      name: "",
      description: "",
      phone_number: "",
      whatsapp_number: "",
      website_url: "",
      instagram_handle: "",
      address: "",
    },
  })

  const operationalForm = useForm<OperationalSettingsData>({
    resolver: zodResolver(operationalSettingsSchema),
    defaultValues: {
      booking_window_days: 30,
      cancellation_window_hours: 24,
      table_turnover_minutes: 120,
      booking_policy: "instant",
    },
  })

  const pricingForm = useForm<PricingSettingsData>({
    resolver: zodResolver(pricingSettingsSchema),
    defaultValues: {
      price_range: 2,
      cuisine_type: "",
      dietary_options: [],
      parking_available: false,
      valet_parking: false,
      outdoor_seating: false,
      shisha_available: false,
    },
  })

  // Update forms when restaurant data loads
  useEffect(() => {
    if (restaurant) {
      generalForm.reset({
        name: restaurant.name,
        description: restaurant.description || "",
        phone_number: restaurant.phone_number || "",
        whatsapp_number: restaurant.whatsapp_number || "",
        website_url: restaurant.website_url || "",
        instagram_handle: restaurant.instagram_handle || "",
        address: restaurant.address,
      })

      operationalForm.reset({
        booking_window_days: restaurant.booking_window_days,
        cancellation_window_hours: restaurant.cancellation_window_hours,
        table_turnover_minutes: restaurant.table_turnover_minutes,
        booking_policy: restaurant.booking_policy,
      })

      pricingForm.reset({
        price_range: restaurant.price_range,
        cuisine_type: restaurant.cuisine_type,
        dietary_options: restaurant.dietary_options || [],
        parking_available: restaurant.parking_available,
        valet_parking: restaurant.valet_parking,
        outdoor_seating: restaurant.outdoor_seating,
        shisha_available: restaurant.shisha_available,
      })
    }
  }, [restaurant])

  // Update mutations
  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: Partial<Restaurant>) => {
      const { error } = await supabase
        .from("restaurants")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", restaurantId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant"] })
      toast.success("Settings updated successfully")
    },
    onError: () => {
      toast.error("Failed to update settings")
    },
  })

  // Handle form submissions
  const handleGeneralSubmit = (data: GeneralSettingsData) => {
    updateRestaurantMutation.mutate(data)
  }

  const handleOperationalSubmit = (data: OperationalSettingsData) => {
    // Force instant booking policy for Basic tier
    const submitData = tier === 'basic' 
      ? { ...data, booking_policy: 'instant' as const }
      : data
    
    updateRestaurantMutation.mutate(submitData)
  }

  const handlePricingSubmit = (data: PricingSettingsData) => {
    updateRestaurantMutation.mutate(data)
  }

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your restaurant settings and preferences
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Add new settings card for availability */}
        <Link href="/settings/availability">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Operating Hours
                  </CardTitle>
                  <CardDescription>
                    Manage regular hours, holidays, and special events
                  </CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
          <TabsTrigger value="features">Features & Pricing</TabsTrigger>
          <TabsTrigger value="pwa">PWA & Mobile</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Basic information about your restaurant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generalForm}>
                <form onSubmit={generalForm.handleSubmit(handleGeneralSubmit)} className="space-y-6">
                  <FormField
                    control={generalForm.control}
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
                    control={generalForm.control}
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
                        <FormDescription>
                          A brief description of your restaurant
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={generalForm.control}
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
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={generalForm.control}
                      name="phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <Phone className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                              <Input {...field} disabled={updateRestaurantMutation.isPending} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={generalForm.control}
                      name="whatsapp_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp Number</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <Phone className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                              <Input {...field} disabled={updateRestaurantMutation.isPending} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={generalForm.control}
                      name="website_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <Globe className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                              <Input {...field} disabled={updateRestaurantMutation.isPending} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={generalForm.control}
                      name="instagram_handle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram Handle</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <Instagram className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                              <Input
                                {...field}
                                disabled={updateRestaurantMutation.isPending}
                                placeholder="@restaurant"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateRestaurantMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          {/* Data Migration Widget */}
          <MigrationWidget restaurantId={restaurant?.id || ""} />
        </TabsContent>

        <TabsContent value="location" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Restaurant Location
              </CardTitle>
              <CardDescription>
                Set your restaurant's precise location for accurate directions and delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LocationManager restaurantId={restaurantId} currentAddress={restaurant?.address} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operational" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operational Settings</CardTitle>
              <CardDescription>
                Configure your restaurant's operational parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...operationalForm}>
                <form onSubmit={operationalForm.handleSubmit(handleOperationalSubmit)} className="space-y-6">
                  
                  <FormField
                    control={operationalForm.control}
                    name="booking_policy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Booking Policy
                          {tier === 'basic' && (
                            <Badge variant="outline" className="text-xs">
                              Basic Tier - Instant Only
                            </Badge>
                          )}
                        </FormLabel>
                        {tier === 'basic' ? (
                          <div className="p-3 bg-muted rounded-md">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="font-medium">Instant Confirmation</div>
                              <Badge variant="default" className="text-xs">Active</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Basic tier restaurants use instant booking confirmation only. 
                              Upgrade to Pro tier to enable request-based bookings.
                            </div>
                          </div>
                        ) : (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={updateRestaurantMutation.isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="instant">
                                <div>
                                  <div className="font-medium">Instant Confirmation</div>
                                  <div className="text-sm text-muted-foreground">
                                    Bookings are automatically confirmed
                                  </div>
                                </div>
                              </SelectItem>
                              <SelectItem value="request">
                                <div>
                                  <div className="font-medium">Request Based</div>
                                  <div className="text-sm text-muted-foreground">
                                    You manually approve each booking
                                  </div>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={operationalForm.control}
                      name="booking_window_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking Window</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              disabled={updateRestaurantMutation.isPending}
                            />
                          </FormControl>
                          <FormDescription>
                            Days in advance
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={operationalForm.control}
                      name="cancellation_window_hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cancellation Window</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              disabled={updateRestaurantMutation.isPending}
                            />
                          </FormControl>
                          <FormDescription>
                            Hours before booking
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={operationalForm.control}
                      name="table_turnover_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Table Turnover</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              disabled={updateRestaurantMutation.isPending}
                            />
                          </FormControl>
                          <FormDescription>
                            Minutes per booking
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateRestaurantMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Features & Pricing</CardTitle>
              <CardDescription>
                Configure your restaurant's features and pricing tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...pricingForm}>
                <form onSubmit={pricingForm.handleSubmit(handlePricingSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={pricingForm.control}
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
                      control={pricingForm.control}
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
                  
                  <FormField
                    control={pricingForm.control}
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
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <FormField
                      control={pricingForm.control}
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
                      control={pricingForm.control}
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
                      control={pricingForm.control}
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
                      control={pricingForm.control}
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
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateRestaurantMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {updateRestaurantMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pwa" className="space-y-4">
          <div className="space-y-6">
            {/* PWA Install Prompt */}
            <InstallPrompt />
            
            {/* Push Notifications */}
            <PushNotificationManager restaurantId={restaurantId} />
            
            {/* PWA Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Progressive Web App Status
                </CardTitle>
                <CardDescription>
                  Information about PWA features and capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="font-medium">✅ Service Worker</div>
                    <div className="text-sm text-muted-foreground">
                      Enables offline functionality and caching
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">✅ Web App Manifest</div>
                    <div className="text-sm text-muted-foreground">
                      Allows installation to home screen
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">✅ Push Notifications</div>
                    <div className="text-sm text-muted-foreground">
                      Real-time notifications for bookings and updates
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">✅ Offline Support</div>
                    <div className="text-sm text-muted-foreground">
                      Basic functionality when internet is unavailable
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="font-medium">PWA Benefits:</div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Fast loading and smooth performance</li>
                    <li>Works offline with cached data</li>
                    <li>Install directly to home screen</li>
                    <li>Push notifications for real-time updates</li>
                    <li>Native app-like experience</li>
                    <li>Automatic updates in background</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}