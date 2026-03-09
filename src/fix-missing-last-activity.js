import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function fixMissingLastActivity() {
  console.log('🔧 Fixing missing last activity dates...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get all members
    console.log('📥 Loading Mighty Networks members...');
    const members = await mightyClient.getAllMembers();
    console.log(`✓ Loaded ${members.length} members\n`);

    console.log('🔄 Checking and fixing contacts with missing last activity...\n');

    let fixedCount = 0;
    let alreadySetCount = 0;
    let notFoundCount = 0;

    for (const member of members) {
      if (!member.email) continue;

      try {
        // Find contact in HubSpot
        const contact = await hubspotClient.findContactByEmail(member.email);
        if (!contact) {
          notFoundCount++;
          continue;
        }

        // Check if mighty_last_activity is missing or null
        const currentLastActivity = contact.properties.mighty_last_activity;

        if (!currentLastActivity || currentLastActivity === '' || currentLastActivity === 'null') {
          // Fix: Use updated_at if available, otherwise use created_at
          const lastActivityDate = member.updated_at
            ? member.updated_at.split('T')[0]
            : (member.created_at ? member.created_at.split('T')[0] : null);

          if (lastActivityDate) {
            await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
              properties: {
                mighty_last_activity: lastActivityDate
              }
            });

            fixedCount++;
            console.log(`✓ Fixed ${member.email}: ${lastActivityDate}`);
          }
        } else {
          alreadySetCount++;
        }

        // Log progress every 100 contacts
        if ((fixedCount + alreadySetCount + notFoundCount) % 100 === 0) {
          console.log(`  Checked ${fixedCount + alreadySetCount} contacts...`);
        }

      } catch (error) {
        console.log(`✗ Error processing ${member.email}: ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════');
    console.log('       FIX COMPLETE! 🎉           ');
    console.log('═══════════════════════════════════');
    console.log(`Total contacts checked: ${members.length}`);
    console.log(`Contacts fixed: ${fixedCount}`);
    console.log(`Already had dates: ${alreadySetCount}`);
    console.log(`Not found in HubSpot: ${notFoundCount}`);
    console.log('═══════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    process.exit(1);
  }
}

fixMissingLastActivity();
