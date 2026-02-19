'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ContactPreferences } from '@/lib/types';

// ==============================
// SCHEMA STATE
// ==============================

const ConversationStateSchema = z.object({
  buget_max: z.number().nullable(),
  camere: z.number().nullable(),
  zona_generala: z.string(),
  zona_specifica: z.string(),
  imobil_nou: z.boolean().nullable(),
  accepta_imobil_vechi: z.boolean().nullable(),
  an_minim_constructie: z.number().nullable(),
  scop_achizitie: z.string(),
  urgenta: z.string(),
  modalitate_plata: z.string(),
  preferinte: z.array(z.string()),
  mesaj_final: z.string(),
  pas_curent: z.number(),
  completat: z.boolean(),
});

type ConversationState = z.infer<typeof ConversationStateSchema>;


// ==============================
// INPUT / OUTPUT
// ==============================

const PreferencesChatInputSchema = z.object({
  prompt: z.string(),
  linkId: z.string(),
});

const PreferencesChatOutputSchema = z.object({
  response: z.string(),
});

export async function preferencesChat(
  input: z.infer<typeof PreferencesChatInputSchema>
): Promise<z.infer<typeof PreferencesChatOutputSchema>> {
  return preferencesChatFlow(input);
}


// ==============================
// FLOW DETERMINIST
// ==============================

const preferencesChatFlow = ai.defineFlow(
  {
    name: 'preferencesChatFlow',
    inputSchema: PreferencesChatInputSchema,
    outputSchema: PreferencesChatOutputSchema,
  },
  async (input) => {

    // 1️⃣ LUĂM CONTACTUL
    const linkRef = adminDb.collection('buyer-preferences-links').doc(input.linkId);
    const linkSnap = await linkRef.get();

    if (!linkSnap.exists) {
      throw new Error('Link invalid');
    }

    const { agencyId, contactId } = linkSnap.data()!;
    const contactRef = adminDb
      .collection('agencies')
      .doc(agencyId)
      .collection('contacts')
      .doc(contactId);

    const contactSnap = await contactRef.get();

    let state: ConversationState =
      contactSnap.data()?.preferencesCollected || {
        buget_max: null,
        camere: null,
        zona_generala: "",
        zona_specifica: "",
        imobil_nou: null,
        accepta_imobil_vechi: null,
        an_minim_constructie: null,
        scop_achizitie: "",
        urgenta: "",
        modalitate_plata: "",
        preferinte: [],
        mesaj_final: "",
        pas_curent: -1,
        completat: false,
      };

    // 2️⃣ PRIMUL MESAJ
    if (state.pas_curent === -1) {
      state.pas_curent = 0;

      await contactRef.update({
        preferencesCollected: state,
      });

      return {
        response:
          "Bună! Mă bucur că ai ajuns aici 😊 Ca să începem, spune-mi te rog care este bugetul tău maxim pentru achiziție?",
      };
    }

    // 3️⃣ EXTRAGERE DATE CU AI (DOAR JSON)
    const extractionPrompt = `
State actual:
${JSON.stringify(state)}

Răspuns utilizator:
"${input.prompt}"

Actualizează DOAR câmpurile relevante din JSON.
Returnează doar JSON valid.
`;

    const aiResponse = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: extractionPrompt,
      config: { temperature: 0.1 },
    });

    try {
      state = ConversationStateSchema.parse(JSON.parse(aiResponse.text));
    } catch {
      // dacă AI greșește, păstrăm state-ul anterior
    }

    // 4️⃣ CONTROL PAS
    let nextStep = state.pas_curent + 1;

    // Dacă NU acceptă imobil vechi, sărim pasul 6
    if (nextStep === 6 && state.accepta_imobil_vechi === false) {
      nextStep = 7;
    }

    state.pas_curent = nextStep;

    // 5️⃣ SELECTĂM ÎNTREBAREA DIN BACKEND
    let nextQuestion = "";

    switch (nextStep) {
      case 1:
        nextQuestion = "Perfect. Câte camere îți dorești?";
        break;
      case 2:
        nextQuestion = "Am notat. În ce zonă generală cauți? Nord, Sud, Est, Vest sau Oricare? Alege doar o zona generala, vei putea specifica o zona restransa la pasul urmator";
        break;
      case 3:
        nextQuestion = "Excelent. Ai o preferință pentru o zonă mai exactă?";
        break;
      case 4:
        nextQuestion = "Îți dorești un imobil nou?";
        break;
      case 5:
        nextQuestion = "Accepți și imobil vechi?";
        break;
      case 6:
        nextQuestion = "Care este anul minim de construcție acceptat?";
        break;
      case 7:
        nextQuestion = "Proprietatea este pentru locuit sau investiție?";
        break;
      case 8:
        nextQuestion = "Cât de urgentă este achiziția?";
        break;
      case 9:
        nextQuestion = "Modalitatea de plată este credit, surse proprii sau nu ai decis inca?";
        break;
      case 10:
        nextQuestion = "Ai alte preferințe importante? Poti specifica aici și alte preferințe.";
        break;
      case 11:
        nextQuestion = "Poți lăsa aici un mesaj suplimentar cu detalii.";
        break;
      default:
        nextQuestion =
          "Îți mulțumesc pentru informații 🙌 Le-am transmis deja către un consultant care te va contacta.";
        state.completat = true;
    }

    // 6️⃣ SALVARE
    await contactRef.update({
      preferencesCollected: state,
      preferencesChatHistory: FieldValue.arrayUnion(
        { role: "user", content: input.prompt },
        { role: "model", content: nextQuestion }
      ),
    });

    return {
      response: nextQuestion,
    };
  }
);
