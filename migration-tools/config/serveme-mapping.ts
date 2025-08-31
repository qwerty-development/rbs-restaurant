// Serveme Data Mapping Configuration
// Customize these mappings based on your Serveme export format

export interface ServemeCustomerMapping {
  // Required fields
  name: string;           // Column containing customer full name
  email: string;          // Column containing email address
  phone?: string;         // Column containing phone number
  
  // Optional fields
  notes?: string;         // Column containing customer notes
  vipStatus?: string;     // Column indicating VIP status
  dietaryRestrictions?: string; // Column with dietary restrictions
  allergies?: string;     // Column with allergies
  tags?: string;          // Column with customer tags/labels
  firstVisit?: string;    // Column with first visit date
  lastVisit?: string;     // Column with last visit date
  totalVisits?: string;   // Column with total visit count
  totalSpent?: string;    // Column with total amount spent
}

export interface ServemeBookingMapping {
  // Required fields
  dateTime: string;       // Column containing booking date/time
  partySize: string;      // Column containing party size
  customerIdentifier: string; // Column to match customer (email/name/id)
  
  // Optional fields
  status?: string;        // Column containing booking status
  specialRequests?: string; // Column with special requests
  table?: string;         // Column with table assignment
  notes?: string;         // Column with booking notes
  occasion?: string;      // Column with occasion/celebration
  createdDate?: string;   // Column with booking creation date
  confirmationCode?: string; // Column with confirmation code
  source?: string;        // Column indicating booking source
}

export interface ServemeTableMapping {
  // Required fields
  name: string;           // Table name/number
  capacity: string;       // Table seating capacity
  
  // Optional fields
  type?: string;          // Table type (booth, standard, etc.)
  section?: string;       // Table section/area
  position?: string;      // Table position coordinates
  isActive?: string;      // Whether table is active
}

export interface ServemeStaffMapping {
  // Required fields
  name: string;           // Staff member name
  email: string;          // Staff email address
  
  // Optional fields
  role?: string;          // Staff role/position
  phone?: string;         // Phone number
  permissions?: string;   // Permissions list
  isActive?: string;      // Whether staff is active
}

// Default mappings for common Serveme export formats
export const defaultServemeMapping = {
  customers: {
    name: 'Customer Name',
    email: 'Email',
    phone: 'Phone',
    notes: 'Notes',
    vipStatus: 'VIP',
    dietaryRestrictions: 'Dietary Restrictions',
    allergies: 'Allergies',
    tags: 'Tags',
    firstVisit: 'First Visit',
    lastVisit: 'Last Visit',
    totalVisits: 'Total Visits',
    totalSpent: 'Total Spent'
  } as ServemeCustomerMapping,
  
  bookings: {
    dateTime: 'Date & Time',
    partySize: 'Party Size',
    customerIdentifier: 'Customer Email',
    status: 'Status',
    specialRequests: 'Special Requests',
    table: 'Table',
    notes: 'Notes',
    occasion: 'Occasion',
    createdDate: 'Created',
    confirmationCode: 'Confirmation Code',
    source: 'Source'
  } as ServemeBookingMapping,
  
  tables: {
    name: 'Table Name',
    capacity: 'Capacity',
    type: 'Type',
    section: 'Section',
    isActive: 'Active'
  } as ServemeTableMapping,
  
  staff: {
    name: 'Staff Name',
    email: 'Email',
    role: 'Role',
    phone: 'Phone',
    isActive: 'Active'
  } as ServemeStaffMapping
};

// Status mapping from Serveme to Plate
export const statusMapping = {
  'confirmed': 'confirmed',
  'pending': 'pending',
  'cancelled': 'cancelled_by_user',
  'canceled': 'cancelled_by_user',
  'no show': 'no_show',
  'no-show': 'no_show',
  'noshow': 'no_show',
  'completed': 'completed',
  'finished': 'completed',
  'done': 'completed',
  'seated': 'seated',
  'arrived': 'arrived'
};

// Role mapping from Serveme to Plate
export const roleMapping = {
  'manager': 'manager',
  'owner': 'owner',
  'staff': 'staff',
  'server': 'staff',
  'host': 'staff',
  'hostess': 'staff',
  'waiter': 'staff',
  'waitress': 'staff',
  'admin': 'manager',
  'administrator': 'manager'
};

// Table type mapping
export const tableTypeMapping = {
  'booth': 'booth',
  'table': 'standard',
  'standard': 'standard',
  'bar': 'bar',
  'patio': 'patio',
  'outdoor': 'patio',
  'private': 'private',
  'window': 'window'
};

export interface MigrationConfig {
  // Batch size for processing records
  batchSize: number;
  
  // Whether to skip duplicate records
  skipDuplicates: boolean;
  
  // Whether to merge customers with same email
  mergeCustomersByEmail: boolean;
  
  // Default restaurant timezone
  timezone: string;
  
  // Whether to preserve original IDs as references
  preserveOriginalIds: boolean;
  
  // Validation settings
  validation: {
    requireCustomerEmail: boolean;
    requireBookingDateTime: boolean;
    requirePartySize: boolean;
    validatePhoneNumbers: boolean;
    validateEmailFormat: boolean;
  };
}

export const defaultMigrationConfig: MigrationConfig = {
  batchSize: 100,
  skipDuplicates: true,
  mergeCustomersByEmail: true,
  timezone: 'America/New_York',
  preserveOriginalIds: true,
  validation: {
    requireCustomerEmail: false, // Allow guest bookings
    requireBookingDateTime: true,
    requirePartySize: true,
    validatePhoneNumbers: true,
    validateEmailFormat: true
  }
};
