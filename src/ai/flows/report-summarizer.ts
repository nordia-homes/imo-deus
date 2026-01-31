'use server';
/**
 * @fileOverview An AI agent to analyze and summarize performance reports.
 *
 * - summarizeReport - A function that generates a summary and recommendations.
 * - SummarizeReportInput - The input type for the function.
 * - SummarizeReportOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SalesDataSchema = z.object({
  month: z.string(),
  sales: z.number(),
});

const LeadSourceDataSchema = z.object({
  source: z.string(),
  count: z.number(),
  fill: z.string(),
});

const KpiSchema = z.object({
    totalWonLeads: z.number(),
    conversionRate: z.number(),
    averageDealSize: z.number(),
});

export const SummarizeReportInputSchema = z.object({
    salesData: z.array(SalesDataSchema).describe("Monthly sales volume data."),
    leadSourceData: z.array(LeadSourceDataSchema).describe("Data on the count of leads from different sources."),
    kpis: KpiSchema.describe("Key Performance Indicators including total won leads, conversion rate (%), and average deal size (€)."),
});
export type SummarizeReportInput = z.infer<typeof SummarizeReportInputSchema>;

export const SummarizeReportOutputSchema = z.object({
  summary: z.string().describe("A concise, overall summary of the business performance in Romanian, written in a paragraph."),
  recommendations: z.string().describe("A bulleted list of 3-4 actionable recommendations in Romanian based on the data, formatted as a single string with each point starting with a hyphen '-' and separated by a newline '\\n'."),
});
export type SummarizeReportOutput = z.infer<typeof SummarizeReportOutputSchema>;

export async function summarizeReport(input: SummarizeReportInput): Promise<SummarizeReportOutput> {
  return summarizeReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeReportPrompt',
  input: {schema: SummarizeReportInputSchema},
  output: {schema: SummarizeReportOutputSchema},
  prompt: `You are a professional real estate business analyst. Your task is to analyze the following performance data for a real estate agency in Romania and provide a concise summary and actionable recommendations. The language for the output must be Romanian.

  **Key Performance Indicators (KPIs):**
  - Total Won Leads: {{{kpis.totalWonLeads}}}
  - Conversion Rate: {{{kpis.conversionRate.toFixed(1)}}}%
  - Average Deal Size: €{{{kpis.averageDealSize.toLocaleString()}}}

  **Monthly Sales Data:**
  {{#each salesData}}
  - {{{this.month}}}: €{{{this.sales.toLocaleString()}}}
  {{/each}}

  **Lead Source Distribution:**
  {{#each leadSourceData}}
  - {{{this.source}}}: {{{this.count}}} leads
  {{/each}}

  **Your Tasks:**
  1.  **Summary:** Write a brief, insightful summary (one paragraph) of the overall performance. Mention the strong points and the areas that need attention.
  2.  **Recommendations:** Provide 3-4 clear, actionable recommendations in a bulleted list format. These should help the agency improve its sales, marketing, or operational efficiency based *only* on the data provided. For example, if one lead source is dominant, suggest focusing more resources on it. If sales show high volatility, suggest investigating the cause. Each recommendation should start with a hyphen.
  `,
});

const summarizeReportFlow = ai.defineFlow(
  {
    name: 'summarizeReportFlow',
    inputSchema: SummarizeReportInputSchema,
    outputSchema: SummarizeReportOutputSchema,
  },
  async input => {
    // Ensure there is data to process
    if (input.salesData.length === 0 && input.leadSourceData.length === 0) {
        return {
            summary: "Nu există suficiente date pentru a genera o analiză. Adăugați mai multe lead-uri și tranzacții câștigate.",
            recommendations: "- Adaugă lead-uri noi.\n- Închide tranzacții pentru a înregistra vânzări."
        }
    }
    const {output} = await prompt(input);
    return output!;
  }
);
