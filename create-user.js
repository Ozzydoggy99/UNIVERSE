// Script to create a new user with Template 1
// This is a direct modification to the existing createPredefinedUsers function

// First, add the new user to the server/auth.ts file in the createPredefinedUsers function
// Look for the section after creating Isabella user

// Add the following code:
/*
    // Check if Nana exists, if not create regular user with template 1
    let nanaUser = await storage.getUserByUsername("Nana");
    if (!nanaUser) {
      const hashedPassword = await hashPassword("Nana");
      nanaUser = await storage.createUser({
        username: "Nana",
        password: hashedPassword,
        role: "user"
      });
      console.log("Created regular user: Nana");
    }
    
    // Assign template 1 to Nana if needed
    if (template1 && nanaUser && !nanaUser.templateId) {
      await storage.updateUser(nanaUser.id, { templateId: template1.id });
      console.log("Assigned Template 1 to Nana");
    }
*/