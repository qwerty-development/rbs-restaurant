"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Plus,
  Trash2,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { MfaEnrollmentDialog } from "@/components/admin/mfa-enrollment-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Factor {
  id: string
  friendly_name: string
  factor_type: "totp"
  status: "verified" | "unverified"
  created_at: string
}

export default function AdminSettingsPage() {
  const [factors, setFactors] = useState<Factor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false)
  const [factorToDelete, setFactorToDelete] = useState<Factor | null>(null)
  const [isDeletingFactor, setIsDeletingFactor] = useState(false)
  const [aal, setAal] = useState<{ currentLevel: string; nextLevel: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadFactors()
    checkAAL()
  }, [])

  const loadFactors = async () => {
    try {
      setIsLoading(true)

      const { data, error } = await supabase.auth.mfa.listFactors()

      if (error) throw error

      // Combine all factor types (currently only TOTP)
      const allFactors = [...(data?.totp || [])]
      setFactors(allFactors as Factor[])
    } catch (err: any) {
      console.error("Error loading factors:", err)
      toast.error("Failed to load security factors")
    } finally {
      setIsLoading(false)
    }
  }

  const checkAAL = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (error) throw error

      setAal({
        currentLevel: data?.currentLevel || "aal1",
        nextLevel: data?.nextLevel || "aal1",
      })
    } catch (err: any) {
      console.error("Error checking AAL:", err)
    }
  }

  const handleUnenroll = async () => {
    if (!factorToDelete) return

    try {
      setIsDeletingFactor(true)

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorToDelete.id,
      })

      if (error) throw error

      toast.success("Two-factor authentication disabled")
      await loadFactors()
      await checkAAL()

      // Refresh the session to update AAL
      await supabase.auth.refreshSession()
    } catch (err: any) {
      console.error("Error unenrolling factor:", err)
      toast.error("Failed to disable two-factor authentication")
    } finally {
      setIsDeletingFactor(false)
      setFactorToDelete(null)
    }
  }

  const verifiedFactors = factors.filter((f) => f.status === "verified")
  const hasMultipleFactors = verifiedFactors.length > 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your account security and two-factor authentication
        </p>
      </div>

      {/* Current Security Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Security Status
          </CardTitle>
          <CardDescription>Your current authentication assurance level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {verifiedFactors.length > 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Two-Factor Authentication Enabled
                    </p>
                    <p className="text-sm text-gray-600">
                      {verifiedFactors.length} {verifiedFactors.length === 1 ? "device" : "devices"}{" "}
                      enrolled
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Two-Factor Authentication Disabled
                    </p>
                    <p className="text-sm text-gray-600">
                      Your account is not protected by 2FA
                    </p>
                  </div>
                </>
              )}
            </div>
            <Badge variant={verifiedFactors.length > 0 ? "default" : "secondary"}>
              {aal?.currentLevel?.toUpperCase() || "AAL1"}
            </Badge>
          </div>

          {verifiedFactors.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                We strongly recommend enabling two-factor authentication to protect your admin
                account from unauthorized access.
              </AlertDescription>
            </Alert>
          )}

          {verifiedFactors.length === 1 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Consider adding a backup device in case you lose access to your primary
                authenticator.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Enrolled Devices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600" />
                Authenticator Devices
              </CardTitle>
              <CardDescription>
                Manage devices used for two-factor authentication
              </CardDescription>
            </div>
            <Button onClick={() => setEnrollDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : factors.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No authenticator devices enrolled</p>
              <Button onClick={() => setEnrollDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Device
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Smartphone className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {factor.friendly_name || "Authenticator App"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={factor.status === "verified" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {factor.status === "verified" ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            "Pending Verification"
                          )}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Added {new Date(factor.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFactorToDelete(factor)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How Two-Factor Authentication Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">Enroll Your Device</p>
                <p className="text-sm text-gray-600">
                  Scan a QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">Enter Your Code</p>
                <p className="text-sm text-gray-600">
                  When logging in, you'll be asked for a 6-digit code from your authenticator app
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Stay Protected</p>
                <p className="text-sm text-gray-600">
                  Your account is now protected even if someone knows your password
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Keep your authenticator device secure. If you lose it,
              you may need to contact support to regain access to your account.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Enrollment Dialog */}
      <MfaEnrollmentDialog
        open={enrollDialogOpen}
        onOpenChange={setEnrollDialogOpen}
        onSuccess={() => {
          loadFactors()
          checkAAL()
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!factorToDelete}
        onOpenChange={(open) => !open && setFactorToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Authenticator Device?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{factorToDelete?.friendly_name}"?
              {!hasMultipleFactors && (
                <span className="block mt-2 text-amber-600 font-medium">
                  This is your only enrolled device. Removing it will disable two-factor
                  authentication on your account.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFactor}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={isDeletingFactor}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingFactor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
