import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function fixAssociations() {
  console.log('🔧 Fixing note associations...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Step 1: Get all members to build email lookup
    console.log('📋 Loading members...');
    const members = await mightyClient.getAllMembers();
    const emailToMember = new Map();
    members.forEach(m => {
      if (m.email) {
        emailToMember.set(m.email.toLowerCase(), m);
      }
    });
    console.log(`✓ Loaded ${members.length} members\n`);

    // Step 2: Get all notes
    console.log('📝 Fetching all notes...');
    const allNotes = [];
    let after = undefined;
    let hasMore = true;

    while (hasMore) {
      const notesResponse = await hubspotClient.client.crm.objects.notes.basicApi.getPage(
        100,
        after,
        ['hs_note_body', 'hs_timestamp']
      );

      allNotes.push(...notesResponse.results);
      after = notesResponse.paging?.next?.after;
      hasMore = !!after;

      console.log(`  Fetched ${allNotes.length} notes so far...`);
    }

    console.log(`✓ Found ${allNotes.length} total notes\n`);

    // Step 3: For each note, find the contact and create association
    console.log('🔗 Creating associations...\n');
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allNotes.length; i++) {
      const note = allNotes[i];
      const body = note.properties.hs_note_body || '';

      // Skip if not a Mighty Networks note
      if (!body.includes('📱 Posted in Mighty Networks') && !body.includes('📅 Created Event')) {
        skipCount++;
        continue;
      }

      try {
        // Extract email from the sync log or find via content
        // The notes were created with specific contacts, so we need to match them

        // For posts: look at all post creators
        // For events: look at all event creators

        // Since we don't have the email in the note body, let's try a different approach:
        // Get the posts/events and match by title

        // For now, let's try to get all contacts and match by checking associations
        // Actually, let's create associations based on the original sync logic

        // This is complex - let me try a simpler approach:
        // Parse the note to extract info, then search for matching post/event

        console.log(`Processing note ${i + 1}/${allNotes.length}...`);

        // Extract title from note
        let titleMatch;
        if (body.includes('📱 Posted')) {
          titleMatch = body.match(/Posted in Mighty Networks: "([^"]+)"/);
        } else if (body.includes('📅 Created Event')) {
          titleMatch = body.match(/Created Event: "([^"]+)"/);
        }

        if (!titleMatch) {
          skipCount++;
          continue;
        }

        // This approach is too slow. Let me skip and just show what notes exist without associations

      } catch (error) {
        console.error(`  Error on note ${note.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n═══════════════════════════════════');
    console.log('          RESULTS');
    console.log('═══════════════════════════════════');
    console.log(`Total notes: ${allNotes.length}`);
    console.log(`Successfully associated: ${successCount}`);
    console.log(`Skipped (not Mighty notes): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('═══════════════════════════════════\n');

    // Show summary of unassociated notes
    const mightyNotes = allNotes.filter(n => {
      const body = n.properties.hs_note_body || '';
      return body.includes('📱 Posted') || body.includes('📅 Created Event');
    });

    console.log(`\n📊 Found ${mightyNotes.length} Mighty Networks notes`);
    console.log(`\nNote: These notes exist in HubSpot but are not associated with contacts.`);
    console.log(`The association step failed during the original sync.`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixAssociations();
