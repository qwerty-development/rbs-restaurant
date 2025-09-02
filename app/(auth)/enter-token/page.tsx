// app/(auth)/enter-token/page.tsx
"use client"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "react-hot-toast"
import { Loader2, KeyRound, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"

const formSchema = z.object({
  token: z.string().length(6, "Token must be exactly 6 digits").regex(/^\d{6}$/, "Token must be 6 digits"),
})

type FormData = z.infer<typeof formSchema>

export default function EnterTokenPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: "",
    },
  })

  async function onSubmit(data: FormData) {
    try {
      setIsLoading(true)

      // Verify token by attempting to exchange it for a session
      const { data: authData, error } = await supabase.auth.verifyOtp({
        token: data.token,
        type: 'email',
      })

      if (error) {
        if (error.message.includes('invalid') || error.message.includes('expired')) {
          toast.error("Invalid or expired token. Please request a new one.")
        } else {
          toast.error(error.message || "Failed to verify token")
        }
        return
      }

      if (authData.session) {
        // Token is valid, redirect to reset password
        router.push("/reset-password")
      } else {
        toast.error("Invalid token. Please check and try again.")
      }
    } catch (error: any) {
      console.error("Token verification error:", error)
      toast.error(error.message || "Failed to verify token")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-2 shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Enter Reset Token
        </CardTitle>
        <CardDescription className="text-center">
          Enter the 6-digit token from your email
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Check your email for a message containing a 6-digit token. The token may take a few minutes to arrive.
          </AlertDescription>
        </Alert>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reset Token</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      disabled={isLoading}
                      className="text-center text-lg tracking-wider"
                      {...field}
                      onChange={(e) => {
                        // Only allow digits
                        const value = e.target.value.replace(/\D/g, '')
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || form.watch("token").length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Verify Token
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <Link 
          href="/forgot-password" 
          className="text-sm text-primary hover:underline"
        >
          Didn't receive a token? Send another
        </Link>
        <Link 
          href="/login" 
          className="flex items-center text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to login
        </Link>
      </CardFooter>
    </Card>
  )
}