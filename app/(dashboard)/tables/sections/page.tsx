// app/(dashboard)/tables/sections/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "react-hot-toast"
import { Plus, Edit, Trash2, ArrowLeft, Settings, Users, MapPin } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import * as z from "zod"

const tableFormSchema = z.object({
  tableNumber: z.string().min(1, "Table number is required"),
  tableType: z.enum(["booth", "window", "patio", "standard", "bar", "private"]),
  minCapacity: z.number().min(1, "Min capacity must be at least 1"),
  maxCapacity: z.number().min(1, "Max capacity must be at least 1"),
  xPosition: z.number().default(50).optional(),
  yPosition: z.number().default(50).optional(),
  width: z.number().default(10).optional(),
  height: z.number().default(10).optional(),
  shape: z.enum(["rectangle", "circle", "square"]).default("rectangle").optional(),
  features: z.array(z.string()).default([]).optional(),
  isCombinable: z.boolean().default(true).optional(),
  priorityScore: z.number().default(0).optional(),
})

type TableFormData = z.infer<typeof tableFormSchema>

type RestaurantTable = {
  id: string
  restaurant_id: string
  table_number: string
  table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private"
  capacity: number
  x_position: number
  y_position: number
  shape: "rectangle" | "circle" | "square"
  width: number
  height: number
  is_active: boolean
  features: string[] | null
  created_at: string
  min_capacity: number
  max_capacity: number
  is_combinable: boolean
  combinable_with: string[] | null
  priority_score: number
}

type TablesByType = {
  [key: string]: RestaurantTable[]
}

const TABLE_TYPE_LABELS = {
  booth: "Booth",
  window: "Window",
  patio: "Patio", 
  standard: "Standard",
  bar: "Bar",
  private: "Private"
}

const TABLE_TYPE_COLORS = {
  booth: "#8B5CF6",
  window: "#06B6D4", 
  patio: "#10B981",
  standard: "#6B7280",
  bar: "#F59E0B",
  private: "#EF4444"
}

