// hooks/use-restaurant-sections.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"

export interface RestaurantSection {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  color: string
  icon: string
  created_at: string
  updated_at: string
}

export interface CreateSectionData {
  name: string
  description?: string
  color?: string
  icon?: string
  is_active?: boolean
}

export interface UpdateSectionData {
  name?: string
  description?: string
  color?: string
  icon?: string
  is_active?: boolean
  display_order?: number
}

export function useRestaurantSections(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId
  })
}

export function useActiveSections(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["restaurant-sections-active", restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId
  })
}

export function useCreateSection(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateSectionData) => {
      if (!restaurantId) throw new Error("Restaurant ID is required")

      // Get current max order
      const { data: existingSections } = await supabase
        .from("restaurant_sections")
        .select("display_order")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: false })
        .limit(1)

      const maxOrder = existingSections?.[0]?.display_order || 0

      const { error } = await supabase
        .from("restaurant_sections")
        .insert({
          restaurant_id: restaurantId,
          name: data.name,
          description: data.description || null,
          color: data.color || "#3b82f6",
          icon: data.icon || "grid",
          is_active: data.is_active ?? true,
          display_order: maxOrder + 1
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Section created successfully")
    },
    onError: (error) => {
      toast.error("Failed to create section")
      console.error("Error creating section:", error)
    }
  })
}

export function useUpdateSection(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: UpdateSectionData }) => {
      const { error } = await supabase
        .from("restaurant_sections")
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Section updated successfully")
    },
    onError: (error) => {
      toast.error("Failed to update section")
      console.error("Error updating section:", error)
    }
  })
}

export function useDeleteSection(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Check if section is being used in any bookings
      const { data: bookingsWithSection, error: bookingError } = await supabase
        .from("bookings")
        .select("id")
        .eq("preferred_section", id)
        .limit(1)

      if (bookingError) throw bookingError

      if (bookingsWithSection && bookingsWithSection.length > 0) {
        throw new Error("Cannot delete section that is referenced in existing bookings")
      }

      const { error } = await supabase
        .from("restaurant_sections")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Section deleted successfully")
    },
    onError: (error) => {
      if (error.message.includes("referenced in existing bookings")) {
        toast.error("Cannot delete section that has existing bookings. Deactivate it instead.")
      } else {
        toast.error("Failed to delete section")
      }
      console.error("Error deleting section:", error)
    }
  })
}

export function useReorderSections(restaurantId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sections: { id: string, display_order: number }[]) => {
      const updates = sections.map(section => 
        supabase
          .from("restaurant_sections")
          .update({ 
            display_order: section.display_order,
            updated_at: new Date().toISOString()
          })
          .eq("id", section.id)
      )

      const results = await Promise.all(updates)
      
      for (const { error } of results) {
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections", restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
    },
    onError: (error) => {
      toast.error("Failed to reorder sections")
      console.error("Error reordering sections:", error)
    }
  })
}