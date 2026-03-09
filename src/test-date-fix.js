import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function testDateFix() {
  console.log('🧪 Testing date fix on a sample contact...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get first member
    const membersResponse = await mightyClient.getNetworkMembers(1);
    const member = membersResponse.items[0];

    console.log('Sample member data:');
    console.log(`  Email: ${member.email}`);
    console.log(`  Created: ${member.created_at}`);
    console.log(`  Updated: ${member.updated_at}`);
    console.log('');

    // Convert dates to YYYY-MM-DD format
    const memberSinceDate = member.created_at ? member.created_at.split('T')[0] : null;
    const lastActivityDate = member.updated_at ? member.updated_at.split('T')[0] : null;

    console.log('Formatted dates:');
    console.log(`  Member Since: ${memberSinceDate}`);
    console.log(`  Last Activity: ${lastActivityDate}`);
    console.log('');

    // Find contact in HubSpot
    const contact = await hubspotClient.findContactByEmail(member.email);
    if (!contact) {
      console.log('❌ Contact not found in HubSpot');
      return;
    }

    console.log(`Found HubSpot contact: ${contact.id}\n`);

    // Update with formatted dates
    await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
      properties: {
        mighty_member_since: memberSinceDate,
        mighty_last_activity: lastActivityDate,
        mighty_user_id: member.id.toString()
      }
    });

    console.log('✅ Successfully updated contact with formatted dates!');
    console.log('   Check HubSpot to verify the dates are displaying correctly.');
    console.log(`   Contact: ${member.email}\n`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testDateFix();
