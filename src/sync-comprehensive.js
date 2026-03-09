import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function comprehensiveSync() {
  console.log('🚀 Starting Comprehensive Mighty Networks → HubSpot Sync\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  const stats = {
    membersProcessed: 0,
    postsProcessed: 0,
    eventsProcessed: 0,
    postEngagements: 0,
    eventEngagements: 0,
    errors: 0
  };

  try {
    // 1. Build member lookup map
    console.log('📋 Building member directory...');
    const members = await mightyClient.getAllMembers();
    const memberMap = new Map();
    members.forEach(m => memberMap.set(m.id, m));
    stats.membersProcessed = members.length;
    console.log(`✓ Loaded ${members.length} members\n`);

    // 2. Sync Posts as Engagement Notes
    console.log('📝 Syncing Posts...');
    const posts = await mightyClient.getAllPosts();
    console.log(`Found ${posts.length} posts`);

    // Process all posts
    console.log(`Processing all ${posts.length} posts...\n`);

    for (const post of posts) {
      try {
        const creator = memberMap.get(post.creator_id);
        if (creator && creator.email) {
          const contact = await hubspotClient.findContactByEmail(creator.email);
          if (contact) {
            const noteBody = `📱 Posted in Mighty Networks: "${post.title || 'Untitled Post'}"\n\nType: ${post.post_type}\nSpace ID: ${post.space_id}\nPublished: ${post.published_at}\n\nView: ${post.permalink}`;

            await hubspotClient.createEngagementNote(
              contact.id,
              noteBody,
              post.created_at
            );
            stats.postEngagements++;
            console.log(`  ✓ Post engagement for ${creator.email}`);
          }
        }
        stats.postsProcessed++;
      } catch (error) {
        stats.errors++;
        console.log(`  ✗ Error processing post: ${error.message}`);
      }
    }
    console.log(`\n✓ Created ${stats.postEngagements} post engagements\n`);

    // 3. Sync Events as Engagement Notes
    console.log('📅 Syncing Events...');
    const events = await mightyClient.getAllEvents();
    console.log(`Found ${events.length} events`);

    // Process all events
    console.log(`Processing all ${events.length} events...\n`);

    for (const event of events) {
      try {
        if (event.creator && event.creator.email) {
          const contact = await hubspotClient.findContactByEmail(event.creator.email);
          if (contact) {
            const noteBody = `📅 Created Event: "${event.title}"\n\nType: ${event.event_type}\nStarts: ${event.starts_at}\nEnds: ${event.ends_at}\nRSVP Enabled: ${event.rsvp_enabled}\n\nView: ${event.permalink}`;

            await hubspotClient.createEngagementNote(
              contact.id,
              noteBody,
              event.created_at
            );
            stats.eventEngagements++;
            console.log(`  ✓ Event engagement for ${event.creator.name}`);
          }
        }
        stats.eventsProcessed++;
      } catch (error) {
        stats.errors++;
        console.log(`  ✗ Error processing event: ${error.message}`);
      }
    }
    console.log(`\n✓ Created ${stats.eventEngagements} event engagements\n`);

    // Summary
    console.log('═══════════════════════════════════');
    console.log('         SYNC COMPLETE! 🎉         ');
    console.log('═══════════════════════════════════');
    console.log(`Members in directory: ${stats.membersProcessed}`);
    console.log(`Posts found: ${posts.length}`);
    console.log(`Posts processed: ${stats.postsProcessed}`);
    console.log(`Events found: ${events.length}`);
    console.log(`Events processed: ${stats.eventsProcessed}`);
    console.log(`\nEngagements created:`);
    console.log(`  • Posts: ${stats.postEngagements}`);
    console.log(`  • Events: ${stats.eventEngagements}`);
    console.log(`  • Total: ${stats.postEngagements + stats.eventEngagements}`);
    console.log(`\nErrors: ${stats.errors}`);
    console.log('═══════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

comprehensiveSync();
