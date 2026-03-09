import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function verifyLocationParsing() {
  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Search for contacts with location data
    const searchResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'mighty_location',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: ['email', 'mighty_location', 'mighty_city', 'mighty_state', 'mighty_country'],
      limit: 10
    });

    console.log(`Found ${searchResponse.total} contacts with location data\n`);
    console.log('Sample contacts with parsed locations:\n');

    for (const contact of searchResponse.results) {
      const props = contact.properties;
      console.log(`Email: ${props.email}`);
      console.log(`  Full Location: ${props.mighty_location || '(none)'}`);
      console.log(`  City: ${props.mighty_city || '(not parsed)'}`);
      console.log(`  State: ${props.mighty_state || '(not parsed)'}`);
      console.log(`  Country: ${props.mighty_country || '(not parsed)'}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyLocationParsing();
