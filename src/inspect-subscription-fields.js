import dotenv from 'dotenv';
import { MightyNetworksClient } from './clients/mightyClient.js';

dotenv.config();

async function inspectSubscriptionFields() {
  const mightyClient = new MightyNetworksClient(
    process.env.MIGHTY_API_KEY,
    process.env.MIGHTY_NETWORK_ID
  );

  const response = await mightyClient.getSubscriptions(1);
  const items = response.items || [];

  console.log(`Total items on page 1: ${items.length}`);
  console.log(`Total in dataset: ${response.meta?.total_count ?? 'unknown'}\n`);

  // Show ALL top-level fields from first item
  const sample = items[0];
  console.log('=== ALL FIELDS ON SUBSCRIPTION ITEM ===\n');
  for (const [key, val] of Object.entries(sample)) {
    const preview = typeof val === 'object' && val !== null
      ? JSON.stringify(val).substring(0, 120)
      : String(val);
    console.log(`${key}: ${preview}`);
  }

  // Specifically look for status/deactivation fields
  console.log('\n=== STATUS / DEACTIVATION FIELDS ===\n');
  const statusKeys = Object.keys(sample).filter(k =>
    /status|deactivat|delet|remov|suspend|block|active|disabled|left|exit/i.test(k)
  );
  if (statusKeys.length === 0) {
    console.log('None found at top level — checking nested objects...');
    for (const [key, val] of Object.entries(sample)) {
      if (typeof val === 'object' && val !== null) {
        const nestedKeys = Object.keys(val).filter(k =>
          /status|deactivat|delet|remov|suspend|block|active|disabled|left|exit/i.test(k)
        );
        if (nestedKeys.length > 0) {
          console.log(`\nFound in "${key}":`);
          for (const nk of nestedKeys) {
            console.log(`  ${key}.${nk}: ${val[nk]}`);
          }
        }
      }
    }
  } else {
    for (const k of statusKeys) {
      console.log(`${k}: ${JSON.stringify(sample[k])}`);
    }
  }

  // Show a canceled example if one exists on this page
  console.log('\n=== CANCELED MEMBER EXAMPLE (if any on page 1) ===\n');
  const canceledExample = items.find(m => m.subscription?.canceled_at);
  if (canceledExample) {
    console.log('Found a canceled member. Full object:');
    console.log(JSON.stringify(canceledExample, null, 2));
  } else {
    console.log('No canceled members on page 1. Checking page 2...');
    const page2 = await mightyClient.getSubscriptions(2);
    const canceledPage2 = (page2.items || []).find(m => m.subscription?.canceled_at);
    if (canceledPage2) {
      console.log(JSON.stringify(canceledPage2, null, 2));
    } else {
      console.log('No canceled members found on pages 1-2 either.');
    }
  }
}

inspectSubscriptionFields().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
