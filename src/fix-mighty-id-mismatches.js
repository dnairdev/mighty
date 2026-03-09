import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function fixMightyIdMismatches() {
  console.log('Fixing Mighty ID mismatches in HubSpot...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );
  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Step 1: Fetch all members from Mighty Networks
    console.log('Step 1: Fetching members from Mighty Networks...');
    const mightyMembers = await mightyClient.getAllSubscriptions();

    // Create email lookup
    const mightyByEmail = new Map();
    for (const member of mightyMembers) {
      if (member.email) {
        mightyByEmail.set(member.email.toLowerCase(), member);
      }
    }
    console.log(`Indexed ${mightyByEmail.size} Mighty members\n`);

    // Step 2: Fetch contacts from HubSpot with Mighty data
    console.log('Step 2: Fetching contacts from HubSpot...');
    const allContacts = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
      const response = await hubspotClient.client.crm.contacts.basicApi.getPage(
        100,
        after,
        ['email', 'firstname', 'lastname', 'mighty_member_id']
      );

      allContacts.push(...response.results);

      if (response.paging?.next?.after) {
        after = response.paging.next.after;
      } else {
        hasMore = false;
      }
    }
    console.log(`Found ${allContacts.length} contacts in HubSpot\n`);

    // Step 3: Find and fix mismatches
    console.log('Step 3: Checking for ID mismatches...\n');

    const mismatches = [];

    for (const contact of allContacts) {
      const email = contact.properties.email?.toLowerCase();
      const hubspotMightyId = contact.properties.mighty_member_id;

      if (!email || !hubspotMightyId) continue;

      const mightyMember = mightyByEmail.get(email);

      if (mightyMember) {
        const correctMightyId = mightyMember.member_id?.toString();

        if (correctMightyId && hubspotMightyId !== correctMightyId) {
          mismatches.push({
            email,
            name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || email,
            hubspotContactId: contact.id,
            oldMightyId: hubspotMightyId,
            newMightyId: correctMightyId
          });
        }
      }
    }

    console.log(`Found ${mismatches.length} ID mismatches\n`);

    if (mismatches.length === 0) {
      console.log('✅ No mismatches found! All Mighty IDs are correct.\n');
      return;
    }

    // Step 4: Fix the mismatches
    console.log('Step 4: Fixing ID mismatches...\n');

    let fixed = 0;
    let errors = 0;

    for (const mismatch of mismatches) {
      try {
        await hubspotClient.client.crm.contacts.basicApi.update(
          mismatch.hubspotContactId,
          {
            properties: {
              mighty_member_id: mismatch.newMightyId
            }
          }
        );

        fixed++;
        console.log(`✓ Fixed: ${mismatch.name} (${mismatch.email})`);
        console.log(`  Changed ID: ${mismatch.oldMightyId} → ${mismatch.newMightyId}\n`);
      } catch (error) {
        errors++;
        console.error(`✗ Error fixing ${mismatch.email}: ${error.message}\n`);
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('FIX COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total mismatches found: ${mismatches.length}`);
    console.log(`Successfully fixed:     ${fixed}`);
    console.log(`Errors:                 ${errors}`);
    console.log('');

    if (fixed > 0) {
      console.log('✅ Run verify-mighty-ids again to confirm all IDs are now correct.');
    }

  } catch (error) {
    console.error('Fix failed:', error.message);
    console.error(error.stack);
  }
}

fixMightyIdMismatches();
