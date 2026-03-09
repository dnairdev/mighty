import dotenv from 'dotenv';
import hubspot from '@hubspot/api-client';

dotenv.config();

async function testAssociationV2() {
  console.log('🧪 Testing note association with direct API...\n');

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

    // Try Method 1: Using PUT request to v4 API
    console.log('Method 1: Using PUT request to v4 associations API...\n');

    try {
      const response = await client.apiRequest({
        method: 'put',
        path: `/crm/v4/objects/notes/${testNote.id}/associations/contacts/${contact.id}`,
        body: [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 202
          }
        ]
      });

      console.log('✓ Association created successfully with Method 1!');
      console.log('Response:', response);

    } catch (error) {
      console.error('✗ Method 1 failed:');
      console.error('Error message:', error.message);

      // Try Method 2: Using batch API
      console.log('\nMethod 2: Using batch associations API...\n');

      try {
        const batchResponse = await client.apiRequest({
          method: 'post',
          path: '/crm/v4/associations/notes/contacts/batch/create',
          body: {
            inputs: [
              {
                from: { id: testNote.id },
                to: { id: contact.id },
                types: [
                  {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 202
                  }
                ]
              }
            ]
          }
        });

        const result = await batchResponse.json();
        console.log('✓ Association created successfully with Method 2!');
        console.log('Result:', JSON.stringify(result, null, 2));

      } catch (error2) {
        console.error('✗ Method 2 also failed:');
        console.error('Error message:', error2.message);
      }
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAssociationV2();
