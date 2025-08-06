"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RestaurantTableCombinationWithTables } from "@/types"

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
