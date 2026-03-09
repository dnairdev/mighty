import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncAllEngagement() {
  console.log('🚀 Starting Full Engagement Count Sync...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Step 1: Ensure custom properties exist
    console.log('📋 Ensuring custom properties exist...');

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
        memberEngagement.set(creatorId, { posts: 0, events: 0 });
      }
      memberEngagement.get(creatorId).posts++;
    });

    // Count events per creator
    events.forEach(event => {
      if (event.creator && event.creator.id) {
        const creatorId = event.creator.id;
        if (!memberEngagement.has(creatorId)) {
          memberEngagement.set(creatorId, { posts: 0, events: 0 });
        }
        memberEngagement.get(creatorId).events++;
      }
    });

    console.log(`Found engagement data for ${memberEngagement.size} unique members\n`);

    // Step 4: Update ALL HubSpot contacts with counts
    console.log('🔄 Updating ALL HubSpot contacts with engagement counts...\n');

    let updatedCount = 0;
    let notFoundCount = 0;
    let zeroEngagementCount = 0;

    for (const member of members) {
      if (!member.email) continue;

      const engagement = memberEngagement.get(member.id);

      // Set engagement to 0 if no activity
      const postsCount = engagement?.posts || 0;
      const eventsCount = engagement?.events || 0;
      const totalCount = postsCount + eventsCount;

      try {
        // Find contact in HubSpot
        const contact = await hubspotClient.findContactByEmail(member.email);
        if (!contact) {
          notFoundCount++;
          continue;
        }

        // Update custom properties for ALL contacts (including those with 0 engagement)
        await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
          properties: {
            mighty_posts_count: postsCount,
            mighty_events_count: eventsCount,
            mighty_engagement_total: totalCount
          }
        });

        updatedCount++;

        if (totalCount === 0) {
          zeroEngagementCount++;
        }

        // Log progress every 50 contacts
        if (updatedCount % 50 === 0) {
          console.log(`  Processed ${updatedCount} contacts...`);
        }

        // Log contacts with engagement
        if (totalCount > 0) {
          console.log(`✓ ${member.email}: ${postsCount} posts, ${eventsCount} events (total: ${totalCount})`);
        }

      } catch (error) {
        console.log(`✗ Error processing ${member.email}: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════');
    console.log('       SYNC COMPLETE! 🎉           ');
    console.log('═══════════════════════════════════');
    console.log(`Total members processed: ${members.length}`);
    console.log(`Contacts updated in HubSpot: ${updatedCount}`);
    console.log(`  - With engagement: ${updatedCount - zeroEngagementCount}`);
    console.log(`  - Without engagement (0): ${zeroEngagementCount}`);
    console.log(`Contacts not found in HubSpot: ${notFoundCount}`);
    console.log(`Unique members with activity: ${memberEngagement.size}`);
    console.log('═══════════════════════════════════\n');

    console.log('✅ All engagement counts synced to HubSpot!');
    console.log('   View the columns in HubSpot by:');
    console.log('   1. Go to Contacts → Contacts');
    console.log('   2. Click "Edit columns"');
    console.log('   3. Add: Mighty Posts Count, Mighty Events Count, Mighty Engagement Total\n');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

syncAllEngagement();
