import dotenv from 'dotenv';
import express from 'express';
import Stripe from 'stripe';
import { HubSpotClient } from './clients/hubspotClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3000;
const WEBHOOK_SECRET = process.env.MIGHTY_WEBHOOK_SECRET;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Helpers ────────────────────────────────────────────────────────────────

function log(source, event, email, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${source}] [${event}] ${email || '?'} — ${message}`);
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

// ── Stripe webhook ─────────────────────────────────────────────────────────
// IMPORTANT: Must be registered BEFORE app.use(express.json()) to preserve raw body

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  if (STRIPE_WEBHOOK_SECRET) {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn(`[Stripe] Signature verification failed: ${err.message}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    event = JSON.parse(req.body);
  }

  const hubspot = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    switch (event.type) {

      // ── Subscription upgraded (free → premium) ───────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const email = customer.email?.toLowerCase();
        if (!email) break;

        const contact = await hubspot.findContactByEmail(email);
        if (!contact) break;

        const stripeStatus = subscription.status; // active, past_due, canceled, etc.
        let mightyStatus, mightyPlanType;

        if (stripeStatus === 'active') {
          mightyStatus = 'active';
          mightyPlanType = 'premium';
        } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
          mightyStatus = 'past_due';
          mightyPlanType = 'premium'; // still premium, just payment overdue
        } else {
          mightyStatus = 'canceled';
          mightyPlanType = 'canceled';
        }

        const properties = {
          stripe_subscription_status: stripeStatus,
          mighty_subscription_status: mightyStatus,
          mighty_plan_type: mightyPlanType,
        };

        // If cancellation is scheduled (cancel_at_period_end) but not yet active
        if (subscription.cancel_at_period_end && subscription.cancel_at) {
          properties.mighty_canceled_at = new Date(subscription.cancel_at * 1000).toISOString().split('T')[0];
        }

        await hubspot.client.crm.contacts.basicApi.update(contact.id, { properties });
        log('Stripe', event.type, email, `stripe status: ${stripeStatus} → mighty: ${mightyStatus}`);
        break;
      }

      // ── Subscription canceled/deleted (premium → free or deleted) ────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const email = customer.email?.toLowerCase();
        if (!email) break;

        const contact = await hubspot.findContactByEmail(email);
        if (!contact) break;

        const canceledDate = subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const daysSince = Math.floor(
          (Date.now() - (subscription.canceled_at * 1000 || Date.now())) / (1000 * 60 * 60 * 24)
        );

        await hubspot.client.crm.contacts.basicApi.update(contact.id, {
          properties: {
            stripe_subscription_status: 'canceled',
            mighty_subscription_status: 'canceled',
            mighty_plan_type: 'canceled',
            mighty_canceled_at: canceledDate,
            mighty_subscription_canceled_at: canceledDate,
            mighty_downgraded_to_free_at: canceledDate,
            mighty_days_since_cancellation: daysSince,
          }
        });
        log('Stripe', event.type, email, `marked as canceled (${canceledDate})`);
        break;
      }

      // ── Payment succeeded → update last payment date ─────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.amount_paid === 0) break; // skip $0 invoices

        const customer = await stripe.customers.retrieve(invoice.customer);
        const email = customer.email?.toLowerCase();
        if (!email) break;

        const contact = await hubspot.findContactByEmail(email);
        if (!contact) break;

        const paymentDate = new Date(invoice.created * 1000).toISOString().split('T')[0];
        const paymentAmount = `$${(invoice.amount_paid / 100).toFixed(2)}`;

        await hubspot.client.crm.contacts.basicApi.update(contact.id, {
          properties: {
            stripe_last_payment_date: paymentDate,
            stripe_last_payment_amount: paymentAmount,
            stripe_subscription_status: 'active',
            mighty_subscription_status: 'active',
            mighty_plan_type: 'premium',
          }
        });
        log('Stripe', event.type, email, `payment ${paymentAmount} on ${paymentDate}`);
        break;
      }

      // ── Payment failed → flag as past due ────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const email = customer.email?.toLowerCase();
        if (!email) break;

        const contact = await hubspot.findContactByEmail(email);
        if (!contact) break;

        await hubspot.client.crm.contacts.basicApi.update(contact.id, {
          properties: {
            stripe_subscription_status: 'past_due',
            mighty_subscription_status: 'past_due',
          }
        });
        log('Stripe', event.type, email, 'payment failed — marked as past_due');
        break;
      }

      default:
        // Ignore other Stripe events
    }

    res.json({ ok: true, type: event.type });

  } catch (error) {
    console.error(`[Stripe ERROR] ${event.type} — ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ── Global JSON parsing (after Stripe route) ───────────────────────────────

app.use(express.json());

// ── Mighty Networks webhook ────────────────────────────────────────────────

app.post('/webhooks/mighty', async (req, res) => {
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
    log('Mighty', event, null, 'No email in payload — skipping');
    return res.status(200).json({ ok: true, skipped: true });
  }

  log('Mighty', event, email, 'Received');

  const hubspot = new HubSpotClient(process.env.HUBSPOT_ACCESS_TOKEN);

  try {
    switch (event) {

      // ── Member created ───────────────────────────────────────────────
      case 'member.created': {
        const existing = await hubspot.findContactByEmail(email);
        const properties = buildContactProperties(data, deriveSubscriptionStatus(data));

        if (existing) {
          await hubspot.client.crm.contacts.basicApi.update(existing.id, { properties });
          log('Mighty', event, email, `Updated existing HubSpot contact (ID: ${existing.id})`);
        } else {
          await hubspot.client.crm.contacts.basicApi.create({
            properties: {
              ...properties,
              email,
              firstname: data.first_name || '',
              lastname: data.last_name || ''
            }
          });
          log('Mighty', event, email, 'Created new HubSpot contact');
        }
        break;
      }

      // ── Member updated ───────────────────────────────────────────────
      case 'member.updated': {
        const contact = await hubspot.findContactByEmail(email);
        const properties = buildContactProperties(data, deriveSubscriptionStatus(data));

        if (contact) {
          await hubspot.client.crm.contacts.basicApi.update(contact.id, { properties });
          log('Mighty', event, email, `Updated — status: ${properties.mighty_subscription_status}`);
        } else {
          log('Mighty', event, email, 'Contact not found in HubSpot — skipping update');
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
              member_deleted_status: 'deleted_recent'
            }
          });
          log('Mighty', event, email, `Marked as DELETED in HubSpot (ID: ${contact.id})`);
        } else {
          log('Mighty', event, email, 'Contact not found in HubSpot — nothing to mark deleted');
        }
        break;
      }

      default:
        log('Mighty', event, email, 'Unhandled event type — ignored');
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
  console.log(`\nWebhook Server running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /webhooks/mighty  ← Mighty Networks events`);
  console.log(`  POST /webhooks/stripe  ← Stripe events`);
  console.log(`  GET  /health           ← Health check`);
  console.log(`\nMighty events: member.created, member.updated, member.deleted`);
  console.log(`Stripe events: subscription.created/updated/deleted, invoice.payment_succeeded/failed\n`);
});
