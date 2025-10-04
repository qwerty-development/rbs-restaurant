// Test script to debug customer creation validation
// This will help us understand what's happening with the validation

const testCustomerValidation = () => {
  // Simulate the validation logic as it appears in the source code
  const name = "Test Walk-in Customer";
  const email = null;
  const phone = null;

  // Clean the values as done in the source code
  const cleanName = name && name.length > 0 ? name : null;
  const cleanEmail = email && email.length > 0 ? email : null;
  const cleanPhone = phone && phone.length > 0 ? phone : null;



  // First validation: Check if all fields are empty
  if (!cleanName && !cleanEmail && !cleanPhone) {

    return false;
  }

  // The problematic validation that should NOT exist
  if (!cleanEmail && !cleanPhone) {
    
    return false;
  }


  return true;
};

testCustomerValidation();
