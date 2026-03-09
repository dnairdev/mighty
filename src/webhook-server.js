import dotenv from 'dotenv';
import express from 'express';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3000;
const WEBHOOK_SECRET = process.env.MIGHTY_WEBHOOK_SECRET; // optional signature verification

app.use(express.json());

// ── Helpers ────────────────────────────────────────────────────────────────

function log(event, email, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${event}] ${email || '?'} — ${message}`);
}

function deriveSubscriptionStatus(member) {
  const planType = member.plan?.type || 'unknown';
  const isCanceled = !!member.subscription?.canceled_at;

  if (planType === 'subscription' && !isCanceled) return 'active';
  if (planType === 'subscription' && isCanceled) return 'canceled';
  return 'free';
}

function derivePlanType(member) {
  const planType = member.plan?.type || 'unknown';
  const isCanceled = !!member.subscription?.canceled_at;

  if (planType === 'subscription' && !isCanceled) return 'premium';
  if (planType === 'subscription' && isCanceled) return 'canceled';
  return 'free';
}

function buildContactProperties(member, status) {
  const planType = member.plan?.type || 'unknown';
  const planAmount = member.plan?.amount || 0;
  const planInterval = member.plan?.interval || 'month';
  const isCanceled = !!member.subscription?.canceled_at;

  const properties = {
    mighty_member_id: member.member_id?.toString() || member.id?.toString() || '',
    mighty_plan_name: member.plan?.name || 'Unknown',
    mighty_plan_type: derivePlanType(member),
    mighty_plan_price: planAmount > 0 ? `$${(planAmount / 100).toFixed(0)}/${planInterval}` : 'Free',
    mighty_subscription_status: status || deriveSubscriptionStatus(member),
  };

  if (member.created_at) {
    properties.mighty_member_joined = member.created_at.split('T')[0];
  }

  if (member.location) {
    properties.mighty_location = member.location;
  }

  if (member.subscription?.purchased_at) {
    properties.mighty_subscription_start = member.subscription.purchased_at.split('T')[0];
  }

  if (isCanceled && member.subscription?.canceled_at) {
    const canceledDate = member.subscription.canceled_at.split('T')[0];
    properties.mighty_canceled_at = canceledDate;
    properties.mighty_subscription_canceled_at = canceledDate;

    if (planType === 'subscription') {
      properties.mighty_downgraded_to_free_at = canceledDate;
    }

    const daysSince = Math.floor(
      (Date.now() - new Date(member.subscription.canceled_at)) / (1000 * 60 * 60 * 24)
    );
    properties.mighty_days_since_cancellation = daysSince;
  }

  return properties;
}

// ── Webhook endpoint ───────────────────────────────────────────────────────

app.post('/webhooks/mighty', async (req, res) => {
  // Optional: verify webhook secret header if Mighty sends one
  if (WEBHOOK_SECRET) {
    const signature = req.headers['x-mighty-signature'] || req.headers['x-webhook-secret'];
    if (signature !== WEBHOOK_SECRET) {
      console.warn('Webhook received with invalid signature — rejected');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: 'Missing event or data' });
  }

  const email = data.email?.toLowerCase();
  if (!email) {
    log(event, null, 'No email in payload — skipping');
    return res.status(200).json({ ok: true, skipped: true });
  }

  log(event, email, 'Received');

  const hubspot = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    switch (event) {

      // ── Member created ───────────────────────────────────────────────
      case 'member.created': {
        const existing = await hubspot.findContactByEmail(email);
        const properties = buildContactProperties(data, deriveSubscriptionStatus(data));

        if (existing) {
          await hubspot.client.crm.contacts.basicApi.update(existing.id, { properties });
          log(event, email, `Updated existing HubSpot contact (ID: ${existing.id})`);
        } else {
          await hubspot.client.crm.contacts.basicApi.create({
            properties: {
              ...properties,
              email,
              firstname: data.first_name || '',
              lastname: data.last_name || ''
            }
          });
          log(event, email, 'Created new HubSpot contact');
        }
        break;
      }

      // ── Member updated ───────────────────────────────────────────────
      case 'member.updated': {
        const contact = await hubspot.findContactByEmail(email);
        const properties = buildContactProperties(data, deriveSubscriptionStatus(data));

        if (contact) {
          await hubspot.client.crm.contacts.basicApi.update(contact.id, { properties });
          log(event, email, `Updated HubSpot contact — status: ${properties.mighty_subscription_status}`);
        } else {
          log(event, email, 'Contact not found in HubSpot — skipping update');
        }
        break;
      }

      // ── Member deleted ───────────────────────────────────────────────
      case 'member.deleted': {
        const contact = await hubspot.findContactByEmail(email);

        if (contact) {
          await hubspot.client.crm.contacts.basicApi.update(contact.id, {
            properties: {
              mighty_subscription_status: 'deleted',
              mighty_plan_type: 'canceled',
              member_deleted_status: 'deleted_recent' // will be recategorized on next tag-winback run
            }
          });
          log(event, email, `Marked as DELETED in HubSpot (ID: ${contact.id})`);
        } else {
          log(event, email, 'Contact not found in HubSpot — nothing to mark deleted');
        }
        break;
      }

      default:
        log(event, email, `Unhandled event type — ignored`);
    }

    res.status(200).json({ ok: true, event, email });

  } catch (error) {
    console.error(`[ERROR] [${event}] ${email} — ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ── Health check ───────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nMighty Networks Webhook Server running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST http://localhost:${PORT}/webhooks/mighty  ← Mighty sends events here`);
  console.log(`  GET  http://localhost:${PORT}/health           ← Health check`);
  console.log(`\nListening for events:`);
  console.log(`  member.created  → Create/update HubSpot contact`);
  console.log(`  member.updated  → Update HubSpot contact`);
  console.log(`  member.deleted  → Set status to "deleted" in HubSpot`);
  console.log(`\nTo expose publicly for Mighty to reach, run:`);
  console.log(`  ngrok http ${PORT}`);
  console.log(`  Then set the ngrok URL in Mighty Networks dashboard as your webhook URL\n`);
});
