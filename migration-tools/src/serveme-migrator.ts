import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as XLSX from 'xlsx';
import {
  ServemeCustomerMapping,
  ServemeBookingMapping,
  ServemeTableMapping,
  ServemeStaffMapping,
  MigrationConfig,
  defaultServemeMapping,
  defaultMigrationConfig,
  statusMapping,
  roleMapping,
  tableTypeMapping
} from '../config/serveme-mapping';

export interface MigrationResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  errors: Array<{ record: any; error: string }>;
}

export interface MigrationProgress {
  phase: 'parsing' | 'validating' | 'importing' | 'complete';
  totalRecords: number;
  processedRecords: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  errors: string[];
}

export class ServemeMigrator {
  private supabase: any;
  private config: MigrationConfig;
  private restaurantId: string;
  private progressCallback?: (progress: MigrationProgress) => void;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    restaurantId: string,
    config: Partial<MigrationConfig> = {},
    progressCallback?: (progress: MigrationProgress) => void
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.restaurantId = restaurantId;
    this.config = { ...defaultMigrationConfig, ...config };
    this.progressCallback = progressCallback;
  }

  async migrateFromFiles(dataDir: string, dryRun: boolean = false): Promise<{
    customers: MigrationResult;
    tables: MigrationResult;
    bookings: MigrationResult;
    staff: MigrationResult;
  }> {
    const results = {
      customers: { success: false, recordsProcessed: 0, recordsImported: 0, recordsSkipped: 0, errors: [] },
      tables: { success: false, recordsProcessed: 0, recordsImported: 0, recordsSkipped: 0, errors: [] },
      bookings: { success: false, recordsProcessed: 0, recordsImported: 0, recordsSkipped: 0, errors: [] },
      staff: { success: false, recordsProcessed: 0, recordsImported: 0, recordsSkipped: 0, errors: [] }
    };

    try {
      // 1. Migrate customers first
      const customersFile = this.findDataFile(dataDir, 'customers');
      if (customersFile) {
        results.customers = await this.migrateCustomers(customersFile, dryRun);
      }

      // 2. Migrate tables
      const tablesFile = this.findDataFile(dataDir, 'tables');
      if (tablesFile) {
        results.tables = await this.migrateTables(tablesFile, dryRun);
      }

      // 3. Migrate staff
      const staffFile = this.findDataFile(dataDir, 'staff');
      if (staffFile) {
        results.staff = await this.migrateStaff(staffFile, dryRun);
      }

      // 4. Migrate bookings last (depends on customers and tables)
      const bookingsFile = this.findDataFile(dataDir, 'bookings');
      if (bookingsFile) {
        results.bookings = await this.migrateBookings(bookingsFile, dryRun);
      }

    } catch (error) {
      console.error('Migration failed:', error);
    }

    return results;
  }

  private findDataFile(dataDir: string, type: string): string | null {
    const extensions = ['.csv', '.xlsx', '.xls', '.json', '.tsv'];
    const patterns = [
      `serveme_${type}`,
      `${type}`,
      `serveme-${type}`,
      type
    ];

    for (const pattern of patterns) {
      for (const ext of extensions) {
        const filePath = path.join(dataDir, pattern + ext);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
      }
    }

    return null;
  }

  private async parseFile(filePath: string): Promise<any[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.csv':
        return this.parseCsv(filePath);
      case '.xlsx':
      case '.xls':
        return this.parseExcel(filePath);
      case '.json':
        return this.parseJson(filePath);
      case '.tsv':
        return this.parseTsv(filePath);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  private async parseCsv(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (record) => records.push(record))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  private async parseExcel(filePath: string): Promise<any[]> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }

  private async parseJson(filePath: string): Promise<any[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async parseTsv(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csv({ separator: '\t' }))
        .on('data', (record) => records.push(record))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  private async migrateCustomers(filePath: string, dryRun: boolean): Promise<MigrationResult> {
    const records = await this.parseFile(filePath);
    const mapping = defaultServemeMapping.customers;
    const result: MigrationResult = {
      success: false,
      recordsProcessed: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      errors: []
    };

    for (let i = 0; i < records.length; i += this.config.batchSize) {
      const batch = records.slice(i, i + this.config.batchSize);
      
      for (const record of batch) {
        result.recordsProcessed++;
        
        try {
          const customer = this.transformCustomer(record, mapping);
          
          if (!this.validateCustomer(customer)) {
            result.recordsSkipped++;
            continue;
          }

          if (!dryRun) {
            await this.insertCustomer(customer);
          }
          
          result.recordsImported++;
        } catch (error) {
          result.errors.push({
            record,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private transformCustomer(record: any, mapping: ServemeCustomerMapping): any {
    const fullName = record[mapping.name]?.trim();
    const email = record[mapping.email]?.trim().toLowerCase();
    const phone = record[mapping.phone]?.trim();

    return {
      restaurant_id: this.restaurantId,
      user_id: null, // Will be filled if we find matching profile
      guest_name: fullName,
      guest_email: email,
      guest_phone: this.formatPhoneNumber(phone),
      vip_status: this.parseBoolean(record[mapping.vipStatus || '']),
      total_bookings: parseInt(record[mapping.totalVisits || '0']) || 0,
      total_spent: parseFloat(record[mapping.totalSpent || '0']) || 0,
      first_visit: this.parseDate(record[mapping.firstVisit || '']),
      last_visit: this.parseDate(record[mapping.lastVisit || '']),
      dietary_restrictions: this.parseArray(record[mapping.dietaryRestrictions || '']),
      allergies: this.parseArray(record[mapping.allergies || '']),
      notes: record[mapping.notes || '']?.trim() || null,
      tags: this.parseArray(record[mapping.tags || '']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async insertCustomer(customer: any): Promise<void> {
    // Check if customer already exists by email
    if (customer.guest_email && this.config.mergeCustomersByEmail) {
      const { data: existing } = await this.supabase
        .from('restaurant_customers')
        .select('id')
        .eq('restaurant_id', this.restaurantId)
        .eq('guest_email', customer.guest_email)
        .single();

      if (existing) {
        // Update existing customer
        const { error } = await this.supabase
          .from('restaurant_customers')
          .update(customer)
          .eq('id', existing.id);
        
        if (error) throw error;
        return;
      }
    }

    // Insert new customer
    const { error } = await this.supabase
      .from('restaurant_customers')
      .insert(customer);
    
    if (error) throw error;
  }

  private async migrateTables(filePath: string, dryRun: boolean): Promise<MigrationResult> {
    const records = await this.parseFile(filePath);
    const mapping = defaultServemeMapping.tables;
    const result: MigrationResult = {
      success: false,
      recordsProcessed: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      errors: []
    };

    for (const record of records) {
      result.recordsProcessed++;
      
      try {
        const table = this.transformTable(record, mapping);
        
        if (!this.validateTable(table)) {
          result.recordsSkipped++;
          continue;
        }

        if (!dryRun) {
          await this.insertTable(table);
        }
        
        result.recordsImported++;
      } catch (error) {
        result.errors.push({
          record,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private transformTable(record: any, mapping: ServemeTableMapping): any {
    const name = record[mapping.name]?.trim();
    const capacity = parseInt(record[mapping.capacity]) || 4;
    const type = record[mapping.type]?.trim().toLowerCase() || 'standard';

    return {
      restaurant_id: this.restaurantId,
      name,
      capacity,
      type: tableTypeMapping[type] || 'standard',
      section: record[mapping.section || '']?.trim() || null,
      position_x: 0, // Default position
      position_y: 0,
      is_active: this.parseBoolean(record[mapping.isActive || ''], true),
      created_at: new Date().toISOString()
    };
  }

  private async insertTable(table: any): Promise<void> {
    const { error } = await this.supabase
      .from('restaurant_tables')
      .insert(table);
    
    if (error) throw error;
  }

  private async migrateBookings(filePath: string, dryRun: boolean): Promise<MigrationResult> {
    const records = await this.parseFile(filePath);
    const mapping = defaultServemeMapping.bookings;
    const result: MigrationResult = {
      success: false,
      recordsProcessed: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      errors: []
    };

    // Pre-load customers and tables for lookup
    const { data: customers } = await this.supabase
      .from('restaurant_customers')
      .select('id, guest_email, guest_name')
      .eq('restaurant_id', this.restaurantId);

    const { data: tables } = await this.supabase
      .from('restaurant_tables')
      .select('id, name')
      .eq('restaurant_id', this.restaurantId);

    const customerLookup = new Map();
    customers?.forEach((c: any) => {
      if (c.guest_email) customerLookup.set(c.guest_email.toLowerCase(), c.id);
      if (c.guest_name) customerLookup.set(c.guest_name.toLowerCase(), c.id);
    });

    const tableLookup = new Map();
    tables?.forEach((t: any) => {
      tableLookup.set(t.name.toLowerCase(), t.id);
    });

    for (const record of records) {
      result.recordsProcessed++;
      
      try {
        const booking = this.transformBooking(record, mapping, customerLookup, tableLookup);
        
        if (!this.validateBooking(booking)) {
          result.recordsSkipped++;
          continue;
        }

        if (!dryRun) {
          await this.insertBooking(booking);
        }
        
        result.recordsImported++;
      } catch (error) {
        result.errors.push({
          record,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private transformBooking(record: any, mapping: ServemeBookingMapping, customerLookup: Map<string, string>, tableLookup: Map<string, string>): any {
    const bookingTime = this.parseDate(record[mapping.dateTime]);
    const partySize = parseInt(record[mapping.partySize]) || 2;
    const customerIdentifier = record[mapping.customerIdentifier]?.trim().toLowerCase();
    const status = record[mapping.status]?.trim().toLowerCase() || 'completed';
    const tableName = record[mapping.table || '']?.trim().toLowerCase();

    // Find customer ID
    const customerId = customerLookup.get(customerIdentifier);
    
    // Find table ID
    const tableId = tableName ? tableLookup.get(tableName) : null;

    return {
      restaurant_id: this.restaurantId,
      customer_id: customerId,
      booking_time: bookingTime,
      party_size: partySize,
      status: statusMapping[status] || 'completed',
      special_requests: record[mapping.specialRequests || '']?.trim() || null,
      occasion: record[mapping.occasion || '']?.trim() || null,
      confirmation_code: record[mapping.confirmationCode || '']?.trim() || null,
      source: record[mapping.source || '']?.trim() || 'serveme',
      table_id: tableId,
      created_at: this.parseDate(record[mapping.createdDate || '']) || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async insertBooking(booking: any): Promise<void> {
    const { error } = await this.supabase
      .from('bookings')
      .insert(booking);
    
    if (error) throw error;
  }

  private async migrateStaff(filePath: string, dryRun: boolean): Promise<MigrationResult> {
    // Similar implementation for staff migration
    // This would require creating profiles and restaurant_staff records
    return {
      success: true,
      recordsProcessed: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      errors: []
    };
  }

  // Utility methods
  private validateCustomer(customer: any): boolean {
    if (this.config.validation.requireCustomerEmail && !customer.guest_email) {
      return false;
    }
    return true;
  }

  private validateTable(table: any): boolean {
    return table.name && table.capacity > 0;
  }

  private validateBooking(booking: any): boolean {
    if (this.config.validation.requireBookingDateTime && !booking.booking_time) {
      return false;
    }
    if (this.config.validation.requirePartySize && (!booking.party_size || booking.party_size < 1)) {
      return false;
    }
    return true;
  }

  private parseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  }

  private parseBoolean(value: string, defaultValue: boolean = false): boolean {
    if (!value) return defaultValue;
    const lower = value.toLowerCase().trim();
    return ['true', '1', 'yes', 'y', 'on'].includes(lower);
  }

  private parseArray(value: string): string[] {
    if (!value) return [];
    return value.split(',').map(item => item.trim()).filter(item => item);
  }

  private formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Handle US phone numbers
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return phone; // Return original if can't format
  }
}
