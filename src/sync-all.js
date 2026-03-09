import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncAllData() {
  console.log('Starting comprehensive Mighty Networks to HubSpot sync...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  const stats = {
    members: 0,
    posts: 0,
    events: 0,
    engagements: 0,
    errors: 0
  };

  try {
    // Test connections
    console.log('Testing API connections...');
    const mightyConnected = await mightyClient.testConnection();
    const hubspotConnected = await hubspotClient.testConnection();

    if (!mightyConnected || !hubspotConnected) {
      throw new Error('Failed to connect to APIs');
    }
    console.log('✓ Both APIs connected\n');

    // 1. Sync Members (if not already done)
    console.log('=== Syncing Members ===');
    const members = await mightyClient.getAllMembers();
    stats.members = members.length;
    console.log(`Found ${members.length} members\n`);

    // 2. Fetch Posts
    console.log('=== Fetching Posts ===');
    try {
      const posts = await mightyClient.getAllPosts();
      stats.posts = posts.length;

      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts`);
        console.log('Sample posts:');
        posts.slice(0, 3).forEach(post => {
          console.log(`  - "${post.title || 'Untitled'}" by member ${post.member_id}`);
        });

        // Create engagement notes for posts (limited to prevent spam)
        console.log('\nCreating engagement notes for recent posts...');
        const recentPosts = posts.slice(0, 10);

        for (const post of recentPosts) {
          try {
            // Find member by ID and get their contact
            const member = members.find(m => m.id === post.member_id);
            if (member && member.email) {
              const contact = await hubspotClient.findContactByEmail(member.email);
              if (contact) {
                const noteBody = `Posted in Mighty Networks: "${post.title || 'Untitled'}"\n\n${post.body?.substring(0, 200) || ''}...`;
                await hubspotClient.createEngagementNote(
                  contact.id,
                  noteBody,
                  post.created_at
                );
                stats.engagements++;
              }
            }
          } catch (error) {
            stats.errors++;
          }
        }
        console.log(`Created ${stats.engagements} post engagement notes`);
      }
    } catch (error) {
      console.log('Posts endpoint may not be available:', error.message);
    }
    console.log('');

    // 3. Fetch Events
    console.log('=== Fetching Events ===');
    try {
      const events = await mightyClient.getAllEvents();
      stats.events = events.length;

      if (events.length > 0) {
        console.log(`Found ${events.length} events`);
        console.log('Sample events:');
        events.slice(0, 5).forEach(event => {
          console.log(`  - "${event.name || event.title}" on ${event.start_time || event.created_at}`);
        });

        // Try to get RSVPs for first event
        if (events[0] && events[0].id) {
          try {
            console.log('\nFetching RSVPs for first event...');
            const rsvps = await mightyClient.getEventRSVPs(events[0].id);
            console.log(`Found ${rsvps.items?.length || 0} RSVPs`);
          } catch (error) {
            console.log('Could not fetch RSVPs:', error.message);
          }
        }
      }
    } catch (error) {
      console.log('Events endpoint may not be available:', error.message);
    }
    console.log('');

    // Summary
    console.log('=== Sync Summary ===');
    console.log(`Members: ${stats.members}`);
    console.log(`Posts: ${stats.posts}`);
    console.log(`Events: ${stats.events}`);
    console.log(`Engagement notes created: ${stats.engagements}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('====================\n');

  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  }
}

syncAllData();
