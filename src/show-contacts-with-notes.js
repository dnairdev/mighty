import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function showContactsWithNotes() {
  console.log('👥 Finding contacts with Mighty Networks notes...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get all contacts
    const contactsResponse = await hubspotClient.client.crm.contacts.basicApi.getPage(
      100,
      undefined,
      ['email', 'firstname', 'lastname']
    );

    console.log(`Checking ${contactsResponse.results.length} contacts...\n`);

    const contactsWithNotes = [];

    for (const contact of contactsResponse.results) {
      try {
        // Get contact with note associations
        const contactWithAssociations = await hubspotClient.client.crm.contacts.basicApi.getById(
          contact.id,
          ['email', 'firstname', 'lastname'],
          undefined,
          ['notes']
        );

        if (contactWithAssociations.associations &&
            contactWithAssociations.associations.notes &&
            contactWithAssociations.associations.notes.results.length > 0) {

          const noteCount = contactWithAssociations.associations.notes.results.length;
          const email = contact.properties.email;
          const firstName = contact.properties.firstname || '';
          const lastName = contact.properties.lastname || '';
          const name = `${firstName} ${lastName}`.trim() || 'Unknown';

          // Get the actual notes to see how many are Mighty notes
          const noteIds = contactWithAssociations.associations.notes.results.slice(0, 10).map(n => n.id);
          const notes = await hubspotClient.client.crm.objects.notes.batchApi.read({
            properties: ['hs_note_body'],
            inputs: noteIds.map(id => ({ id }))
          });

          let postCount = 0;
          let eventCount = 0;

          notes.results.forEach(note => {
            const body = note.properties.hs_note_body || '';
            if (body.includes('📱 Posted in Mighty Networks')) {
              postCount++;
            } else if (body.includes('📅 Created Event')) {
              eventCount++;
            }
          });

          if (postCount > 0 || eventCount > 0) {
            contactsWithNotes.push({
              name,
              email,
              totalNotes: noteCount,
              postNotes: postCount,
              eventNotes: eventCount,
              notes: notes.results
            });
          }
        }
      } catch (error) {
        // Skip contacts that have issues
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log(`Found ${contactsWithNotes.length} contacts with Mighty Networks notes`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Show first 10 contacts
    contactsWithNotes.slice(0, 10).forEach((contact, i) => {
      console.log(`${i + 1}. 👤 ${contact.name} (${contact.email})`);
      console.log(`   Total notes: ${contact.totalNotes}`);
      if (contact.postNotes > 0) console.log(`   - Posts: ${contact.postNotes}`);
      if (contact.eventNotes > 0) console.log(`   - Events: ${contact.eventNotes}`);

      // Show sample note
      if (contact.notes.length > 0) {
        const sampleBody = contact.notes[0].properties.hs_note_body || '';
        const firstLine = sampleBody.split('\n')[0];
        console.log(`   Sample: ${firstLine}`);
      }
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════');

    let totalPosts = 0;
    let totalEvents = 0;
    contactsWithNotes.forEach(c => {
      totalPosts += c.postNotes;
      totalEvents += c.eventNotes;
    });

    console.log(`Contacts with Mighty notes: ${contactsWithNotes.length}`);
    console.log(`Total post notes: ${totalPosts}`);
    console.log(`Total event notes: ${totalEvents}`);
    console.log(`Total notes: ${totalPosts + totalEvents}`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('✅ You can now view these notes in HubSpot by:');
    console.log('   1. Going to https://app.hubspot.com');
    console.log('   2. Navigate to Contacts');
    console.log('   3. Click on any of the contacts listed above');
    console.log('   4. Scroll down to the Notes section\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

showContactsWithNotes();
