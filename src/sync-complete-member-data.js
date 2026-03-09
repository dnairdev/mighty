import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function syncCompleteMemberData() {
  console.log('🚀 Starting Complete Member Data Sync...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Step 1: Create custom properties in HubSpot
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
      },
      {
        name: 'mighty_user_id',
        label: 'Mighty User ID',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Unique user ID in Mighty Networks'
      },
      {
        name: 'mighty_member_since',
        label: 'Mighty Member Since',
        type: 'datetime',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Date when member joined Mighty Networks'
      },
      {
        name: 'mighty_last_activity',
        label: 'Mighty Last Activity',
        type: 'datetime',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Last activity date in Mighty Networks'
      },
      {
        name: 'mighty_spaces',
        label: 'Mighty Spaces',
        type: 'string',
        fieldType: 'textarea',
        groupName: 'contactinformation',
        description: 'List of Mighty Networks spaces member belongs to'
      },
      {
        name: 'mighty_location',
        label: 'Mighty Location',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Member location from Mighty Networks'
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
    const spaces = await mightyClient.getSpaces();

    console.log(`✓ Loaded ${members.length} members, ${posts.length} posts, ${events.length} events, ${spaces.items.length} spaces\n`);

    // Step 3: Build space membership map
    console.log('🗺️  Building space membership map...');
    const memberSpacesMap = new Map(); // member_id -> [space names]

    for (const space of spaces.items) {
      try {
        console.log(`  Checking space: ${space.name}`);
        const spaceMembers = await mightyClient.getSpaceMembers(space.id);

        if (spaceMembers.items) {
          for (const spaceMember of spaceMembers.items) {
            // spaceMember should have a user_id or id field
            const memberId = spaceMember.user_id || spaceMember.id;
            if (!memberSpacesMap.has(memberId)) {
              memberSpacesMap.set(memberId, []);
            }
            memberSpacesMap.get(memberId).push(space.name);
          }
        }
      } catch (error) {
        console.log(`  ✗ Error loading space ${space.name}: ${error.message}`);
      }
    }

    console.log(`✓ Mapped spaces for ${memberSpacesMap.size} members\n`);

    // Step 4: Calculate engagement counts per member
    console.log('📊 Calculating engagement counts...');

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

    // Step 5: Update ALL HubSpot contacts with complete member data
    console.log('🔄 Updating ALL HubSpot contacts with complete member data...\n');

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const member of members) {
      if (!member.email) {
        errorCount++;
        continue;
      }

      try {
        // Find contact in HubSpot
        const contact = await hubspotClient.findContactByEmail(member.email);
        if (!contact) {
          notFoundCount++;
          continue;
        }

        // Get engagement counts (default to 0)
        const engagement = memberEngagement.get(member.id);
        const postsCount = engagement?.posts || 0;
        const eventsCount = engagement?.events || 0;
        const totalCount = postsCount + eventsCount;

        // Get space membership
        const memberSpaces = memberSpacesMap.get(member.id) || [];
        const spacesString = memberSpaces.length > 0 ? memberSpaces.join('\n') : 'None';

        // Convert dates to YYYY-MM-DD format for HubSpot date properties
        const memberSinceDate = member.created_at ? member.created_at.split('T')[0] : null;
        // Use updated_at if available, otherwise fall back to created_at
        const lastActivityDate = member.updated_at
          ? member.updated_at.split('T')[0]
          : (member.created_at ? member.created_at.split('T')[0] : null);

        // Extract location
        const location = member.location || null;

        // Update custom properties for ALL contacts
        const properties = {
          mighty_posts_count: postsCount,
          mighty_events_count: eventsCount,
          mighty_engagement_total: totalCount,
          mighty_user_id: member.id.toString(),
          mighty_spaces: spacesString
        };

        // Add date fields only if they exist
        if (memberSinceDate) {
          properties.mighty_member_since = memberSinceDate;
        }
        if (lastActivityDate) {
          properties.mighty_last_activity = lastActivityDate;
        }
        if (location) {
          properties.mighty_location = location;
        }

        await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
          properties
        });

        updatedCount++;

        // Log progress every 50 contacts
        if (updatedCount % 50 === 0) {
          console.log(`  Processed ${updatedCount} contacts...`);
        }

        // Log details for contacts with engagement
        if (totalCount > 0 || memberSpaces.length > 0) {
          console.log(`✓ ${member.email}: ${postsCount} posts, ${eventsCount} events, ${memberSpaces.length} spaces`);
        }

      } catch (error) {
        console.log(`✗ Error processing ${member.email}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n═══════════════════════════════════');
    console.log('       SYNC COMPLETE! 🎉           ');
    console.log('═══════════════════════════════════');
    console.log(`Total members: ${members.length}`);
    console.log(`Contacts updated in HubSpot: ${updatedCount}`);
    console.log(`Contacts not found in HubSpot: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('═══════════════════════════════════\n');

    console.log('✅ All member data synced to HubSpot!');
    console.log('   View the columns in HubSpot by:');
    console.log('   1. Go to Contacts → Contacts');
    console.log('   2. Click "Edit columns"');
    console.log('   3. Add the following columns:');
    console.log('      - Mighty Posts Count');
    console.log('      - Mighty Events Count');
    console.log('      - Mighty Engagement Total');
    console.log('      - Mighty User ID');
    console.log('      - Mighty Member Since');
    console.log('      - Mighty Last Activity');
    console.log('      - Mighty Spaces');
    console.log('      - Mighty Location\n');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncCompleteMemberData();
