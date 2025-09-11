// app/(dashboard)/offers/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "react-hot-toast"
import { Plus, Gift, Calendar as CalendarIcon, Users, Percent, Clock, Edit, Trash2 } from "lucide-react"
import { format, addDays, isAfter, isBefore, isWithinInterval } from "date-fns"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { SpecialOffer } from "@/types"

const offerFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  discountPercentage: z.number().min(5).max(100),
  validFrom: z.date(),
  validUntil: z.date(),
  minimumPartySize: z.number().min(1).max(20),
  applicableDays: z.array(z.number()).min(1, "Select at least one day"),
  termsConditions: z.string().optional(),
})

type OfferFormData = z.infer<typeof offerFormSchema>

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export default function OffersPage() {
  const [selectedOffer, setSelectedOffer] = useState<SpecialOffer | null>(null)
  const [isAddingOffer, setIsAddingOffer] = useState(false)
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "upcoming" | "expired">("all")
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { currentRestaurant } = useRestaurantContext()

  // Get restaurant ID
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch offers
  const { data: offers, isLoading } = useQuery({
    queryKey: ["special-offers", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("special_offers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as SpecialOffer[]
    },
    enabled: !!restaurantId,
  })

  // Form setup
  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: {
      title: "",
      description: "",
      discountPercentage: 10,
      validFrom: new Date(),
      validUntil: addDays(new Date(), 30),
      minimumPartySize: 1,
      applicableDays: [0, 1, 2, 3, 4, 5, 6],
      termsConditions: "",
    },
  })

  // Create/Update offer mutation
  const offerMutation = useMutation({
    mutationFn: async (data: OfferFormData) => {
      const offerData = {
        restaurant_id: restaurantId,
        title: data.title,
        description: data.description,
        discount_percentage: data.discountPercentage,
        valid_from: data.validFrom.toISOString(),
        valid_until: data.validUntil.toISOString(),
        minimum_party_size: data.minimumPartySize,
        applicable_days: data.applicableDays,
        terms_conditions: data.termsConditions ? [data.termsConditions] : [],
      }

      if (selectedOffer) {
        // Update existing offer
        const { error } = await supabase
          .from("special_offers")
          .update(offerData)
          .eq("id", selectedOffer.id)

        if (error) throw error
      } else {
        // Create new offer
        const { error } = await supabase
          .from("special_offers")
          .insert(offerData)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success(selectedOffer ? "Offer updated" : "Offer created")
      setSelectedOffer(null)
      setIsAddingOffer(false)
      resetFormToDefaults()
    },
    onError: () => {
      toast.error("Failed to save offer")
    },
  })

  // Delete offer mutation
  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase
        .from("special_offers")
        .delete()
        .eq("id", offerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Offer deleted")
    },
    onError: () => {
      toast.error("Failed to delete offer")
    },
  })

  // Filter offers based on status
  const filteredOffers = offers?.filter((offer) => {
    const now = new Date()
    const validFrom = new Date(offer.valid_from)
    const validUntil = new Date(offer.valid_until)
    
    switch (filterStatus) {
      case "active":
        return isWithinInterval(now, { start: validFrom, end: validUntil })
      case "upcoming":
        return isAfter(validFrom, now)
      case "expired":
        return isBefore(validUntil, now)
      default:
        return true
    }
  })

  // Get offer statistics
  const getOfferStats = () => {
    if (!offers) return { total: 0, active: 0, upcoming: 0, expired: 0 }
    
    const now = new Date()
    const stats = {
      total: offers.length,
      active: 0,
      upcoming: 0,
      expired: 0,
    }

    offers.forEach(offer => {
      const validFrom = new Date(offer.valid_from)
      const validUntil = new Date(offer.valid_until)
      
      if (isWithinInterval(now, { start: validFrom, end: validUntil })) {
        stats.active++
      } else if (isAfter(validFrom, now)) {
        stats.upcoming++
      } else if (isBefore(validUntil, now)) {
        stats.expired++
      }
    })

    return stats
  }

  const stats = getOfferStats()

  // Reset form to default values
  const resetFormToDefaults = () => {
    form.reset({
      title: "",
      description: "",
      discountPercentage: 10,
      validFrom: new Date(),
      validUntil: addDays(new Date(), 30),
      minimumPartySize: 1,
      applicableDays: [0, 1, 2, 3, 4, 5, 6],
      termsConditions: "",
    })
  }

  // Get offer status
  const getOfferStatus = (offer: SpecialOffer) => {
    const now = new Date()
    const validFrom = new Date(offer.valid_from)
    const validUntil = new Date(offer.valid_until)
    
    if (isWithinInterval(now, { start: validFrom, end: validUntil })) {
      return { label: "Active", variant: "default" as const }
    } else if (isAfter(validFrom, now)) {
      return { label: "Upcoming", variant: "secondary" as const }
    } else {
      return { label: "Expired", variant: "outline" as const }
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Special Offers</h1>
          <p className="text-muted-foreground">
            Create and manage promotional offers for your restaurant
          </p>
        </div>
        <Dialog open={isAddingOffer || !!selectedOffer} onOpenChange={(open) => {
          if (!open) {
            setIsAddingOffer(false)
            setSelectedOffer(null)
            resetFormToDefaults()
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setIsAddingOffer(true)
              resetFormToDefaults()
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Offer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {selectedOffer ? "Edit Offer" : "Create New Offer"}
              </DialogTitle>
              <DialogDescription>
                Set up a special discount or promotion for your customers
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => offerMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Weekend Special - 20% Off"
                          {...field}
                          disabled={offerMutation.isPending}
                        />
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enjoy a special discount on weekend dining..."
                          {...field}
                          disabled={offerMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Percentage</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="20"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            disabled={offerMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="minimumPartySize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Party Size</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            disabled={offerMutation.isPending}
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
                    name="validFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid From</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={offerMutation.isPending}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Until</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={offerMutation.isPending}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < form.getValues("validFrom")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="applicableDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Applicable Days</FormLabel>
                      <FormDescription>
                        Select which days of the week this offer is valid
                      </FormDescription>
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`day-${day.value}`}
                              checked={field.value.includes(day.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, day.value])
                                } else {
                                  field.onChange(field.value.filter(d => d !== day.value))
                                }
                              }}
                              className="h-4 w-4"
                              disabled={offerMutation.isPending}
                            />
                            <label
                              htmlFor={`day-${day.value}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {day.label.slice(0, 3)}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="termsConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms & Conditions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Not valid with other offers. Subject to availability..."
                          {...field}
                          disabled={offerMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingOffer(false)
                      setSelectedOffer(null)
                      resetFormToDefaults()
                    }}
                    disabled={offerMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={offerMutation.isPending}>
                    {offerMutation.isPending 
                      ? "Saving..." 
                      : selectedOffer 
                        ? "Update Offer" 
                        : "Create Offer"
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Offers</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcoming}</div>
            <p className="text-xs text-muted-foreground">
              Starting soon
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Discount</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {offers && offers.length > 0
                ? Math.round(
                    offers.reduce((sum, o) => sum + o.discount_percentage, 0) / offers.length
                  )
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Offers</CardTitle>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offers ({stats.total})</SelectItem>
                <SelectItem value="active">Active ({stats.active})</SelectItem>
                <SelectItem value="upcoming">Upcoming ({stats.upcoming})</SelectItem>
                <SelectItem value="expired">Expired ({stats.expired})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading offers...</div>
          ) : filteredOffers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No offers found
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOffers?.map((offer) => {
                const status = getOfferStatus(offer)
                const applicableDays = DAYS_OF_WEEK.filter(d => 
                  offer.applicable_days?.includes(d.value)
                ).map(d => d.label.slice(0, 3))

                return (
                  <Card key={offer.id} className="relative">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{offer.title}</CardTitle>
                          <CardDescription>
                            {offer.discount_percentage}% off
                          </CardDescription>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {offer.description && (
                        <p className="text-sm text-muted-foreground">
                          {offer.description}
                        </p>
                      )}
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Min. {offer.minimum_party_size} guests</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(new Date(offer.valid_from), "MMM d")} - {format(new Date(offer.valid_until), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{applicableDays.join(", ")}</span>
                        </div>
                      </div>

                      {offer.terms_conditions && offer.terms_conditions.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            {offer.terms_conditions[0]}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOffer(offer)
                            form.reset({
                              title: offer.title,
                              description: offer.description || "",
                              discountPercentage: offer.discount_percentage,
                              validFrom: new Date(offer.valid_from),
                              validUntil: new Date(offer.valid_until),
                              minimumPartySize: offer.minimum_party_size,
                              applicableDays: offer.applicable_days || [],
                              termsConditions: offer.terms_conditions?.[0] || "",
                            })
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this offer?")) {
                              deleteOfferMutation.mutate(offer.id)
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}