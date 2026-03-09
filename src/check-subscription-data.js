import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function checkSubscriptionData() {
  console.log('🔍 Checking actual subscription data from Mighty Networks...\n');

  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  try {
    // Get first 10 members to check
    const membersResponse = await mightyClient.getNetworkMembers(1);
    const sampleMembers = membersResponse.items.slice(0, 10);

    console.log(`Checking ${sampleMembers.length} sample members:\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const member of sampleMembers) {
      console.log(`📧 Email: ${member.email}`);
      console.log(`👤 Name: ${member.first_name} ${member.last_name}`);

      // Show raw plan data
      console.log('\n📊 RAW PLAN DATA:');
      if (member.plan) {
        console.log(JSON.stringify(member.plan, null, 2));
      } else {
        console.log('  ❌ No plan object found');
      }

      // Show raw subscription data
      console.log('\n💳 RAW SUBSCRIPTION DATA:');
      if (member.subscription) {
        console.log(JSON.stringify(member.subscription, null, 2));
      } else {
        console.log('  ❌ No subscription object found');
      }

      // Show categories (for cohort years)
      console.log('\n📁 CATEGORIES:');
      if (member.categories && member.categories.length > 0) {
        console.log(`  ${member.categories.map(c => c.title).join(', ')}`);
      } else {
        console.log('  ❌ No categories');
      }

      // Show location
      console.log('\n📍 LOCATION:');
      console.log(`  ${member.location || '❌ No location'}`);

      // Show what the script would classify this as
      console.log('\n🤖 SCRIPT CLASSIFICATION:');
      const rawPlanType = member.plan?.type || 'unknown';
      const isCanceled = !!member.subscription?.canceled_at;
      const isPremium = rawPlanType === 'subscription' && !isCanceled;

      let planType;
      if (rawPlanType === 'subscription' && !isCanceled) {
        planType = 'premium';
      } else if (rawPlanType === 'subscription' && isCanceled) {
        planType = 'canceled';
      } else {
        planType = 'free';
      }

      console.log(`  Plan Type: ${planType}`);
      console.log(`  Is Premium: ${isPremium}`);
      console.log(`  Status: ${isCanceled ? 'canceled' : 'active'}`);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    console.log('✅ Check complete!\n');
    console.log('⚠️  IMPORTANT: Review the data above and verify:');
    console.log('   1. Does the classification match what you expect?');
    console.log('   2. Are paid members showing as "premium" and is_premium = true?');
    console.log('   3. Are free members showing as "free" and is_premium = false?');
    console.log('   4. Are canceled subscriptions properly detected?\n');

  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error(error.stack);
  }
}

checkSubscriptionData();
