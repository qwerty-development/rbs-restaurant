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
      // Check if combination already exists (either direction)
      const { data: existingCombinations, error: checkError } = await supabase
        .from("table_combinations")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .or(
          `and(primary_table_id.eq.${primaryTableId},secondary_table_id.eq.${secondaryTableId}),` +
          `and(primary_table_id.eq.${secondaryTableId},secondary_table_id.eq.${primaryTableId})`
        )

      if (checkError) throw checkError

      if (existingCombinations && existingCombinations.length > 0) {
        throw new Error("Table combination already exists!")
      }

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
      
      // Parse database errors for better user experience
      let errorMessage = "Failed to create table combination"
      
      if (error?.message) {
        // Check for unique constraint violation (duplicate combination)
        if (error.message.includes('duplicate key') || 
            error.message.includes('violates unique constraint') ||
            error.message.includes('already exists')) {
          errorMessage = "Table combination already exists!"
        }
        // Check for foreign key constraint violations
        else if (error.message.includes('table_combinations_primary_table_id_fkey') ||
                 error.message.includes('table_combinations_secondary_table_id_fkey')) {
          errorMessage = "One of the selected tables is no longer valid. Please refresh and try again."
        }
        else if (error.message.includes('table_combinations_restaurant_id_fkey')) {
          errorMessage = "Invalid restaurant. Please refresh and try again."
        }
        // Check for check constraint violations
        else if (error.message.includes('violates check constraint')) {
          errorMessage = "Invalid combination settings. Please check your inputs."
        }
        // Check for null violations
        else if (error.message.includes('violates not-null constraint')) {
          errorMessage = "Required information is missing. Please fill out all fields."
        }
        // Show specific error message if it's user-friendly
        else if (error.message.length < 100 && !error.message.includes('function') && !error.message.includes('relation')) {
          errorMessage = error.message
        }
      }
      
      toast.error(errorMessage)
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
