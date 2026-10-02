import { NextRequest } from 'next/server';
import { verifyWebhook, receiveWebhook } from '@/lib/communications/webhook-handler';
export const runtime = 'nodejs';
export const GET = verifyWebhook;
export const POST = (request: NextRequest) => receiveWebhook(request, false);
