#!/usr/bin/env node

import { ServemeMigrator, MigrationProgress } from './src/serveme-migrator';
import { defaultMigrationConfig } from './config/serveme-mapping';
import * as path from 'path';
import * as fs from 'fs';

interface CLIArgs {
  dataDir: string;
  restaurantId: string;
  supabaseUrl: string;
  supabaseKey: string;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: any = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'dry-run') {
        parsed.dryRun = true;
      } else if (key === 'verbose') {
        parsed.verbose = true;
      } else {
        parsed[key] = args[i + 1];
        i++;
      }
    }
  }

  return {
    dataDir: parsed.dataDir || './migration-tools/data/serveme',
    restaurantId: parsed.restaurantId || process.env.RESTAURANT_ID || '',
    supabaseUrl: parsed.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseKey: parsed.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    dryRun: parsed.dryRun || false,
    verbose: parsed.verbose || false
  };
}

function validateArgs(args: CLIArgs): void {
  if (!args.restaurantId) {
    console.error('❌ Restaurant ID is required. Use --restaurant-id or set RESTAURANT_ID env var.');
    process.exit(1);
  }
  
  if (!args.supabaseUrl) {
    console.error('❌ Supabase URL is required. Use --supabase-url or set NEXT_PUBLIC_SUPABASE_URL env var.');
    process.exit(1);
  }
  
  if (!args.supabaseKey) {
    console.error('❌ Supabase service role key is required. Use --supabase-key or set SUPABASE_SERVICE_ROLE_KEY env var.');
    process.exit(1);
  }
  
  if (!fs.existsSync(args.dataDir)) {
    console.error(`❌ Data directory not found: ${args.dataDir}`);
    console.error('Please place your Serveme export files in this directory.');
    process.exit(1);
  }
}

function displayProgress(progress: MigrationProgress): void {
  const { phase, totalRecords, processedRecords, currentBatch, totalBatches } = progress;
  const percentage = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;
  
  console.log(`\n📊 ${phase.toUpperCase()}: ${processedRecords}/${totalRecords} (${percentage}%)`);
  console.log(`   Batch: ${currentBatch}/${totalBatches}`);
  
  if (progress.errors.length > 0) {
    console.log(`   ⚠️  Errors: ${progress.errors.length}`);
  }
}

async function main() {
  console.log('🔄 Serveme to Plate Migration Tool\n');
  
  const args = parseArgs();
  validateArgs(args);
  
  if (args.dryRun) {
    console.log('🔍 Running in DRY RUN mode - no data will be imported\n');
  }
  
  if (args.verbose) {
    console.log('📋 Configuration:');
    console.log(`   Data Directory: ${args.dataDir}`);
    console.log(`   Restaurant ID: ${args.restaurantId}`);
    console.log(`   Supabase URL: ${args.supabaseUrl.substring(0, 30)}...`);
    console.log(`   Dry Run: ${args.dryRun}`);
    console.log('');
  }

  const migrator = new ServemeMigrator(
    args.supabaseUrl,
    args.supabaseKey,
    args.restaurantId,
    defaultMigrationConfig,
    args.verbose ? displayProgress : undefined
  );

  try {
    console.log('🚀 Starting migration...\n');
    const startTime = Date.now();
    
    const results = await migrator.migrateFromFiles(args.dataDir, args.dryRun);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n✅ Migration completed!\n');
    console.log('📊 Results Summary:');
    console.log('=====================================');
    
    let totalProcessed = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    Object.entries(results).forEach(([type, result]) => {
      console.log(`\n${type.toUpperCase()}:`);
      console.log(`   Processed: ${result.recordsProcessed}`);
      console.log(`   Imported: ${result.recordsImported}`);
      console.log(`   Skipped: ${result.recordsSkipped}`);
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      
      totalProcessed += result.recordsProcessed;
      totalImported += result.recordsImported;
      totalSkipped += result.recordsSkipped;
      totalErrors += result.errors.length;
      
      if (result.errors.length > 0 && args.verbose) {
        console.log(`\n   Error Details:`);
        result.errors.slice(0, 5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.error}`);
        });
        if (result.errors.length > 5) {
          console.log(`   ... and ${result.errors.length - 5} more errors`);
        }
      }
    });
    
    console.log('\n=====================================');
    console.log('OVERALL TOTALS:');
    console.log(`   Total Processed: ${totalProcessed}`);
    console.log(`   Total Imported: ${totalImported}`);
    console.log(`   Total Skipped: ${totalSkipped}`);
    console.log(`   Total Errors: ${totalErrors}`);
    console.log(`   Duration: ${duration}s`);
    console.log('=====================================');
    
    if (args.dryRun) {
      console.log('\n💡 This was a dry run. To actually import the data, run without --dry-run flag.');
    } else {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Log into your restaurant dashboard');
      console.log('2. Review the imported customers in the Customers section');
      console.log('3. Check booking history and table assignments');
      console.log('4. Update customer tags and preferences as needed');
      console.log('5. Train your staff on the new system');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
