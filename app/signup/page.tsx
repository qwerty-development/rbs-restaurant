"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { toast } from "react-hot-toast"
import { Loader2, UserPlus } from "lucide-react"
import { RegistrationTermsCheckbox } from "@/components/ui/terms-checkbox"

// Lebanese phone number validation regex - just check for 8 digits
const lebanesePhoneRegex = /^\d{8}$/

const formSchema = z.object({
  // Staff details
  fullName: z
    .string()
    .min(2, "Please enter at least 2 characters.")
    .max(50, "Please enter fewer than 50 characters.")
    .regex(
      /^[a-zA-Z\s\u0600-\u06FF\u002D\u0027]+$/,
      "Please enter a valid name.",
    ),
  email: z
    .string()
    .email("Please enter a valid email address.")
    .toLowerCase(),
  phoneNumber: z
    .string()
    .regex(lebanesePhoneRegex, "Please enter a valid 8-digit Lebanese phone number.")
    .transform((val) => {
      // Normalize phone number format - always add +961 prefix
      const cleaned = val.trim()
      // Remove all non-digit characters
      const digits = cleaned.replace(/\D/g, '')
      
      // Should be exactly 8 digits after validation
      return `+961${digits}`
    }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be fewer than 128 characters.")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain uppercase, lowercase, number, and special character.",
    ),
  confirmPassword: z.string().min(8, "Please confirm your password."),
  
  // Terms acceptance
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to register",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type FormData = z.infer<typeof formSchema>

export default function SignUpPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  })

  async function onSubmit(data: FormData) {
    try {
      setIsLoading(true)

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone_number: data.phoneNumber,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error("Failed to create account")

      // Upsert profile (update if exists, insert if doesn't)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: authData.user.id,
          full_name: data.fullName,
          email: data.email,
          phone_number: data.phoneNumber,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error("Profile update error:", profileError)
        // Don't throw here as the user account was created successfully
      }

      // Redirect to confirmation page
      router.push("/confirm-email")
    } catch (error: any) {
      console.error("Sign-up error:", error)
      
      // Show user-friendly error messages
      let errorMessage = "An error occurred during sign up."
      
      if (error.message?.includes("already registered")) {
        errorMessage = "This email is already registered. Please sign in instead."
      } else if (error.message?.includes("weak password")) {
        errorMessage = "Please choose a stronger password."
      } else if (error.message?.includes("invalid email")) {
        errorMessage = "Please enter a valid email address."
      } else if (error.message?.includes("phone")) {
        errorMessage = "Please enter a valid Lebanese phone number."
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full border-2 shadow-xl backdrop-blur-md bg-white/20 border-white/30">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                Create Account
              </CardTitle>
              <CardDescription className="text-center text-secondary-foreground">
                Sign up to join a restaurant team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
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
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
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
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="03 123 456 or 71 234 567"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
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

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
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
                  </div>

                  {/* Terms and Conditions */}
                  <FormField
                    control={form.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormControl>
                          <RegistrationTermsCheckbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !form.watch("acceptTerms")}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <div className="text-sm text-secondary-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </Card>
  )
}
