#!/usr/bin/env node

// Quick test script to check table combinations functionality
const { createClient } = require('@supabase/supabase-js')

// We'll use hardcoded values for testing - you'll need to replace these
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-key'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testTableCombinations() {
  console.log('Testing table combinations functionality...')
  console.log('Supabase URL:', supabaseUrl.substring(0, 30) + '...')
  
  try {
    // First, let's try to fetch existing combinations
    console.log('1. Fetching existing combinations...')
    const { data: combinations, error: fetchError } = await supabase
      .from('table_combinations')
      .select('*')
      .limit(5)
    
    if (fetchError) {
      console.error('Error fetching combinations:', fetchError)
    } else {
      console.log('Existing combinations:', combinations)
    }
    
    // Try to get tables to see if we can fetch them
    console.log('2. Fetching restaurant tables...')
    const { data: tables, error: tablesError } = await supabase
      .from('restaurant_tables')
      .select('id, table_number, max_capacity, is_combinable')
      .eq('is_active', true)
      .limit(5)
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError)
    } else {
      console.log('Sample tables:', tables)
    }
    
  } catch (error) {
    console.error('General error:', error)
  }
}

testTableCombinations()