function TableForm({
  table,
  onSubmit,
  onCancel,
  isLoading,
}: {
  table?: RestaurantTable | null
  onSubmit: (data: TableFormData) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const form = useForm<TableFormData>({
    resolver: zodResolver(tableFormSchema),
    defaultValues: {
      tableNumber: table?.table_number || "",
      tableType: table?.table_type || "standard",
      minCapacity: table?.min_capacity || 1,
      maxCapacity: table?.max_capacity || 4,
      xPosition: table?.x_position || 50,
      yPosition: table?.y_position || 50,
      width: table?.width || 10,
      height: table?.height || 10,
      shape: table?.shape || "rectangle",
      features: table?.features || [],
      isCombinable: table?.is_combinable ?? true,
      priorityScore: table?.priority_score || 0,
    },
  })

  useEffect(() => {
    form.reset({
      tableNumber: table?.table_number || "",
      tableType: table?.table_type || "standard",
      minCapacity: table?.min_capacity || 1,
      maxCapacity: table?.max_capacity || 4,
      xPosition: table?.x_position || 50,
      yPosition: table?.y_position || 50,
      width: table?.width || 10,
      height: table?.height || 10,
      shape: table?.shape || "rectangle",
      features: table?.features || [],
      isCombinable: table?.is_combinable ?? true,
      priorityScore: table?.priority_score || 0,
    })
  }, [table, form])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tableNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Table Number</FormLabel>
                <FormControl>
                  <Input {...field} disabled={isLoading} placeholder="T1, A5, etc." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tableType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Table Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select table type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TABLE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded"
                            style={{ backgroundColor: TABLE_TYPE_COLORS[value as keyof typeof TABLE_TYPE_COLORS] }}
                          />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
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
            name="minCapacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    disabled={isLoading}
                    min="1"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxCapacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    disabled={isLoading}
                    min="1"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="shape"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shape</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shape" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="rectangle">Rectangle</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
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

export default function TableSectionsPage() {
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>("all")
  const router = useRouter()

  const supabase = createClient()
  const queryClient = useQueryClient()

  const [restaurantId, setRestaurantId] = useState<string>("")

  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch tables
  const { data: tables, isLoading } = useQuery({
    queryKey: ["restaurant-tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data as RestaurantTable[]
    },
    enabled: !!restaurantId,
  })

  // Group tables by type
  const tablesByType: TablesByType = tables?.reduce((acc, table) => {
    if (!acc[table.table_type]) {
      acc[table.table_type] = []
    }
    acc[table.table_type].push(table)
    return acc
  }, {} as TablesByType) || {}

  // Get stats for each type
  const typeStats = Object.entries(TABLE_TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    count: tablesByType[type]?.length || 0,
    totalCapacity: tablesByType[type]?.reduce((sum, table) => sum + table.max_capacity, 0) || 0,
    color: TABLE_TYPE_COLORS[type as keyof typeof TABLE_TYPE_COLORS]
  }))

  const tableMutation = useMutation({
    mutationFn: async (tableData: TableFormData) => {
      const dataToSave = {
        table_number: tableData.tableNumber,
        table_type: tableData.tableType,
        capacity: tableData.maxCapacity, // Using max capacity as the main capacity
        x_position: tableData.xPosition,
        y_position: tableData.yPosition,
        shape: tableData.shape,
        width: tableData.width,
        height: tableData.height,
        features: tableData.features,
        min_capacity: tableData.minCapacity,
        max_capacity: tableData.maxCapacity,
        is_combinable: tableData.isCombinable,
        priority_score: tableData.priorityScore,
        restaurant_id: restaurantId,
      }

      if (selectedTable) {
        const { error } = await supabase
          .from("restaurant_tables")
          .update(dataToSave)
          .eq("id", selectedTable.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("restaurant_tables")
          .insert(dataToSave)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-tables"] })
      toast.success(selectedTable ? "Table updated" : "Table created")
      setIsFormOpen(false)
      setSelectedTable(null)
    },
    onError: (error: any) => {
      console.error("Table mutation error:", error)
      toast.error("Failed to save table")
    },
  })

  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ is_active: false })
        .eq("id", tableId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-tables"] })
      toast.success("Table deleted")
    },
    onError: (error: any) => {
      console.error("Delete table error:", error)
      toast.error("Failed to delete table")
    },
  })

  const handleEdit = (table: RestaurantTable) => {
    setSelectedTable(table)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedTable(null)
    setIsFormOpen(true)
  }

  const handleDelete = (tableId: string) => {
    if (confirm("Are you sure you want to delete this table?")) {
      deleteTableMutation.mutate(tableId)
    }
  }

  const filteredTables = selectedType === "all" 
    ? tables || []
    : tables?.filter(table => table.table_type === selectedType) || []

  return (
    <div className="space-y-8">
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/dashboard/tables")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tables
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Table Types</h1>
            <p className="text-muted-foreground">
              Manage your tables organized by type (booth, window, patio, etc.).
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Table
          </Button>
        </div>
      </div>

      {/* Table Type Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {typeStats.map((stat) => (
          <Card 
            key={stat.type} 
            className={`cursor-pointer transition-colors ${
              selectedType === stat.type ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedType(selectedType === stat.type ? "all" : stat.type)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: stat.color }}
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.count}</div>
              <p className="text-xs text-muted-foreground">
                {stat.totalCapacity} total seats
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog 
        open={isFormOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false)
            setSelectedTable(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTable ? "Edit Table" : "Add New Table"}</DialogTitle>
          </DialogHeader>
          <TableForm
            table={selectedTable}
            onSubmit={(data) => tableMutation.mutate(data)}
            onCancel={() => {
              setIsFormOpen(false)
              setSelectedTable(null)
            }}
            isLoading={tableMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedType === "all" 
                  ? "All Tables" 
                  : `${TABLE_TYPE_LABELS[selectedType as keyof typeof TABLE_TYPE_LABELS]} Tables`
                }
              </CardTitle>
              <CardDescription>
                {selectedType === "all" 
                  ? "All tables in your restaurant"
                  : `Tables of type: ${TABLE_TYPE_LABELS[selectedType as keyof typeof TABLE_TYPE_LABELS]}`
                }
              </CardDescription>
            </div>
            {selectedType !== "all" && (
              <Button variant="outline" onClick={() => setSelectedType("all")}>
                Show All Types
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Shape</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredTables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No tables found. Create your first table to get started.
                  </TableCell>
                </TableRow>
              ) : filteredTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">{table.table_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: TABLE_TYPE_COLORS[table.table_type] }}
                      />
                      {TABLE_TYPE_LABELS[table.table_type]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {table.min_capacity} - {table.max_capacity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {table.shape}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {Math.round(table.x_position)}, {Math.round(table.y_position)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {table.is_combinable && (
                        <Badge variant="secondary" className="text-xs">
                          Combinable
                        </Badge>
                      )}
                      {table.features && table.features.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{table.features.length} features
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(table)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(table.id)}
                        disabled={deleteTableMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}