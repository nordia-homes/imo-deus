import { config } from 'dotenv';
config();

import '@/ai/flows/lead-scoring.ts';
import '@/ai/flows/property-matcher.ts';
import '@/ai/flows/property-description-generator.ts';
import '@/ai/flows/chat.ts';
