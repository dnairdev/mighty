import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function verifyMightyIds() {
  console.log('Verifying Mighty Network IDs between Mighty API and HubSpot...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );
  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Step 1: Fetch all members from Mighty Networks
    console.log('Step 1: Fetching members from Mighty Networks...');
    const mightyMembers = await mightyClient.getAllSubscriptions();
    console.log(`Found ${mightyMembers.length} members in Mighty Networks\n`);

    // Create lookup maps
    const mightyByEmail = new Map();
    const mightyById = new Map();

    for (const member of mightyMembers) {
      if (member.email) {
        mightyByEmail.set(member.email.toLowerCase(), member);
      }
      if (member.member_id) {
        mightyById.set(member.member_id.toString(), member);
      }
    }

    console.log(`Mighty members indexed: ${mightyByEmail.size} by email, ${mightyById.size} by ID\n`);

    // Step 2: Fetch all contacts from HubSpot with Mighty data
    console.log('Step 2: Fetching contacts from HubSpot...');

    const allContacts = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
      const response = await hubspotClient.client.crm.contacts.basicApi.getPage(
        100,
        after,
        [
          'email',
          'firstname',
          'lastname',
          'mighty_member_id',
          'mighty_plan_name',
          'mighty_is_premium'
        ]
      );

      allContacts.push(...response.results);

      if (response.paging?.next?.after) {
        after = response.paging.next.after;
        console.log(`  Fetched ${allContacts.length} contacts so far...`);
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allContacts.length} total contacts in HubSpot\n`);

    // Step 3: Verify ID matches
    console.log('Step 3: Verifying Mighty IDs...\n');

    const results = {
      perfect: [],      // Email matches, ID matches
      idMismatch: [],   // Email matches, but ID is different
      missingId: [],    // Contact exists but has no Mighty ID
      notInMighty: [],  // Contact has Mighty ID but not found in Mighty API
      emailMismatch: [] // Email in Mighty but contact has different ID
    };

    for (const contact of allContacts) {
      const email = contact.properties.email?.toLowerCase();
      const hubspotMightyId = contact.properties.mighty_member_id;
      const name = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || email;

      if (!email) continue;

      const mightyMember = mightyByEmail.get(email);

      if (mightyMember) {
        const correctMightyId = mightyMember.member_id?.toString();

        if (!hubspotMightyId) {
          // Contact exists in both, but HubSpot is missing the ID
          results.missingId.push({
            email,
            name,
            hubspotId: contact.id,
            correctMightyId,
            hubspotMightyId: null
          });
        } else if (hubspotMightyId === correctMightyId) {
          // Perfect match
          results.perfect.push({
            email,
            name,
            mightyId: correctMightyId
          });
        } else {
          // ID mismatch
          results.idMismatch.push({
            email,
            name,
            hubspotId: contact.id,
            hubspotMightyId,
            correctMightyId
          });
        }
      } else if (hubspotMightyId) {
        // Contact has a Mighty ID but not found in current Mighty API
        results.notInMighty.push({
          email,
          name,
          hubspotId: contact.id,
          hubspotMightyId
        });
      }
    }

    // Step 4: Report results
    console.log('='.repeat(80));
    console.log('                    VERIFICATION RESULTS');
    console.log('='.repeat(80));
    console.log('');

    console.log(`✓ Perfect matches:        ${results.perfect.length} contacts`);
    console.log(`⚠ ID mismatches:          ${results.idMismatch.length} contacts`);
    console.log(`⚠ Missing Mighty ID:      ${results.missingId.length} contacts`);
    console.log(`⚠ Not in Mighty API:      ${results.notInMighty.length} contacts`);
    console.log('');

    // Show ID mismatches (critical issues)
    if (results.idMismatch.length > 0) {
      console.log('='.repeat(80));
      console.log('CRITICAL: ID MISMATCHES');
      console.log('='.repeat(80));
      console.log('These contacts have incorrect Mighty IDs stored in HubSpot:\n');

      const displayCount = Math.min(20, results.idMismatch.length);
      for (let i = 0; i < displayCount; i++) {
        const item = results.idMismatch[i];
        console.log(`${i + 1}. ${item.name} (${item.email})`);
        console.log(`   HubSpot has:     ${item.hubspotMightyId}`);
        console.log(`   Should be:       ${item.correctMightyId}`);
        console.log(`   HubSpot ID:      ${item.hubspotId}`);
        console.log('');
      }

      if (results.idMismatch.length > displayCount) {
        console.log(`... and ${results.idMismatch.length - displayCount} more mismatches\n`);
      }
    }

    // Show missing IDs
    if (results.missingId.length > 0) {
      console.log('='.repeat(80));
      console.log('WARNING: MISSING MIGHTY IDs');
      console.log('='.repeat(80));
      console.log('These contacts exist in Mighty but have no ID stored in HubSpot:\n');

      const displayCount = Math.min(20, results.missingId.length);
      for (let i = 0; i < displayCount; i++) {
        const item = results.missingId[i];
        console.log(`${i + 1}. ${item.name} (${item.email})`);
        console.log(`   Mighty ID should be: ${item.correctMightyId}`);
        console.log(`   HubSpot ID: ${item.hubspotId}`);
        console.log('');
      }

      if (results.missingId.length > displayCount) {
        console.log(`... and ${results.missingId.length - displayCount} more missing IDs\n`);
      }
    }

    // Show not in Mighty (likely deleted members)
    if (results.notInMighty.length > 0) {
      console.log('='.repeat(80));
      console.log('INFO: NOT FOUND IN MIGHTY API');
      console.log('='.repeat(80));
      console.log('These contacts have Mighty IDs but were not found in Mighty API');
      console.log('(Likely deleted members or data sync issue):\n');

      const displayCount = Math.min(10, results.notInMighty.length);
      for (let i = 0; i < displayCount; i++) {
        const item = results.notInMighty[i];
        console.log(`${i + 1}. ${item.name} (${item.email})`);
        console.log(`   Stored Mighty ID: ${item.hubspotMightyId}`);
        console.log('');
      }

      if (results.notInMighty.length > displayCount) {
        console.log(`... and ${results.notInMighty.length - displayCount} more\n`);
      }
    }

    // Summary and recommendations
    console.log('='.repeat(80));
    console.log('SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(80));
    console.log('');

    const totalIssues = results.idMismatch.length + results.missingId.length;
    const accuracy = ((results.perfect.length / (results.perfect.length + totalIssues)) * 100).toFixed(1);

    console.log(`Data Accuracy: ${accuracy}% (${results.perfect.length} out of ${results.perfect.length + totalIssues})`);
    console.log('');

    if (results.idMismatch.length > 0) {
      console.log('⚠️  ACTION REQUIRED: Fix ID mismatches');
      console.log(`   ${results.idMismatch.length} contacts have incorrect Mighty IDs`);
      console.log('   Run: npm run fix-mighty-ids (script to be created)');
      console.log('');
    }

    if (results.missingId.length > 0) {
      console.log('⚠️  ACTION RECOMMENDED: Add missing Mighty IDs');
      console.log(`   ${results.missingId.length} contacts are missing Mighty IDs`);
      console.log('   Run: npm run sync-subscriptions (will add missing IDs)');
      console.log('');
    }

    if (results.notInMighty.length > 0) {
      console.log('ℹ️  INFO: Contacts not in Mighty API');
      console.log(`   ${results.notInMighty.length} contacts not found in current Mighty data`);
      console.log('   These may be deleted members - no action needed');
      console.log('');
    }

    if (totalIssues === 0) {
      console.log('✅ All Mighty IDs are correct and accurate!');
      console.log('   No action needed.');
      console.log('');
    }

  } catch (error) {
    console.error('Verification failed:', error.message);
    console.error(error.stack);
  }
}

verifyMightyIds();
