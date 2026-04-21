import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

type ClerkEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    phone_numbers?: Array<{ phone_number: string }>;
    first_name?: string | null;
  };
};

http.route({
  path: '/clerk-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      return new Response('Missing CLERK_WEBHOOK_SECRET', { status: 500 });
    }

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing Svix headers', { status: 400 });
    }

    const body = await req.text();
    let event: ClerkEvent;
    try {
      event = new Webhook(secret).verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkEvent;
    } catch {
      return new Response('Invalid signature', { status: 401 });
    }

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const email = event.data.email_addresses?.[0]?.email_address;
        if (!email) {
          return new Response('No email on user', { status: 400 });
        }
        await ctx.runMutation(internal.users.syncFromClerk, {
          clerkId: event.data.id,
          email,
          phoneNumber: event.data.phone_numbers?.[0]?.phone_number,
          displayName: event.data.first_name ?? 'Friend',
        });
        break;
      }
      case 'user.deleted':
        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: event.data.id,
        });
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
