// components/menu/delete-category-dialog.tsx
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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { MenuCategory } from "@/types"

interface DeleteCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryName: string
  itemCount: number
  categories: MenuCategory[]
  onConfirm: (action: "delete-all" | "reassign", targetCategoryId?: string) => void
  isLoading: boolean
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  categoryName,
  itemCount,
  categories,
  onConfirm,
  isLoading,
}: DeleteCategoryDialogProps) {
  const [action, setAction] = useState<"delete-all" | "reassign">("reassign")
  const [targetCategoryId, setTargetCategoryId] = useState<string>("")

  const handleConfirm = () => {
    if (action === "reassign" && !targetCategoryId) {
      return
    }
    onConfirm(action, action === "reassign" ? targetCategoryId : undefined)
  }

  const canConfirm = action === "delete-all" || (action === "reassign" && targetCategoryId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            The category &quot;{categoryName}&quot; contains {itemCount} menu item{itemCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. Choose how to handle the menu items.
            </AlertDescription>
          </Alert>

          <RadioGroup value={action} onValueChange={(v) => setAction(v as "delete-all" | "reassign")}>
            <div className="space-y-4">
              {/* Reassign Option */}
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="reassign" id="reassign" className="mt-1" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="reassign" className="font-medium cursor-pointer">
                    Reassign items to another category
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Move all {itemCount} item{itemCount !== 1 ? "s" : ""} to a different category before deleting
                  </p>
                  {action === "reassign" && (
                    <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select target category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Delete All Option */}
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="delete-all" id="delete-all" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="delete-all" className="font-medium cursor-pointer text-destructive">
                    Delete category and all items
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete the category and all {itemCount} menu item{itemCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
