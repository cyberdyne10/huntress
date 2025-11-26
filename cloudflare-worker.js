// Cloudflare Worker Script for Gemini API Proxy

// --- Deployment Instructions ---
// 1. Create a new Cloudflare Worker.
// 2. Paste this entire script into the worker's editor.
// 3. Go to the worker's settings page -> Variables.
// 4. Add a new secret variable named `GEMINI_API_KEY` and paste your Google Gemini API key into the value field.
// 5. Deploy the worker.
// 6. Update the `API_URL` in your frontend `gemini_chat.js` to point to this worker's URL.

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export default {
    async fetch(request, env) {
        // Only allow POST requests
        if (request.method !== 'POST') {
            return new Response('Expected POST', { status: 405 });
        }

        // Forward the request to the Gemini API
        try {
            const requestBody = await request.json();

            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': env.GEMINI_API_KEY, // Use the secret key
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            // Return the Gemini API's response to the frontend
            return new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (error) {
            return new Response(`Error forwarding request: ${error}`, { status: 500 });
        }
    },
};
