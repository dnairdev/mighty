import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function checkPropertyDetails() {
  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  const propertiesToCheck = [
    'mighty_subscription_start',
    'mighty_subscription_status'
  ];

  try {
    const allProperties = await hubspotClient.client.crm.properties.coreApi.getAll('contacts');

    for (const propName of propertiesToCheck) {
      const prop = allProperties.results.find(p => p.name === propName);
      if (prop) {
        console.log(`\n=== ${prop.label} (${prop.name}) ===`);
        console.log(`  Type: ${prop.type}`);
        console.log(`  Field Type: ${prop.fieldType}`);
        console.log(`  Group: ${prop.groupName}`);
        console.log(`  Hidden: ${prop.hidden}`);
        console.log(`  Form Field: ${prop.formField}`);
        console.log(`  Description: ${prop.description}`);
      } else {
        console.log(`\n[NOT FOUND] ${propName}`);
      }
    }

    // List all mighty properties
    console.log('\n\n=== ALL MIGHTY PROPERTIES ===');
    const mightyProps = allProperties.results.filter(p => p.name.startsWith('mighty_'));
    for (const prop of mightyProps) {
      console.log(`  ${prop.label} (${prop.name}) - hidden: ${prop.hidden}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPropertyDetails();
