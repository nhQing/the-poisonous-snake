import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { imageBase64 } = await req.json();

        if (!imageBase64) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        // Strip the "data:image/jpeg;base64," part
        const base64Data = imageBase64.split(',')[1] || imageBase64;

        const { text } = await generateText({
            model: anthropic('claude-3-5-sonnet-latest'),
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'You are an AI assistant helping to monitor a game. Look at this image from a web camera. Count the exact number of human faces/people visible in this frame. Respond ONLY with a single integer number (e.g., "1", "2", "0"). Do not add any extra text.' },
                        {
                            type: 'image',
                            image: base64Data, // @ai-sdk handles passing this to Claude automatically
                        },
                    ],
                },
            ],
        });

        const count = parseInt(text.trim());
        return NextResponse.json({ count: isNaN(count) ? 1 : count });

    } catch (error) {
        console.error('Vision API error:', error);
        return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }
}
