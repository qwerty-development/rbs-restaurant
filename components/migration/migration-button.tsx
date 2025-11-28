'use client'

import { useState } from 'react'
import { Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MigrationWidget } from './migration-widget'
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface MigrationButtonProps {
  restaurantId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function MigrationButton({ 
  restaurantId, 
  variant = 'outline', 
  size = 'default',
  className 
}: MigrationButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Upload className="mr-2 h-4 w-4" />
          Import Data
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Customer Data</DialogTitle>
        </DialogHeader>
        <MigrationWidget restaurantId={restaurantId} />
      </DialogContent>
    </Dialog>
  )
}
