import dotenv from 'dotenv';
import hubspot from '@hubspot/api-client';

dotenv.config();

async function checkNoteDetails() {
  console.log('🔍 Checking note details and associations...\n');

  const client = new hubspot.Client({
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN
  });

  try {
    // Get first 10 notes
    const notesResponse = await client.crm.objects.notes.basicApi.getPage(
      10,
      undefined,
      ['hs_note_body', 'hs_timestamp'],
      undefined,
      undefined,
      false
    );

    console.log(`Found ${notesResponse.results.length} notes\n`);

    for (let i = 0; i < Math.min(3, notesResponse.results.length); i++) {
      const note = notesResponse.results[i];
      const body = note.properties.hs_note_body || '';
      const preview = body.substring(0, 100).replace(/\n/g, ' ');

      console.log(`Note ${i + 1}:`);
      console.log(`  ID: ${note.id}`);
      console.log(`  Preview: "${preview}..."`);

      // Try to get associations using different methods
      try {
        // Method 1: Get note with associations
        const noteWithAssociations = await client.crm.objects.notes.basicApi.getById(
          note.id,
          ['hs_note_body'],
          undefined,
          ['contacts']
        );

        console.log(`  Associations in response:`, noteWithAssociations.associations);
      } catch (error) {
        console.log(`  Could not get associations in note response`);
      }

      // Method 2: Use associations API
      try {
        const associations = await client.apiRequest({
          method: 'get',
          path: `/crm/v4/objects/notes/${note.id}/associations/contacts`
        });

        console.log(`  Associations from API:`, associations);
      } catch (error) {
        console.log(`  Associations API error: ${error.message}`);
      }

      console.log('');
    }

    // Also try to find a contact and see their associated notes
    console.log('\n🔄 Checking from contact side...\n');

    const contactsResponse = await client.crm.contacts.basicApi.getPage(
      5,
      undefined,
      ['email', 'firstname', 'lastname']
    );

    for (const contact of contactsResponse.results.slice(0, 2)) {
      const email = contact.properties.email;
      const name = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim();

      console.log(`Contact: ${name} (${email})`);
      console.log(`  Contact ID: ${contact.id}`);

      // Try to get notes for this contact
      try {
        const contactWithAssociations = await client.crm.contacts.basicApi.getById(
          contact.id,
          ['email'],
          undefined,
          ['notes']
        );

        if (contactWithAssociations.associations && contactWithAssociations.associations.notes) {
          console.log(`  Has ${contactWithAssociations.associations.notes.results.length} notes`);
        } else {
          console.log(`  No notes found`);
        }
      } catch (error) {
        console.log(`  Error getting associations: ${error.message}`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.body);
  }
}

checkNoteDetails();
