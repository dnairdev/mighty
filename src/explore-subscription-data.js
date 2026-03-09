import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function exploreSubscriptionData() {
  console.log('💰 Exploring subscription and payment data...\\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // 1. Check MEMBER object for subscription fields
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 MEMBER SUBSCRIPTION FIELDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const membersResponse = await mightyClient.getNetworkMembers(1);
    if (membersResponse.items && membersResponse.items.length > 0) {
      const sampleMember = membersResponse.items[0];

      console.log('Full member object:');
      console.log(JSON.stringify(sampleMember, null, 2));

      console.log('\\nChecking for subscription-related fields:');
      console.log('- subscription:', sampleMember.subscription ? 'FOUND ✅' : 'NOT FOUND ❌');
      console.log('- subscription_status:', sampleMember.subscription_status || 'NOT FOUND ❌');
      console.log('- subscription_plan:', sampleMember.subscription_plan || 'NOT FOUND ❌');
      console.log('- plan:', sampleMember.plan || 'NOT FOUND ❌');
      console.log('- plan_id:', sampleMember.plan_id || 'NOT FOUND ❌');
      console.log('- plan_name:', sampleMember.plan_name || 'NOT FOUND ❌');
      console.log('- membership_type:', sampleMember.membership_type || 'NOT FOUND ❌');
      console.log('- membership_tier:', sampleMember.membership_tier || 'NOT FOUND ❌');
      console.log('- is_paid:', sampleMember.is_paid !== undefined ? `FOUND ✅ (${sampleMember.is_paid})` : 'NOT FOUND ❌');
      console.log('- is_premium:', sampleMember.is_premium !== undefined ? `FOUND ✅ (${sampleMember.is_premium})` : 'NOT FOUND ❌');
      console.log('- payment_status:', sampleMember.payment_status || 'NOT FOUND ❌');
      console.log('- subscribed_at:', sampleMember.subscribed_at || 'NOT FOUND ❌');
      console.log('- subscription_expires_at:', sampleMember.subscription_expires_at || 'NOT FOUND ❌');
    }

    // 2. Check for SUBSCRIPTIONS endpoint
    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUBSCRIPTIONS ENDPOINT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const subscriptionEndpoints = [
      `/networks/${mightyClient.networkId}/subscriptions`,
      `/networks/${mightyClient.networkId}/memberships`,
      `/networks/${mightyClient.networkId}/members/subscriptions`,
      `/networks/${mightyClient.networkId}/payments`,
      `/networks/${mightyClient.networkId}/plans`
    ];

    for (const endpoint of subscriptionEndpoints) {
      try {
        console.log(`🔍 Testing: ${endpoint}`);
        const response = await mightyClient.client.get(endpoint);
        console.log(`✅ ACCESSIBLE! Sample data:`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
      } catch (error) {
        console.log(`❌ Not accessible: ${error.response?.status || error.message}\\n`);
      }
    }

    // 3. Check for individual member subscription endpoint
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 INDIVIDUAL MEMBER SUBSCRIPTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    if (membersResponse.items && membersResponse.items.length > 0) {
      const sampleMemberId = membersResponse.items[0].id;

      const memberEndpoints = [
        `/networks/${mightyClient.networkId}/members/${sampleMemberId}/subscription`,
        `/networks/${mightyClient.networkId}/members/${sampleMemberId}/membership`,
        `/networks/${mightyClient.networkId}/members/${sampleMemberId}/payments`
      ];

      for (const endpoint of memberEndpoints) {
        try {
          console.log(`🔍 Testing: ${endpoint}`);
          const response = await mightyClient.client.get(endpoint);
          console.log(`✅ ACCESSIBLE! Sample data:`);
          console.log(JSON.stringify(response.data, null, 2));
          console.log('');
        } catch (error) {
          console.log(`❌ Not accessible: ${error.response?.status || error.message}\\n`);
        }
      }
    }

    // 4. Check for BILLING/REVENUE data
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💳 BILLING & REVENUE DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const billingEndpoints = [
      `/networks/${mightyClient.networkId}/billing`,
      `/networks/${mightyClient.networkId}/revenue`,
      `/networks/${mightyClient.networkId}/transactions`,
      `/networks/${mightyClient.networkId}/invoices`,
      `/networks/${mightyClient.networkId}/analytics/revenue`
    ];

    for (const endpoint of billingEndpoints) {
      try {
        console.log(`🔍 Testing: ${endpoint}`);
        const response = await mightyClient.client.get(endpoint);
        console.log(`✅ ACCESSIBLE! Sample data:`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
      } catch (error) {
        console.log(`❌ Not accessible: ${error.response?.status || error.message}\\n`);
      }
    }

    // 5. Check SPACE-level subscriptions (some networks have paid spaces)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗺️  SPACE-LEVEL MEMBERSHIP DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    const spacesResponse = await mightyClient.getSpaces();
    if (spacesResponse.items && spacesResponse.items.length > 0) {
      const sampleSpace = spacesResponse.items[0];

      console.log('Checking space object for pricing/subscription fields:');
      console.log('- is_paid:', sampleSpace.is_paid !== undefined ? `FOUND ✅ (${sampleSpace.is_paid})` : 'NOT FOUND ❌');
      console.log('- price:', sampleSpace.price || 'NOT FOUND ❌');
      console.log('- subscription_required:', sampleSpace.subscription_required !== undefined ? `FOUND ✅ (${sampleSpace.subscription_required})` : 'NOT FOUND ❌');
      console.log('- membership_tier:', sampleSpace.membership_tier || 'NOT FOUND ❌');

      // Try space members endpoint to see membership details
      try {
        console.log(`\\n🔍 Checking space member data for subscription info...`);
        const spaceMembers = await mightyClient.getSpaceMembers(sampleSpace.id);
        if (spaceMembers.items && spaceMembers.items.length > 0) {
          const spaceMember = spaceMembers.items[0];
          console.log('Space member object:');
          console.log(JSON.stringify(spaceMember, null, 2));
        }
      } catch (error) {
        console.log(`❌ Space members not accessible: ${error.message}`);
      }
    }

    console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ EXPLORATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');

    console.log('📋 SUMMARY: Run this script to see which subscription');
    console.log('   and payment fields are available in your network.\\n');

  } catch (error) {
    console.error('❌ Exploration failed:', error.message);
    console.error(error.stack);
  }
}

exploreSubscriptionData();
