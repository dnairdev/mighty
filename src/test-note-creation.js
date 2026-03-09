import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function testNoteCreation() {
  console.log('🧪 Testing note creation with association...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get first contact
    const contactsResponse = await hubspotClient.client.crm.contacts.basicApi.getPage(1);
    const contact = contactsResponse.results[0];
    console.log(`Test contact: ${contact.properties.email} (ID: ${contact.id})\n`);

    // Create a test note
    const testBody = '🧪 Test Note: This is a test engagement note created to verify associations work correctly.';

    console.log('Creating note with association...\n');
    const result = await hubspotClient.createEngagementNote(
      contact.id,
      testBody,
      new Date().toISOString()
    );

    if (result) {
      console.log(`✓ Note created successfully! Note ID: ${result.id}\n`);

      // Verify the association
      console.log('Verifying association...');
      const noteWithAssociations = await hubspotClient.client.crm.objects.notes.basicApi.getById(
        result.id,
        ['hs_note_body'],
        undefined,
        ['contacts']
      );

      if (noteWithAssociations.associations && noteWithAssociations.associations.contacts) {
        console.log(`✓ Note is associated with ${noteWithAssociations.associations.contacts.results.length} contact(s)`);
        console.log('Association is working correctly! ✅');
      } else {
        console.log('✗ Note was created but has no associations');
      }
    } else {
      console.log('✗ Note creation failed');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testNoteCreation();
