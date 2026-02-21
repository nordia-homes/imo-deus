'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/lead-scoring.ts';
import '@/ai/flows/property-matcher.ts';
import '@/ai/flows/property-description-generator.ts';
import '@/ai/flows/chat.ts';
import '@/ai/flows/property-insights-generator.ts';
import '@/ai/flows/email-generator.ts';
import '@/ai/flows/report-summarizer.ts';
import '@/ai/flows/property-presentation-generator.ts';
import '@/ai/flows/cma-generator.ts';
import '@/ai/flows/social-media-post-generator.ts';
import '@/ai/flows/update-buyer-preferences.ts';
import '@/ai/flows/preferences-chat.ts';
import '@/ai/flows/schedule-viewing.ts';
