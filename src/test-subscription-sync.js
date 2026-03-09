import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function testSubscriptionSync() {
  console.log('🧪 Testing subscription field sync on sample contacts...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const hubspotClient = new HubSpotClient(
    process.env.HUBSPOT_ACCESS_TOKEN
  );

  try {
    // Get first 3 members to test
    const membersResponse = await mightyClient.getNetworkMembers(1);
    const testMembers = membersResponse.items.slice(0, 3);

    console.log(`Testing with ${testMembers.length} sample members:\n`);

    for (const member of testMembers) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Member: ${member.first_name} ${member.last_name}`);
      console.log(`   Email: ${member.email}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Show raw data from Mighty
      console.log('📊 Mighty Networks Data:');
      console.log(`   Plan Name: ${member.plan?.name || 'N/A'}`);
      console.log(`   Plan Type: ${member.plan?.type || 'N/A'}`);
      console.log(`   Plan Amount: $${member.plan?.amount || 0}`);
      console.log(`   Subscription ID: ${member.subscription?.id || 'N/A'}`);
      console.log(`   Purchased At: ${member.subscription?.purchased_at || 'N/A'}`);
      console.log(`   Canceled At: ${member.subscription?.canceled_at || 'N/A'}`);
      console.log(`   Categories: ${member.categories?.map(c => c.title).join(', ') || 'None'}\n`);

      // Process the data
      const planType = member.plan?.type || 'unknown';
      const isPremium = planType === 'subscription';
      const subscriptionStatus = member.subscription?.canceled_at ? 'canceled' : 'active';
      const subscriptionStart = member.subscription?.purchased_at
        ? member.subscription.purchased_at.split('T')[0]
        : (member.subscription?.current_period_start ? member.subscription.current_period_start.split('T')[0] : null);
      const cohortYears = member.categories && member.categories.length > 0
        ? member.categories.map(cat => cat.title).join(', ')
        : null;

      console.log('🔄 Processed Data for HubSpot:');
      console.log(`   mighty_plan_type: "${planType}"`);
      console.log(`   mighty_is_premium: ${isPremium}`);
      console.log(`   mighty_subscription_status: "${subscriptionStatus}"`);
      console.log(`   mighty_subscription_start: ${subscriptionStart || 'N/A'}`);
      console.log(`   mighty_cohort_years: ${cohortYears || 'N/A'}\n`);

      // Try to update HubSpot
      const contact = await hubspotClient.findContactByEmail(member.email);
      if (!contact) {
        console.log('❌ Contact not found in HubSpot\n');
        continue;
      }

      const properties = {
        mighty_plan_type: planType,
        mighty_is_premium: isPremium,
        mighty_subscription_status: subscriptionStatus
      };

      if (subscriptionStart) {
        properties.mighty_subscription_start = subscriptionStart;
      }
      if (cohortYears) {
        properties.mighty_cohort_years = cohortYears;
      }

      await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
        properties
      });

      console.log('✅ Successfully updated HubSpot contact!');
      console.log(`   HubSpot Contact ID: ${contact.id}\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Check HubSpot to verify the new fields are populated correctly.');
    console.log('If everything looks good, run the full sync:');
    console.log('   node src/sync-complete-member-data.js\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testSubscriptionSync();
