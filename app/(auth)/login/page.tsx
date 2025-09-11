"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "react-hot-toast"
import { Loader2, LogIn, AlertCircle } from "lucide-react"

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password must be at least 1 characters"),
})

type FormData = z.infer<typeof formSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const error = searchParams.get('error')

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: FormData) {
    try {
      setIsLoading(true)
  
      // Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
  
      if (authError) {
        throw authError
      }
  
      if (!authData.user) {
        throw new Error("Login failed")
      }
  
      // Check if user has restaurant access
      const { data: staffData, error: staffError } = await supabase
        .from("restaurant_staff")
        .select(`
          id,
          role,
          restaurant_id,
          restaurant:restaurants(id, name)
        `)
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
  
      if (staffError || !staffData || staffData.length === 0) {
        await supabase.auth.signOut()
        throw new Error("You don't have access to any restaurant. Please contact your restaurant owner.")
      }
  
      // For multi-restaurant users, we'll let the dashboard handle restaurant selection
      // For single restaurant users, we can set some basic metadata
      if (staffData.length === 1) {
        const singleRestaurant = staffData[0]
        await supabase.auth.updateUser({
          data: {
            restaurant_id: singleRestaurant.restaurant_id,
            restaurant_name: (singleRestaurant.restaurant as any)?.name,
            role: singleRestaurant.role,
          }
        })
        toast.success(`Welcome back! Logging in to ${(singleRestaurant.restaurant as any)?.name}`)
      } else {
        toast.success(`Welcome back! You have access to ${staffData.length} restaurants.`)
      }
      
      // IMPORTANT: Use window.location.href instead of router.push
      // This forces a full page reload which ensures the session is properly set
      window.location.href = "/dashboard"
      
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error(error.message || "Failed to login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-2 shadow-xl backdrop-blur-md bg-white/20 border-white/30">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center text-white">
          Restaurant Login
        </CardTitle>
        <CardDescription className="text-center text-white/80">
          Enter your credentials to access your restaurant dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error === 'no_access' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have access to any restaurant. Please contact your restaurant owner.
            </AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-white/80 text-center">
          <Link href="/forgot-password" className="text-white hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="text-sm text-white/80 text-center">
          Don't have an account?{" "}
          <Link href="/signup" className="text-white hover:underline">
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}