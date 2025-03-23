const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins (or specify your client's origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Function to generate a unique ID
function generateUniqueId() {
  const timestamp = Date.now().toString(36); // Convert timestamp to base-36 string
  const random = Math.random().toString(36).substring(2, 8); // Random string
  return `chatcmpl-${timestamp}-${random}`; // Combine timestamp and random string
}

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature } = req.body;

    // Extract the user's message (last message in the array)
    const userMessage = messages.find(msg => msg.role === 'user');
    if (!userMessage) {
      throw new Error("No user message found in the request");
    }

    // Call the upstream API with the user's message
    const response = await axios.post('https://api-provider-b5s7.onrender.com/api/answer', {
      prompt: userMessage.content,
      model: model
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 55000 // 55 seconds timeout
    });

    // Log the upstream API's response for debugging
    console.log("Upstream API response:", response.data);

    // Check if the response contains the expected field
    if (!response.data || !response.data.answer) {
      throw new Error("Invalid response from upstream API: Missing 'answer' field");
    }

    // Generate a unique ID for the response
    const responseId = generateUniqueId();

    // Transform the response to match OpenAI's chat/completions format
    const openaiResponse = {
      id: responseId, // Unique ID for the response
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000), // Current timestamp
      model: model || "gpt-4o", // Use the requested model or default to "gpt-4o"
      system_fingerprint: "fp_d64a2bdd8a65", // Static system fingerprint (can be customized)
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: response.data.answer // Use the upstream API's answer
          },
          finish_reason: "stop" // Static finish reason
        }
      ],
      usage: {
        prompt_tokens: userMessage.content.split(' ').length, // Approximate token count
        completion_tokens: response.data.answer.split(' ').length, // Approximate token count
        total_tokens: userMessage.content.split(' ').length + response.data.answer.split(' ').length // Total tokens
      }
    };

    // Send the transformed response
    res.status(200).json(openaiResponse);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
