"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  X,
  Clock,
  Save,
  Copy,
  Coffee,
  Utensils,
  Wine,
  ChefHat,
  AlertCircle,
  Store,
  Calendar,
  Users,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { RestaurantOpenHours } from "@/types"
import { useOpenHours, useBulkUpdateOpenHours } from "@/lib/hooks/use-open-hours"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// Service type configurations with better UX
const SERVICE_TYPES = [
  { value: 'general', label: 'All Day', icon: Store, color: 'bg-blue-500', desc: 'Full restaurant service' },
  { value: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'bg-orange-500', desc: 'Morning service' },
  { value: 'lunch', label: 'Lunch', icon: Utensils, color: 'bg-green-500', desc: 'Midday service' },
  { value: 'dinner', label: 'Dinner', icon: Utensils, color: 'bg-purple-500', desc: 'Evening service' },
  { value: 'bar', label: 'Bar Only', icon: Wine, color: 'bg-red-500', desc: 'Drinks only' },
  { value: 'kitchen', label: 'Kitchen', icon: ChefHat, color: 'bg-yellow-500', desc: 'Food prep hours' },
] as const

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
] as const

// Schema for a single shift entry
const shiftSchema = z.object({
  id: z.string().optional(),
  day_of_week: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  service_type: z.enum(['breakfast', 'lunch', 'dinner', 'general', 'bar', 'kitchen']),
  is_open: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  name: z.string().optional(),
  accepts_walkins: z.boolean(),
}).refine((data) => {
  if (data.is_open) {
    return data.open_time && data.close_time
  }
  return true
}, {
  message: "Open and close times are required when service is open",
  path: ["open_time"]
})

// Main form schema
const openHoursFormSchema = z.object({
  shifts: z.array(shiftSchema)
})

type OpenHoursFormData = z.infer<typeof openHoursFormSchema>

interface OpenHoursFormProps {
  restaurantId: string
  onSuccess?: () => void
}

