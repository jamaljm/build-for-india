import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Server configuration error: missing API key" },
      { status: 500 }
    );
  }

  let body: { image: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { image } = body;

  if (!image || typeof image !== "string") {
    return NextResponse.json(
      { success: false, error: "Missing or invalid image field" },
      { status: 400 }
    );
  }

  // Strip the data URL prefix if present to measure raw base64 size
  const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
  const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
  const maxSize = 5 * 1024 * 1024; // 5 MB

  if (sizeInBytes > maxSize) {
    return NextResponse.json(
      { success: false, error: "Image too large. Maximum size is 5MB." },
      { status: 400 }
    );
  }

  // Ensure the image has a proper data URL prefix for the API
  const imageUrl = image.startsWith("data:")
    ? image
    : `data:image/jpeg;base64,${image}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the following from this Aadhaar card image. Return ONLY valid JSON with no markdown formatting, no code fences, just the raw JSON object:
{
  "aadhaarNumber": "12-digit number with no spaces or dashes",
  "fullName": "full name of the card holder as printed in English",
  "fatherName": "father's name or guardian's name if printed (look for S/O, D/O, C/O labels)",
  "motherName": "mother's name if printed",
  "dob": "YYYY-MM-DD format",
  "gender": "male or female or other (lowercase)",
  "address": "full address as printed in English",
  "pincode": "6-digit PIN code"
}
If a field is not visible or readable, use null for its value. The card may have text in English, Hindi, or Malayalam — always extract the English version of each field. Note: Aadhaar cards often show "S/O" (son of) or "D/O" (daughter of) followed by the father's or guardian's name.`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `OpenAI Vision API error: ${response.status} ${response.statusText}`,
        errorBody
      );
      return NextResponse.json(
        { success: false, error: "Failed to process image" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: "No response from OCR" },
        { status: 502 }
      );
    }

    // Parse the JSON from the response, stripping any markdown code fences
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let extracted: Record<string, string | null>;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse OCR response as JSON:", content);
      return NextResponse.json(
        { success: false, error: "Could not parse extracted data" },
        { status: 502 }
      );
    }

    // Normalize fields
    if (extracted.aadhaarNumber) {
      extracted.aadhaarNumber = extracted.aadhaarNumber.replace(/[\s-]/g, "");
    }
    if (extracted.gender) {
      extracted.gender = extracted.gender.toLowerCase();
    }
    if (extracted.pincode) {
      extracted.pincode = extracted.pincode.replace(/\D/g, "");
    }

    return NextResponse.json({ success: true, data: extracted });
  } catch (error) {
    console.error("Error in /api/ocr:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
