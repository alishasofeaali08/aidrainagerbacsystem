import os
import re
import json
import base64
import requests

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()

# ==========================================
# GROQ CONFIGURATION
# ==========================================

URL = "https://api.groq.com/openai/v1/chat/completions"

MODELS = [
    model.strip()
    for model in os.getenv(
        "GROQ_MODELS",
        "qwen/qwen3.8-27b"
    ).split(",")
    if model.strip()
]

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

MAX_IMAGE_SIZE = 3_500_000

PROMPT = """
This is a photo of a Malaysian MyKad identity card.

Extract the following information:
1. Full name exactly as printed.
2. Malaysian IC number (12 digits).

Return ONLY valid JSON in this format:

{
    "name": "FULL NAME",
    "ic_number": "123456789012"
}

Rules:
- Do not guess unreadable information.
- Use an empty string if information cannot be read.
- Remove dashes from the IC number.
- If the image is not a Malaysian MyKad, return:
  {"name": "", "ic_number": ""}
"""


# ==========================================
# SCAN IC ENDPOINT
# ==========================================

@router.post("/auth/scan-ic")
async def scan_ic(image: UploadFile = File(...)):

    print("\n========== IC SCANNER ==========")

    # 1. Check API key
    key = os.getenv("GROQ_API_KEY")

    if not key:
        print("ERROR: GROQ_API_KEY is missing")

        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured"
        )

    # 2. Validate image format
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPG, PNG and WEBP images are supported"
        )

    # 3. Read image
    data = await image.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty"
        )

    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image too large. Maximum size is 3.5 MB"
        )

    print("Image received:", len(data), "bytes")
    print("Image type:", image.content_type)

    # 4. Convert image to Base64
    encoded_image = base64.b64encode(data).decode("utf-8")

    data_url = (
        f"data:{image.content_type};base64,{encoded_image}"
    )

    # 5. Try available Groq models
    result = None
    last_error = "No model succeeded"

    for model in MODELS:

        print("\nTrying Groq model:", model)

        payload = {
            "model": model,
            "temperature": 0,
            "max_tokens": 500,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": PROMPT
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url
                            }
                        }
                    ]
                }
            ]
        }

        try:

            response = requests.post(
                URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                },
                timeout=45
            )

            print("Groq HTTP status:", response.status_code)

            # Handle rate limits
            if response.status_code == 429:
                print("ERROR: Groq rate limit reached")

                raise HTTPException(
                    status_code=429,
                    detail="Groq is busy. Please try again later."
                )

            # Handle other API errors
            if response.status_code != 200:

                last_error = response.text[:1000]

                print("Groq API error:", last_error)

                continue

            # 6. Extract response
            response_data = response.json()

            content = (
                response_data["choices"][0]["message"]["content"]
            )

            if isinstance(content, list):
                content = " ".join(
                    item.get("text", "")
                    for item in content
                    if isinstance(item, dict)
                )

            if not content:
                last_error = "Groq returned an empty response"
                print(last_error)
                continue

            print("Groq response received successfully")

            # 7. Extract JSON
            match = re.search(
                r"\{[\s\S]*\}",
                content
            )

            if not match:
                last_error = "No JSON found in Groq response"
                print(last_error)
                continue

            result = json.loads(match.group(0))

            break

        except HTTPException:
            raise

        except requests.RequestException as error:

            last_error = str(error)

            print("Request error:", last_error)

        except (KeyError, ValueError, TypeError) as error:

            last_error = str(error)

            print("Response parsing error:", last_error)

        except Exception as error:

            last_error = str(error)

            print("Unexpected scanner error:", last_error)

    # 8. Check whether scanning succeeded
    if result is None:

        print("\nFINAL SCANNER ERROR:", last_error)
        print("================================\n")

        raise HTTPException(
            status_code=502,
            detail="Could not read the card. Check backend terminal for Groq error."
        )

    # 9. Clean extracted information
    name = str(result.get("name", "")).strip().upper()

    ic_number = re.sub(
        r"\D",
        "",
        str(result.get("ic_number", ""))
    )

    if len(ic_number) != 12:
        ic_number = ""

    print("IC scan completed")
    print("================================\n")

    # 10. Return result
    return {
        "name": name,
        "ic_number": ic_number
    }