export function OpenHoursForm({ restaurantId, onSuccess }: OpenHoursFormProps) {
  const [selectedDay, setSelectedDay] = useState<string>('monday')
  const { data: existingOpenHours, isLoading } = useOpenHours(restaurantId)
  const updateOpenHours = useBulkUpdateOpenHours()

  const form = useForm<OpenHoursFormData>({
    resolver: zodResolver(openHoursFormSchema),
    defaultValues: {
      shifts: []
    }
  })

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "shifts"
  })

  // Initialize form with existing data
  useEffect(() => {
    if (existingOpenHours && existingOpenHours.length > 0) {
      const formData: OpenHoursFormData = {
        shifts: existingOpenHours.map(hours => ({
          id: hours.id,
          day_of_week: hours.day_of_week,
          service_type: hours.service_type,
          is_open: hours.is_open,
          open_time: hours.open_time || undefined,
          close_time: hours.close_time || undefined,
          name: hours.name || undefined,
          accepts_walkins: hours.accepts_walkins,
        }))
      }
      form.reset(formData)
    } else {
      // Initialize with default general service for each day
      const defaultShifts: OpenHoursFormData['shifts'] = []
      DAYS_OF_WEEK.forEach(day => {
        defaultShifts.push({
          day_of_week: day.value,
          service_type: 'general',
          is_open: true,
          open_time: '08:00',
          close_time: '22:00',
          name: 'All Day Service',
          accepts_walkins: true,
        })
      })
      form.reset({ shifts: defaultShifts })
    }
  }, [existingOpenHours, form])

  const onSubmit = async (data: OpenHoursFormData) => {
    try {
      const openHoursData = data.shifts.map(shift => ({
        restaurant_id: restaurantId,
        day_of_week: shift.day_of_week,
        service_type: shift.service_type,
        is_open: shift.is_open,
        open_time: shift.is_open ? shift.open_time || null : null,
        close_time: shift.is_open ? shift.close_time || null : null,
        name: shift.name || null,
        accepts_walkins: shift.accepts_walkins,
        notes: null,
      }))

      await updateOpenHours.mutateAsync({
        restaurantId,
        openHoursData
      })

      onSuccess?.()
    } catch (error) {
      console.error('Error updating open hours:', error)
    }
  }

  const addShift = (day: string, serviceType: string = 'general') => {
    const defaultTimes = {
      breakfast: { open: '07:00', close: '11:00' },
      lunch: { open: '11:30', close: '15:00' },
      dinner: { open: '17:00', close: '22:00' },
      bar: { open: '16:00', close: '01:00' },
      kitchen: { open: '08:00', close: '21:00' },
      general: { open: '08:00', close: '22:00' },
    }

    const times = defaultTimes[serviceType as keyof typeof defaultTimes] || defaultTimes.general

    const newShift = {
      day_of_week: day as any,
      service_type: serviceType as any,
      is_open: true,
      open_time: times.open,
      close_time: times.close,
      name: SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType,
      accepts_walkins: true,
    }
    append(newShift)
  }

  const copyShiftToAllDays = (shiftIndex: number) => {
    const shift = fields[shiftIndex]
    if (!shift) return

    DAYS_OF_WEEK.forEach(day => {
      if (day.value === shift.day_of_week) return // Skip source day

      const existingIndex = fields.findIndex(f =>
        f.day_of_week === day.value && f.service_type === shift.service_type
      )

      const newShift = {
        day_of_week: day.value as any,
        service_type: shift.service_type,
        is_open: shift.is_open,
        open_time: shift.open_time,
        close_time: shift.close_time,
        name: shift.name,
        accepts_walkins: shift.accepts_walkins,
      }

      if (existingIndex >= 0) {
        update(existingIndex, newShift)
      } else {
        append(newShift)
      }
    })

    toast.success(`Copied ${shift.service_type} shift to all days`)
  }

  const getShiftsForDay = (day: string) => {
    return fields.filter(f => f.day_of_week === day)
  }

  const getServiceConfig = (serviceType: string) => {
    return SERVICE_TYPES.find(s => s.value === serviceType) || SERVICE_TYPES[0]
  }


  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Loading open hours...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          When Are You Open?
        </CardTitle>
        <CardDescription>
          Set the hours when your restaurant is physically open for business.
          This is separate from when you accept online bookings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            {/* Simple explanation */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Quick Setup:</strong> Set your open hours for each day.
                You can be physically open for walk-ins even when not accepting online bookings.
              </AlertDescription>
            </Alert>

            {/* Day Selection Tabs */}
            <Tabs value={selectedDay} onValueChange={setSelectedDay} className="w-full">
              <TabsList className="grid w-full grid-cols-7 h-12">
                {DAYS_OF_WEEK.map((day) => (
                  <TabsTrigger
                    key={day.value}
                    value={day.value}
                    className="text-xs font-medium"
                  >
                    {day.short}
                  </TabsTrigger>
                ))}
              </TabsList>

              {DAYS_OF_WEEK.map((day) => (
                <TabsContent key={day.value} value={day.value} className="space-y-6 mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {day.label} Schedule
                    </h3>
                    <div className="flex gap-2">
                      <Select onValueChange={(serviceType) => addShift(day.value, serviceType)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Add Service" />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map((service) => {
                            const Icon = service.icon
                            return (
                              <SelectItem key={service.value} value={service.value}>
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-3 h-3 rounded-full", service.color)} />
                                  <Icon className="h-4 w-4" />
                                  <span>{service.label}</span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Shifts for this day */}
                  <div className="space-y-4">
                    {getShiftsForDay(day.value).length === 0 ? (
                      <Card className="border-dashed border-2 border-gray-300">
                        <CardContent className="p-8 text-center">
                          <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-600 mb-2">No shifts scheduled</h3>
                          <p className="text-sm text-gray-500 mb-4">Add a service to get started</p>
                        </CardContent>
                      </Card>
                    ) : (
                      getShiftsForDay(day.value).map((shift, shiftIndex) => {
                        const actualIndex = fields.findIndex(f => f === shift)
                        const service = getServiceConfig(shift.service_type)
                        const Icon = service.icon

                        const getBorderColor = (bgColor: string) => {
                          const colorMap: { [key: string]: string } = {
                            'bg-blue-500': '#3b82f6',
                            'bg-orange-500': '#f97316',
                            'bg-green-500': '#22c55e',
                            'bg-purple-500': '#a855f7',
                            'bg-red-500': '#ef4444',
                            'bg-yellow-500': '#eab308',
                          }
                          return colorMap[bgColor] || '#3b82f6'
                        }

                        return (
                          <Card key={actualIndex} className="border-l-4" style={{ borderLeftColor: getBorderColor(service.color) }}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn("w-4 h-4 rounded-full", service.color)} />
                                  <Icon className="h-5 w-5" />
                                  <div>
                                    <h4 className="font-semibold">{service.label}</h4>
                                    <p className="text-sm text-gray-500">{service.desc}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyShiftToAllDays(actualIndex)}
                                    className="h-8"
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy to All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => remove(actualIndex)}
                                    className="h-8 text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`shifts.${actualIndex}.is_open`}
                                  render={({ field }) => (
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                      <Label className={cn(
                                        "text-sm font-medium",
                                        field.value ? "text-green-600" : "text-gray-500"
                                      )}>
                                        {field.value ? "Open" : "Closed"}
                                      </Label>
                                    </div>
                                  )}
                                />

                                {form.watch(`shifts.${actualIndex}.is_open`) && (
                                  <>
                                    <FormField
                                      control={form.control}
                                      name={`shifts.${actualIndex}.open_time`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm">Opens At</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="time"
                                              {...field}
                                              className="touch-manipulation"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name={`shifts.${actualIndex}.close_time`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm">Closes At</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="time"
                                              {...field}
                                              className="touch-manipulation"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </>
                                )}
                              </div>

                              {form.watch(`shifts.${actualIndex}.is_open`) && (
                                <div className="mt-4 space-y-3">
                                  <FormField
                                    control={form.control}
                                    name={`shifts.${actualIndex}.name`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm">Custom Name (Optional)</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder={`${service.label} Service`}
                                            className="touch-manipulation"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`shifts.${actualIndex}.accepts_walkins`}
                                    render={({ field }) => (
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                        <Label className="text-sm">
                                          Accept walk-ins during this service
                                        </Label>
                                      </div>
                                    )}
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Submit Button - Centered to avoid PWA modal conflicts */}
            <div className="flex justify-center pt-6">
              <Button
                type="submit"
                disabled={updateOpenHours.isPending}
                className="min-w-48 h-12 text-base shadow-lg"
                size="lg"
              >
                {updateOpenHours.isPending ? (
                  <Clock className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}
                Save Open Hours
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}