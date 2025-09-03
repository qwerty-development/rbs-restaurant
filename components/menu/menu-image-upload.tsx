"use client"

import { useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Loader2,
  Link as LinkIcon,
  AlertCircle
} from "lucide-react"
import Image from "next/image"

interface MenuImageUploadProps {
  restaurantId: string
  value?: string
  onChange?: (url: string) => void
  onClear?: () => void
  disabled?: boolean
  maxFileSize?: number // in MB
}

interface UploadProgress {
  progress: number
  url?: string
  error?: string
}

export function MenuImageUpload({
  restaurantId,
  value,
  onChange,
  onClear,
  disabled = false,
  maxFileSize = 5
}: MenuImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [urlInput, setUrlInput] = useState(value || "")
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Generate unique filename for menu images
  const generateFileName = (file: File): string => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    return `${restaurantId}/menu_${timestamp}_${random}.${extension}`
  }

  // Upload file to Supabase menu_images bucket
  const uploadToSupabase = async (file: File, fileName: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async () => {
        try {
          // Check if user is authenticated
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            throw new Error('You must be logged in to upload images')
          }

          const { error: uploadError } = await supabase.storage
            .from('menu_images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error('Upload error details:', uploadError)
            throw uploadError
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('menu_images')
            .getPublicUrl(fileName)

          setUpload({ progress: 100, url: publicUrl })
          resolve(publicUrl)
        } catch (error: any) {
          console.error('Upload error details:', error)
          setUpload({ progress: 0, error: error.message })
          reject(error)
        }
      }

      reader.onerror = () => {
        const error = 'Failed to read file'
        setUpload({ progress: 0, error })
        reject(new Error(error))
      }

      // Simulate progress for better UX
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        if (progress < 90) {
          setUpload(prev => prev ? { ...prev, progress } : { progress })
        } else {
          clearInterval(interval)
        }
      }, 100)

      reader.readAsArrayBuffer(file)
    })
  }

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please upload an image file'
    }
    
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size must be less than ${maxFileSize}MB`
    }
    
    return null
  }

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (files.length === 0 || disabled) return

    const file = files[0]
    const error = validateFile(file)
    
    if (error) {
      toast.error(error)
      return
    }

    try {
      setUpload({ progress: 0 })
      const fileName = generateFileName(file)
      const url = await uploadToSupabase(file, fileName)
      
      onChange?.(url)
      toast.success('Image uploaded successfully')
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    }
  }, [disabled, onChange])

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    if (disabled) return
    
    const files = e.dataTransfer.files
    handleFileUpload(files)
  }, [disabled, handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  // Handle URL input
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a valid URL')
      return
    }

    try {
      new URL(urlInput) // Validate URL
      onChange?.(urlInput)
      toast.success('Image URL set successfully')
    } catch {
      toast.error('Please enter a valid URL')
    }
  }

  // Clear image
  const handleClear = () => {
    setUrlInput("")
    setUpload(null)
    onChange?.("")
    onClear?.()
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "url")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" disabled={disabled}>
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="url" disabled={disabled}>
            <LinkIcon className="w-4 h-4 mr-2" />
            Image URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          {/* File Upload Area */}
          <Card 
            className={`transition-colors ${
              dragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-dashed border-muted-foreground/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {dragOver ? 'Drop image here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP up to {maxFileSize}MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            disabled={disabled}
          />

          {/* Upload Progress */}
          {upload && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {upload.error ? (
                    <div className="flex items-center space-x-2 text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">{upload.error}</span>
                    </div>
                  ) : upload.url ? (
                    <div className="flex items-center space-x-2 text-green-600">
                      <span className="text-sm">Upload complete!</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Uploading... {upload.progress}%</span>
                      </div>
                      <Progress value={upload.progress} className="w-full" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          {/* URL Input */}
          <div className="flex space-x-2">
            <Input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={disabled}
            />
            <Button 
              onClick={handleUrlSubmit}
              disabled={disabled || !urlInput.trim()}
            >
              Set URL
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Current Image Preview */}
      {value && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Image</span>
                {!disabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              
              <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                <Image
                  src={value}
                  alt="Menu item preview"
                  fill
                  className="object-cover"
                  onError={() => {
                    toast.error('Failed to load image')
                  }}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {value.startsWith('http') ? 'External URL' : 'Uploaded'}
                </Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {value}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
