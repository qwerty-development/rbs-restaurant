// components/menu/csv-category-import-dialog.tsx
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
import {
  Upload,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react"
import {
  parseCategoriesCSV,
  convertCSVToCategories,
  downloadCategoriesTemplate,
  type CSVCategoryValidationError
} from "@/lib/csv-category-parser"
import { toast } from "react-hot-toast"

interface CSVCategoryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  onImportComplete: () => void
}

type ImportStep = 'upload' | 'validation' | 'preview' | 'importing' | 'complete' | 'error'

export function CSVCategoryImportDialog({
  open,
  onOpenChange,
  restaurantId,
  onImportComplete
}: CSVCategoryImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [validCategories, setValidCategories] = useState<any[]>([])
  const [errors, setErrors] = useState<CSVCategoryValidationError[]>([])
  const [progress, setProgress] = useState(0)
  const [importStats, setImportStats] = useState({ success: 0, failed: 0 })

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
    setValidCategories([])

    try {
      const text = await selectedFile.text()
      const result = parseCategoriesCSV(text)

      if (result.errors.length > 0) {
        setErrors(result.errors)
        setStep('error')
        return
      }

      if (result.valid.length === 0) {
        setErrors([{ row: 0, field: 'file', message: 'No valid categories found in CSV' }])
        setStep('error')
        return
      }

      // Convert to database format
      const categories = convertCSVToCategories(result.valid, restaurantId)

      setValidCategories(categories)
      setStep('preview')
    } catch (error) {
      console.error('Error parsing CSV:', error)
      setErrors([{ row: 0, field: 'file', message: 'Failed to parse CSV file' }])
      setStep('error')
    }
  }

  const handleImport = async () => {
    if (validCategories.length === 0) return

    setStep('importing')
    setProgress(0)
    setImportStats({ success: 0, failed: 0 })

    let successCount = 0
    let failedCount = 0

    try {
      // Insert one by one to avoid UUID batch issues
      for (let i = 0; i < validCategories.length; i++) {
        const category = validCategories[i]

        // Clean the data - remove any empty strings
        const cleanCategory: any = {
          restaurant_id: restaurantId,
          name: category.name,
          is_active: category.is_active ?? true,
          display_order: category.display_order ?? i
        }

        // Only add description if it's not empty
        if (category.description && category.description.trim()) {
          cleanCategory.description = category.description
        }

        const { error } = await supabase
          .from('menu_categories')
          .insert([cleanCategory])

        if (error) {
          console.error('Insert error:', error)
          failedCount++
        } else {
          successCount++
        }

        // Update progress
        const currentProgress = ((i + 1) / validCategories.length) * 100
        setProgress(currentProgress)
        setImportStats({ success: successCount, failed: failedCount })
      }

      if (failedCount === 0) {
        toast.success(`Successfully imported ${successCount} categories`)
        setStep('complete')
        setTimeout(() => {
          onImportComplete()
          handleClose()
        }, 2000)
      } else {
        toast.error(`Imported ${successCount} categories, ${failedCount} failed`)
        setStep('complete')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import categories')
      setStep('error')
      setErrors([{ row: 0, field: 'import', message: 'Failed to import categories to database' }])
    }
  }

  const handleClose = () => {
    setStep('upload')
    setFile(null)
    setValidCategories([])
    setErrors([])
    setProgress(0)
    setImportStats({ success: 0, failed: 0 })
    onOpenChange(false)
  }

  const handleDownloadTemplate = () => {
    downloadCategoriesTemplate()
    toast.success('Categories template downloaded')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Menu Categories from CSV</DialogTitle>
          <DialogDescription>
            <span className="text-orange-600 font-semibold">STEP 1:</span> Upload categories first, then import menu items.
            Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Categories CSV Template
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
                Drag and drop your categories CSV here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-category-upload"
              />
              <Button asChild>
                <label htmlFor="csv-category-upload" className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Select Categories CSV
                </label>
              </Button>
            </div>
          )}

          {/* Validation Step */}
          {step === 'validation' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Validating categories...</span>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Found {validCategories.length} valid categories ready to import
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-2">
                  {validCategories.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded">
                      <div className="flex-1">
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary">Order: {category.display_order}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleImport} className="flex-1">
                  Import {validCategories.length} Categories
                </Button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-lg">Importing categories...</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">
                {importStats.success} of {validCategories.length} categories imported
              </p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Successfully imported {importStats.success} categories!
                {importStats.failed > 0 && ` (${importStats.failed} failed)`}
                <br />
                <span className="text-orange-600 font-semibold mt-2 block">
                  Now you can import menu items (STEP 2)
                </span>
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
