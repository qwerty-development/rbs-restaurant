"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useCreateEvent } from "@/lib/hooks/use-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, PartyPopper } from "lucide-react"
import { EVENT_TYPES, type CreateEventInput } from "@/types/events"
import { toast } from "sonner"

export default function NewEventPage() {
  const router = useRouter()
  const { currentRestaurant } = useRestaurantContext()
  const createEventMutation = useCreateEvent()

  const [formData, setFormData] = useState<CreateEventInput>({
    restaurant_id: currentRestaurant?.restaurant.id || "",
    title: "",
    description: "",
    event_type: "",
    image_url: "",
    minimum_age: null,
    minimum_party_size: 1,
    maximum_party_size: null,
    special_requirements: "",
    terms_and_conditions: [],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title) {
      toast.error("Please enter an event title")
      return
    }

    if (!currentRestaurant) {
      toast.error("Restaurant not found")
      return
    }

    try {
      const event = await createEventMutation.mutateAsync({
        ...formData,
        restaurant_id: currentRestaurant.restaurant.id,
      })

      toast.success("Event created successfully!")
      router.push(`/events/${event.id}`)
    } catch (error) {
      console.error("Error creating event:", error)
    }
  }

  const updateField = (field: keyof CreateEventInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <PartyPopper className="h-8 w-8 text-primary" />
          Create New Event
        </h1>
        <p className="text-muted-foreground mt-1">
          Set up a new event for your restaurant
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Provide the essential details about your event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g., Sunday Brunch, Live Jazz Night"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your event..."
                rows={4}
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="event_type">Event Type</Label>
                <Select
                  value={formData.event_type || ""}
                  onValueChange={(value) => updateField('event_type', value)}
                >
                  <SelectTrigger id="event_type" className="mt-1.5">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => updateField('image_url', e.target.value)}
                  placeholder="https://..."
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Constraints */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Requirements & Constraints</CardTitle>
            <CardDescription>
              Set age and party size requirements for your event
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="minimum_age">Minimum Age</Label>
                <Input
                  id="minimum_age"
                  type="number"
                  min="13"
                  max="25"
                  value={formData.minimum_age || ""}
                  onChange={(e) => updateField('minimum_age', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for no age restriction
                </p>
              </div>

              <div>
                <Label htmlFor="minimum_party_size">Min Party Size</Label>
                <Input
                  id="minimum_party_size"
                  type="number"
                  min="1"
                  value={formData.minimum_party_size}
                  onChange={(e) => updateField('minimum_party_size', parseInt(e.target.value))}
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <Label htmlFor="maximum_party_size">Max Party Size</Label>
                <Input
                  id="maximum_party_size"
                  type="number"
                  min="1"
                  value={formData.maximum_party_size || ""}
                  onChange={(e) => updateField('maximum_party_size', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="special_requirements">Special Requirements</Label>
              <Textarea
                id="special_requirements"
                value={formData.special_requirements}
                onChange={(e) => updateField('special_requirements', e.target.value)}
                placeholder="Any special requirements or notes..."
                rows={3}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createEventMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createEventMutation.isPending}
          >
            {createEventMutation.isPending ? "Creating..." : "Create Event"}
          </Button>
        </div>
      </form>
    </div>
  )
}
