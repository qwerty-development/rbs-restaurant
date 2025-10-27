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
import { PasswordInput } from "@/components/ui/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "react-hot-toast"
import { Loader2, LogIn, AlertCircle } from "lucide-react"
import { MfaVerificationForm } from "@/components/admin/mfa-verification-form"

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password must be at least 1 characters"),
})

type FormData = z.infer<typeof formSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showMfaVerification, setShowMfaVerification] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
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

      // Sign in with email and password
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

      // Check if user has MFA enabled
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      // Get list of MFA factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const hasVerifiedFactors = factorsData?.totp?.some((f) => f.status === "verified") || false

      // First check if user is an admin
      const { data: adminData, error: adminError } = await supabase
        .from("rbs_admins")
        .select("id, user_id")
        .eq("user_id", authData.user.id)
        .single()

      const userIsAdmin = adminData && !adminError

      // If user has MFA enabled but hasn't verified yet (AAL1 but has factors)
      if (hasVerifiedFactors && aalData?.currentLevel === "aal1") {
        setIsAdmin(userIsAdmin)
        setShowMfaVerification(true)
        setIsLoading(false)
        return
      }

      // If no MFA or already verified (AAL2), proceed with normal login
      await handleSuccessfulLogin(authData.user.id, userIsAdmin)
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error(error.message || "Failed to login")
      setIsLoading(false)
    }
  }

  async function handleSuccessfulLogin(userId: string, userIsAdmin: boolean) {
    try {
      if (userIsAdmin) {
        await supabase.auth.updateUser({
          data: {
            role: "admin",
            is_admin: true,
          },
        })
        toast.success("Welcome back, Admin!")
        // IMPORTANT: Use window.location.href instead of router.push
        // This forces a full page reload which ensures the session is properly set
        window.location.href = "/admin"
        return
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
        .eq("user_id", userId)
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
          },
        })
        toast.success(`Welcome back! Logging in to ${(singleRestaurant.restaurant as any)?.name}`)
      } else {
        toast.success(`Welcome back! You have access to ${staffData.length} restaurants.`)
      }

      // IMPORTANT: Use window.location.href instead of router.push
      // This forces a full page reload which ensures the session is properly set
      window.location.href = "/dashboard"
    } catch (error: any) {
      console.error("Post-login error:", error)
      toast.error(error.message || "Failed to complete login")
    }
  }

  async function handleMfaVerified() {
    try {
      setIsLoading(true)

      // Get current user after MFA verification
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not found after MFA verification")
      }

      await handleSuccessfulLogin(user.id, isAdmin)
    } catch (error: any) {
      console.error("MFA post-verification error:", error)
      toast.error(error.message || "Failed to complete login")
      setIsLoading(false)
    }
  }

  function handleMfaCancelled() {
    // Sign out and reset to login screen
    supabase.auth.signOut()
    setShowMfaVerification(false)
    setIsAdmin(false)
    toast.info("Login cancelled")
  }

  // Show MFA verification screen if needed
  if (showMfaVerification) {
    return (
      <MfaVerificationForm
        onVerified={handleMfaVerified}
        onCancel={handleMfaCancelled}
      />
    )
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
        {error === 'admin_access_required' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Admin access required to view this page. Please log in with an admin account.
            </AlertDescription>
          </Alert>
        )}
        {error === 'auth_error' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              There was an authentication error. Please try logging in again or request a new confirmation email if your account is unverified.
            </AlertDescription>
          </Alert>
        )}
        {error === 'expired' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your confirmation link has expired. Please use "Forgot Password" below to get a new confirmation email.
            </AlertDescription>
          </Alert>
        )}
        {error === 'invalid' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The confirmation link was invalid or already used. Try logging in or request a new confirmation email using "Forgot Password".
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
                    <PasswordInput
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