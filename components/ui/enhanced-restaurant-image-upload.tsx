"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "react-hot-toast"
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Star,
  Loader2,
  Camera,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Crown,
  Grid3X3,
  ArrowLeftRight
} from "lucide-react"
import Image from "next/image"

interface RestaurantImageUploadProps {
  restaurantId: string
  mainImageUrl?: string
  images?: string[]
  onMainImageChange?: (url: string) => void
  onImagesChange?: (urls: string[]) => void
  maxImages?: number
  maxFileSize?: number // in MB
}

interface UploadProgress {
  id: string
  file: File
  progress: number
  url?: string
  error?: string
}

interface ImageItem {
  id: string
  url: string
  isMain?: boolean
}

export function EnhancedRestaurantImageUpload({
  restaurantId,
  mainImageUrl,
  images = [],
  onMainImageChange,
  onImagesChange,
  maxImages = 10,
  maxFileSize = 5
}: RestaurantImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [draggedImage, setDraggedImage] = useState<string | null>(null)
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [allImages, setAllImages] = useState<ImageItem[]>([])
  const [currentMainImage, setCurrentMainImage] = useState<string>(mainImageUrl || "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Initialize images when props change
  useEffect(() => {
    const imageItems: ImageItem[] = []
    
    // Add main image if exists
    if (mainImageUrl) {
      imageItems.push({
        id: `main-${Date.now()}`,
        url: mainImageUrl,
        isMain: true
      })
    }
    
    // Add gallery images
    images.forEach((url, index) => {
      if (url && url !== mainImageUrl) {
        imageItems.push({
          id: `gallery-${index}-${Date.now()}`,
          url: url,
          isMain: false
        })
      }
    })
    
    setAllImages(imageItems)
    setCurrentMainImage(mainImageUrl || "")
  }, [mainImageUrl, images])

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file'
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size must be less than ${maxFileSize}MB`
    }

    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!supportedFormats.includes(file.type)) {
      return 'Supported formats: JPEG, PNG, WebP'
    }

    return null
  }

  const generateFileName = (file: File, isMainImage: boolean = false): string => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop()
    const prefix = isMainImage ? 'main' : 'gallery'
    return `${restaurantId}/${prefix}_${timestamp}_${random}.${extension}`
  }

  const uploadToSupabase = async (
    file: File, 
    fileName: string, 
    bucket: string,
    uploadId: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async () => {
        try {
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName)

          setUploads(prev => 
            prev.map(u => 
              u.id === uploadId 
                ? { ...u, progress: 100, url: publicUrl }
                : u
            )
          )

          resolve(publicUrl)
        } catch (error: any) {
          setUploads(prev => 
            prev.map(u => 
              u.id === uploadId 
                ? { ...u, error: error.message }
                : u
            )
          )
          reject(error)
        }
      }

      reader.onerror = () => {
        const error = 'Failed to read file'
        setUploads(prev => 
          prev.map(u => 
            u.id === uploadId 
              ? { ...u, error }
              : u
          )
        )
        reject(new Error(error))
      }

      // Simulate progress
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        if (progress < 90) {
          setUploads(prev => 
            prev.map(u => 
              u.id === uploadId 
                ? { ...u, progress }
                : u
            )
          )
        } else {
          clearInterval(interval)
        }
      }, 100)

      reader.readAsArrayBuffer(file)
    })
  }

  const updateImageArrays = useCallback((imageList: ImageItem[]) => {
    const mainImg = imageList.find(img => img.isMain)
    const galleryImgs = imageList.filter(img => !img.isMain)
    
    onMainImageChange?.(mainImg?.url || "")
    onImagesChange?.(galleryImgs.map(img => img.url))
  }, [onMainImageChange, onImagesChange])

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files)
    
    if (allImages.length + fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`)
      return
    }

    // Validate files
    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast.error(`${file.name}: ${error}`)
        return
      }
    }

    // Create upload progress tracking
    const newUploads: UploadProgress[] = fileArray.map(file => ({
      id: Math.random().toString(36),
      file,
      progress: 0
    }))

    setUploads(prev => [...prev, ...newUploads])

    // Process uploads
    const uploadedImages: ImageItem[] = []
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const upload = newUploads[i]
      
      try {
        const fileName = generateFileName(file, false) // All uploads go to gallery first
        const bucket = 'images'
        
        const url = await uploadToSupabase(file, fileName, bucket, upload.id)
        
        const newImage: ImageItem = {
          id: `uploaded-${Date.now()}-${i}`,
          url: url,
          isMain: false
        }
        
        uploadedImages.push(newImage)
        toast.success(`${file.name} uploaded successfully!`)
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`)
      }
    }

    // Add uploaded images to gallery
    if (uploadedImages.length > 0) {
      const updatedImages = [...allImages, ...uploadedImages]
      setAllImages(updatedImages)
      updateImageArrays(updatedImages)
    }

    // Clear completed uploads after delay
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.error || !u.url))
    }, 2000)
  }, [allImages, maxImages, validateFile, generateFileName, uploadToSupabase, updateImageArrays])

  const setAsMainImage = async (imageId: string) => {
    const newImages = allImages.map(img => ({
      ...img,
      isMain: img.id === imageId
    }))
    
    setAllImages(newImages)
    
    const newMainImage = newImages.find(img => img.isMain)
    setCurrentMainImage(newMainImage?.url || "")
    
    updateImageArrays(newImages)
    toast.success('Main image updated!')
  }

  const removeImage = async (imageId: string) => {
    const imageToRemove = allImages.find(img => img.id === imageId)
    if (!imageToRemove) return

    try {
      // Extract file path from URL for Supabase deletion
      const urlParts = imageToRemove.url.split('/')
      const bucket = imageToRemove.isMain ? 'main_images' : 'images'
      const filePath = urlParts.slice(-2).join('/') // restaurantId/filename
      
      // Delete from Supabase storage
      await supabase.storage.from(bucket).remove([filePath])

      const newImages = allImages.filter(img => img.id !== imageId)
      setAllImages(newImages)
      
      if (imageToRemove.isMain) {
        setCurrentMainImage("")
      }
      
      updateImageArrays(newImages)
      toast.success('Image removed successfully')
    } catch (error: any) {
      toast.error(`Failed to remove image: ${error.message}`)
    }
  }

  const moveImage = (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = allImages.findIndex(img => img.id === imageId)
    if (currentIndex === -1) return

    const newImages = [...allImages]
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    
    if (targetIndex < 0 || targetIndex >= newImages.length) return

    // Swap images
    [newImages[currentIndex], newImages[targetIndex]] = [newImages[targetIndex], newImages[currentIndex]]
    
    setAllImages(newImages)
    updateImageArrays(newImages)
  }

  const resetToNoMainImage = () => {
    const newImages = allImages.map(img => ({
      ...img,
      isMain: false
    }))
    
    setAllImages(newImages)
    setCurrentMainImage("")
    updateImageArrays(newImages)
    toast.success('Main image cleared')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const mainImage = allImages.find(img => img.isMain)
  const galleryImages = allImages.filter(img => !img.isMain)
  const totalImages = allImages.length

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Camera className="w-6 h-6 text-muted-foreground" />
          </div>
          
          <div>
            <h3 className="font-semibold">Upload Restaurant Images</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Drag images here or click to select files
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              JPEG, PNG, WebP • Max {maxFileSize}MB each • {totalImages}/{maxImages} used
            </p>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={totalImages >= maxImages}
            className="mx-auto"
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Images
          </Button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading Images
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  {upload.error ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {upload.error}
                    </p>
                  ) : upload.url ? (
                    <p className="text-xs text-green-600">✓ Upload complete</p>
                  ) : (
                    <div className="space-y-1">
                      <Progress value={upload.progress} className="h-1" />
                      <p className="text-xs text-muted-foreground">{upload.progress}%</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Image Section */}
      {mainImage ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">Main Image (Logo)</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={resetToNoMainImage}
                title="Clear main image"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative group w-fit">
              <div className="relative">
                <Image
                  src={mainImage.url}
                  alt="Main restaurant image"
                  width={200}
                  height={150}
                  className="rounded-lg object-cover border-2 border-yellow-200"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeImage(mainImage.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Badge className="absolute top-2 left-2 bg-yellow-500">
                  <Star className="h-3 w-3 mr-1" />
                  Main
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <div className="space-y-2">
              <Crown className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No main image selected</p>
              <p className="text-xs text-muted-foreground">Select an image from gallery below to set as main image</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Images */}
      {galleryImages.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              <CardTitle className="text-base">Gallery Images ({galleryImages.length})</CardTitle>
            </div>
            <Badge variant="outline">{galleryImages.length} images</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image, index) => (
                <Card key={image.id} className="relative group overflow-hidden">
                  <CardContent className="p-2">
                    <div className="relative">
                      <Image
                        src={image.url}
                        alt={`Gallery image ${index + 1}`}
                        width={150}
                        height={100}
                        className="rounded object-cover w-full h-24"
                      />
                      
                      {/* Hover Controls */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/70 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAsMainImage(image.id)}
                            className="h-7 w-7 p-0"
                            title="Set as main image"
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeImage(image.id)}
                            className="h-7 w-7 p-0"
                            title="Remove image"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Position Controls */}
                      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => moveImage(image.id, 'up')}
                          className="h-6 w-6 p-0"
                          disabled={index === 0}
                          title="Move up"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => moveImage(image.id, 'down')}
                          className="h-6 w-6 p-0"
                          disabled={index === galleryImages.length - 1}
                          title="Move down"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Position Badge */}
                      <Badge variant="secondary" className="absolute bottom-1 left-1 text-xs h-5">
                        {index + 1}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {galleryImages.length > 1 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <ArrowLeftRight className="h-3 w-3" />
                  Use the arrow buttons to reorder images. Click the star to set any image as the main image.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Images State */}
      {totalImages === 0 && (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold text-muted-foreground">No images uploaded yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload images to showcase your restaurant. The first image you select as main will serve as your logo.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Your First Image
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {totalImages > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <ImageIcon className="h-4 w-4" />
                <span className="font-medium">
                  {totalImages} image{totalImages !== 1 ? 's' : ''} uploaded
                </span>
              </div>
              <div className="text-green-600">
                {mainImage ? '✓ Main image set' : '⚠ No main image'} • 
                {galleryImages.length} in gallery
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}