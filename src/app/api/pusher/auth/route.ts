import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

export async function POST(req: Request) {
    try {
        const data = await req.formData();
        const socketId = data.get('socket_id') as string;
        const channelName = data.get('channel_name') as string;

        // In a real app we'd verify session here. For now, we allow the client
        // to pass their chosen name and avatar URL (passed as headers or extra form data in pusher config).
        // Let's just generate a random ID for them.
        const presenceData = {
            user_id: `player_${Math.random().toString(36).substr(2, 9)}`,
            user_info: {
                // Will be hydrated by the client events or simple messages
            }
        };

        const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
        return NextResponse.json(authResponse);

    } catch (error) {
        console.error('Pusher auth error', error);
        return new NextResponse('Forbidden', { status: 403 });
    }
}
