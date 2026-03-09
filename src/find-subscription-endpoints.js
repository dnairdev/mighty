import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function findSubscriptionEndpoints() {
  console.log('🔍 Searching for subscription data in Mighty Networks API...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get a sample member ID for testing
    const membersResponse = await mightyClient.getNetworkMembers(1);
    const sampleMember = membersResponse.items[0];
    const sampleMemberId = sampleMember.id;

    console.log(`Using sample member: ${sampleMember.email} (ID: ${sampleMemberId})\n`);

    // List of endpoints to test
    const endpointsToTest = [
      // Network-level subscription endpoints
      { path: `/networks/${mightyClient.networkId}/subscriptions`, description: 'Network subscriptions' },
      { path: `/networks/${mightyClient.networkId}/memberships`, description: 'Network memberships' },
      { path: `/networks/${mightyClient.networkId}/plans`, description: 'Network plans' },
      { path: `/networks/${mightyClient.networkId}/billing`, description: 'Network billing' },
      { path: `/networks/${mightyClient.networkId}/payments`, description: 'Network payments' },
      { path: `/networks/${mightyClient.networkId}/transactions`, description: 'Network transactions' },
      { path: `/networks/${mightyClient.networkId}/invoices`, description: 'Network invoices' },
      { path: `/networks/${mightyClient.networkId}/revenue`, description: 'Network revenue' },
      { path: `/networks/${mightyClient.networkId}/stripe`, description: 'Stripe integration' },

      // Member-specific subscription endpoints
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}`, description: 'Member details' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/subscription`, description: 'Member subscription' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/membership`, description: 'Member membership' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/plan`, description: 'Member plan' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/billing`, description: 'Member billing' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/payments`, description: 'Member payments' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/transactions`, description: 'Member transactions' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}/invoices`, description: 'Member invoices' },

      // Try with query parameters that might enable subscription data
      { path: `/networks/${mightyClient.networkId}/members?include=subscription`, description: 'Members with subscription included' },
      { path: `/networks/${mightyClient.networkId}/members?include=plan`, description: 'Members with plan included' },
      { path: `/networks/${mightyClient.networkId}/members?include=billing`, description: 'Members with billing included' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}?include=subscription`, description: 'Member with subscription included' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}?include=plan`, description: 'Member with plan included' },
      { path: `/networks/${mightyClient.networkId}/members/${sampleMemberId}?include=billing`, description: 'Member with billing included' },
    ];

    console.log('Testing endpoints...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const successfulEndpoints = [];

    for (const endpoint of endpointsToTest) {
      try {
        console.log(`🔍 Testing: ${endpoint.description}`);
        console.log(`   ${endpoint.path}`);

        const response = await mightyClient.client.get(endpoint.path);

        console.log(`   ✅ SUCCESS! Status: ${response.status}`);

        // Check if response has subscription-related data
        const dataStr = JSON.stringify(response.data).toLowerCase();
        const hasSubscriptionData =
          dataStr.includes('subscription') ||
          dataStr.includes('plan') ||
          dataStr.includes('billing') ||
          dataStr.includes('payment') ||
          dataStr.includes('stripe') ||
          dataStr.includes('price') ||
          dataStr.includes('amount');

        if (hasSubscriptionData) {
          console.log(`   💰 CONTAINS SUBSCRIPTION-RELATED DATA!`);
          successfulEndpoints.push({
            ...endpoint,
            data: response.data
          });
        }

        console.log('');

      } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        console.log(`   ❌ Failed: ${status || 'Error'} - ${message}`);
        console.log('');
      }
    }

    // Display results
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 RESULTS SUMMARY\n');

    if (successfulEndpoints.length === 0) {
      console.log('❌ No endpoints found with subscription data.\n');
      console.log('This means:');
      console.log('  1. Your API key may not have permission to access billing data');
      console.log('  2. Subscription data may not be exposed through the API');
      console.log('  3. Your network may not have paid subscriptions enabled\n');
      console.log('💡 RECOMMENDATION:');
      console.log('  - Contact Mighty Networks support to ask about API access to subscription data');
      console.log('  - Export subscription data manually from the dashboard');
      console.log('  - Use categories/tags as a proxy for paid status\n');
    } else {
      console.log(`✅ Found ${successfulEndpoints.length} endpoint(s) with subscription data!\n`);

      for (const endpoint of successfulEndpoints) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📍 ${endpoint.description}`);
        console.log(`🔗 ${endpoint.path}\n`);
        console.log('📄 Sample data:');
        console.log(JSON.stringify(endpoint.data, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    }

  } catch (error) {
    console.error('❌ Search failed:', error.message);
    console.error(error.stack);
  }
}

findSubscriptionEndpoints();
