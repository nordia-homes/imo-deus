import { NextResponse } from "next/server";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // The SDK will automatically use Google Application Default Credentials
      // on Google Cloud environments.
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

const db = admin.firestore();

export async function GET() {
  try {
    const snapshot = await db
      .collection("ownerListings")
      .orderBy("postedAt", "desc")
      .limit(100)
      .get();

    if (snapshot.empty) {
      console.log("No documents found in ownerListings collection.");
      return NextResponse.json([]);
    }

    const listings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(listings);
  } catch (error: any) {
    console.error("API Route /api/owner-listings Error:", error);
    return NextResponse.json(
      { error: `Error fetching from Firestore: ${error.message}` },
      { status: 500 }
    );
  }
}
