// components/menu/csv-import-dialog.tsx
"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Upload,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign
} from "lucide-react"
import {
  parseMenuItemsCSV,
  convertCSVToMenuItems,
  downloadCSVTemplate,
  type CSVValidationError
} from "@/lib/csv-parser"
import type { MenuCategory } from "@/types"
import { toast } from "react-hot-toast"

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MenuCategory[]
  restaurantId: string
  onImportComplete: () => void
}

type ImportStep = 'upload' | 'validation' | 'preview' | 'importing' | 'complete' | 'error'

export function CSVImportDialog({
  open,
  onOpenChange,
  categories: initialCategories,
  restaurantId,
  onImportComplete
}: CSVImportDialogProps) {
  // CRITICAL DEBUG: Log what restaurantId we receive when component mounts/updates
  console.log('🔍 CSVImportDialog render - restaurantId:', restaurantId)
  console.log('🔍 restaurantId type:', typeof restaurantId)
  console.log('🔍 restaurantId length:', restaurantId?.length)
  console.log('🔍 restaurantId is empty string?', restaurantId === '')
  console.log('🔍 Dialog open?', open)

  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [validItems, setValidItems] = useState<any[]>([])
  const [errors, setErrors] = useState<CSVValidationError[]>([])
  const [unmatchedCategories, setUnmatchedCategories] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [importStats, setImportStats] = useState({ success: 0, failed: 0 })
  const [pricelessMode, setPricelessMode] = useState(false)
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories)

  const supabase = createClient()

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && droppedFile.type === "text/csv") {
      handleFileSelect(droppedFile)
    } else {
      toast.error("Please upload a CSV file")
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setStep('validation')
    setErrors([])
    setValidItems([])

    try {
      // CRITICAL: Check if we have a restaurant ID
      if (!restaurantId || restaurantId.trim() === '') {
        console.error('❌ Restaurant ID is missing or empty!')
        setErrors([{
          row: 0,
          field: 'restaurant',
          message: 'Restaurant ID is missing. Please refresh the page and try again.'
        }])
        setStep('error')
        return
      }

      // FIRST: Fetch fresh categories from database RIGHT NOW
      console.log('=== CSV IMPORT DEBUG ===')
      console.log('Restaurant ID:', restaurantId)
      console.log('Restaurant ID length:', restaurantId.length)
      console.log('Fetching categories for this restaurant...')

      const { data: freshCategories, error: catError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (catError) {
        console.error('Error fetching categories:', catError)
        setErrors([{ row: 0, field: 'categories', message: `Failed to fetch categories: ${catError.message}` }])
        setStep('error')
        return
      }

      console.log('Query returned:', freshCategories)
      console.log('Number of categories found:', freshCategories?.length || 0)

      if (!freshCategories || freshCategories.length === 0) {
        setErrors([{
          row: 0,
          field: 'categories',
          message: `No categories found for restaurant ID: ${restaurantId}. Please import categories first (STEP 1)`
        }])
        setStep('error')
        return
      }

      console.log('✅ Found categories:', freshCategories.map(c => c.name))
      console.log('======================')
      setCategories(freshCategories as MenuCategory[])

      // THEN: Parse the CSV file
      const text = await selectedFile.text()
      const result = parseMenuItemsCSV(text, pricelessMode)

      if (result.errors.length > 0) {
        setErrors(result.errors)
        setStep('error')
        return
      }

      if (result.valid.length === 0) {
        setErrors([{ row: 0, field: 'file', message: 'No valid items found in CSV' }])
        setStep('error')
        return
      }

      // FINALLY: Convert to menu items format using FRESH categories
      const { items, unmatchedCategories: unmatched } = await convertCSVToMenuItems(
        result.valid,
        freshCategories as MenuCategory[],
        restaurantId
      )

      if (unmatched.length > 0) {
        setUnmatchedCategories(unmatched)
        const availableCategories = freshCategories.map(c => c.name).join(', ')
        setErrors([{
          row: 0,
          field: 'categories',
          message: `Categories not found: ${unmatched.join(', ')}.\n\nAvailable categories: ${availableCategories}\n\nMake sure your CSV category names match exactly (case-insensitive).`
        }])
        setStep('error')
        return
      }

      setValidItems(items)
      setStep('preview')
    } catch (error) {
      console.error('Error parsing CSV:', error)
      setErrors([{ row: 0, field: 'file', message: 'Failed to parse CSV file' }])
      setStep('error')
    }
  }

  const handleImport = async () => {
    if (validItems.length === 0) return

    setStep('importing')
    setProgress(0)
    setImportStats({ success: 0, failed: 0 })

    let successCount = 0
    let failedCount = 0

    try {
      // Insert one by one to avoid UUID batch issues
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i]

        // Clean the data - remove any empty strings and null values
        const cleanItem: any = {
          restaurant_id: restaurantId,
          category_id: item.category_id,
          name: item.name,
          price: item.price ?? 0,
          is_available: item.is_available ?? true,
          is_featured: item.is_featured ?? false,
          display_order: item.display_order ?? i
        }

        // Only add optional fields if they have values
        if (item.description && item.description.trim()) {
          cleanItem.description = item.description
        }
        if (item.dietary_tags && item.dietary_tags.length > 0) {
          cleanItem.dietary_tags = item.dietary_tags
        }
        if (item.allergens && item.allergens.length > 0) {
          cleanItem.allergens = item.allergens
        }
        if (item.calories) {
          cleanItem.calories = item.calories
        }
        if (item.preparation_time) {
          cleanItem.preparation_time = item.preparation_time
        }
        if (item.image_url && item.image_url.trim()) {
          cleanItem.image_url = item.image_url
        }

        const { error } = await supabase
          .from('menu_items')
          .insert([cleanItem])

        if (error) {
          console.error('Insert error:', error)
          failedCount++
        } else {
          successCount++
        }

        // Update progress
        const currentProgress = ((i + 1) / validItems.length) * 100
        setProgress(currentProgress)
        setImportStats({ success: successCount, failed: failedCount })
      }

      if (failedCount === 0) {
        toast.success(`Successfully imported ${successCount} menu items`)
        setStep('complete')
        setTimeout(() => {
          onImportComplete()
          handleClose()
        }, 2000)
      } else {
        toast.error(`Imported ${successCount} items, ${failedCount} failed`)
        setStep('complete')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import menu items')
      setStep('error')
      setErrors([{ row: 0, field: 'import', message: 'Failed to import items to database' }])
    }
  }

  const handleClose = () => {
    setStep('upload')
    setFile(null)
    setValidItems([])
    setErrors([])
    setUnmatchedCategories([])
    setProgress(0)
    setImportStats({ success: 0, failed: 0 })
    setPricelessMode(false)
    onOpenChange(false)
  }

  const handleDownloadTemplate = () => {
    downloadCSVTemplate(pricelessMode)
    const templateType = pricelessMode ? 'priceless template' : 'template'
    toast.success(`${templateType.charAt(0).toUpperCase() + templateType.slice(1)} downloaded`)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Menu Items from CSV</DialogTitle>
          <DialogDescription>
            <span className="text-blue-600 font-semibold">STEP 2:</span> Upload menu items CSV.
            {pricelessMode && <span className="text-orange-600 ml-1">(Priceless Mode: All items will be $0.00)</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="text-sm">
                Categories will be automatically fetched when you upload your CSV file.
                Make sure you've imported categories first (STEP 1).
              </p>
            </AlertDescription>
          </Alert>

          {/* Priceless Menu Toggle */}
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="priceless-mode"
              checked={pricelessMode}
              onCheckedChange={(checked) => setPricelessMode(checked as boolean)}
            />
            <div className="flex-1">
              <Label
                htmlFor="priceless-mode"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Priceless Menu (No Prices)
                </div>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Enable if your restaurant menu doesn't have prices. All items will be set to $0.00
              </p>
            </div>
          </div>

          {/* Template Download */}
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV Template {pricelessMode && '(Priceless)'}
          </Button>

          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Drag and drop your CSV file here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Select CSV File
                </label>
              </Button>
            </div>
          )}

          {/* Validation Step */}
          {step === 'validation' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Validating CSV file...</span>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Found {validItems.length} valid menu items ready to import
                  {pricelessMode && <span className="block text-orange-600 mt-1">Priceless mode: All items will be imported at $0.00</span>}
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-2">
                  {validItems.slice(0, 10).map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      {pricelessMode ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Free
                        </Badge>
                      ) : (
                        <Badge variant="secondary">${item.price.toFixed(2)}</Badge>
                      )}
                    </div>
                  ))}
                  {validItems.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      And {validItems.length - 10} more items...
                    </p>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleImport} className="flex-1">
                  Import {validItems.length} Items
                </Button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-lg">Importing menu items...</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">
                {importStats.success} of {validItems.length} items imported
              </p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Successfully imported {importStats.success} menu items!
                {importStats.failed > 0 && ` (${importStats.failed} failed)`}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Found {errors.length} error(s) in the CSV file
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-destructive/10 rounded">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {error.row > 0 ? `Row ${error.row}` : 'File'} - {error.field}
                        </p>
                        <p className="text-sm text-muted-foreground">{error.message}</p>
                        {error.value && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Value: "{error.value}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {unmatchedCategories.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Missing Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {unmatchedCategories.map((cat, index) => (
                        <Badge key={index} variant="outline">{cat}</Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-sm">
                      Please create these categories first, then try importing again.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <Button variant="outline" onClick={handleClose} className="w-full">
                Close and Fix Errors
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
