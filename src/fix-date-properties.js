import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function fixDateProperties() {
  console.log('🔧 Fixing date properties in HubSpot...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    const dateProperties = ['mighty_member_since', 'mighty_last_activity'];

    // Step 1: Delete existing date properties
    console.log('🗑️  Deleting existing date properties...');
    for (const propName of dateProperties) {
      try {
        await hubspotClient.client.crm.properties.coreApi.archive('contacts', propName);
        console.log(`✓ Deleted: ${propName}`);
      } catch (error) {
        console.log(`  Note: ${propName} - ${error.message}`);
      }
    }
    console.log('');

    // Step 2: Recreate with correct configuration
    console.log('📋 Creating date properties with correct configuration...');

    const propertiesToCreate = [
      {
        name: 'mighty_member_since',
        label: 'Mighty Member Since',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member joined Mighty Networks'
      },
      {
        name: 'mighty_last_activity',
        label: 'Mighty Last Activity',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Last activity date in Mighty Networks'
      }
    ];

    for (const property of propertiesToCreate) {
      try {
        await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
        console.log(`✓ Created: ${property.label}`);
      } catch (error) {
        console.log(`✗ Error creating ${property.label}: ${error.message}`);
      }
    }

    console.log('\n✅ Date properties fixed!');
    console.log('   Now run: node src/sync-complete-member-data.js');
    console.log('   to update all contacts with the corrected date format.\n');

  } catch (error) {
    console.error('❌ Failed to fix date properties:', error.message);
    process.exit(1);
  }
}

fixDateProperties();
