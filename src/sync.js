import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncMembersToHubSpot() {
  console.log('Starting Mighty Networks to HubSpot sync...\n');

  // Initialize clients
  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Test connections
    console.log('Testing Mighty Networks connection...');
    const mightyConnected = await mightyClient.testConnection();
    if (!mightyConnected) {
      throw new Error('Failed to connect to Mighty Networks API');
    }
    console.log('✓ Mighty Networks connection successful\n');

    console.log('Testing HubSpot connection...');
    const hubspotConnected = await hubspotClient.testConnection();
    if (!hubspotConnected) {
      throw new Error('Failed to connect to HubSpot API');
    }
    console.log('✓ HubSpot connection successful\n');

    // Ensure custom properties exist in HubSpot
    console.log('Ensuring custom properties exist in HubSpot...');
    await hubspotClient.ensureCustomProperties();
    console.log('✓ Custom properties ready\n');

    // Fetch all members from Mighty Networks
    console.log('Fetching members from Mighty Networks...');
    const members = await mightyClient.getAllMembers();
    console.log(`✓ Found ${members.length} members\n`);

    // Sync each member to HubSpot
    console.log('Syncing members to HubSpot...');
    let successCount = 0;
    let errorCount = 0;

    for (const member of members) {
      try {
        await hubspotClient.createOrUpdateContact(member);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync member ${member.user_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n--- Sync Complete ---');
    console.log(`✓ Successfully synced: ${successCount} members`);
    if (errorCount > 0) {
      console.log(`✗ Failed: ${errorCount} members`);
    }
    console.log('---------------------\n');

  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncMembersToHubSpot();
