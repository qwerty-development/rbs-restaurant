import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

export interface MigrationResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  errors: Array<{ record: any; error: string }>;
}

export interface MigrationResults {
  customers?: MigrationResult;
  bookings?: MigrationResult;
  tables?: MigrationResult;
}

// Simple CSV parser function
function parseCSV(text: string): any[] {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const records = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length === headers.length) {
      const record: any = {}
      headers.forEach((header, index) => {
        record[header] = values[index]
      })
      records.push(record)
    }
  }
  
  return records
}

// Parse uploaded file
async function parseFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer()
  const filename = file.name.toLowerCase()
  
  if (filename.endsWith('.csv')) {
    const text = new TextDecoder().decode(buffer)
    return parseCSV(text)
  } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json(worksheet)
  } else {
    throw new Error('Unsupported file format')
  }
}

// Transform customer data
function transformCustomer(record: any, restaurantId: string): any {
  const name = record['Customer Name']?.trim() || record['Name']?.trim()
  const email = record['Email']?.trim()?.toLowerCase()
  const phone = record['Phone']?.trim()
  const vip = record['VIP']?.toLowerCase() === 'yes' || record['VIP']?.toLowerCase() === 'true'
  
  return {
    restaurant_id: restaurantId,
    user_id: null,
    guest_name: name,
    guest_email: email,
    guest_phone: phone,
    vip_status: vip,
    total_bookings: parseInt(record['Total Visits'] || '0') || 0,
    total_spent: parseFloat(record['Total Spent'] || '0') || 0,
    average_party_size: parseInt(record['Average Party Size'] || '2') || 2,
    first_visit: record['First Visit'] ? new Date(record['First Visit']).toISOString() : null,
    last_visit: record['Last Visit'] ? new Date(record['Last Visit']).toISOString() : null,
    no_show_count: parseInt(record['No Shows'] || '0') || 0,
    cancelled_count: parseInt(record['Cancellations'] || '0') || 0,
    blacklisted: record['Blacklisted']?.toLowerCase() === 'yes',
    blacklist_reason: record['Blacklist Reason']?.trim() || null,
    preferred_table_types: record['Preferred Tables'] ? [record['Preferred Tables']] : [],
    preferred_time_slots: record['Preferred Times'] ? [record['Preferred Times']] : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// Transform booking data
function transformBooking(record: any, restaurantId: string, customerLookup: Map<string, string>): any {
  const dateTime = record['Date & Time'] || record['DateTime'] || record['Booking Time']
  const customerEmail = record['Customer Email']?.trim()?.toLowerCase() || record['Email']?.trim()?.toLowerCase()
  const customerId = customerEmail ? customerLookup.get(customerEmail) : null
  
  const statusMap: any = {
    'confirmed': 'confirmed',
    'completed': 'completed', 
    'cancelled': 'cancelled_by_user',
    'no show': 'no_show',
    'no-show': 'no_show',
    'pending': 'pending'
  }
  
  const status = record['Status']?.toLowerCase() || 'completed'
  
  return {
    restaurant_id: restaurantId,
    customer_id: customerId,
    booking_time: new Date(dateTime).toISOString(),
    party_size: parseInt(record['Party Size'] || '2') || 2,
    status: statusMap[status] || 'completed',
    special_requests: record['Special Requests']?.trim() || null,
    occasion: record['Occasion']?.trim() || null,
    source: 'serveme_migration',
    created_at: record['Created'] ? new Date(record['Created']).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// Transform table data
function transformTable(record: any, restaurantId: string): any {
  return {
    restaurant_id: restaurantId,
    table_number: record['Table Number']?.toString() || record['Number']?.toString(),
    section: record['Section']?.trim() || 'Main',
    capacity: parseInt(record['Capacity'] || '4') || 4,
    table_type: record['Type']?.trim()?.toLowerCase() || 'standard',
    position_x: parseInt(record['X Position'] || '0') || 0,
    position_y: parseInt(record['Y Position'] || '0') || 0,
    is_active: record['Active']?.toLowerCase() !== 'no',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export async function migrateServemeData(
  files: {
    customers?: File;
    bookings?: File;
    tables?: File;
  },
  restaurantId: string,
  dryRun: boolean = false
): Promise<MigrationResults> {
  const supabase = createClient()
  const results: MigrationResults = {}

  try {
    // Process customers file first
    if (files.customers) {
      try {
        const customerRecords = await parseFile(files.customers)
        const transformedCustomers = customerRecords.map(record => transformCustomer(record, restaurantId))
        
        let imported = 0
        let skipped = 0
        const errors: any[] = []

        if (!dryRun) {
          for (const customer of transformedCustomers) {
            try {
              const { error } = await supabase
                .from('restaurant_customers')
                .insert(customer)
              
              if (error) throw error
              imported++
            } catch (error) {
              console.error('Customer import error:', error)
              errors.push({ record: customer, error: String(error) })
              skipped++
            }
          }
        } else {
          imported = transformedCustomers.length
        }

        results.customers = {
          success: errors.length === 0,
          recordsProcessed: customerRecords.length,
          recordsImported: imported,
          recordsSkipped: skipped,
          errors
        }
      } catch (error) {
        console.error('Customers processing error:', error)
        results.customers = {
          success: false,
          recordsProcessed: 0,
          recordsImported: 0,
          recordsSkipped: 0,
          errors: [{ record: null, error: String(error) }]
        }
      }
    }

    // Process tables file
    if (files.tables) {
      try {
        const tableRecords = await parseFile(files.tables)
        const transformedTables = tableRecords.map(record => transformTable(record, restaurantId))
        
        let imported = 0
        let skipped = 0
        const errors: any[] = []

        if (!dryRun) {
          for (const table of transformedTables) {
            try {
              const { error } = await supabase
                .from('restaurant_tables')
                .insert(table)
              
              if (error) throw error
              imported++
            } catch (error) {
              console.error('Table import error:', error)
              errors.push({ record: table, error: String(error) })
              skipped++
            }
          }
        } else {
          imported = transformedTables.length
        }

        results.tables = {
          success: errors.length === 0,
          recordsProcessed: tableRecords.length,
          recordsImported: imported,
          recordsSkipped: skipped,
          errors
        }
      } catch (error) {
        console.error('Tables processing error:', error)
        results.tables = {
          success: false,
          recordsProcessed: 0,
          recordsImported: 0,
          recordsSkipped: 0,
          errors: [{ record: null, error: String(error) }]
        }
      }
    }

    // Process bookings file (after customers to get customer lookup)
    if (files.bookings) {
      try {
        // Get customer lookup map
        const { data: customers, error: customerError } = await supabase
          .from('restaurant_customers')
          .select('id, guest_email')
          .eq('restaurant_id', restaurantId)

        if (customerError) throw customerError

        const customerLookup = new Map<string, string>()
        customers?.forEach((customer: any) => {
          if (customer.guest_email) {
            customerLookup.set(customer.guest_email.toLowerCase(), customer.id)
          }
        })

        const bookingRecords = await parseFile(files.bookings)
        const transformedBookings = bookingRecords.map(record => 
          transformBooking(record, restaurantId, customerLookup)
        )
        
        let imported = 0
        let skipped = 0
        const errors: any[] = []

        if (!dryRun) {
          for (const booking of transformedBookings) {
            try {
              const { error } = await supabase
                .from('bookings')
                .insert(booking)
              
              if (error) throw error
              imported++
            } catch (error) {
              console.error('Booking import error:', error)
              errors.push({ record: booking, error: String(error) })
              skipped++
            }
          }
        } else {
          imported = transformedBookings.length
        }

        results.bookings = {
          success: errors.length === 0,
          recordsProcessed: bookingRecords.length,
          recordsImported: imported,
          recordsSkipped: skipped,
          errors
        }
      } catch (error) {
        console.error('Bookings processing error:', error)
        results.bookings = {
          success: false,
          recordsProcessed: 0,
          recordsImported: 0,
          recordsSkipped: 0,
          errors: [{ record: null, error: String(error) }]
        }
      }
    }

    return results

  } catch (error) {
    console.error('Migration service error:', error)
    throw new Error(`Migration failed: ${error}`)
  }
}
