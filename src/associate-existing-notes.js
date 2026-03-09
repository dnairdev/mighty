import dotenv from 'dotenv';
import { HubSpotClient } from './clients/hubspotClient.js';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function associateExistingNotes() {
  console.log('🔗 Associating existing notes with contacts...\n');

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const stats = {
    totalNotes: 0,
    mightyNotes: 0,
    postsAssociated: 0,
    eventsAssociated: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // Step 1: Load all posts and events from Mighty Networks
    console.log('📋 Loading Mighty Networks data...');
    const posts = await mightyClient.getAllPosts();
    const events = await mightyClient.getAllEvents();
    const members = await mightyClient.getAllMembers();

    // Build lookup maps
    const memberMap = new Map();
    members.forEach(m => memberMap.set(m.id, m));

    const postsByTitle = new Map();
    posts.forEach(p => {
      const title = (p.title || 'Untitled Post').toLowerCase();
      postsByTitle.set(title, p);
    });

    const eventsByTitle = new Map();
    events.forEach(e => {
      const title = (e.title || '').toLowerCase();
      eventsByTitle.set(title, e);
    });

    console.log(`✓ Loaded ${members.length} members, ${posts.length} posts, ${events.length} events\n`);

    // Step 2: Get all notes from HubSpot
    console.log('📝 Fetching all notes from HubSpot...');
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

      if (allNotes.length % 500 === 0) {
        console.log(`  Fetched ${allNotes.length} notes...`);
      }
    }

    stats.totalNotes = allNotes.length;
    console.log(`✓ Found ${allNotes.length} total notes\n`);

    // Step 3: Process each note
    console.log('🔗 Creating associations...\n');

    for (let i = 0; i < allNotes.length; i++) {
      const note = allNotes[i];
      const body = note.properties.hs_note_body || '';

      // Skip non-Mighty notes
      if (!body.includes('📱 Posted in Mighty Networks') && !body.includes('📅 Created Event')) {
        stats.skipped++;
        continue;
      }

      stats.mightyNotes++;

      try {
        let creatorEmail = null;
        let isPost = false;

        // Extract title and determine type
        if (body.includes('📱 Posted in Mighty Networks')) {
          isPost = true;
          const titleMatch = body.match(/Posted in Mighty Networks: "([^"]+)"/);
          if (titleMatch) {
            const title = titleMatch[1].toLowerCase();
            const post = postsByTitle.get(title);
            if (post) {
              const creator = memberMap.get(post.creator_id);
              if (creator && creator.email) {
                creatorEmail = creator.email;
              }
            }
          }
        } else if (body.includes('📅 Created Event')) {
          const titleMatch = body.match(/Created Event: "([^"]+)"/);
          if (titleMatch) {
            const title = titleMatch[1].toLowerCase();
            const event = eventsByTitle.get(title);
            if (event && event.creator && event.creator.email) {
              creatorEmail = event.creator.email;
            }
          }
        }

        if (!creatorEmail) {
          stats.skipped++;
          if ((i + 1) % 100 === 0) {
            console.log(`  Processed ${i + 1}/${allNotes.length} notes (${stats.postsAssociated + stats.eventsAssociated} associated, ${stats.errors} errors)`);
          }
          continue;
        }

        // Find contact in HubSpot
        const contact = await hubspotClient.findContactByEmail(creatorEmail);
        if (!contact) {
          stats.skipped++;
          if ((i + 1) % 100 === 0) {
            console.log(`  Processed ${i + 1}/${allNotes.length} notes (${stats.postsAssociated + stats.eventsAssociated} associated, ${stats.errors} errors)`);
          }
          continue;
        }

        // Create association using direct API request
        await hubspotClient.client.apiRequest({
          method: 'put',
          path: `/crm/v4/objects/notes/${note.id}/associations/contacts/${contact.id}`,
          body: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 202
            }
          ]
        });

        if (isPost) {
          stats.postsAssociated++;
        } else {
          stats.eventsAssociated++;
        }

        if ((i + 1) % 100 === 0) {
          console.log(`  Processed ${i + 1}/${allNotes.length} notes (${stats.postsAssociated + stats.eventsAssociated} associated, ${stats.errors} errors)`);
        }

      } catch (error) {
        stats.errors++;
        if ((i + 1) % 100 === 0) {
          console.log(`  Processed ${i + 1}/${allNotes.length} notes (${stats.postsAssociated + stats.eventsAssociated} associated, ${stats.errors} errors)`);
        }
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════');
    console.log('      ASSOCIATION COMPLETE! 🎉      ');
    console.log('═══════════════════════════════════');
    console.log(`Total notes processed: ${stats.totalNotes}`);
    console.log(`Mighty Networks notes: ${stats.mightyNotes}`);
    console.log(`\nAssociations created:`);
    console.log(`  • Posts: ${stats.postsAssociated}`);
    console.log(`  • Events: ${stats.eventsAssociated}`);
    console.log(`  • Total: ${stats.postsAssociated + stats.eventsAssociated}`);
    console.log(`\nSkipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('═══════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Association failed:', error.message);
    process.exit(1);
  }
}

associateExistingNotes();
