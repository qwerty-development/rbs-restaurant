// components/bookings/decline-note-dialog.tsx
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, MessageSquare } from "lucide-react"

interface DeclineNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string) => void
  onCancel: () => void
  guestName?: string
  isLoading?: boolean
  bookingTime?: string
  partySize?: number
}

export function DeclineNoteDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  guestName,
  isLoading = false,
  bookingTime,
  partySize
}: DeclineNoteDialogProps) {
  const [note, setNote] = useState("")

  const handleConfirm = () => {
    onConfirm(note.trim())
    setNote("") // Reset note after confirming
  }

  const handleCancel = () => {
    onCancel()
    setNote("") // Reset note when canceling
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNote("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Decline Booking Request
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {guestName && (
                  <span className="font-medium text-foreground">{guestName}</span>
                )}
                {bookingTime && partySize && (
                  <>
                    {guestName && " • "}
                    {bookingTime} • {partySize} guest{partySize !== 1 ? 's' : ''}
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-orange-800">
                  This action cannot be undone
                </p>
                <p className="text-orange-700 mt-1">
                  The guest will be automatically notified of the decline. You can optionally add a note explaining the reason.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="decline-note" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Decline Note (Optional)
            </Label>
            <Textarea
              id="decline-note"
              placeholder="e.g., Unfortunately we're fully booked at that time. Would you be interested in an alternative time?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              This note will be sent to the guest and visible to staff.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? "Declining..." : "Decline Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}