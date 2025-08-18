// components/customers/tag-management-dialog.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Plus, 
  Trash2, 
  Edit2,
  Save,
  X,
  Tag
} from 'lucide-react'
import { toast } from 'sonner'
import type { CustomerTag } from '@/types/customer'

interface TagManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  tags: CustomerTag[]
  onUpdate: () => void
}

const TAG_COLORS = [
  { name: 'Mulberry Velvet', value: '#7A2E4A' }, // Primary brand color
  { name: 'Lavender Fog', value: '#D4C4E0' }, // Accent brand color
  { name: 'Blushed Linen', value: '#FFF0E6' }, // Secondary brand color
  { name: 'Charcoal Mood', value: '#787878' }, // Muted foreground
  { name: 'Sage Green', value: '#10B981' },
  { name: 'Warm Orange', value: '#F97316' },
  { name: 'Golden Yellow', value: '#F59E0B' },
  { name: 'Deep Purple', value: '#8B5CF6' },
]

export function TagManagementDialog({
  open,
  onOpenChange,
  restaurantId,
  tags,
  onUpdate
}: TagManagementDialogProps) {
  const supabase = createClient()
  
  // State
  const [loading, setLoading] = useState(false)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<string | null>(null)
  
  // New tag form
  const [newTag, setNewTag] = useState({
    name: '',
    color: '#7A2E4A', // Default to primary brand color
    description: ''
  })
  
  // Edit tag form
  const [editForm, setEditForm] = useState({
    name: '',
    color: '',
    description: ''
  })

  // Create new tag
  const handleCreateTag = async () => {
    if (!newTag.name.trim()) return

    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('customer_tags')
        .insert({
          restaurant_id: restaurantId,
          name: newTag.name.trim(),
          color: newTag.color,
          description: newTag.description.trim()
        })

      if (error) throw error

      toast.success('Tag created successfully')
      setNewTag({ name: '', color: '#7A2E4A', description: '' })
      onUpdate()
    } catch (error: any) {
      console.error('Error creating tag:', error)
      toast.error(error.message || 'Failed to create tag')
    } finally {
      setLoading(false)
    }
  }

  // Update tag
  const handleUpdateTag = async (tagId: string) => {
    if (!editForm.name.trim()) return

    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('customer_tags')
        .update({
          name: editForm.name.trim(),
          color: editForm.color,
          description: editForm.description.trim()
        })
        .eq('id', tagId)

      if (error) throw error

      toast.success('Tag updated successfully')
      setEditingTag(null)
      onUpdate()
    } catch (error: any) {
      console.error('Error updating tag:', error)
      toast.error(error.message || 'Failed to update tag')
    } finally {
      setLoading(false)
    }
  }

  // Delete tag
  const handleDeleteTag = async (tagId: string) => {
    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('customer_tags')
        .delete()
        .eq('id', tagId)

      if (error) throw error

      toast.success('Tag deleted successfully')
      setDeleteConfirmTag(null)
      onUpdate()
    } catch (error: any) {
      console.error('Error deleting tag:', error)
      toast.error(error.message || 'Failed to delete tag')
    } finally {
      setLoading(false)
    }
  }

  // Start editing
  const startEditing = (tag: CustomerTag) => {
    setEditingTag(tag.id)
    setEditForm({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Customer Tags</DialogTitle>
            <DialogDescription>
              Create and manage tags to categorize your customers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Create New Tag */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New Tag
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tag Name</Label>
                  <Input
                    placeholder="e.g., VIP, Regular, Birthday"
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    maxLength={50}
                  />
                </div>
                
                <div>
                  <Label>Color</Label>
                  <div className="flex gap-2 mt-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color.value}
                        className={`w-8 h-8 rounded-full border-2 ${
                          newTag.color === color.value ? 'border-gray-900' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setNewTag({ ...newTag, color: color.value })}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  placeholder="Describe when to use this tag"
                  value={newTag.description}
                  onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  maxLength={200}
                />
              </div>
              
              <Button 
                onClick={handleCreateTag} 
                disabled={loading || !newTag.name.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Tag
              </Button>
            </div>

            {/* Existing Tags */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Existing Tags ({tags.length})
              </h3>
              
              {tags.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  No tags created yet. Create your first tag above.
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      {editingTag === tag.id ? (
                        // Edit mode
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="flex-1"
                            />
                            <div className="flex gap-1">
                              {TAG_COLORS.map((color) => (
                                <button
                                  key={color.value}
                                  className={`w-8 h-8 rounded-full border-2 ${
                                    editForm.color === color.value ? 'border-gray-900' : 'border-gray-300'
                                  }`}
                                  style={{ backgroundColor: color.value }}
                                  onClick={() => setEditForm({ ...editForm, color: color.value })}
                                />
                              ))}
                            </div>
                          </div>
                          <Input
                            placeholder="Description"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateTag(tag.id)}
                              disabled={loading || !editForm.name.trim()}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTag(null)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              style={{ 
                                borderColor: tag.color, 
                                color: tag.color,
                                backgroundColor: `${tag.color}20`
                              }}
                            >
                              {tag.name}
                            </Badge>
                            {tag.description && (
                              <span className="text-sm text-gray-600">
                                {tag.description}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditing(tag)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmTag(tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteConfirmTag !== null} 
        onOpenChange={() => setDeleteConfirmTag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This will remove it from all customers.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmTag && handleDeleteTag(deleteConfirmTag)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}