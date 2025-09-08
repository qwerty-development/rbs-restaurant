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

  console.log("Testing customer validation:");
  console.log("cleanName:", cleanName);
  console.log("cleanEmail:", cleanEmail);
  console.log("cleanPhone:", cleanPhone);

  // First validation: Check if all fields are empty
  if (!cleanName && !cleanEmail && !cleanPhone) {
    console.log("BLOCKED: All fields empty - this is correct behavior");
    return false;
  }

  // The problematic validation that should NOT exist
  if (!cleanEmail && !cleanPhone) {
    console.log("BLOCKED: Contact information required - this is the bug!");
    return false;
  }

  console.log("ALLOWED: Customer can be created");
  return true;
};

testCustomerValidation();
