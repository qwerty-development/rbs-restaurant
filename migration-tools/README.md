# Serveme to Plate Migration Guide

This guide helps you migrate your restaurant data from Serveme to the Plate Restaurant Management System.

## Pre-Migration Checklist

### 1. Data Export from Serveme

Before running the migration, you'll need to export the following data from Serveme:

#### Required Exports:
- **Customers/Guests** (CSV/Excel format preferred)
- **Reservations/Bookings** (CSV/Excel format preferred)
- **Tables** (if available)
- **Staff** (if available)

#### Serveme Export Instructions:
1. Log into your Serveme dashboard
2. Look for "Export" or "Download Data" options (usually in Settings or Reports)
3. Export the following data types:

**Customer Data Should Include:**
- Customer name
- Email address
- Phone number
- Visit history
- Dietary restrictions/allergies
- VIP status (if available)
- Customer notes
- Tags/labels

**Booking Data Should Include:**
- Booking date and time
- Customer information
- Party size
- Table assignments
- Special requests
- Booking status
- Created date
- Cancelled/No-show information

**Table Data Should Include:**
- Table numbers/names
- Seating capacity
- Table types (booth, standard, etc.)
- Location/section

### 2. Supported File Formats

Our migration tool supports:
- **CSV files** (recommended)
- **Excel files** (.xlsx, .xls)
- **JSON files**
- **TSV files**

### 3. File Naming Convention

Please name your exported files as follows:
- `serveme_customers.csv`
- `serveme_bookings.csv`
- `serveme_tables.csv`
- `serveme_staff.csv`

## Migration Process

### Step 1: Prepare Migration Environment

```bash
# Install dependencies
npm install

# Create migration data directory
mkdir -p migration-tools/data/serveme
```

### Step 2: Place Export Files

Copy your Serveme export files to:
```
migration-tools/data/serveme/
├── customers.csv
├── bookings.csv
├── tables.csv
└── staff.csv
```

### Step 3: Configure Migration Settings

Edit `migration-tools/config/serveme-mapping.ts` to match your Serveme export format.

### Step 4: Run Migration

```bash
# Dry run (preview without importing)
npm run migrate:serveme:dry-run

# Full migration
npm run migrate:serveme
```

### Step 5: Verify Migration

After migration, verify:
- Customer count matches
- Booking history is preserved
- Table assignments are correct
- Staff roles are properly mapped

## Data Mapping

### Customer Mapping
| Serveme Field | Plate Field | Notes |
|---------------|-------------|-------|
| Name/Full Name | full_name | Combined first + last name |
| Email | email | Primary contact email |
| Phone | phone_number | Formatted as +1234567890 |
| Notes | customer_notes | Imported as general notes |
| VIP Status | vip_status | Boolean true/false |
| Diet Restrictions | dietary_restrictions | Array format |
| Allergies | allergies | Array format |

### Booking Mapping
| Serveme Field | Plate Field | Notes |
|---------------|-------------|-------|
| Date/Time | booking_time | ISO format required |
| Party Size | party_size | Integer value |
| Status | status | Mapped to our status enum |
| Customer | user_id/guest_* | Links to customer record |
| Special Requests | special_requests | Free text field |
| Table | booking_tables | Junction table relation |

### Status Mapping
| Serveme Status | Plate Status |
|----------------|--------------|
| Confirmed | confirmed |
| Cancelled | cancelled_by_user |
| No Show | no_show |
| Completed | completed |
| Pending | pending |

## Troubleshooting

### Common Issues

**1. Email Conflicts**
- If customers exist with same email, they'll be merged
- Guest bookings are preserved separately

**2. Date Format Issues**
- Ensure dates are in ISO format (YYYY-MM-DD HH:mm:ss)
- Check timezone settings

**3. Missing Required Fields**
- Party size defaults to 2 if missing
- Status defaults to 'completed' for past bookings

**4. Large Data Sets**
- Migration processes in batches of 100 records
- Monitor memory usage for large imports

### Getting Help

If you encounter issues:
1. Check the migration logs in `migration-tools/logs/`
2. Run with `--verbose` flag for detailed output
3. Contact support with error logs

## Post-Migration Tasks

After successful migration:

1. **Review Customer Data**
   - Check customer profiles in the dashboard
   - Verify contact information
   - Update customer tags as needed

2. **Validate Booking History**
   - Spot-check booking details
   - Verify date/time accuracy
   - Check table assignments

3. **Train Staff**
   - Show staff the new system
   - Explain differences from Serveme
   - Update booking procedures

4. **Update Integration Settings**
   - Configure payment gateways
   - Set up email notifications
   - Adjust booking rules

## Rollback Procedure

If you need to rollback the migration:

```bash
# Rollback last migration
npm run migrate:rollback

# Full reset (WARNING: This deletes all imported data)
npm run migrate:reset
```

**⚠️ Important**: Rollback should only be done immediately after migration and before live operations begin.
