"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, AlertCircle, ArrowLeft } from "lucide-react"

interface MfaVerificationFormProps {
  onVerified: () => void
  onCancel: () => void
}

export function MfaVerificationForm({
  onVerified,
  onCancel,
}: MfaVerificationFormProps) {
  const [verificationCode, setVerificationCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const supabase = createClient()

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoading(true)
      setError("")

      if (!verificationCode || verificationCode.length !== 6) {
        setError("Please enter a valid 6-digit code")
        return
      }

      // Get the list of factors for the user
      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors()

      if (factorsError) throw factorsError

      // Get verified TOTP factors
      const totpFactors = factorsData?.totp?.filter((f) => f.status === "verified") || []

      if (totpFactors.length === 0) {
        throw new Error("No MFA factors found. Please set up 2FA first.")
      }

      // Use the first verified factor (in production, you might want to let user choose)
      const factor = totpFactors[0]

      // Create a challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: factor.id,
        })

      if (challengeError) throw challengeError

      // Verify the challenge with the provided code
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: verificationCode,
      })

      if (verifyError) throw verifyError

      // Verification successful
      onVerified()
    } catch (err: any) {
      console.error("MFA verification error:", err)

      if (err.message.includes("Invalid TOTP code") || err.message.includes("expired")) {
        setError("Invalid or expired code. Please try again with a new code from your authenticator app.")
      } else {
        setError(err.message || "Verification failed. Please try again.")
      }

      // Clear the input on error
      setVerificationCode("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    // Only allow digits and limit to 6 characters
    const cleaned = value.replace(/\D/g, "").slice(0, 6)
    setVerificationCode(cleaned)

    // Clear error when user starts typing
    if (error) setError("")
  }

  return (
    <Card className="border-2 shadow-xl backdrop-blur-md bg-white/20 border-white/30">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center text-white flex items-center justify-center gap-2">
          <Shield className="h-6 w-6" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription className="text-center text-white/80">
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="code" className="text-white">
              Verification Code
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              maxLength={6}
              disabled={isLoading}
              className="text-center text-3xl tracking-[0.5em] font-mono h-16"
              autoComplete="one-time-code"
              autoFocus
            />
            <p className="text-xs text-white/70 text-center">
              Open your authenticator app and enter the current code
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={isLoading || verificationCode.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-5 w-5" />
                Verify & Continue
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
          className="text-white hover:text-white/80 hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
        <div className="text-xs text-white/70 text-center">
          Lost your device?{" "}
          <a href="mailto:support@example.com" className="text-white hover:underline">
            Contact Support
          </a>
        </div>
      </CardFooter>
    </Card>
  )
}
