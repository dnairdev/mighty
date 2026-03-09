import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function debugMightyAPI() {
  console.log('=== Mighty Networks API Debug Tool ===\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  // Test 1: Check spaces
  console.log('1. Checking Spaces...');
  try {
    const spaces = await mightyClient.getSpaces();
    console.log('   Response:', JSON.stringify(spaces, null, 2));
    console.log(`   Total spaces: ${spaces.data?.length || 0}\n`);
  } catch (error) {
    console.error('   Error:', error.response?.data || error.message);
    console.log('');
  }

  // Test 2: Check network members
  console.log('2. Checking Network Members...');
  try {
    const members = await mightyClient.getNetworkMembers();
    console.log('   Response:', JSON.stringify(members, null, 2));
    console.log(`   Total members: ${members.data?.length || 0}\n`);
  } catch (error) {
    console.error('   Error:', error.response?.data || error.message);
    console.log('');
  }

  // Test 3: Direct API call to verify endpoint
  console.log('3. Testing Direct API Call...');
  try {
    const response = await mightyClient.client.get(`/networks/${process.env.MIGHTY_NETWORK_ID}`);
    console.log('   Network info:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('   Error:', error.response?.data || error.message);
  }

  console.log('\n=== Debug Complete ===');
}

debugMightyAPI();
