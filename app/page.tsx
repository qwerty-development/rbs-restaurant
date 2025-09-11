// app/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
    return
  }

  try {
    // Get user's restaurant tier
    const { data: staffData } = await supabase
      .from("restaurant_staff")
      .select(`
        restaurant:restaurants(
          tier
        )
      `)
      .eq("user_id", user.id)
      .single()

    if (!staffData) {
      redirect("/login")
      return
    }

    // Handle both array and object formats from Supabase
    const restaurant = Array.isArray(staffData.restaurant) 
      ? staffData.restaurant[0] 
      : staffData.restaurant
    
    const tier = restaurant?.tier

    if (tier === 'basic') {
      redirect("/basic-dashboard")
    } else {
      redirect("/dashboard")
    }

  } catch (error) {
    console.error('Error checking tier:', error)
    redirect("/login")
  }
}