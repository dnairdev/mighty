import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function testConnections() {
  console.log('Testing API connections...\n');

  // Test Mighty Networks
  console.log('1. Testing Mighty Networks API...');
  try {
    const mightyClient = new MightyNetworksClient(
      process.env.MIGHTY_API_KEY,
      process.env.MIGHTY_NETWORK_ID
    );

    const spaces = await mightyClient.getSpaces();
    console.log('✓ Mighty Networks connection successful');
    console.log(`  Found ${spaces.data?.length || 0} spaces`);

    if (spaces.data && spaces.data.length > 0) {
      console.log('  Sample spaces:');
      spaces.data.slice(0, 3).forEach(space => {
        console.log(`    - ${space.name} (ID: ${space.id})`);
      });
    }
  } catch (error) {
    console.error('✗ Mighty Networks connection failed:', error.message);
  }

  console.log('');

  // Test HubSpot
  console.log('2. Testing HubSpot API...');
  try {
    const hubspotClient = new HubSpotClient(
      process.env.HUBSPOT_ACCESS_TOKEN
    );

    const contacts = await hubspotClient.client.crm.contacts.basicApi.getPage(1);
    console.log('✓ HubSpot connection successful');
    console.log(`  Found ${contacts.results?.length || 0} contacts in first page`);
  } catch (error) {
    console.error('✗ HubSpot connection failed:', error.message);
  }

  console.log('\nConnection tests complete!');
}

testConnections();
