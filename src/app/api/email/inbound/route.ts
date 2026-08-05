import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/firebase/admin';
import type { SaleEmailMessage, SaleTransaction } from '@/lib/types';
import { processSalesDocument } from '@/lib/sales-document-processing';
import { appendSalesAudit } from '@/lib/sales-server';
import {
  extractInboundToken,
  extractSaleTrackingCode,
  hashInboundToken,
  mapAnswersToQuestions,
  mergeReceivedDocuments,
  stripQuotedReply,
} from '@/lib/sales-inbound';

export const runtime = 'nodejs';

type InboundAttachment = { name: string; type: string; bytes: Buffer };
type InboundPayload = {
  recipient: string;
  sender: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  providerMessageId: string;
  attachments: InboundAttachment[];
};

function jsonString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

async function parsePayload(request: NextRequest): Promise<InboundPayload> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json() as Record<string, unknown>;
    const attachments = Array.isArray(body.attachments) ? body.attachments.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Record<string, unknown>;
      const data = jsonString(item.base64 || item.data);
      if (!data) return [];
      return [{ name: jsonString(item.name || item.filename) || 'document', type: jsonString(item.type) || 'application/octet-stream', bytes: Buffer.from(data, 'base64') }];
    }) : [];
    return {
      recipient: jsonString(body.recipient || body.to),
      sender: jsonString(body.sender || body.from),
      subject: jsonString(body.subject),
      bodyText: jsonString(body.bodyText || body.text || body['body-plain']),
      bodyHtml: jsonString(body.bodyHtml || body.html || body['body-html']),
      providerMessageId: jsonString(body.messageId || body['Message-Id']) || crypto.randomUUID(),
      attachments,
    };
  }
  const form = await request.formData();
  const known = new Set(['recipient', 'to', 'sender', 'from', 'subject', 'body-plain', 'body-html', 'text', 'html', 'Message-Id', 'messageId']);
  const attachments: InboundAttachment[] = [];
  for (const [key, value] of form.entries()) {
    if (known.has(key) || typeof value === 'string') continue;
    attachments.push({ name: value.name || key, type: value.type || 'application/octet-stream', bytes: Buffer.from(await value.arrayBuffer()) });
  }
  const field = (...keys: string[]) => keys.map((key) => form.get(key)).find((value) => typeof value === 'string') as string | undefined;
  return {
    recipient: field('recipient', 'to') || '',
    sender: field('sender', 'from') || '',
    subject: field('subject') || '',
    bodyText: field('body-plain', 'text') || '',
    bodyHtml: field('body-html', 'html') || '',
    providerMessageId: field('Message-Id', 'messageId') || crypto.randomUUID(),
    attachments,
  };
}

function safeFileName(value: string) {
  return value.normalize('NFKD').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140) || 'document';
}

