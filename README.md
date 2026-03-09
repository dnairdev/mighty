# Mighty Networks to HubSpot Integration

This integration syncs members and activities from Mighty Networks to HubSpot.

## Features

- Syncs Mighty Networks members to HubSpot contacts
- Tracks member spaces and roles
- Deduplicates members across multiple spaces
- Creates custom HubSpot properties for Mighty data
- Updates existing contacts or creates new ones

## Prerequisites

1. **Mighty Networks API Key**: Your API key starting with `mn_`
2. **Mighty Networks Network ID**: Your network identifier
3. **HubSpot Private App Access Token**: Create one in HubSpot Settings > Integrations > Private Apps

### Getting Your HubSpot Access Token

1. Go to HubSpot Settings (gear icon)
2. Navigate to Integrations > Private Apps
3. Click "Create a private app"
4. Name it "Mighty Networks Integration"
5. Go to "Scopes" tab and enable:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.schemas.contacts.read`
   - `crm.schemas.contacts.write`
6. Click "Create app" and copy the access token

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from the example:
```bash
cp .env.example .env
```

3. Edit `.env` and add your credentials:
```env
MIGHTY_API_KEY=mn_9cb98875a53d54def55d76d7d6905f3301bb9bb5f712376d2ac69acb48c3070c
MIGHTY_NETWORK_ID=your_network_id_here
HUBSPOT_ACCESS_TOKEN=your_hubspot_token_here
```

## Usage

### Test Connections
```bash
npm test
```

This will verify that both API connections are working.

### Run Sync
```bash
npm run sync
```

This will:
1. Fetch all members from Mighty Networks
2. Create/update contacts in HubSpot
3. Add custom properties with Mighty data

### Automated Sync

To run the sync automatically, you can use a scheduler like `cron` (Linux/Mac) or Task Scheduler (Windows).

Example cron job (runs every hour):
```bash
0 * * * * cd /Users/diyanair/Desktop/mighty && npm run sync
```

## Data Mapping

Mighty Networks → HubSpot:
- `user_id` → `mighty_user_id` (custom property)
- `email` → `email`
- `first_name` → `firstname`
- `last_name` → `lastname`
- `created_at` → `mighty_member_since` (custom property)
- `spaces` → `mighty_spaces` (custom property, comma-separated)
- `role` → `mighty_role` (custom property)

## Custom Properties Created

The integration automatically creates these custom properties in HubSpot:
- `mighty_user_id`: User ID from Mighty Networks
- `mighty_member_since`: When the user joined
- `mighty_spaces`: Comma-separated list of spaces they're in
- `mighty_role`: Their role (member, admin, etc.)

## Troubleshooting

### Mighty Networks API Errors
- Verify your API key starts with `mn_`
- Check that your network ID is correct
- Ensure you have admin access to your network

### HubSpot API Errors
- Verify your access token is valid
- Check that you've enabled the required scopes
- Make sure you haven't exceeded HubSpot API rate limits

## Future Enhancements

- Timeline events for member activities
- Webhook support for real-time sync
- Custom field mapping configuration
- Activity tracking and engagement metrics

## License

ISC
