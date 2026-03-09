import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function showExamples() {
  console.log('📊 Finding contacts with engagement notes...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get all notes
    const allNotesResponse = await hubspotClient.client.crm.objects.notes.basicApi.getPage(
      100,
      undefined,
      ['hs_note_body', 'hs_timestamp']
    );

    console.log(`Total notes found: ${allNotesResponse.results.length}\n`);

    // Group notes by contact
    const contactNotes = new Map();

    for (const note of allNotesResponse.results) {
      // Get the contact associated with this note
      try {
        const associations = await hubspotClient.client.crm.objects.notes.associationsApi.getAll(
          note.id,
          'contacts'
        );

        if (associations.results && associations.results.length > 0) {
          const contactId = associations.results[0].id;

          if (!contactNotes.has(contactId)) {
            contactNotes.set(contactId, []);
          }

          const body = note.properties.hs_note_body || '';
          const type = body.includes('📱 Posted') ? 'post' : 'event';

          contactNotes.get(contactId).push({
            type,
            body: body.substring(0, 200),
            timestamp: note.properties.hs_timestamp
          });
        }
      } catch (error) {
        // Skip notes without associations
      }
    }

    console.log(`Found notes for ${contactNotes.size} unique contacts\n`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Get details for first 10 contacts with notes
    let count = 0;
    for (const [contactId, notes] of contactNotes.entries()) {
      if (count >= 10) break;

      try {
        const contact = await hubspotClient.client.crm.contacts.basicApi.getById(
          contactId,
          ['email', 'firstname', 'lastname']
        );

        const email = contact.properties.email;
        const firstName = contact.properties.firstname || '';
        const lastName = contact.properties.lastname || '';
        const name = `${firstName} ${lastName}`.trim() || 'Unknown';

        const postCount = notes.filter(n => n.type === 'post').length;
        const eventCount = notes.filter(n => n.type === 'event').length;

        console.log(`👤 ${name} (${email})`);
        console.log(`   Total notes: ${notes.length}`);
        if (postCount > 0) console.log(`   - Posts: ${postCount}`);
        if (eventCount > 0) console.log(`   - Events: ${eventCount}`);

        // Show sample notes
        console.log('\n   Recent activity:');
        notes.slice(0, 3).forEach((note, i) => {
          const icon = note.type === 'post' ? '📱' : '📅';
          const preview = note.body.split('\n')[0].replace(/📱|📅/g, '').trim();
          console.log(`   ${icon} ${preview}`);
        });

        console.log('\n───────────────────────────────────────────────────────\n');
        count++;
      } catch (error) {
        // Skip if contact not found
      }
    }

    // Summary stats
    console.log('📈 Summary Statistics:\n');

    let totalPosts = 0;
    let totalEvents = 0;
    for (const notes of contactNotes.values()) {
      totalPosts += notes.filter(n => n.type === 'post').length;
      totalEvents += notes.filter(n => n.type === 'event').length;
    }

    console.log(`Total contacts with activity: ${contactNotes.size}`);
    console.log(`Total post notes: ${totalPosts}`);
    console.log(`Total event notes: ${totalEvents}`);
    console.log(`Total notes: ${totalPosts + totalEvents}`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

showExamples();
