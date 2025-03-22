const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

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
      timeout: 5000 // 5 seconds timeout
    });

    // Log the upstream API's response for debugging
    console.log("Upstream API response:", response.data);

    // Check if the response contains the expected field
    if (!response.data || !response.data.answer) {
      throw new Error("Invalid response from upstream API: Missing 'answer' field");
    }

    // Transform the response to match OpenAI's chat/completions format
    const openaiResponse = {
      id: "chatcmpl-12345",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model || "gpt-4o", // Use the requested model or default to "gpt-4o"
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: response.data.answer // Use the upstream API's answer
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: userMessage.content.split(' ').length,
        completion_tokens: response.data.answer.split(' ').length,
        total_tokens: userMessage.content.split(' ').length + response.data.answer.split(' ').length
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
