import dotenv from 'dotenv';
import hubspot from '@hubspot/api-client';

dotenv.config();

async function testAssociation() {
  console.log('🧪 Testing note association...\n');

  const client = new hubspot.Client({
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN
  });

  try {
    // Get first contact
    const contactsResponse = await client.crm.contacts.basicApi.getPage(1);
    const contact = contactsResponse.results[0];
    console.log(`Test contact: ${contact.properties.email} (ID: ${contact.id})\n`);

    // Get first Mighty note
    const notesResponse = await client.crm.objects.notes.basicApi.getPage(
      10,
      undefined,
      ['hs_note_body']
    );

    let testNote = null;
    for (const note of notesResponse.results) {
      const body = note.properties.hs_note_body || '';
      if (body.includes('📱 Posted') || body.includes('📅 Created Event')) {
        testNote = note;
        break;
      }
    }

    if (!testNote) {
      console.log('No Mighty notes found');
      return;
    }

    console.log(`Test note ID: ${testNote.id}`);
    const preview = testNote.properties.hs_note_body.substring(0, 100);
    console.log(`Note preview: "${preview}..."\n`);

    // Try to create association
    console.log('Attempting to create association...\n');

    try {
      await client.crm.objects.notes.associationsApi.create(
        testNote.id,
        'contacts',
        contact.id,
        [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 202
          }
        ]
      );

      console.log('✓ Association created successfully!');

    } catch (error) {
      console.error('✗ Association failed:');
      console.error('Error message:', error.message);
      console.error('Error body:', JSON.stringify(error.body, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.body) {
      console.error('Error details:', JSON.stringify(error.body, null, 2));
    }
  }
}

testAssociation();
