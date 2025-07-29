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
  DialogTrigger 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form"
import { toast } from "react-hot-toast"
import { Plus, Edit, Trash2 } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"


const sectionFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
})

type SectionFormData = z.infer<typeof sectionFormSchema>

function SectionForm({
  section,
  onSubmit,
  onCancel,
  isLoading,
}: {
  section?: any | null
  onSubmit: (data: SectionFormData) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const form = useForm<SectionFormData>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: {
      name: section?.name || "",
      description: section?.description || "",
    },
  })

  useEffect(() => {
    form.reset({
      name: section?.name || "",
      description: section?.description || "",
    })
  }, [section, form])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Section Name</FormLabel>
              <FormControl>
                <Input {...field} disabled={isLoading} />
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
                  {...field}
                  disabled={isLoading}
                  placeholder="e.g., Patio, Main Dining Room"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : section ? "Update Section" : "Create Section"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default function TableSectionsPage() {
  const [selectedSection, setSelectedSection] = useState<any | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

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

  const { data: sections, isLoading } = useQuery({
    queryKey: ["table-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from("table_sections")
        .select("*, tables:restaurant_tables(count)")
        .eq("restaurant_id", restaurantId)
        .order("name", { ascending: true })

      if (error) throw error
      return data as (any & { tables: [{ count: number }] })[]
    },
    enabled: !!restaurantId,
  })

  const sectionMutation = useMutation({
    mutationFn: async (sectionData: SectionFormData) => {
      const dataToSave = {
        ...sectionData,
        restaurant_id: restaurantId,
      }
      if (selectedSection) {
        const { error } = await supabase
          .from("table_sections")
          .update(dataToSave)
          .eq("id", selectedSection.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("table_sections")
          .insert(dataToSave)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-sections"] })
      toast.success(selectedSection ? "Section updated" : "Section created")
      setIsFormOpen(false)
      setSelectedSection(null)
    },
    onError: () => {
      toast.error("Failed to save section")
    },
  })

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const { error } = await supabase
        .from("table_sections")
        .delete()
        .eq("id", sectionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-sections"] })
      toast.success("Section deleted")
    },
    onError: (error: any) => {
      if (error.message.includes('foreign key constraint')) {
        toast.error("Cannot delete section with tables. Please reassign tables first.")
      } else {
        toast.error("Failed to delete section")
      }
    },
  })

  const handleEdit = (section: any) => {
    setSelectedSection(section)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedSection(null)
    setIsFormOpen(true)
  }

  const handleDelete = (sectionId: string) => {
    if (confirm("Are you sure you want to delete this section?")) {
      deleteSectionMutation.mutate(sectionId)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Table Sections</h1>
          <p className="text-muted-foreground">
            Group your tables into sections for better organization.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>

      <Dialog 
        open={isFormOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false)
            setSelectedSection(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSection ? "Edit Section" : "Add New Section"}</DialogTitle>
          </DialogHeader>
          <SectionForm
            section={selectedSection}
            onSubmit={(data) => sectionMutation.mutate(data)}
            onCancel={() => {
              setIsFormOpen(false)
              setSelectedSection(null)
            }}
            isLoading={sectionMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All Sections</CardTitle>
          <CardDescription>
            A list of all your table sections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Table Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : sections?.map((section) => (
                <TableRow key={section.id}>
                  <TableCell className="font-medium">{section.name}</TableCell>
                  <TableCell>{section.description}</TableCell>
                  <TableCell>{section.tables[0]?.count || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(section)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(section.id)}>
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
