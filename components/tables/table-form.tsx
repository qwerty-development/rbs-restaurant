// components/tables/table-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RestaurantTable } from "@/types"

const formSchema = z.object({
  table_number: z.string().min(1, "Table number is required"),
  table_type: z.enum(["booth", "window", "patio", "standard", "bar", "private"]),
  capacity: z.number().min(1).max(50),
  min_capacity: z.number().min(1).max(20),
  max_capacity: z.number().min(1).max(50),
  shape: z.enum(["rectangle", "circle", "square"]),
  is_active: z.boolean(),
  is_combinable: z.boolean(),
  features: z.array(z.string()).optional(),
  priority_score: z.number().min(0).max(100),
}).refine((data) => data.min_capacity <= data.capacity, {
  message: "Default capacity must be >= minimum capacity",
  path: ["capacity"],
}).refine((data) => data.capacity <= data.max_capacity, {
  message: "Default capacity must be <= maximum capacity", 
  path: ["capacity"],
}).refine((data) => data.min_capacity <= data.max_capacity, {
  message: "Minimum capacity must be <= maximum capacity",
  path: ["max_capacity"],
})

type FormData = z.infer<typeof formSchema>

interface TableFormProps {
  table?: RestaurantTable
  tables: RestaurantTable[]
  onSubmit: (data: Partial<RestaurantTable>) => void
  onCancel: () => void
  isLoading: boolean
}

const TABLE_FEATURES = [
  "Window View",
  "Private Area",
  "Wheelchair Accessible",
  "High Chair Compatible",
  "Power Outlet",
  "Corner Table",
  "Near Kitchen",
  "Near Restroom",
  "Outdoor",
  "Covered",
]

export function TableForm({ table, tables, onSubmit, onCancel, isLoading }: TableFormProps) {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(table?.features || [])
  const [combinableWith, setCombinableWith] = useState<string[]>(table?.combinable_with || [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      table_number: table?.table_number || "",
      table_type: table?.table_type || "standard",
      capacity: table?.capacity || 4,
      min_capacity: table?.min_capacity || 2,
      max_capacity: table?.max_capacity || 4,
      shape: table?.shape || "rectangle",
      is_active: table?.is_active ?? true,
      is_combinable: table?.is_combinable ?? true,
      priority_score: table?.priority_score || 50,
    },
  })

  const isCombinable = watch("is_combinable")

  const handleFormSubmit = (data: FormData) => {
    onSubmit({
      ...data,
      features: selectedFeatures,
      combinable_with: isCombinable ? combinableWith : [],
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Basic Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="table_number">Table Number *</Label>
          <Input
            id="table_number"
            {...register("table_number")}
            disabled={isLoading}
          />
          {errors.table_number && (
            <p className="text-sm text-red-600 mt-1">{errors.table_number.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="table_type">Table Type *</Label>
          <Select
            value={watch("table_type")}
            onValueChange={(value: any) => setValue("table_type", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="booth">Booth</SelectItem>
              <SelectItem value="window">Window</SelectItem>
              <SelectItem value="patio">Patio</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Capacity */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="capacity">Default Capacity *</Label>
          <Input
            id="capacity"
            type="number"
            min="1"
            max="50"
            {...register("capacity", { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.capacity && (
            <p className="text-sm text-red-600 mt-1">{errors.capacity.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Standard seating capacity
          </p>
        </div>

        <div>
          <Label htmlFor="min_capacity">Min Capacity *</Label>
          <Input
            id="min_capacity"
            type="number"
            min="1"
            max="20"
            {...register("min_capacity", { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.min_capacity && (
            <p className="text-sm text-red-600 mt-1">{errors.min_capacity.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="max_capacity">Max Capacity *</Label>
          <Input
            id="max_capacity"
            type="number"
            min="1"
            max="50"
            {...register("max_capacity", { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.max_capacity && (
            <p className="text-sm text-red-600 mt-1">{errors.max_capacity.message}</p>
          )}
        </div>
      </div>

      {/* Shape and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="shape">Shape</Label>
          <Select
            value={watch("shape")}
            onValueChange={(value: any) => setValue("shape", value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rectangle">Rectangle</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority_score">Priority Score (0-100)</Label>
          <Input
            id="priority_score"
            type="number"
            min="0"
            max="100"
            {...register("priority_score", { valueAsNumber: true })}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Higher scores are preferred for bookings
          </p>
        </div>
      </div>

      {/* Features */}
      <div>
        <Label>Table Features</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {TABLE_FEATURES.map((feature) => (
            <label
              key={feature}
              className="flex items-center space-x-2 text-sm"
            >
              <Checkbox
                checked={selectedFeatures.includes(feature)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedFeatures([...selectedFeatures, feature])
                  } else {
                   // components/tables/table-form.tsx (continued)
                    setSelectedFeatures(selectedFeatures.filter(f => f !== feature))
                  }
                }}
                disabled={isLoading}
              />
              <span>{feature}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status Switches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active Table</Label>
            <p className="text-sm text-muted-foreground">
              Table is available for bookings
            </p>
          </div>
          <Switch
            checked={watch("is_active")}
            onCheckedChange={(checked) => setValue("is_active", checked)}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Combinable</Label>
            <p className="text-sm text-muted-foreground">
              Can be combined with other tables
            </p>
          </div>
          <Switch
            checked={watch("is_combinable")}
            onCheckedChange={(checked) => setValue("is_combinable", checked)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Combinable With (only show if is_combinable is true) */}
      {isCombinable && tables.length > 1 && (
        <div>
          <Label>Can Combine With</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Select tables that can be combined with this one
          </p>
          <div className="grid grid-cols-2 gap-2">
            {tables
              .filter(t => t.id !== table?.id && t.is_combinable)
              .map((otherTable) => (
                <label
                  key={otherTable.id}
                  className="flex items-center space-x-2 text-sm"
                >
                  <Checkbox
                    checked={combinableWith.includes(otherTable.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setCombinableWith([...combinableWith, otherTable.id])
                      } else {
                        setCombinableWith(combinableWith.filter(id => id !== otherTable.id))
                      }
                    }}
                    disabled={isLoading}
                  />
                  <span>
                    Table {otherTable.table_number} ({otherTable.table_type})
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : table ? "Update Table" : "Create Table"}
        </Button>
      </div>
    </form>
  )
}