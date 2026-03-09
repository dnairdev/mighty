import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncWithProperties() {
  console.log('🚀 Starting Enhanced Sync with Custom Properties...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Step 1: Create custom properties for counts
    console.log('📋 Creating custom properties...');

    const customProperties = [
      {
        name: 'mighty_posts_count',
        label: 'Mighty Posts Count',
        type: 'number',
        fieldType: 'number',
        groupName: 'contactinformation',
        description: 'Number of posts created in Mighty Networks'
      },
      {
        name: 'mighty_events_count',
        label: 'Mighty Events Count',
        type: 'number',
        fieldType: 'number',
        groupName: 'contactinformation',
        description: 'Number of events created in Mighty Networks'
      },
      {
        name: 'mighty_engagement_total',
        label: 'Mighty Engagement Total',
        type: 'number',
        fieldType: 'number',
        groupName: 'contactinformation',
        description: 'Total engagement count (posts + events)'
      }
    ];

    for (const property of customProperties) {
      try {
        await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
        console.log(`✓ Created: ${property.label}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`✓ Already exists: ${property.label}`);
        } else {
          console.log(`✗ Error creating ${property.label}: ${error.message}`);
        }
      }
    }
    console.log('');

    // Step 2: Load all Mighty Networks data
    console.log('📥 Loading Mighty Networks data...');
    const members = await mightyClient.getAllMembers();
    const posts = await mightyClient.getAllPosts();
    const events = await mightyClient.getAllEvents();

    console.log(`✓ Loaded ${members.length} members, ${posts.length} posts, ${events.length} events\n`);

    // Step 3: Calculate engagement counts per member
    console.log('📊 Calculating engagement counts...\n');

    const memberEngagement = new Map();

    // Count posts per creator
    posts.forEach(post => {
      const creatorId = post.creator_id;
      if (!memberEngagement.has(creatorId)) {
        memberEngagement.set(creatorId, { posts: 0, events: 0, postData: [], eventData: [] });
      }
      memberEngagement.get(creatorId).posts++;
      memberEngagement.get(creatorId).postData.push(post);
    });

    // Count events per creator
    events.forEach(event => {
      if (event.creator && event.creator.id) {
        const creatorId = event.creator.id;
        if (!memberEngagement.has(creatorId)) {
          memberEngagement.set(creatorId, { posts: 0, events: 0, postData: [], eventData: [] });
        }
        memberEngagement.get(creatorId).events++;
        memberEngagement.get(creatorId).eventData.push(event);
      }
    });

    console.log(`Found engagement data for ${memberEngagement.size} unique members\n`);

    // Step 4: Update HubSpot contacts with counts and create notes
    console.log('🔄 Updating HubSpot contacts...\n');

    let updatedCount = 0;
    let notesCreated = 0;
    let processLimit = 500; // Limit to first 500 to avoid overwhelming

    for (const member of members) {
      if (updatedCount >= processLimit) break;

      if (!member.email) continue;

      const engagement = memberEngagement.get(member.id);
      if (!engagement || (engagement.posts === 0 && engagement.events === 0)) continue;

      try {
        // Find contact in HubSpot
        const contact = await hubspotClient.findContactByEmail(member.email);
        if (!contact) continue;

        // Update custom properties
        await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
          properties: {
            mighty_posts_count: engagement.posts,
            mighty_events_count: engagement.events,
            mighty_engagement_total: engagement.posts + engagement.events
          }
        });

        // Create notes for recent posts (limit to 5 most recent)
        for (const post of engagement.postData.slice(0, 5)) {
          const noteBody = `📱 Posted in Mighty Networks: "${post.title || 'Untitled Post'}"\n\nType: ${post.post_type}\nSpace ID: ${post.space_id}\nPublished: ${post.published_at}\n\nView: ${post.permalink}`;

          await hubspotClient.createEngagementNote(
            contact.id,
            noteBody,
            post.created_at
          );
          notesCreated++;
        }

        // Create notes for recent events (limit to 5 most recent)
        for (const event of engagement.eventData.slice(0, 5)) {
          const noteBody = `📅 Created Event: "${event.title}"\n\nType: ${event.event_type}\nStarts: ${event.starts_at}\nEnds: ${event.ends_at}\nRSVP Enabled: ${event.rsvp_enabled}\n\nView: ${event.permalink}`;

          await hubspotClient.createEngagementNote(
            contact.id,
            noteBody,
            event.created_at
          );
          notesCreated++;
        }

        updatedCount++;
        console.log(`✓ ${member.email}: ${engagement.posts} posts, ${engagement.events} events (${notesCreated} notes created)`);

      } catch (error) {
        console.log(`✗ Error processing ${member.email}: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════');
    console.log('       SYNC COMPLETE! 🎉           ');
    console.log('═══════════════════════════════════');
    console.log(`Contacts updated: ${updatedCount}`);
    console.log(`Notes created: ${notesCreated}`);
    console.log('═══════════════════════════════════\n');

    console.log('✅ You can now view the custom columns in HubSpot:');
    console.log('   1. Go to Contacts → Contacts');
    console.log('   2. Click "Edit columns" (top right)');
    console.log('   3. Search for and add:');
    console.log('      - Mighty Posts Count');
    console.log('      - Mighty Events Count');
    console.log('      - Mighty Engagement Total');
    console.log('');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

syncWithProperties();
