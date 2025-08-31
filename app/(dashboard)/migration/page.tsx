'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { migrateServemeData, type MigrationResult, type MigrationResults } from '@/lib/services/migration-service'

interface MigrationProgress {
  phase: 'parsing' | 'validating' | 'importing' | 'complete';
  totalRecords: number;
  processedRecords: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  errors: string[];
  currentType?: string;
}

export default function MigrationPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  
  // File uploads
  const [customersFile, setCustomersFile] = useState<File | null>(null)
  const [bookingsFile, setBookingsFile] = useState<File | null>(null)
  const [tablesFile, setTablesFile] = useState<File | null>(null)
  
  // Results
  const [migrationResults, setMigrationResults] = useState<MigrationResults | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get current staff data
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          restaurant_id,
          user_id
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        toast.error("You don't have access to migration tools")
        router.push('/dashboard')
        return
      }

      setCurrentStaff(staffData)
      setRestaurantId(staffData.restaurant_id)

      // Check permissions - only managers and owners can access migration
      if (!restaurantAuth.hasPermission(staffData.permissions, 'settings.manage', staffData.role)) {
        toast.error("You don't have permission to access migration tools")
        router.push('/dashboard')
        return
      }

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load migration page')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (file: File, type: 'customers' | 'bookings' | 'tables') => {
    // Validate file type
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
    setMigrationProgress({
      phase: 'parsing',
      totalRecords: 0,
      processedRecords: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: new Date(),
      errors: []
    })

    try {
      // Use direct Supabase migration service
      const files: { customers?: File; bookings?: File; tables?: File } = {}
      if (customersFile) files.customers = customersFile
      if (bookingsFile) files.bookings = bookingsFile
      if (tablesFile) files.tables = tablesFile

      setMigrationProgress(prev => prev ? { ...prev, phase: 'importing' } : null)
      
      const results = await migrateServemeData(files, restaurantId, dryRun)
      setMigrationResults(results)
      
      setMigrationProgress(prev => prev ? { ...prev, phase: 'complete' } : null)
      
      if (dryRun) {
        toast.success('Dry run completed successfully! Review the results below.')
      } else {
        toast.success('Migration completed successfully!')
      }

    } catch (error) {
      console.error('Migration error:', error)
      toast.error('Migration failed. Please check the logs.')
    } finally {
      setIsRunning(false)
    }
  }

  const downloadSampleFiles = () => {
    // Create sample CSV content
    const sampleCustomers = `Customer Name,Email,Phone,VIP,Notes,Dietary Restrictions,Allergies,Tags,First Visit,Last Visit,Total Visits,Total Spent
John Smith,john.smith@email.com,555-123-4567,Yes,Regular customer,Vegetarian,Nuts,VIP;Regular,2023-01-15,2024-08-20,24,850.50
Sarah Johnson,sarah.j@email.com,555-234-5678,No,Celebrates anniversaries here,None,Shellfish,Anniversary,2023-06-10,2024-07-15,8,320.75`

    const sampleBookings = `Date & Time,Party Size,Customer Email,Status,Special Requests,Table,Notes,Occasion,Created,Confirmation Code,Source
2024-08-25 19:00:00,2,john.smith@email.com,Completed,Window seat preferred,Table 5,Customer arrived on time,Date Night,2024-08-20 10:30:00,ABC123,Phone
2024-08-24 18:30:00,4,sarah.j@email.com,Completed,Anniversary celebration,Table 12,Brought flowers,Anniversary,2024-08-22 14:15:00,DEF456,Online`

    const sampleTables = `Table Name,Capacity,Type,Section,Active
Table 1,2,Standard,Main Dining,Yes
Table 2,4,Booth,Main Dining,Yes
Table 3,6,Standard,Main Dining,Yes`

    // Download files
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
    
    toast.success('Sample files downloaded successfully!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading migration tools...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Migration</h1>
          <p className="text-muted-foreground">
            Import your restaurant data from Serveme or other platforms
          </p>
        </div>
        <Button variant="outline" onClick={downloadSampleFiles}>
          <Download className="mr-2 h-4 w-4" />
          Download Sample Files
        </Button>
      </div>

      {/* Migration Status */}
      {migrationProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Phase: {migrationProgress.phase.toUpperCase()}
                  {migrationProgress.currentType && ` - ${migrationProgress.currentType}`}
                </span>
                <Badge variant={migrationProgress.phase === 'complete' ? 'default' : 'secondary'}>
                  {migrationProgress.processedRecords}/{migrationProgress.totalRecords}
                </Badge>
              </div>
              <Progress 
                value={migrationProgress.totalRecords > 0 ? 
                  (migrationProgress.processedRecords / migrationProgress.totalRecords) * 100 : 0} 
              />
              {migrationProgress.errors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {migrationProgress.errors.length} errors encountered
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Upload Section */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customers
                </CardTitle>
                <CardDescription>
                  Upload your customer data file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customers-file">Customer Data File</Label>
                  <Input
                    id="customers-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'customers')
                    }}
                  />
                </div>
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Bookings
                </CardTitle>
                <CardDescription>
                  Upload your booking history file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bookings-file">Booking Data File</Label>
                  <Input
                    id="bookings-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'bookings')
                    }}
                  />
                </div>
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  Tables
                </CardTitle>
                <CardDescription>
                  Upload your table configuration file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tables-file">Table Data File</Label>
                  <Input
                    id="tables-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'tables')
                    }}
                  />
                </div>
                {tablesFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {tablesFile.name}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Migration Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Migration Actions</CardTitle>
              <CardDescription>
                Run a test migration first to preview the results, then run the actual migration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => runMigration(true)}
                  disabled={isRunning || (!customersFile && !bookingsFile && !tablesFile)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Test Migration (Dry Run)
                </Button>
                <Button 
                  onClick={() => runMigration(false)}
                  disabled={isRunning || (!customersFile && !bookingsFile && !tablesFile)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Run Migration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Instructions:</strong> Export your data from Serveme in CSV or Excel format. 
              Upload the files above and run a test migration first to preview the results. 
              Download the sample files to see the expected format.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {/* Results Section */}
          {migrationResults && (migrationResults.customers || migrationResults.bookings || migrationResults.tables) ? (
            <div className="grid gap-6 md:grid-cols-3">
              {migrationResults.customers && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Customers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span>{migrationResults.customers.recordsProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imported:</span>
                      <span className="text-green-600">{migrationResults.customers.recordsImported}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Skipped:</span>
                      <span className="text-yellow-600">{migrationResults.customers.recordsSkipped}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Errors:</span>
                      <span className="text-red-600">{migrationResults.customers.errors.length}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {migrationResults.bookings && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Bookings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span>{migrationResults.bookings.recordsProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imported:</span>
                      <span className="text-green-600">{migrationResults.bookings.recordsImported}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Skipped:</span>
                      <span className="text-yellow-600">{migrationResults.bookings.recordsSkipped}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Errors:</span>
                      <span className="text-red-600">{migrationResults.bookings.errors.length}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {migrationResults.tables && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TableIcon className="h-5 w-5" />
                      Tables
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span>{migrationResults.tables.recordsProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imported:</span>
                      <span className="text-green-600">{migrationResults.tables.recordsImported}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Skipped:</span>
                      <span className="text-yellow-600">{migrationResults.tables.recordsSkipped}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Errors:</span>
                      <span className="text-red-600">{migrationResults.tables.errors.length}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No migration results yet. Upload files and run a migration to see results here.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
