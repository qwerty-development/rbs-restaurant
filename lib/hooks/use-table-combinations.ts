"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RestaurantTableCombinationWithTables } from "@/types"
import { toast } from "react-hot-toast"

export function useTableCombinations(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["table-combinations", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("table_combinations")
        .select(`
          *,
          primary_table:restaurant_tables!table_combinations_primary_table_id_fkey(*),
          secondary_table:restaurant_tables!table_combinations_secondary_table_id_fkey(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (error) {
        console.error("Error fetching table combinations:", error)
        throw error
      }
      
      return data as RestaurantTableCombinationWithTables[]
    },
    enabled: !!restaurantId,
  })
}

export function useCreateTableCombination() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      restaurantId,
      primaryTableId,
      secondaryTableId,
      combinedCapacity,
    }: {
      restaurantId: string
      primaryTableId: string
      secondaryTableId: string
      combinedCapacity: number
    }) => {
      const { data, error } = await supabase
        .from("table_combinations")
        .insert({
          restaurant_id: restaurantId,
          primary_table_id: primaryTableId,
          secondary_table_id: secondaryTableId,
          combined_capacity: combinedCapacity,
        })
        .select()

      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["table-combinations", variables.restaurantId] })
      toast.success("Table combination created successfully")
    },
    onError: (error: any) => {
      console.error("Error creating table combination:", error)
      toast.error("Failed to create table combination")
    },
  })
}

export function useDeleteTableCombination() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase
        .from("table_combinations")
        .update({ is_active: false })
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["table-combinations", variables.restaurantId] })
      toast.success("Table combination deleted successfully")
    },
    onError: (error: any) => {
      console.error("Error deleting table combination:", error)
      toast.error("Failed to delete table combination")
    },
  })
}
