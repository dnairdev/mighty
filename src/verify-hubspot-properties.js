import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function verifyProperties() {
  console.log('Verifying HubSpot properties exist...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  const propertiesToCheck = [
    'mighty_plan_name',
    'mighty_plan_type',
    'mighty_plan_price',
    'mighty_is_premium',
    'mighty_subscription_start',
    'mighty_subscription_status',
    'mighty_member_joined',
    'mighty_days_to_convert',
    'mighty_conversion_type',
    'mighty_cohort_years',
    'mighty_location'
  ];

  try {
    // Get all contact properties
    const allProperties = await hubspotClient.client.crm.properties.coreApi.getAll('contacts');

    console.log('Checking for Mighty properties:\n');

    for (const propName of propertiesToCheck) {
      const found = allProperties.results.find(p => p.name === propName);
      if (found) {
        console.log(`  [EXISTS] ${found.label} (${propName})`);
      } else {
        console.log(`  [MISSING] ${propName}`);
      }
    }

    // Also check a sample contact to see if data exists
    console.log('\n\nChecking sample contact data...\n');

    const testEmail = 'najeh44@gmail.com';
    const searchResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: testEmail
        }]
      }],
      properties: propertiesToCheck,
      limit: 1
    });

    if (searchResponse.results.length > 0) {
      const contact = searchResponse.results[0];
      console.log(`Contact found: ${testEmail}\n`);
      console.log('Property values:');
      for (const propName of propertiesToCheck) {
        const value = contact.properties[propName];
        console.log(`  ${propName}: ${value || '(empty)'}`);
      }
    } else {
      console.log(`Contact not found: ${testEmail}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

verifyProperties();
