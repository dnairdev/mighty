import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { StripeClient } from './clients/stripeClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function findDeletedMembers() {
  console.log('Finding deleted Mighty members using Stripe payment data...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );
  const stripeClient = new StripeClient(process.env.STRIPE_SECRET_KEY);
  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Step 1: Get all current Mighty Networks members
    console.log('Step 1: Fetching current Mighty Networks members...');
    const mightyMembers = await mightyClient.getAllSubscriptions();
    const mightyEmails = new Set(
      mightyMembers
        .map(m => m.email?.toLowerCase())
        .filter(Boolean)
    );
    console.log(`Found ${mightyEmails.size} current Mighty members\n`);

    // Step 2: Get all Stripe customers and their payment data
    console.log('Step 2: Fetching Stripe customer data...');
    const [customers, subscriptions, charges] = await Promise.all([
      stripeClient.getAllCustomers(),
      stripeClient.getAllSubscriptions(),
      stripeClient.getAllCharges()
    ]);
    console.log(`Found ${customers.length} Stripe customers`);
    console.log(`Found ${subscriptions.length} Stripe subscriptions`);
    console.log(`Found ${charges.length} Stripe charges\n`);

    // Step 3: Create lookup maps
    const subscriptionsByCustomer = new Map();
    for (const sub of subscriptions) {
      if (!subscriptionsByCustomer.has(sub.customer)) {
        subscriptionsByCustomer.set(sub.customer, []);
      }
      subscriptionsByCustomer.get(sub.customer).push(sub);
    }

    const chargesByCustomer = new Map();
    for (const charge of charges) {
      if (!chargesByCustomer.has(charge.customer)) {
        chargesByCustomer.set(charge.customer, []);
      }
      chargesByCustomer.get(charge.customer).push(charge);
    }

    // Step 4: Find deleted members (in Stripe but not in Mighty)
    console.log('Step 3: Identifying deleted members...\n');

    const deletedMembers = [];

    for (const customer of customers) {
      if (!customer.email) continue;

      const email = customer.email.toLowerCase();

      // If customer is NOT in current Mighty members, they've been deleted
      if (!mightyEmails.has(email)) {
        const customerSubs = subscriptionsByCustomer.get(customer.id) || [];
        const customerCharges = chargesByCustomer.get(customer.id) || [];

        // Only include if they have payment history (were paying customers)
        if (customerCharges.length > 0) {
          // Find last successful payment
          const successfulCharges = customerCharges
            .filter(c => c.status === 'succeeded')
            .sort((a, b) => b.created - a.created);

          const lastPayment = successfulCharges[0];

          // Find subscription info
          const canceledSubs = customerSubs.filter(s =>
            s.status === 'canceled' || s.status === 'incomplete_expired'
          );
          const activeSubs = customerSubs.filter(s => s.status === 'active');

          let cancellationDate = null;
          let subscriptionStatus = 'unknown';

          if (canceledSubs.length > 0) {
            // Get most recent cancellation
            const latestCanceled = canceledSubs.sort((a, b) =>
              (b.canceled_at || 0) - (a.canceled_at || 0)
            )[0];
            cancellationDate = latestCanceled.canceled_at;
            subscriptionStatus = 'canceled';
          } else if (activeSubs.length > 0) {
            subscriptionStatus = 'active (but deleted from Mighty)';
          } else {
            subscriptionStatus = 'no subscription';
          }

          deletedMembers.push({
            email: customer.email,
            name: customer.name || 'No name',
            stripeCustomerId: customer.id,
            lastPaymentDate: lastPayment ? new Date(lastPayment.created * 1000) : null,
            lastPaymentAmount: lastPayment ? lastPayment.amount / 100 : 0,
            cancellationDate: cancellationDate ? new Date(cancellationDate * 1000) : null,
            subscriptionStatus,
            totalPayments: successfulCharges.length,
            totalPaid: successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100,
            customerCreated: new Date(customer.created * 1000)
          });
        }
      }
    }

    // Step 5: Sort by last payment date (most recent first)
    deletedMembers.sort((a, b) => {
      if (!a.lastPaymentDate) return 1;
      if (!b.lastPaymentDate) return -1;
      return b.lastPaymentDate - a.lastPaymentDate;
    });

    // Step 6: Display results
    console.log('='.repeat(80));
    console.log('              DELETED MEMBERS WITH PAYMENT HISTORY');
    console.log('='.repeat(80));
    console.log(`\nTotal deleted members found: ${deletedMembers.length}\n`);

    if (deletedMembers.length === 0) {
      console.log('✓ No deleted members found with payment history.');
      console.log('  This means all Stripe customers are still in Mighty Networks.\n');
      return;
    }

    // Summary statistics
    const totalRevenueLost = deletedMembers.reduce((sum, m) => sum + m.totalPaid, 0);
    const recentDeletions = deletedMembers.filter(m => {
      if (!m.lastPaymentDate) return false;
      const daysSince = (Date.now() - m.lastPaymentDate) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });

    console.log('-'.repeat(80));
    console.log('REVENUE IMPACT');
    console.log('-'.repeat(80));
    console.log(`Total lifetime revenue from deleted members: $${totalRevenueLost.toFixed(2)}`);
    console.log(`Average revenue per deleted member: $${(totalRevenueLost / deletedMembers.length).toFixed(2)}`);
    console.log(`Members deleted in last 90 days: ${recentDeletions.length}\n`);

    // Show detailed list (first 20)
    console.log('-'.repeat(80));
    console.log('DELETED MEMBERS (Most Recent First - Showing First 20)');
    console.log('-'.repeat(80));
    console.log('');

    const displayCount = Math.min(20, deletedMembers.length);
    for (let i = 0; i < displayCount; i++) {
      const member = deletedMembers[i];
      const daysSincePayment = member.lastPaymentDate
        ? Math.floor((Date.now() - member.lastPaymentDate) / (1000 * 60 * 60 * 24))
        : 'N/A';

      console.log(`${i + 1}. ${member.name} (${member.email})`);
      console.log(`   Last Payment: ${member.lastPaymentDate ? member.lastPaymentDate.toISOString().split('T')[0] : 'N/A'} (${daysSincePayment} days ago)`);
      console.log(`   Last Amount: $${member.lastPaymentAmount.toFixed(2)}`);
      console.log(`   Total Paid: $${member.totalPaid.toFixed(2)} (${member.totalPayments} payments)`);
      console.log(`   Subscription: ${member.subscriptionStatus}`);
      if (member.cancellationDate) {
        console.log(`   Canceled: ${member.cancellationDate.toISOString().split('T')[0]}`);
      }
      console.log('');
    }

    if (deletedMembers.length > 20) {
      console.log(`... and ${deletedMembers.length - 20} more deleted members\n`);
    }

    // Step 7: Check if these members exist in HubSpot
    console.log('='.repeat(80));
    console.log('CHECKING HUBSPOT STATUS');
    console.log('='.repeat(80));
    console.log('');

    let inHubSpot = 0;
    let notInHubSpot = 0;

    console.log('Checking first 10 deleted members in HubSpot...\n');
    for (let i = 0; i < Math.min(10, deletedMembers.length); i++) {
      const member = deletedMembers[i];
      try {
        const contact = await hubspotClient.findContactByEmail(member.email);
        if (contact) {
          inHubSpot++;
          console.log(`✓ ${member.email} - EXISTS in HubSpot (ID: ${contact.id})`);
        } else {
          notInHubSpot++;
          console.log(`✗ ${member.email} - NOT in HubSpot`);
        }
      } catch (error) {
        console.log(`? ${member.email} - Error checking: ${error.message}`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));
    console.log('');
    console.log('1. PRESERVE DATA: Keep these contacts in HubSpot for historical tracking');
    console.log('2. WIN-BACK CAMPAIGN: Target deleted members who paid recently (last 90 days)');
    console.log('3. CHURN ANALYSIS: Analyze why these members left (exit surveys, feedback)');
    console.log('4. STRIPE CLEANUP: Consider archiving very old deleted members in Stripe');
    console.log('');
    console.log(`Members to target for win-back: ${recentDeletions.length}`);
    console.log(`Potential recovered revenue: $${(recentDeletions.reduce((sum, m) => sum + m.lastPaymentAmount, 0) * 12).toFixed(2)}/year`);
    console.log('');

    // Export option
    console.log('='.repeat(80));
    console.log('NEXT STEPS');
    console.log('='.repeat(80));
    console.log('');
    console.log('To create a win-back list in HubSpot:');
    console.log('1. Create a new static list: "Deleted Members - Win Back"');
    console.log('2. Add filter: "Email" is one of:');
    recentDeletions.slice(0, 10).forEach(m => {
      console.log(`   - ${m.email}`);
    });
    if (recentDeletions.length > 10) {
      console.log(`   ... and ${recentDeletions.length - 10} more`);
    }
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

findDeletedMembers();