async function saveAttachment(agencyId: string, saleId: string, messageId: string, attachment: InboundAttachment, settings: { ocrEnabled?: boolean; malwareScanRequired?: boolean }) {
  const analysis = await processSalesDocument({
    bytes: attachment.bytes,
    fileName: attachment.name,
    contentType: attachment.type,
    forceOcr: settings.ocrEnabled === true,
    requireMalwareScanner: settings.malwareScanRequired === true,
  });
  if (!analysis.allowed) {
    return { accepted: false as const, fileName: attachment.name, analysis };
  }
  const token = crypto.randomUUID();
  const objectPath = `agencies/${agencyId}/sales/${saleId}/inbound/${messageId}/${safeFileName(attachment.name)}`;
  const file = adminStorage.bucket().file(objectPath);
  await file.save(attachment.bytes, {
    resumable: false,
    contentType: analysis.detectedContentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const bucket = adminStorage.bucket().name;
  return {
    accepted: true as const,
    fileName: attachment.name,
    downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`,
    storagePath: objectPath,
    receivedAt: new Date().toISOString(),
    contentType: analysis.detectedContentType,
    sizeBytes: attachment.bytes.length,
    checksumSha256: analysis.checksumSha256,
    scanStatus: analysis.scanStatus,
    scanProvider: analysis.scanProvider,
    scanMessage: analysis.scanMessage,
    ocrStatus: analysis.ocrStatus,
    extractedTextPreview: analysis.extractedTextPreview,
    classification: analysis.classification,
    classificationConfidence: analysis.classificationConfidence,
    qualityScore: analysis.qualityScore,
    expiresAt: analysis.expiresAt,
    duplicateOfDocumentId: null as string | null,
  };
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.EMAIL_INBOUND_WEBHOOK_SECRET;
  if ((!expectedSecret && process.env.NODE_ENV === 'production') || (expectedSecret && request.headers.get('x-imodeus-inbound-secret') !== expectedSecret)) {
    return NextResponse.json({ message: expectedSecret ? 'Webhook neautorizat.' : 'Webhook inbound neconfigurat.' }, { status: expectedSecret ? 401 : 503 });
  }
  try {
    const payload = await parsePayload(request);
    const totalAttachmentBytes = payload.attachments.reduce((total, attachment) => total + attachment.bytes.length, 0);
    if (payload.attachments.length > 12 || totalAttachmentBytes > 25 * 1024 * 1024 || payload.attachments.some((attachment) => attachment.bytes.length > 15 * 1024 * 1024)) {
      return NextResponse.json({ message: 'Atașamentele depășesc limita acceptată.' }, { status: 413 });
    }
    const inboundToken = extractInboundToken(payload.recipient);
    if (!inboundToken) return NextResponse.json({ message: 'Destinatar inbound necunoscut.' }, { status: 400 });
    const aliasSnapshot = await adminDb.collection('emailInboundAliases').doc(hashInboundToken(inboundToken)).get();
    if (!aliasSnapshot.exists || aliasSnapshot.data()?.active === false) return NextResponse.json({ message: 'Alias inactiv.' }, { status: 404 });
    const alias = aliasSnapshot.data() as { agencyId: string; ownerUid: string; connectionPath: string };
    const connectionRef = adminDb.doc(alias.connectionPath);

    if (/forwarding confirmation|confirmare.*redirec|verificare.*redirec/i.test(payload.subject)) {
      const verificationCode = payload.bodyText.match(/\b\d{8,20}\b/)?.[0] || null;
      await connectionRef.set({
        status: 'verification_received',
        verificationCode,
        verificationMessageReceivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return NextResponse.json({ accepted: true, type: 'gmail_verification' });
    }

    const trackingCode = extractSaleTrackingCode(payload.subject);
    if (!trackingCode) {
      await connectionRef.set({ lastUnmatchedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ accepted: true, matched: false });
    }
    const saleQuery = await adminDb.collection('agencies').doc(alias.agencyId).collection('sales').where('trackingCode', '==', trackingCode).limit(1).get();
    if (saleQuery.empty) return NextResponse.json({ accepted: true, matched: false });
    const saleSnapshot = saleQuery.docs[0];
    const sale = { id: saleSnapshot.id, ...saleSnapshot.data() } as SaleTransaction;
    const messageHash = crypto.createHash('sha256').update(`${payload.providerMessageId}|${payload.sender}|${payload.subject}`).digest('hex');
    const messageRef = saleSnapshot.ref.collection('emailMessages').doc(messageHash.slice(0, 40));
    if ((await messageRef.get()).exists) return NextResponse.json({ accepted: true, duplicate: true });

    const recentMessages = await saleSnapshot.ref.collection('emailMessages').orderBy('createdAt', 'desc').limit(25).get();
    const outboundSnapshot = recentMessages.docs.find((candidate) => candidate.data().direction === 'outbound') || null;
    const outbound = outboundSnapshot ? outboundSnapshot.data() as SaleEmailMessage : null;
    const cleanReply = stripQuotedReply(payload.bodyText);
    const questions = outbound?.questions ? mapAnswersToQuestions(outbound.questions, cleanReply) : [];
    const settingsSnapshot = await adminDb.collection('agencies').doc(alias.agencyId).collection('salesSettings').doc('default').get();
    const salesSettings = settingsSnapshot.data() || {};
    const processedFiles = await Promise.all(payload.attachments.map((attachment) => saveAttachment(alias.agencyId, sale.id, messageRef.id, attachment, salesSettings)));
    const savedFiles = processedFiles.filter((file): file is Extract<typeof file, { accepted: true }> => file.accepted);
    const knownChecksums = new Map((sale.checklist || []).filter((item) => item.checksumSha256).map((item) => [item.checksumSha256 as string, item.id]));
    for (const file of savedFiles) {
      file.duplicateOfDocumentId = knownChecksums.get(file.checksumSha256) || null;
      if (!file.duplicateOfDocumentId) knownChecksums.set(file.checksumSha256, `incoming:${file.fileName}`);
    }
    const rejectedFiles = processedFiles.filter((file) => !file.accepted);
    const senderEmail = payload.sender.match(/<([^>]+)>/)?.[1] || payload.sender;
    const senderRole = sale.participants.find((participant) => participant.email.toLowerCase() === senderEmail.trim().toLowerCase())?.role;
    const checklist = mergeReceivedDocuments(sale, savedFiles, senderRole === 'owner' ? 'owner' : 'buyer');
    const now = new Date().toISOString();
    const inboundMessage: Omit<SaleEmailMessage, 'id'> = {
      saleId: sale.id,
      agencyId: alias.agencyId,
      direction: 'inbound',
      status: 'replied',
      trackingCode,
      fromName: payload.sender,
      fromEmail: senderEmail,
      to: [payload.recipient],
      subject: payload.subject,
      bodyText: cleanReply,
      bodyHtml: payload.bodyHtml || null,
      questions,
      attachmentNames: savedFiles.map((file) => file.fileName),
      providerMessageId: payload.providerMessageId,
      createdByUid: null,
      createdAt: now,
      receivedAt: now,
      updatedAt: now,
      relatedOutboundMessageId: outboundSnapshot?.id || null,
      replyReview: {
        status: 'pending',
        reviewedByUid: null,
        reviewedAt: null,
        note: rejectedFiles.length ? `${rejectedFiles.length} fișier(e) respinse automat de politica de securitate.` : null,
      },
    };
    const batch = adminDb.batch();
    batch.set(messageRef, inboundMessage);
    if (outboundSnapshot) {
      batch.set(outboundSnapshot.ref, {
        status: 'replied',
        questions,
        sendEvidence: {
          level: 'reply_confirmed',
          source: 'inbound_reply',
          observedAt: now,
          observedByUid: null,
          details: 'Existența răspunsului confirmă că mesajul inițial a fost trimis și recepționat.',
        },
        updatedAt: now,
      }, { merge: true });
    }
    batch.set(saleSnapshot.ref, {
      checklist,
      lastCommunicationAt: now,
      unreadReplyCount: FieldValue.increment(1),
      pendingReviewCount: FieldValue.increment(1),
      receivedDocumentCount: checklist.filter((item) => ['received_needs_review', 'verified'].includes(item.status)).length,
      updatedAt: now,
    }, { merge: true });
    batch.set(connectionRef, { status: 'connected', lastForwardedAt: now, updatedAt: now }, { merge: true });
    batch.set(saleSnapshot.ref.collection('activity').doc(), {
      type: savedFiles.length ? 'email_reply_with_documents' : 'email_reply',
      messageId: messageRef.id,
      sender: payload.sender,
      attachmentCount: savedFiles.length,
      rejectedAttachmentCount: rejectedFiles.length,
      createdAt: now,
    });
    const audit = appendSalesAudit(adminDb, saleSnapshot.ref, {
      agencyId: alias.agencyId,
      saleId: sale.id,
      actorUid: null,
      actorType: 'system',
      action: 'reply.received',
      entityType: 'message',
      entityId: messageRef.id,
      summary: savedFiles.length ? 'Răspuns primit cu documente' : 'Răspuns primit',
      metadata: { attachmentCount: savedFiles.length, rejectedAttachmentCount: rejectedFiles.length },
    });
    batch.set(audit.ref, audit.data);
    batch.set(adminDb.collection('emailInboundEvents').doc(), {
      agencyId: alias.agencyId,
      saleId: sale.id,
      connectionPath: alias.connectionPath,
      status: rejectedFiles.length ? 'accepted_with_rejections' : 'accepted',
      attachmentCount: savedFiles.length,
      rejectedAttachmentCount: rejectedFiles.length,
      providerMessageIdHash: crypto.createHash('sha256').update(payload.providerMessageId).digest('hex'),
      createdAt: now,
    });
    await batch.commit();
    return NextResponse.json({ accepted: true, matched: true, saleId: sale.id, attachmentCount: savedFiles.length, rejectedAttachmentCount: rejectedFiles.length });
  } catch (error) {
    console.error('Inbound sales email failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Emailul inbound nu a putut fi procesat.' }, { status: 500 });
  }
}
