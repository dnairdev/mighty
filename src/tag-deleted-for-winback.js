import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';
import { StripeClient } from './clients/stripeClient.js';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

async function tagDeletedForWinback() {
  console.log('Tagging deleted members for win-back campaign...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );
  const stripeClient = new StripeClient(process.env.STRIPE_SECRET_KEY);
  const hubspotClient = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    // Step 1: Create custom property in HubSpot for deleted member status
    console.log('Step 1: Creating HubSpot custom properties...\n');

    const properties = [
      {
        name: 'member_deleted_status',
        label: 'Member Deleted Status',
        type: 'enumeration',
        fieldType: 'select',
        groupName: 'contactinformation',
        description: 'Status indicating if member was deleted from Mighty Networks',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Deleted - Recent (Win Back)', value: 'deleted_recent' },
          { label: 'Deleted - Medium Term', value: 'deleted_medium' },
          { label: 'Deleted - Long Term', value: 'deleted_long' }
        ]
      },
      {
        name: 'deleted_member_last_payment',
        label: 'Deleted Member Last Payment',
        type: 'date',
        fieldType: 'date',
        groupName: 'contactinformation',
        description: 'Last payment date for deleted members (from Stripe)'
      },
      {
        name: 'deleted_member_total_paid',
        label: 'Deleted Member Total Paid',
        type: 'string',
        fieldType: 'text',
        groupName: 'contactinformation',
        description: 'Total amount paid by deleted member'
      },
      {
        name: 'deleted_member_days_since_payment',
        label: 'Days Since Last Payment (Deleted)',
        type: 'number',
        fieldType: 'number',
        groupName: 'contactinformation',
        description: 'Days since last payment for deleted members'
      }
    ];

    for (const property of properties) {
      try {
        await hubspotClient.client.crm.properties.coreApi.create('contacts', property);
        console.log(`  ✓ Created: ${property.label}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  - Already exists: ${property.label}`);
        } else {
          console.error(`  ✗ Error creating ${property.label}:`, error.message);
        }
      }
    }

    // Step 2: Get current Mighty members
    console.log('\nStep 2: Fetching current Mighty Networks members...');
    const mightyMembers = await mightyClient.getAllSubscriptions();
    const mightyEmails = new Set(
      mightyMembers
        .map(m => m.email?.toLowerCase())
        .filter(Boolean)
    );
    console.log(`Found ${mightyEmails.size} current Mighty members`);

    // Step 3: Get Stripe data
    console.log('\nStep 3: Fetching Stripe customer data...');
    const [customers, charges] = await Promise.all([
      stripeClient.getAllCustomers(),
      stripeClient.getAllCharges()
    ]);

    // Create charges lookup
    const chargesByCustomer = new Map();
    for (const charge of charges) {
      if (!chargesByCustomer.has(charge.customer)) {
        chargesByCustomer.set(charge.customer, []);
      }
      chargesByCustomer.get(charge.customer).push(charge);
    }

    // Step 4: Find deleted members with payment history
    console.log('\nStep 4: Identifying deleted members...');

    const deletedMembers = [];

    for (const customer of customers) {
      if (!customer.email) continue;

      const email = customer.email.toLowerCase();

      if (!mightyEmails.has(email)) {
        const customerCharges = chargesByCustomer.get(customer.id) || [];

        if (customerCharges.length > 0) {
          const successfulCharges = customerCharges
            .filter(c => c.status === 'succeeded')
            .sort((a, b) => b.created - a.created);

          if (successfulCharges.length > 0) {
            const lastPayment = successfulCharges[0];
            const lastPaymentDate = new Date(lastPayment.created * 1000);
            const daysSince = Math.floor((Date.now() - lastPaymentDate) / (1000 * 60 * 60 * 24));
            const totalPaid = successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100;

            // Categorize by recency
            let status;
            if (daysSince <= 90) {
              status = 'deleted_recent';
            } else if (daysSince <= 180) {
              status = 'deleted_medium';
            } else {
              status = 'deleted_long';
            }

            deletedMembers.push({
              email: customer.email,
              name: customer.name || 'No name',
              lastPaymentDate,
              daysSince,
              totalPaid,
              status
            });
          }
        }
      }
    }

    console.log(`Found ${deletedMembers.length} deleted members with payment history`);

    // Categorize for reporting
    const recentDeletions = deletedMembers.filter(m => m.status === 'deleted_recent');
    const mediumDeletions = deletedMembers.filter(m => m.status === 'deleted_medium');
    const longDeletions = deletedMembers.filter(m => m.status === 'deleted_long');

    console.log(`\nBreakdown:`);
    console.log(`  Recent (0-90 days): ${recentDeletions.length}`);
    console.log(`  Medium (91-180 days): ${mediumDeletions.length}`);
    console.log(`  Long-term (180+ days): ${longDeletions.length}`);

    // Step 5: Update HubSpot contacts
    console.log('\nStep 5: Updating HubSpot contacts...\n');
    console.log(`Tagging ALL ${deletedMembers.length} deleted members...\n`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const member of deletedMembers) {
      try {
        const contact = await hubspotClient.findContactByEmail(member.email);

        if (contact) {
          await hubspotClient.client.crm.contacts.basicApi.update(contact.id, {
            properties: {
              member_deleted_status: member.status,
              mighty_subscription_status: 'deleted',
              deleted_member_last_payment: member.lastPaymentDate.toISOString().split('T')[0],
              deleted_member_total_paid: `$${member.totalPaid.toFixed(2)}`,
              deleted_member_days_since_payment: member.daysSince
            }
          });

          updated++;
          console.log(`✓ Tagged: ${member.email} - $${member.totalPaid.toFixed(2)} (${member.daysSince} days ago)`);
        } else {
          notFound++;
          console.log(`✗ Not found: ${member.email}`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error: ${member.email} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('                    TAGGING COMPLETE');
    console.log('='.repeat(80));
    console.log(`\nContacts updated:    ${updated}`);
    console.log(`  Recent (0-90):     ${recentDeletions.length}`);
    console.log(`  Medium (91-180):   ${mediumDeletions.length}`);
    console.log(`  Long-term (180+):  ${longDeletions.length}`);
    console.log(`\nContacts not found:  ${notFound}`);
    console.log(`Errors:              ${errors}\n`);

    // Step 6: Provide next steps
    console.log('='.repeat(80));
    console.log('NEXT STEPS: CREATE HUBSPOT LISTS');
    console.log('='.repeat(80));
    console.log('\n1. HIGH PRIORITY - WIN-BACK LIST (0-90 days):');
    console.log('   Go to: Contacts > Lists > Create list');
    console.log('   Name: "🎯 Deleted Members - Win Back (0-90 days)"');
    console.log('   Filter: "Member Deleted Status" is "Deleted - Recent (Win Back)"');
    console.log('   Expected contacts: ' + recentDeletions.length);

    console.log('\n1b. MEDIUM PRIORITY - RECENT CHURNED (91-180 days):');
    console.log('   Name: "⚠️ Deleted Members - Medium Term (91-180 days)"');
    console.log('   Filter: "Member Deleted Status" is "Deleted - Medium Term"');
    console.log('   Expected contacts: ' + mediumDeletions.length);

    console.log('\n1c. LONG-TERM CHURNED (180+ days):');
    console.log('   Name: "📊 Deleted Members - Long Term (180+ days)"');
    console.log('   Filter: "Member Deleted Status" is "Deleted - Long Term"');
    console.log('   Expected contacts: ' + longDeletions.length);

    console.log('\n2. HIGH-VALUE DELETED MEMBERS:');
    console.log('   Name: "💰 Deleted High-Value Members ($1000+)"');
    console.log('   Filters:');
    console.log('   - "Member Deleted Status" is "Deleted - Recent (Win Back)"');
    console.log('   - "Deleted Member Total Paid" contains "$1" OR contains "$2" OR contains "$3" OR contains "$4"');

    console.log('\n3. RECENT DELETIONS (Last 30 Days):');
    console.log('   Name: "🔥 Deleted Members - Last 30 Days (Hot Leads)"');
    console.log('   Filters:');
    console.log('   - "Member Deleted Status" is "Deleted - Recent (Win Back)"');
    console.log('   - "Days Since Last Payment (Deleted)" is less than 30');

    console.log('\n' + '='.repeat(80));
    console.log('WIN-BACK CAMPAIGN IDEAS BY CATEGORY');
    console.log('='.repeat(80));

    console.log('\n🎯 RECENT DELETIONS (0-90 days) - HIGH PRIORITY');
    console.log('   📧 EMAIL SEQUENCE:');
    console.log('      1. "We Miss You" - Personal note (Day 1)');
    console.log('      2. "What Changed?" - Survey (Day 3)');
    console.log('      3. "Special Offer" - 30% off to return (Day 7)');
    console.log('      4. "Final Chance" - Limited time offer (Day 14)');
    console.log('   📞 PERSONAL OUTREACH: For members who paid $2,000+');
    console.log('      - Personal phone call or video message');
    console.log('      - Custom re-engagement offer with VIP perks');

    console.log('\n⚠️ MEDIUM-TERM (91-180 days) - MODERATE PRIORITY');
    console.log('   📧 EMAIL SEQUENCE:');
    console.log('      1. "See What\'s New" - Highlight recent improvements');
    console.log('      2. "Feedback Matters" - Survey with incentive');
    console.log('      3. "Come Back Offer" - 40% off discount');
    console.log('   💬 Focus on what has changed/improved since they left');

    console.log('\n📊 LONG-TERM (180+ days) - LONG GAME');
    console.log('   📧 LIGHT TOUCH:');
    console.log('      1. Quarterly "What\'s New" updates');
    console.log('      2. Major feature announcements');
    console.log('      3. Community success stories');
    console.log('   🎯 Target high-value members ($10,000+) with personal outreach');

    console.log('\n💡 UNIVERSAL FEEDBACK LOOP:');
    console.log('   Survey questions for all categories:');
    console.log('   - Why did you leave?');
    console.log('   - What would bring you back?');
    console.log('   - What could we improve?');

    console.log('\n' + '='.repeat(80));
    console.log('POTENTIAL REVENUE RECOVERY');
    console.log('='.repeat(80));

    const recentRevenue = recentDeletions.reduce((sum, m) => sum + m.totalPaid, 0);
    const mediumRevenue = mediumDeletions.reduce((sum, m) => sum + m.totalPaid, 0);
    const longRevenue = longDeletions.reduce((sum, m) => sum + m.totalPaid, 0);
    const totalRevenue = recentRevenue + mediumRevenue + longRevenue;

    console.log(`\nREVENUE BY CATEGORY:`);
    console.log(`  Recent (0-90 days):      $${recentRevenue.toFixed(2)} (${recentDeletions.length} members)`);
    console.log(`  Medium (91-180 days):    $${mediumRevenue.toFixed(2)} (${mediumDeletions.length} members)`);
    console.log(`  Long-term (180+ days):   $${longRevenue.toFixed(2)} (${longDeletions.length} members)`);
    console.log(`  TOTAL LIFETIME REVENUE:  $${totalRevenue.toFixed(2)} (${deletedMembers.length} members)`);

    console.log(`\nWIN-BACK PROJECTIONS (Conservative estimates):`);
    const recentWinBack = recentRevenue * 0.15;  // 15% win-back rate for recent
    const mediumWinBack = mediumRevenue * 0.10;  // 10% win-back rate for medium
    const longWinBack = longRevenue * 0.05;      // 5% win-back rate for long-term
    const totalWinBack = recentWinBack + mediumWinBack + longWinBack;

    console.log(`  Recent (15% win-back):   $${recentWinBack.toFixed(2)}`);
    console.log(`  Medium (10% win-back):   $${mediumWinBack.toFixed(2)}`);
    console.log(`  Long-term (5% win-back): $${longWinBack.toFixed(2)}`);
    console.log(`  TOTAL ESTIMATED RECOVERY: $${totalWinBack.toFixed(2)}`);
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

tagDeletedForWinback();
