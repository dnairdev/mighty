import dotenv from 'dotenv';
import hubspot from '@hubspot/api-client';

dotenv.config();

async function listNotes() {
  console.log('📝 Listing all Mighty Networks notes in HubSpot...\n');

  const client = new hubspot.Client({
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN
  });

  try {
    // Get all notes
    const allNotes = [];
    let after = undefined;
    let hasMore = true;

    while (hasMore && allNotes.length < 500) {
      const notesResponse = await client.crm.objects.notes.basicApi.getPage(
        100,
        after,
        ['hs_note_body', 'hs_timestamp']
      );

      allNotes.push(...notesResponse.results);
      after = notesResponse.paging?.next?.after;
      hasMore = !!after;
    }

    console.log(`Found ${allNotes.length} total notes\n`);

    // Filter for Mighty Networks notes
    const mightyNotes = allNotes.filter(n => {
      const body = n.properties.hs_note_body || '';
      return body.includes('📱 Posted in Mighty Networks') || body.includes('📅 Created Event');
    });

    console.log(`Mighty Networks notes: ${mightyNotes.length}\n`);

    // Count by type
    const postNotes = mightyNotes.filter(n => n.properties.hs_note_body.includes('📱 Posted'));
    const eventNotes = mightyNotes.filter(n => n.properties.hs_note_body.includes('📅 Created Event'));

    console.log(`Post notes: ${postNotes.length}`);
    console.log(`Event notes: ${eventNotes.length}\n`);

    // Show some examples
    console.log('═══════════════════════════════════════════════════════');
    console.log('EXAMPLE NOTES');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📱 POST EXAMPLES:\n');
    postNotes.slice(0, 5).forEach((note, i) => {
      const body = note.properties.hs_note_body;
      const lines = body.split('\n');
      console.log(`${i + 1}. ${lines[0]}`);
      if (lines[1]) console.log(`   ${lines[1]}`);
      console.log('');
    });

    console.log('\n📅 EVENT EXAMPLES:\n');
    eventNotes.slice(0, 5).forEach((note, i) => {
      const body = note.properties.hs_note_body;
      const lines = body.split('\n');
      console.log(`${i + 1}. ${lines[0]}`);
      if (lines[1]) console.log(`   ${lines[1]}`);
      console.log('');
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('⚠️  IMPORTANT NOTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('The notes were created in HubSpot but are NOT associated');
    console.log('with contacts. This means they exist in the system but');
    console.log('are not visible on any contact records.');
    console.log('');
    console.log('The association step failed during the sync process.');
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listNotes();
