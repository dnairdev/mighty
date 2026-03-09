import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function checkHubSpot() {
  console.log('🔍 Checking HubSpot account...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // 1. Get total contacts
    const contactsPage = await hubspotClient.client.crm.contacts.basicApi.getPage(10);
    console.log(`Total contacts in account: ${contactsPage.total}`);

    if (contactsPage.results.length > 0) {
      console.log('\nFirst 10 contacts:');
      contactsPage.results.forEach((contact, i) => {
        const email = contact.properties.email;
        const firstName = contact.properties.firstname || '';
        const lastName = contact.properties.lastname || '';
        console.log(`  ${i + 1}. ${firstName} ${lastName} (${email})`);
      });
    }

    // 2. Get total notes
    console.log('\n📝 Checking notes...');
    const notesPage = await hubspotClient.client.crm.objects.notes.basicApi.getPage(10, undefined, ['hs_note_body', 'hs_timestamp']);
    console.log(`Total notes in account: ${notesPage.total || 0}`);

    if (notesPage.results && notesPage.results.length > 0) {
      console.log('\nFirst 10 notes:');
      notesPage.results.forEach((note, i) => {
        const body = note.properties.hs_note_body || '';
        const preview = body.substring(0, 100).replace(/\n/g, ' ');
        console.log(`  ${i + 1}. "${preview}..."`);
      });
    }

    // 3. Check for mighty_user_id property
    console.log('\n🔧 Checking custom properties...');
    try {
      const property = await hubspotClient.client.crm.properties.coreApi.getByName('contacts', 'mighty_user_id');
      console.log('✓ mighty_user_id property exists');
    } catch (error) {
      console.log('✗ mighty_user_id property does not exist');
    }

    // 4. Try to find contacts with any email from proathletecommunity.com
    console.log('\n👥 Checking for Pro Athlete Community contacts...');
    try {
      const searchResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'CONTAINS_TOKEN',
            value: 'proathletecommunity.com'
          }]
        }],
        limit: 10
      });

      console.log(`Found ${searchResponse.total} contacts with proathletecommunity.com emails`);
      if (searchResponse.results.length > 0) {
        searchResponse.results.forEach((contact, i) => {
          console.log(`  ${i + 1}. ${contact.properties.email}`);
        });
      }
    } catch (error) {
      console.log('Could not search for proathletecommunity.com contacts');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkHubSpot();
