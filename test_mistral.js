async function testMistral() {
    console.log('Testing Mistral model...');
    try {
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: 'Hello, say something.' }
                ],
                model: 'mistral'
            })
        });

        if (!response.ok) {
            console.error('Response not ok:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response body:', text);
            return;
        }

        const text = await response.text();
        console.log('Raw response:', text);

        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response is not JSON');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testMistral();
