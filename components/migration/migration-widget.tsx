'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Calendar,
  Table as TableIcon,
  Play,
  Eye,
  HelpCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface MigrationWidgetProps {
  restaurantId: string
  className?: string
}

import { migrateServemeData, type MigrationResults, type MigrationResult } from '@/lib/services/migration-service'

export function MigrationWidget({ restaurantId, className }: MigrationWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  
  // File uploads
  const [customersFile, setCustomersFile] = useState<File | null>(null)
  const [bookingsFile, setBookingsFile] = useState<File | null>(null)
  const [tablesFile, setTablesFile] = useState<File | null>(null)
  
  // Results
  const [results, setResults] = useState<MigrationResults | null>(null)

  const handleFileUpload = (file: File, type: 'customers' | 'bookings' | 'tables') => {
    const allowedTypes = ['.csv', '.xlsx', '.xls']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error(`Invalid file type. Please upload ${allowedTypes.join(', ')} files only.`)
      return
    }
    
    switch (type) {
      case 'customers':
        setCustomersFile(file)
        break
      case 'bookings':
        setBookingsFile(file)
        break
      case 'tables':
        setTablesFile(file)
        break
    }
    
    toast.success(`${type} file uploaded successfully`)
  }

  const runMigration = async (dryRun: boolean = false) => {
    if (!customersFile && !bookingsFile && !tablesFile) {
      toast.error('Please upload at least one file to migrate')
      return
    }

    setIsRunning(true)
    setProgress(0)
    setResults(null)

    try {
      const files: { customers?: File; bookings?: File; tables?: File } = {}
      if (customersFile) files.customers = customersFile
      if (bookingsFile) files.bookings = bookingsFile
      if (tablesFile) files.tables = tablesFile

      setProgress(50)

      const migrationResults = await migrateServemeData(files, restaurantId, dryRun)
      setResults(migrationResults)
      setProgress(100)
      
      if (dryRun) {
        toast.success('Test completed! Review the results below.')
      } else {
        toast.success('Migration completed successfully!')
      }

    } catch (error) {
      console.error('Migration error:', error)
      toast.error('Migration failed. Please try again.')
    } finally {
      setIsRunning(false)
    }
  }

  const downloadSampleFiles = () => {
    const sampleCustomers = `Customer Name,Email,Phone,VIP,Notes,Total Visits,Total Spent
John Smith,john.smith@email.com,555-123-4567,Yes,Regular customer,24,850.50
Sarah Johnson,sarah.j@email.com,555-234-5678,No,Celebrates anniversaries here,8,320.75`

    const sampleBookings = `Date & Time,Party Size,Customer Email,Status,Special Requests,Occasion
2024-08-25 19:00:00,2,john.smith@email.com,Completed,Window seat preferred,Date Night
2024-08-24 18:30:00,4,sarah.j@email.com,Completed,Anniversary celebration,Anniversary`

    const sampleTables = `Table Name,Capacity,Type,Section,Active
Table 1,2,Standard,Main Dining,Yes
Table 2,4,Booth,Main Dining,Yes`

    const downloadFile = (content: string, filename: string) => {
      const blob = new Blob([content], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }

    downloadFile(sampleCustomers, 'sample-customers.csv')
    downloadFile(sampleBookings, 'sample-bookings.csv')
    downloadFile(sampleTables, 'sample-tables.csv')
    
    toast.success('Sample files downloaded!')
  }

  const resetMigration = () => {
    setCustomersFile(null)
    setBookingsFile(null)
    setTablesFile(null)
    setResults(null)
    setProgress(0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className={`cursor-pointer hover:shadow-md transition-shadow ${className}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Import customers, bookings, and tables from Serveme or other platforms
            </CardDescription>
          </CardHeader>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Restaurant Data
          </DialogTitle>
          <DialogDescription>
            Upload your data files to import customers, bookings, and tables
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Migration Progress</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* File Uploads */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Customers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Customers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'customers')
                  }}
                  disabled={isRunning}
                />
                {customersFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {customersFile.name}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bookings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Bookings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'bookings')
                  }}
                  disabled={isRunning}
                />
                {bookingsFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {bookingsFile.name}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tables */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TableIcon className="h-4 w-4" />
                  Tables
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'tables')
                  }}
                  disabled={isRunning}
                />
                {tablesFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {tablesFile.name}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => runMigration(true)}
              disabled={isRunning || (!customersFile && !bookingsFile && !tablesFile)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Test Import
            </Button>
            <Button 
              onClick={() => runMigration(false)}
              disabled={isRunning || (!customersFile && !bookingsFile && !tablesFile)}
            >
              <Play className="mr-2 h-4 w-4" />
              Import Data
            </Button>
            <Button variant="outline" onClick={downloadSampleFiles}>
              <Download className="mr-2 h-4 w-4" />
              Sample Files
            </Button>
            <Button variant="outline" onClick={resetMigration} disabled={isRunning}>
              Reset
            </Button>
          </div>

          {/* Results */}
          {results && (results.customers || results.bookings || results.tables) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Import Results</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {results.customers && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Customers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processed:</span>
                        <span>{results.customers.recordsProcessed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Imported:</span>
                        <span className="text-green-600">{results.customers.recordsImported}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Errors:</span>
                        <span className="text-red-600">{results.customers.errors.length}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.bookings && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Bookings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processed:</span>
                        <span>{results.bookings.recordsProcessed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Imported:</span>
                        <span className="text-green-600">{results.bookings.recordsImported}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Errors:</span>
                        <span className="text-red-600">{results.bookings.errors.length}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.tables && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TableIcon className="h-4 w-4" />
                        Tables
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processed:</span>
                        <span>{results.tables.recordsProcessed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Imported:</span>
                        <span className="text-green-600">{results.tables.recordsImported}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Errors:</span>
                        <span className="text-red-600">{results.tables.errors.length}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>How to use:</strong> Export your data from Serveme as CSV or Excel files. 
              Upload them above and click "Test Import" first to preview results, then "Import Data" to actually import.
              Download sample files to see the expected format.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  )
}
