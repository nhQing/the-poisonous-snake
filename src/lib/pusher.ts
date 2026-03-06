import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
export const pusherServer = new PusherServer({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
    useTLS: true,
});

// Client-side Pusher instance singleton
let pusherClientInstance: PusherClient | null = null;
export const getPusherClient = () => {
    if (typeof window === 'undefined') return null;
    if (!pusherClientInstance) {
        pusherClientInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
            cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
            authEndpoint: '/api/pusher/auth',
        });
    }
    return pusherClientInstance;
};
