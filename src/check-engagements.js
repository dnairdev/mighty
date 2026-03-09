import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function checkEngagements() {
  console.log('🔍 Checking which contacts have engagement notes...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get contacts with mighty_user_id (our synced members)
    const searchResponse = await hubspotClient.client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'mighty_user_id',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: ['email', 'firstname', 'lastname', 'mighty_user_id'],
      limit: 20
    });

    console.log(`Found ${searchResponse.total} total Mighty Networks contacts\n`);
    console.log('Checking first 20 contacts for engagement notes:\n');

    for (const contact of searchResponse.results) {
      const email = contact.properties.email;
      const firstName = contact.properties.firstname || '';
      const lastName = contact.properties.lastname || '';
      const name = `${firstName} ${lastName}`.trim() || email;

      // Get notes associated with this contact
      const notesResponse = await hubspotClient.client.crm.objects.notes.associationsApi.getAll(
        contact.id,
        'contacts'
      );

      if (notesResponse.results && notesResponse.results.length > 0) {
        // Get the actual note details
        const noteIds = notesResponse.results.map(r => r.id);
        const notes = await hubspotClient.client.crm.objects.notes.batchApi.read({
          properties: ['hs_note_body', 'hs_timestamp'],
          inputs: noteIds.slice(0, 10).map(id => ({ id }))
        });

        // Count post vs event notes
        let postNotes = 0;
        let eventNotes = 0;

        notes.results.forEach(note => {
          const body = note.properties.hs_note_body || '';
          if (body.includes('📱 Posted in Mighty Networks')) {
            postNotes++;
          } else if (body.includes('📅 Created Event')) {
            eventNotes++;
          }
        });

        console.log(`✓ ${name} (${email})`);
        console.log(`  Total notes: ${notesResponse.results.length}`);
        if (postNotes > 0) console.log(`  - Posts: ${postNotes}`);
        if (eventNotes > 0) console.log(`  - Events: ${eventNotes}`);

        // Show a sample note
        if (notes.results.length > 0) {
          const sampleNote = notes.results[0].properties.hs_note_body;
          const preview = sampleNote.substring(0, 150).replace(/\n/g, ' ');
          console.log(`  Sample: "${preview}..."`);
        }
        console.log('');
      }
    }

    console.log('\n📊 Summary Stats:\n');

    // Get total note count
    const allNotes = await hubspotClient.client.crm.objects.notes.basicApi.getPage(1);
    console.log(`Total notes in HubSpot: ${allNotes.total}`);
    console.log(`Total Mighty Networks contacts: ${searchResponse.total}`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkEngagements();
