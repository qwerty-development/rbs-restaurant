// components/tables/table-form.tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
import type { RestaurantTable } from "@/types"

const tableSchema = z.object({
  table_number: z.string().min(1, "Table number is required"),
  table_type: z.enum(["booth", "window", "patio", "standard", "bar", "private"]),
  min_capacity: z.number().min(1).max(20),
  max_capacity: z.number().min(1).max(50),
  shape: z.enum(["rectangle", "circle", "square"]),
  is_active: z.boolean(),
  is_combinable: z.boolean(),
  features: z.array(z.string()),
})

type TableFormData = z.infer<typeof tableSchema>

interface TableFormProps {
  table?: RestaurantTable
  onSubmit: (data: Partial<RestaurantTable>) => void
  onCancel: () => void
  isLoading: boolean
}

const TABLE_FEATURES = [
  "Wheelchair Accessible",
  "High Chair Available",
  "Corner Table",
  "Near Kitchen",
  "Near Restroom",
  "Quiet Area",
  "Power Outlet",
]

export function TableForm({ table, onSubmit, onCancel, isLoading }: TableFormProps) {
  const form = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      table_number: table?.table_number || "",
      table_type: table?.table_type || "standard",
      min_capacity: table?.min_capacity || 1,
      max_capacity: table?.max_capacity || 4,
      shape: table?.shape || "rectangle",
      is_active: table?.is_active ?? true,
      is_combinable: table?.is_combinable ?? true,
      features: table?.features || [],
    },
  })

  const watchMinCapacity = form.watch("min_capacity")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="table_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Table Number</FormLabel>
              <FormControl>
                <Input {...field} disabled={isLoading} placeholder="T1, B2, etc." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="table_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Table Type</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="booth">Booth</SelectItem>
                    <SelectItem value="window">Window</SelectItem>
                    <SelectItem value="patio">Patio</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="shape"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shape</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="min_capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="max_capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    disabled={isLoading}
                    min={watchMinCapacity}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="features"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Features</FormLabel>
              <FormDescription>
                Select all applicable features
              </FormDescription>
              <div className="flex flex-wrap gap-2">
                {TABLE_FEATURES.map((feature) => (
                  <Badge
                    key={feature}
                    variant={field.value.includes(feature) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (field.value.includes(feature)) {
                        field.onChange(field.value.filter((f) => f !== feature))
                      } else {
                        field.onChange([...field.value, feature])
                      }
                    }}
                  >
                    {feature}
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
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Active</FormLabel>
                  <FormDescription>
                    Table is available for bookings
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="is_combinable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Combinable</FormLabel>
                  <FormDescription>
                    Can be combined with adjacent tables
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end gap-2">
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
    </Form>
  )
}