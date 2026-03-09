import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function generateConversionReport() {
  console.log('Generating Conversion Report...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Fetch all subscriptions
    const allSubscriptions = await mightyClient.getAllSubscriptions();
    console.log(`\nAnalyzing ${allSubscriptions.length} subscriptions...\n`);

    // Filter to paid members only
    const paidMembers = allSubscriptions.filter(m => m.plan?.type === 'subscription');
    const canceledMembers = paidMembers.filter(m => m.subscription?.canceled_at);
    const activeMembers = paidMembers.filter(m => !m.subscription?.canceled_at);

    // Analyze conversion data
    const conversions = [];
    const directSignups = [];
    const unknownDates = [];

    for (const member of paidMembers) {
      const joinedDate = member.created_at ? new Date(member.created_at) : null;
      const purchasedDate = member.subscription?.purchased_at ? new Date(member.subscription.purchased_at) : null;

      if (!joinedDate || !purchasedDate) {
        unknownDates.push(member);
        continue;
      }

      const daysDiff = Math.round((purchasedDate - joinedDate) / (1000 * 60 * 60 * 24));
      const isCanceled = !!member.subscription?.canceled_at;

      const memberData = {
        email: member.email,
        name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
        location: member.location || 'N/A',
        planName: member.plan?.name || 'Unknown',
        planPrice: member.plan?.amount ? `$${member.plan.amount / 100}/${member.plan.interval}` : 'N/A',
        joinedDate: member.created_at?.split('T')[0],
        purchasedDate: member.subscription?.purchased_at?.split('T')[0],
        daysToPurchase: daysDiff,
        status: isCanceled ? 'Canceled' : 'Active',
        canceledDate: member.subscription?.canceled_at?.split('T')[0] || null
      };

      if (daysDiff > 0) {
        conversions.push(memberData);
      } else {
        directSignups.push(memberData);
      }
    }

    // Sort conversions by days to purchase (longest first)
    conversions.sort((a, b) => b.daysToPurchase - a.daysToPurchase);

    // Sort direct signups by date
    directSignups.sort((a, b) => new Date(b.purchasedDate) - new Date(a.purchasedDate));

    // =====================
    // PRINT REPORT
    // =====================

    console.log('='.repeat(100));
    console.log('PAID MEMBER CONVERSION REPORT');
    console.log('='.repeat(100));
    console.log('');

    // Summary stats
    console.log('SUMMARY');
    console.log('-'.repeat(50));
    console.log(`  Total paid members (ever):        ${paidMembers.length}`);
    console.log(`  Active paid members:              ${activeMembers.length}`);
    console.log(`  Canceled paid members:            ${canceledMembers.length}`);
    console.log('');
    console.log(`  Converted (was free first):       ${conversions.length} (${((conversions.length / paidMembers.length) * 100).toFixed(1)}%)`);
    console.log(`  Direct signups (paid immediately): ${directSignups.length} (${((directSignups.length / paidMembers.length) * 100).toFixed(1)}%)`);
    console.log('');

    // Conversion time analysis
    if (conversions.length > 0) {
      const avgDays = Math.round(conversions.reduce((sum, m) => sum + m.daysToPurchase, 0) / conversions.length);
      const maxDays = Math.max(...conversions.map(m => m.daysToPurchase));
      const minDays = Math.min(...conversions.map(m => m.daysToPurchase));

      console.log('CONVERSION TIME ANALYSIS');
      console.log('-'.repeat(50));
      console.log(`  Average days to convert:          ${avgDays} days`);
      console.log(`  Shortest conversion:              ${minDays} days`);
      console.log(`  Longest conversion:               ${maxDays} days`);
      console.log('');

      // Breakdown by time buckets
      const within7Days = conversions.filter(m => m.daysToPurchase <= 7).length;
      const within30Days = conversions.filter(m => m.daysToPurchase > 7 && m.daysToPurchase <= 30).length;
      const within90Days = conversions.filter(m => m.daysToPurchase > 30 && m.daysToPurchase <= 90).length;
      const over90Days = conversions.filter(m => m.daysToPurchase > 90).length;

      console.log('CONVERSION TIME BUCKETS');
      console.log('-'.repeat(50));
      console.log(`  Within 7 days:                    ${within7Days} members`);
      console.log(`  8-30 days:                        ${within30Days} members`);
      console.log(`  31-90 days:                       ${over90Days} members`);
      console.log(`  Over 90 days:                     ${over90Days} members`);
      console.log('');
    }

    // =====================
    // DETAILED LISTS
    // =====================

    console.log('='.repeat(100));
    console.log('CONVERTED MEMBERS (Was Free, Then Upgraded)');
    console.log('='.repeat(100));
    console.log('');

    if (conversions.length === 0) {
      console.log('  No conversions found.\n');
    } else {
      console.log(
        'Name'.padEnd(25) +
        'Email'.padEnd(35) +
        'Days'.padStart(6) +
        'Joined'.padStart(14) +
        'Purchased'.padStart(14) +
        'Status'.padStart(10)
      );
      console.log('-'.repeat(104));

      for (const m of conversions) {
        console.log(
          (m.name || 'N/A').substring(0, 24).padEnd(25) +
          m.email.substring(0, 34).padEnd(35) +
          m.daysToPurchase.toString().padStart(6) +
          m.joinedDate.padStart(14) +
          m.purchasedDate.padStart(14) +
          m.status.padStart(10)
        );
      }
      console.log('');
    }

    console.log('='.repeat(100));
    console.log('DIRECT SIGNUPS (Paid Immediately on Join)');
    console.log('='.repeat(100));
    console.log('');

    if (directSignups.length === 0) {
      console.log('  No direct signups found.\n');
    } else {
      console.log(
        'Name'.padEnd(25) +
        'Email'.padEnd(35) +
        'Joined'.padStart(14) +
        'Plan'.padStart(20) +
        'Status'.padStart(10)
      );
      console.log('-'.repeat(104));

      for (const m of directSignups) {
        console.log(
          (m.name || 'N/A').substring(0, 24).padEnd(25) +
          m.email.substring(0, 34).padEnd(35) +
          m.joinedDate.padStart(14) +
          m.planPrice.padStart(20) +
          m.status.padStart(10)
        );
      }
      console.log('');
    }

    // Canceled members detail
    const canceledConverts = conversions.filter(m => m.status === 'Canceled');
    const canceledDirect = directSignups.filter(m => m.status === 'Canceled');

    if (canceledConverts.length > 0 || canceledDirect.length > 0) {
      console.log('='.repeat(100));
      console.log('CANCELED PAID MEMBERS');
      console.log('='.repeat(100));
      console.log('');

      const allCanceled = [...canceledConverts, ...canceledDirect];
      console.log(
        'Name'.padEnd(25) +
        'Email'.padEnd(35) +
        'Purchased'.padStart(14) +
        'Canceled'.padStart(14) +
        'Type'.padStart(12)
      );
      console.log('-'.repeat(100));

      for (const m of allCanceled) {
        const conversionType = m.daysToPurchase > 0 ? 'Converted' : 'Direct';
        console.log(
          (m.name || 'N/A').substring(0, 24).padEnd(25) +
          m.email.substring(0, 34).padEnd(35) +
          m.purchasedDate.padStart(14) +
          (m.canceledDate || 'N/A').padStart(14) +
          conversionType.padStart(12)
        );
      }
      console.log('');
    }

    console.log('='.repeat(100));
    console.log('REPORT COMPLETE');
    console.log('='.repeat(100));

  } catch (error) {
    console.error('Error generating report:', error.message);
    console.error(error.stack);
  }
}

generateConversionReport();
