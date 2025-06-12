// key_generator.js - Generate and validate RSA key pairs for LTI
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Generate a new RSA key pair
function generateKeyPair() {
  console.log('🔐 Generating new RSA key pair...\n');
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  console.log('✅ Key pair generated successfully!\n');
  
  // Save keys to files
  fs.writeFileSync('private_key.pem', privateKey);
  fs.writeFileSync('public_key.pem', publicKey);
  
  console.log('📁 Keys saved to:');
  console.log('  - private_key.pem');
  console.log('  - public_key.pem\n');
  
  // Display the keys
  console.log('🔑 PRIVATE KEY (use this in your .env file):');
  console.log('─'.repeat(80));
  console.log(privateKey);
  
  console.log('🔑 PUBLIC KEY (use this in Moodle LTI tool configuration):');
  console.log('─'.repeat(80));
  console.log(publicKey);
  
  // Test the key
  testKey(privateKey);
  
  return { publicKey, privateKey };
}

// Test if a private key is valid
function testKey(privateKey) {
  try {
    console.log('🧪 Testing private key...\n');
    
    // Test JWT signing
    const testPayload = {
      iss: 'test',
      sub: 'test',
      aud: 'test',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300
    };
    
    const token = jwt.sign(testPayload, privateKey, { algorithm: 'RS256' });
    console.log('✅ JWT signing successful');
    console.log('Token preview:', token.substring(0, 50) + '...\n');
    
    // Verify the token
    const publicKey = crypto.createPublicKey(privateKey).export({
      type: 'spki',
      format: 'pem'
    });
    
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    console.log('✅ JWT verification successful');
    console.log('Decoded payload:', decoded);
    
    return true;
  } catch (error) {
    console.error('❌ Key test failed:', error.message);
    return false;
  }
}

// Validate an existing key from environment or string
function validateExistingKey(keyString) {
  console.log('🔍 Validating existing private key...\n');
  
  // Clean up the key string
  let cleanKey = keyString;
  
  // Handle different formats
  if (keyString.includes('\\n')) {
    cleanKey = keyString.replace(/\\n/g, '\n');
    console.log('🔧 Converted \\n to actual newlines');
  }
  
  // Check if it starts with proper PEM header
  if (!cleanKey.includes('-----BEGIN')) {
    console.log('❌ Key does not start with PEM header');
    console.log('Expected format should start with: -----BEGIN PRIVATE KEY-----');
    return false;
  }
  
  console.log('Key info:');
  console.log('  Length:', cleanKey.length, 'characters');
  console.log('  Starts with:', cleanKey.substring(0, 30) + '...');
  console.log('  Ends with:', '...' + cleanKey.substring(cleanKey.length - 30));
  
  return testKey(cleanKey);
}

// Format key for .env file
function formatKeyForEnv(privateKey) {
  const envFormatted = privateKey.replace(/\n/g, '\\n');
  console.log('\n📝 For your .env file, use this format:');
  console.log('─'.repeat(80));
  console.log(`LTI_PRIVATE_KEY="${envFormatted}"`);
  console.log('─'.repeat(80));
}

// Main execution
function main() {
  console.log('🔐 === RSA Key Generator and Validator ===\n');
  
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node key_generator.js generate     - Generate new key pair');
    console.log('  node key_generator.js validate     - Validate existing key from env');
    console.log('  node key_generator.js test "key"   - Test a specific key string');
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'generate':
      const { privateKey } = generateKeyPair();
      formatKeyForEnv(privateKey);
      break;
      
    case 'validate':
      if (!process.env.LTI_PRIVATE_KEY) {
        console.log('❌ LTI_PRIVATE_KEY environment variable not found');
        console.log('Please set it in your .env file first');
        return;
      }
      validateExistingKey(process.env.LTI_PRIVATE_KEY);
      break;
      
    case 'test':
      if (args.length < 2) {
        console.log('❌ Please provide a key string to test');
        return;
      }
      validateExistingKey(args[1]);
      break;
      
    default:
      console.log('❌ Unknown command:', command);
  }
}

// Export functions for use in other modules
module.exports = {
  generateKeyPair,
  testKey,
  validateExistingKey,
  formatKeyForEnv
};

// Run if called directly
if (require.main === module) {
  main();
}