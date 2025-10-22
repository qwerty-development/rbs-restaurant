"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useEvent, useUpdateEvent } from "@/lib/hooks/use-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { ArrowLeft, PartyPopper, Loader2 } from "lucide-react"
import { EVENT_TYPES, type UpdateEventInput } from "@/types/events"
import { toast } from "sonner"

export default function EditEventPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params?.id as string

  const { data: event, isLoading } = useEvent(eventId)
  const updateEventMutation = useUpdateEvent()

  const [formData, setFormData] = useState<UpdateEventInput>({
    title: "",
    description: "",
    event_type: "",
    image_url: "",
    minimum_age: null,
    minimum_party_size: 1,
    maximum_party_size: null,
    special_requirements: "",
    is_active: true,
  })

  // Populate form when event data loads
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || "",
        event_type: event.event_type || "",
        image_url: event.image_url || "",
        minimum_age: event.minimum_age,
        minimum_party_size: event.minimum_party_size,
        maximum_party_size: event.maximum_party_size,
        special_requirements: event.special_requirements || "",
        is_active: event.is_active,
      })
    }
  }, [event])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title?.trim()) {
      toast.error("Please enter an event title")
      return
    }

    try {
      await updateEventMutation.mutateAsync({
        eventId,
        updates: formData,
      })

      toast.success("Event updated successfully!")
      router.push(`/events/${eventId}`)
    } catch (error) {
      console.error("Error updating event:", error)
    }
  }

  const updateField = (field: keyof UpdateEventInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The event you're trying to edit doesn't exist
        </p>
        <Button onClick={() => router.push("/events")}>
          Back to Events
        </Button>
      </div>
    )
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <PartyPopper className="h-8 w-8 text-primary" />
              Edit Event
            </h1>
            <p className="text-muted-foreground mt-1">
              Update your event details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="is_active" className="text-sm font-medium">
              Active
            </Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => updateField('is_active', checked)}
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update the essential details about your event
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

            {/* Image Preview */}
            {formData.image_url && (
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Image Preview
                </Label>
                <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                  <img
                    src={formData.image_url}
                    alt="Event preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement!.innerHTML = 
                        '<div class="flex items-center justify-center h-full text-muted-foreground">Invalid image URL</div>'
                    }}
                  />
                </div>
              </div>
            )}
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
                  onChange={(e) => updateField('minimum_party_size', parseInt(e.target.value) || 1)}
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

        {/* Event Statistics (Read-only) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Event Statistics</CardTitle>
            <CardDescription>
              Current event performance (read-only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Total Occurrences
                </div>
                <div className="text-2xl font-bold">
                  {event.occurrences?.length || 0}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Upcoming Dates
                </div>
                <div className="text-2xl font-bold">
                  {event.occurrences?.filter(o => 
                    o.status === 'scheduled' || o.status === 'full'
                  ).length || 0}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Total Bookings
                </div>
                <div className="text-2xl font-bold">
                  {event.occurrences?.reduce((acc, o) => acc + o.current_bookings, 0) || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={updateEventMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateEventMutation.isPending}
          >
            {updateEventMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Event"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
